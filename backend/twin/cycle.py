"""
Integrated CSS + SRP Cycle Simulation Engine.

Simulates the complete well-to-surface chain:
Reservoir Heat -> Viscosity Response -> Thermal Inflow -> SRP Hydraulics -> Rod Float Dynamics -> Surface Energy

PROVENANCE: SIMULATED (Transparent physical models chained together).
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import numpy as np

from .thermal.css_model import CSSThermalModel, CSSThermalParameters, CSSThermalState
from .fluid.viscosity import AndradeViscosityModel, BaghewalaViscosityParameters
from .fluid.density import FluidDensityModel
from .fluid.fluid_properties import FluidPropertiesManager
from .reservoir.inflow import ThermalInflowModel, ReservoirParameters
from .reservoir.production import ProductionHydraulicsModel
from .srp.rod_string import RodStringModel
from .srp.float_detection import RodFloatDetector, FloatAnalysisResult
from .srp.pump import DownholePumpModel, PumpState
from .srp.dynacard import GibbsDynacardModel, DynacardResult
from .srp.motor import SRPMotorModel, MotorEnergyResult
from .surface.steam_system import SteamGeneratorModel
from .surface.energy import FieldEnergyAccounting, EnergyKPIs

@dataclass
class CycleConfig:
    # Well Identification
    well_id: str = "BGW-01"
    cycle_number: int = 1
    
    # CSS Parameters
    steam_volume_tonnes: float = 3000.0
    injection_duration_days: float = 15.0
    injection_pressure_bar: float = 125.0
    steam_temp_celsius: float = 260.0
    steam_quality_wellhead: float = 0.80
    soak_duration_days: float = 6.0
    
    # Production Duration & Cutoff
    production_duration_days: float = 90.0
    economic_cutoff_oil_rate_bpd: float = 12.0 # Explicit decision variable
    
    # SRP Operating Parameters
    spm: float = 4.5
    stroke_length_inch: float = 100.0
    pump_bore_inch: float = 2.25
    vfd_downstroke_ratio: float = 1.0          # < 1.0 slows downstroke to avoid rod float
    
    # Well Depth & Geometry
    pump_depth_m: float = 980.0
    well_tvd_m: float = 1050.0
    reservoir_pressure_bar: float = 65.0
    
    # Seeded cooling anomaly event for demonstration
    cooling_anomaly_day: Optional[int] = None
    cooling_anomaly_severity_pct: float = 0.0

@dataclass
class DailyTimeseriesPoint:
    day: int
    cycle_phase: str                    # "INJECTION", "SOAK", "PRODUCTION"
    temperature_c: float
    viscosity_cp: float
    oil_rate_bpd: float
    water_rate_bpd: float
    cumulative_oil_bbl: float
    flowing_bottomhole_pressure_bar: float
    pump_intake_pressure_bar: float
    float_margin_index: float
    is_rod_floating: bool
    goodman_stress_ratio: float
    pump_fillage_pct: float
    daily_electricity_kwh: float
    asphaltene_risk_score: float

@dataclass
class CycleSimulationResult:
    well_id: str
    cycle_number: int
    config: CycleConfig
    daily_history: List[DailyTimeseriesPoint]
    kpis: EnergyKPIs
    final_dynacard: DynacardResult
    total_oil_produced_bbl: float
    total_water_produced_bbl: float
    total_steam_tonnes: float
    total_electricity_kwh: float
    steam_oil_ratio: float
    total_float_events_count: int
    max_goodman_stress_ratio: float
    average_pump_fillage_pct: float
    production_cutoff_day_actual: int
    cutoff_triggered: bool
    provenance: str = "SIMULATED"

class CSSCycleSimulator:
    """Orchestrates the physics simulation of a complete CSS cycle with SRP lifting."""

    def __init__(self, config: CycleConfig = None):
        self.config = config or CycleConfig()
        
        # Initialize component models
        thermal_params = CSSThermalParameters(
            steam_volume_tonnes=self.config.steam_volume_tonnes,
            injection_duration_days=self.config.injection_duration_days,
            injection_pressure_bar=self.config.injection_pressure_bar,
            steam_temp_celsius=self.config.steam_temp_celsius,
            steam_quality_wellhead=self.config.steam_quality_wellhead,
            soak_duration_days=self.config.soak_duration_days
        )
        self.thermal_model = CSSThermalModel(thermal_params)
        self.fluid_mgr = FluidPropertiesManager()
        self.res_params = ReservoirParameters(initial_pressure_bar=self.config.reservoir_pressure_bar)
        self.inflow_model = ThermalInflowModel(self.res_params)
        self.hydraulics_model = ProductionHydraulicsModel(
            pump_depth_m=self.config.pump_depth_m,
            well_tvd_m=self.config.well_tvd_m
        )
        self.rod_model = RodStringModel(pump_depth_m=self.config.pump_depth_m)
        self.float_detector = RodFloatDetector(
            pump_depth_m=self.config.pump_depth_m,
            submerged_weight_lbs=self.rod_model.compute_submerged_weight_lbs(1010.0)
        )
        self.pump_model = DownholePumpModel(pump_bore_diameter_inch=self.config.pump_bore_inch)
        self.dynacard_model = GibbsDynacardModel()
        self.motor_model = SRPMotorModel()
        self.steam_model = SteamGeneratorModel()
        self.energy_accounting = FieldEnergyAccounting()

    def run_simulation(self) -> CycleSimulationResult:
        """Executes full forward simulation across injection, soak, and production phases."""
        cfg = self.config
        
        # 1. Thermal Injection
        inj_state = self.thermal_model.simulate_injection_end()
        steam_res = self.steam_model.evaluate_generation(
            steam_mass_tonnes=cfg.steam_volume_tonnes,
            steam_temp_celsius=cfg.steam_temp_celsius,
            steam_quality=cfg.steam_quality_wellhead
        )
        
        # 2. Soak Period
        soak_state = self.thermal_model.simulate_soak_end(inj_state)
        
        # 3. Production Phase
        timeseries: List[DailyTimeseriesPoint] = []
        cum_oil_bbl = 0.0
        cum_water_bbl = 0.0
        total_kwh = 0.0
        float_events = 0
        fillage_history = []
        max_goodman = 0.0
        
        current_temp = soak_state.average_temperature_c
        p_res = cfg.reservoir_pressure_bar
        
        # Declining cycle effect for multi-cycle simulations (Cycle 2, 3, etc.)
        cycle_decay = max(0.60, 1.0 - (cfg.cycle_number - 1) * 0.08)
        
        # Track daily production
        actual_cutoff_day = int(cfg.production_duration_days)
        cutoff_triggered = False
        latest_dynacard = None
        
        submerged_rod_wt = self.rod_model.compute_submerged_weight_lbs(1010.0)
        
        for d in range(1, int(cfg.production_duration_days) + 1):
            # Check for seeded cooling anomaly event
            if cfg.cooling_anomaly_day is not None and d >= cfg.cooling_anomaly_day:
                cooling_drop = 15.0 * (1.0 + cfg.cooling_anomaly_severity_pct)
                current_temp = max(47.0, current_temp - 0.5 * cooling_drop)
            
            # Fluid state at current downhole temperature
            fluid_state = self.fluid_mgr.evaluate_state(current_temp)
            visc_cp = fluid_state.viscosity_cp
            
            # Reservoir Inflow state (evaluated at bottomhole temperature)
            res_state = self.inflow_model.evaluate_reservoir_state(
                current_temp_c=current_temp,
                current_viscosity_cp=visc_cp,
                reservoir_pressure_bar=p_res
            )
            
            # Wellbore temperature along rod string: fluid cools as it rises toward surface (32-35C ambient)
            surface_fluid_temp = max(33.0, 32.0 + (current_temp - 32.0) * 0.40)
            rod_effective_temp = (current_temp + surface_fluid_temp) / 2.0
            rod_fluid_state = self.fluid_mgr.evaluate_state(rod_effective_temp)
            rod_visc_cp = rod_fluid_state.viscosity_cp
            
            # Compute drawdown & liquid inflow rate
            # SRP capacity at current SPM:
            disp_bpd, disp_m3 = self.pump_model.compute_displacement(cfg.spm, cfg.stroke_length_inch)
            
            # Target liquid rate limited by pump displacement or reservoir open-flow:
            potential_oil_m3 = res_state.q_max_oil_m3_d * 0.85 * cycle_decay
            potential_oil_bpd = potential_oil_m3 * 6.2898
            
            water_cut = self.hydraulics_model.compute_water_cut(d, int(cfg.production_duration_days))
            potential_liquid_bpd = potential_oil_bpd / (1.0 - water_cut)
            
            # Actual liquid lifted by pump:
            actual_liquid_bpd = min(disp_bpd * 0.95, potential_liquid_bpd)
            actual_oil_bpd = actual_liquid_bpd * (1.0 - water_cut)
            actual_water_bpd = actual_liquid_bpd - actual_oil_bpd
            actual_oil_m3 = actual_oil_bpd / 6.2898
            actual_liquid_m3 = actual_liquid_bpd / 6.2898

            # Invert Vogel to find required bottomhole pressure:
            pwf_bar = self.inflow_model.compute_pwf_from_target_rate(res_state, actual_oil_m3)
            day_hydraulics = self.hydraulics_model.evaluate_day(
                day=d,
                target_oil_rate_m3_d=actual_oil_m3,
                water_cut_fraction=water_cut,
                mixture_density_kg_m3=fluid_state.mixture_density_kg_m3,
                pwf_bar=pwf_bar
            )
            
            # Evaluate pump fillage and fluid pound
            pump_state = self.pump_model.evaluate_pump_operation(
                spm=cfg.spm,
                stroke_length_inch=cfg.stroke_length_inch,
                inflow_liquid_rate_m3_d=actual_liquid_m3,
                pump_intake_pressure_bar=day_hydraulics.pump_intake_pressure_bar,
                wellhead_pressure_bar=5.0,
                pump_depth_m=cfg.pump_depth_m,
                fluid_density_kg_m3=fluid_state.mixture_density_kg_m3
            )
            fillage_history.append(pump_state.pump_fillage_fraction * 100.0)
            
            # Evaluate Rod Float Margin!
            float_res = self.float_detector.evaluate_float_margin(
                spm=cfg.spm,
                stroke_length_inch=cfg.stroke_length_inch,
                viscosity_cp=rod_visc_cp,
                fluid_pound_severity=pump_state.fluid_pound_severity,
                vfd_downstroke_ratio=cfg.vfd_downstroke_ratio
            )
            if float_res.is_rod_floating:
                float_events += 1
                
            # Synthesize dynacard for this operating point
            dynacard = self.dynacard_model.generate_dynacards(
                stroke_length_inch=cfg.stroke_length_inch,
                spm=cfg.spm,
                submerged_rod_weight_lbs=submerged_rod_wt,
                plunger_fluid_load_lbs=pump_state.plunger_fluid_load_lbs,
                viscosity_cp=rod_visc_cp,
                pump_fillage=pump_state.pump_fillage_fraction,
                float_margin_index=float_res.float_margin_index,
                vfd_downstroke_ratio=cfg.vfd_downstroke_ratio
            )
            latest_dynacard = dynacard
            
            # Evaluate rod string Goodman stress
            stress_res = self.rod_model.evaluate_goodman_stress(
                peak_polished_rod_load_lbs=dynacard.peak_polished_rod_load_lbs,
                min_polished_rod_load_lbs=dynacard.min_polished_rod_load_lbs
            )
            if stress_res.goodman_stress_ratio > max_goodman:
                max_goodman = stress_res.goodman_stress_ratio
                
            # Evaluate motor electrical energy
            motor_res = self.motor_model.evaluate_energy(
                card_work_in_lbs=dynacard.card_area_in_lbs,
                spm=cfg.spm,
                liquid_rate_bpd=actual_liquid_bpd,
                peak_gearbox_torque_in_lbs=dynacard.peak_gearbox_torque_in_lbs
            )
            total_kwh += motor_res.daily_electricity_kwh

            # Accumulate production
            cum_oil_bbl += actual_oil_bpd
            cum_water_bbl += actual_water_bpd

            # Record daily timeseries
            timeseries.append(DailyTimeseriesPoint(
                day=d,
                cycle_phase="PRODUCTION",
                temperature_c=round(current_temp, 2),
                viscosity_cp=round(visc_cp, 1),
                oil_rate_bpd=round(actual_oil_bpd, 1),
                water_rate_bpd=round(actual_water_bpd, 1),
                cumulative_oil_bbl=round(cum_oil_bbl, 1),
                flowing_bottomhole_pressure_bar=day_hydraulics.flowing_bottomhole_pressure_bar,
                pump_intake_pressure_bar=day_hydraulics.pump_intake_pressure_bar,
                float_margin_index=float_res.float_margin_index,
                is_rod_floating=float_res.is_rod_floating,
                goodman_stress_ratio=stress_res.goodman_stress_ratio,
                pump_fillage_pct=round(pump_state.pump_fillage_fraction * 100.0, 1),
                daily_electricity_kwh=motor_res.daily_electricity_kwh,
                asphaltene_risk_score=fluid_state.asphaltene_risk_score
            ))

            # Temperature decay for next day (Boberg-Lantz step)
            # Fluid heat extraction + caprock conduction cools the reservoir
            cooling_rate = 0.025 + (actual_liquid_m3 / 100.0) * 0.015
            delta_t = current_temp - 47.0 # Baghewala base temp
            current_temp = max(47.0, current_temp - delta_t * cooling_rate)

            # Check Economic Cutoff Decision Variable
            if actual_oil_bpd < cfg.economic_cutoff_oil_rate_bpd and d >= 15:
                actual_cutoff_day = d
                cutoff_triggered = True
                break

        # Compute final cycle KPIs
        kpis = self.energy_accounting.compute_cycle_kpis(
            steam_mass_tonnes=cfg.steam_volume_tonnes,
            steam_cost_usd=steam_res.steam_generation_cost_usd,
            cumulative_oil_bbl=cum_oil_bbl,
            cumulative_water_bbl=cum_water_bbl,
            total_pumping_kwh=total_kwh,
            cycle_duration_days=actual_cutoff_day + cfg.injection_duration_days + cfg.soak_duration_days
        )

        avg_fillage = float(np.mean(fillage_history)) if fillage_history else 100.0

        return CycleSimulationResult(
            well_id=cfg.well_id,
            cycle_number=cfg.cycle_number,
            config=cfg,
            daily_history=timeseries,
            kpis=kpis,
            final_dynacard=latest_dynacard or self.dynacard_model.generate_dynacards(100.0, 4.0, 5000.0, 4000.0, 500.0),
            total_oil_produced_bbl=round(cum_oil_bbl, 1),
            total_water_produced_bbl=round(cum_water_bbl, 1),
            total_steam_tonnes=cfg.steam_volume_tonnes,
            total_electricity_kwh=round(total_kwh, 1),
            steam_oil_ratio=kpis.steam_oil_ratio_tonne_tonne,
            total_float_events_count=float_events,
            max_goodman_stress_ratio=round(max_goodman, 3),
            average_pump_fillage_pct=round(avg_fillage, 1),
            production_cutoff_day_actual=actual_cutoff_day,
            cutoff_triggered=cutoff_triggered,
            provenance="SIMULATED"
        )
