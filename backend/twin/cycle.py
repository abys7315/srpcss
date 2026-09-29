"""
Integrated CSS + SRP Cycle Simulation Engine.

Simulates the genuinely coupled well-to-surface digital twin chain:
Steam Injection (Marx-Langenheim)
    ↓
Soak Thermal Diffusion
    ↓
Reservoir State & Pressure Balance (Depletion + Steam Support)
    ↓
Boberg-Lantz Production Thermal Decline
    ↓
Temperature-Dependent Oil Viscosity (Andrade) & Mobility
    ↓
Thermal Inflow (Vogel/Darcy Inflow Performance)
    ↓
Wellbore Thermal & Multiphase Hydraulics
    ↓
SRP Lifting & Annular Viscous Shear Drag (Stokes-Couette)
    ↓
Rod Float Margin Dynamics & Impact Shock Detection
    ↓
Gibbs-Inspired Dynacard & Mechanical Stress Analysis
    ↓
Surface Motor Electrical Energy & Economic KPIs

PROVENANCE: SIMULATED (Transparent physical models coupled through state variables).
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import numpy as np

from .thermal.css_model import CSSThermalModel, CSSThermalParameters, CSSThermalState
from .fluid.viscosity import AndradeViscosityModel, BaghewalaViscosityParameters
from .fluid.density import FluidDensityModel
from .fluid.fluid_properties import FluidPropertiesManager
from .reservoir.inflow import ThermalInflowModel, ReservoirParameters
from .reservoir.pressure import ReservoirPressureModel, ReservoirPressureParameters
from .reservoir.production import ProductionHydraulicsModel
from .wellbore.wellbore_1d import Wellbore1DModel, WellboreProfile1D, RodDragResult
from .wellbore.temperature import WellboreTemperatureModel
from .wellbore.pressure import WellboreHydraulicsModel
from .wellbore.heat_transfer import WellboreHeatTransferModel
from .srp.rod_string import RodStringModel
from .srp.float_detection import RodFloatDetector, FloatAnalysisResult
from .srp.pump import DownholePumpModel, PumpState
from .srp.dynacard import GibbsDynacardModel, DynacardResult
from .srp.motor import SRPMotorModel, MotorEnergyResult
from .surface.steam_system import SteamGeneratorModel
from .surface.energy import FieldEnergyAccounting, EnergyKPIs
from .state import DigitalTwinState

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
    economic_cutoff_oil_rate_bpd: float = 8.0 # Explicit decision variable
    
    # SRP Operating Parameters
    spm: float = 4.5
    stroke_length_inch: float = 100.0
    pump_bore_inch: float = 2.25
    vfd_downstroke_ratio: float = 1.0          # < 1.0 slows downstroke to avoid rod float
    
    # Well Depth & Geometry
    pump_depth_m: float = 980.0
    well_tvd_m: float = 1050.0
    reservoir_pressure_bar: float = 65.0
    
    # Cumulative historical production prior to this cycle (for multi-cycle depletion)
    cumulative_prior_oil_produced_m3: float = 0.0
    
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
    reservoir_pressure_bar: float = 65.0
    flowing_bottomhole_pressure_bar: float = 0.0
    pump_intake_pressure_bar: float = 0.0
    wellhead_pressure_bar: float = 5.0
    wellhead_pressure_provenance: str = "ASSUMED / SCENARIO INPUT"
    float_margin_index: float = 1.0
    is_rod_floating: bool = False
    goodman_stress_ratio: float = 0.5
    pump_fillage_pct: float = 80.0
    daily_electricity_kwh: float = 0.0
    asphaltene_risk_score: float = 0.0

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
    states: List[DigitalTwinState] = field(default_factory=list)
    latest_wellbore_profile: Optional[WellboreProfile1D] = None


class CSSCycleSimulator:
    """Orchestrates the physics simulation of a complete CSS cycle with SRP lifting."""

    def __init__(self, config: CycleConfig = None):
        self.config = config or CycleConfig()
        
        # 1. Thermal Injection & Soak Models
        thermal_params = CSSThermalParameters(
            steam_volume_tonnes=self.config.steam_volume_tonnes,
            injection_duration_days=self.config.injection_duration_days,
            injection_pressure_bar=self.config.injection_pressure_bar,
            steam_temp_celsius=self.config.steam_temp_celsius,
            steam_quality_wellhead=self.config.steam_quality_wellhead,
            soak_duration_days=self.config.soak_duration_days
        )
        self.thermal_model = CSSThermalModel(thermal_params)
        
        # 2. Fluid & Reservoir Models
        self.fluid_mgr = FluidPropertiesManager()
        self.res_pressure_model = ReservoirPressureModel(
            ReservoirPressureParameters(initial_pressure_bar=self.config.reservoir_pressure_bar)
        )
        self.res_params = ReservoirParameters(initial_pressure_bar=self.config.reservoir_pressure_bar)
        self.inflow_model = ThermalInflowModel(self.res_params)
        
        # 3. Wellbore Thermal & Multiphase Hydraulics Models
        self.wellbore_1d = Wellbore1DModel(well_tvd_m=self.config.well_tvd_m, pump_depth_m=self.config.pump_depth_m)
        self.wellbore_temp_model = WellboreTemperatureModel()
        self.wellbore_hydraulics_model = WellboreHydraulicsModel(depth_m=self.config.well_tvd_m)
        self.wellbore_heat_transfer = WellboreHeatTransferModel(well_depth_m=self.config.well_tvd_m)
        self.hydraulics_model = ProductionHydraulicsModel(
            pump_depth_m=self.config.pump_depth_m,
            well_tvd_m=self.config.well_tvd_m
        )
        
        # 4. SRP Mechanical Lift Models
        self.rod_model = RodStringModel(pump_depth_m=self.config.pump_depth_m)
        submerged_wt = self.rod_model.compute_submerged_weight_lbs(1010.0)
        self.float_detector = RodFloatDetector(
            pump_depth_m=self.config.pump_depth_m,
            submerged_weight_lbs=submerged_wt
        )
        self.pump_model = DownholePumpModel(pump_bore_diameter_inch=self.config.pump_bore_inch)
        self.dynacard_model = GibbsDynacardModel()
        self.motor_model = SRPMotorModel()
        self.steam_model = SteamGeneratorModel()
        self.energy_accounting = FieldEnergyAccounting()

    def run_simulation(self) -> CycleSimulationResult:
        """Executes full forward simulation across injection, soak, and production phases."""
        cfg = self.config
        
        # 1. Thermal Injection Phase (Marx-Langenheim + Wellbore Heat Transfer)
        inj_rate_kg_s = (cfg.steam_volume_tonnes * 1000.0) / max(1.0, cfg.injection_duration_days * 86400.0)
        wb_inj = self.wellbore_heat_transfer.evaluate_injection_heat_loss(
            steam_temp_celsius=cfg.steam_temp_celsius,
            steam_quality_wellhead=cfg.steam_quality_wellhead,
            steam_rate_kg_s=inj_rate_kg_s
        )
        inj_state = self.thermal_model.simulate_injection_end()
        steam_res = self.steam_model.evaluate_generation(
            steam_mass_tonnes=cfg.steam_volume_tonnes,
            steam_temp_celsius=cfg.steam_temp_celsius,
            steam_quality=wb_inj.delivered_steam_quality
        )
        
        # 2. Soak Period (Thermal Diffusion)
        soak_state = self.thermal_model.simulate_soak_end(inj_state)
        
        # 3. Production Phase Setup
        timeseries: List[DailyTimeseriesPoint] = []
        states_history: List[DigitalTwinState] = []
        cum_oil_bbl = 0.0
        cum_water_bbl = 0.0
        total_kwh = 0.0
        float_events = 0
        fillage_history = []
        max_goodman = 0.0
        
        # Initial cycle reservoir pressure accounting for cumulative depletion + steam support
        p_res = self.res_pressure_model.compute_cycle_initial_pressure(
            cumulative_oil_produced_m3=cfg.cumulative_prior_oil_produced_m3,
            steam_injected_tonnes=cfg.steam_volume_tonnes
        )
        
        # Declining cycle multiplier for multi-cycle simulation (Cycle 2, 3, etc.)
        cycle_decay = max(0.60, 1.0 - (cfg.cycle_number - 1) * 0.08)
        
        actual_cutoff_day = int(cfg.production_duration_days)
        cutoff_triggered = False
        latest_dynacard = None
        submerged_rod_wt = self.rod_model.compute_submerged_weight_lbs(1010.0)
        
        # Initialize thermal state with soak state
        current_thermal_state = soak_state
        current_temp = current_thermal_state.average_temperature_c
        
        for d in range(1, int(cfg.production_duration_days) + 1):
            # Check for seeded cooling anomaly event (severity percentage normalized to fraction)
            anomaly_sev_pct = 0.0
            if cfg.cooling_anomaly_day is not None and d >= cfg.cooling_anomaly_day:
                anomaly_sev_pct = cfg.cooling_anomaly_severity_pct

            # Fluid state at bottomhole temperature
            fluid_state = self.fluid_mgr.evaluate_state(current_temp)
            visc_cp = fluid_state.viscosity_cp
            
            # Reservoir Inflow state (evaluated at bottomhole temperature and depleted reservoir pressure)
            res_state = self.inflow_model.evaluate_reservoir_state(
                current_temp_c=current_temp,
                current_viscosity_cp=visc_cp,
                reservoir_pressure_bar=p_res
            )
            
            # SRP capacity at current SPM:
            disp_bpd, disp_m3 = self.pump_model.compute_displacement(cfg.spm, cfg.stroke_length_inch)
            
            # Target liquid rate limited by pump displacement or reservoir open-flow:
            potential_oil_m3 = res_state.q_max_oil_m3_d * 0.85 * cycle_decay
            potential_oil_bpd = potential_oil_m3 * 6.2898
            
            water_cut = self.hydraulics_model.compute_water_cut(d, int(cfg.production_duration_days))
            potential_liquid_bpd = potential_oil_bpd / max(1e-4, (1.0 - water_cut))
            
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

            # 1-D Depth-Resolved Wellbore Thermohydraulic Model
            wellbore_profile_1d = self.wellbore_1d.compute_profile(
                bottomhole_temp_c=current_temp,
                liquid_rate_m3_d=actual_liquid_m3,
                water_cut=water_cut,
                wellhead_pressure_bar=5.0
            )
            surface_fluid_temp = wellbore_profile_1d.surface_temp_c
            rod_effective_temp = (current_temp + surface_fluid_temp) / 2.0
            rod_fluid_state = self.fluid_mgr.evaluate_state(rod_effective_temp)
            rod_visc_cp = wellbore_profile_1d.average_viscosity_cp

            # Imposed kinematics and distributed segment-wise viscous drag:
            v_imposed_down = self.float_detector.compute_imposed_downstroke_velocity(
                cfg.spm, cfg.stroke_length_inch, cfg.vfd_downstroke_ratio
            )
            v_imposed_up = (cfg.stroke_length_inch * 0.0254 / 2.0) * ((2.0 * np.pi * cfg.spm) / 60.0)
            is_detailed_day = (d in [10, 60] or d >= int(cfg.production_duration_days) - 1)
            drag_down = self.wellbore_1d.compute_rod_drag(wellbore_profile_1d, rod_velocity_m_s=v_imposed_down, is_upstroke=False, detailed=is_detailed_day)
            drag_up = self.wellbore_1d.compute_rod_drag(wellbore_profile_1d, rod_velocity_m_s=v_imposed_up, is_upstroke=True, detailed=is_detailed_day)
            v_term_sinking = self.wellbore_1d.compute_terminal_sinking_velocity(wellbore_profile_1d, submerged_rod_wt)

            # Wellbore Hydraulics Model: multiphase pressure profile along tubing string
            wellbore_profile = self.wellbore_hydraulics_model.compute_pressure_profile(
                liquid_rate_m3_d=actual_liquid_m3,
                mixture_density_kg_m3=fluid_state.mixture_density_kg_m3,
                wellhead_pressure_bar=5.0
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
            
            # Evaluate Rod Float Margin with physically coupled distributed drag!
            float_res = self.float_detector.evaluate_float_margin(
                spm=cfg.spm,
                stroke_length_inch=cfg.stroke_length_inch,
                viscosity_cp=rod_visc_cp,
                fluid_pound_severity=pump_state.fluid_pound_severity,
                vfd_downstroke_ratio=cfg.vfd_downstroke_ratio,
                wellbore_profile=wellbore_profile_1d,
                drag_force_lbs=drag_down.total_drag_force_lbs,
                terminal_velocity_m_s=v_term_sinking
            )
            if float_res.is_rod_floating:
                float_events += 1
                
            # Synthesize dynacard using directional distributed viscous drag!
            dynacard = self.dynacard_model.generate_dynacards(
                stroke_length_inch=cfg.stroke_length_inch,
                spm=cfg.spm,
                submerged_rod_weight_lbs=submerged_rod_wt,
                plunger_fluid_load_lbs=pump_state.plunger_fluid_load_lbs,
                viscosity_cp=rod_visc_cp,
                pump_fillage=pump_state.pump_fillage_fraction,
                float_margin_index=float_res.float_margin_index,
                vfd_downstroke_ratio=cfg.vfd_downstroke_ratio,
                drag_force_lbs=drag_down.total_drag_force_lbs,
                upstroke_drag_lbs=drag_up.total_drag_force_lbs,
                downstroke_drag_lbs=drag_down.total_drag_force_lbs,
                full_points=is_detailed_day
            )
            latest_dynacard = dynacard
            latest_wellbore_profile = wellbore_profile_1d

            
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
            
            # Dynamic Reservoir Pressure Depletion Step
            cum_oil_m3 = cum_oil_bbl / 6.2898
            depletion_bar = (cum_oil_m3 / 1000.0) * 0.85
            p_res = max(15.0, cfg.reservoir_pressure_bar - depletion_bar)

            # Record daily timeseries
            timeseries.append(DailyTimeseriesPoint(
                day=d,
                cycle_phase="PRODUCTION",
                temperature_c=round(current_temp, 2),
                viscosity_cp=round(visc_cp, 1),
                oil_rate_bpd=round(actual_oil_bpd, 1),
                water_rate_bpd=round(actual_water_bpd, 1),
                cumulative_oil_bbl=round(cum_oil_bbl, 1),
                reservoir_pressure_bar=round(p_res, 2),
                flowing_bottomhole_pressure_bar=round(day_hydraulics.flowing_bottomhole_pressure_bar, 2),
                pump_intake_pressure_bar=round(day_hydraulics.pump_intake_pressure_bar, 2),
                wellhead_pressure_bar=5.0,
                wellhead_pressure_provenance="ASSUMED / SCENARIO INPUT",
                float_margin_index=float_res.float_margin_index,
                is_rod_floating=float_res.is_rod_floating,
                goodman_stress_ratio=stress_res.goodman_stress_ratio,
                pump_fillage_pct=round(pump_state.pump_fillage_fraction * 100.0, 1),
                daily_electricity_kwh=motor_res.daily_electricity_kwh,
                asphaltene_risk_score=fluid_state.asphaltene_risk_score
            ))

            # Record DigitalTwinState
            oil_tonnes = max(0.01, cum_oil_bbl * 0.1504)
            current_sor = cfg.steam_volume_tonnes / oil_tonnes
            dt_state = DigitalTwinState(
                well_id=cfg.well_id,
                cycle_number=cfg.cycle_number,
                day=d,
                phase="PRODUCTION",
                reservoir_pressure_bar=round(p_res, 2),
                reservoir_temperature_c=round(current_temp, 2),
                heated_zone_radius_m=current_thermal_state.heated_zone_radius_m,
                cumulative_heat_retained_gj=current_thermal_state.heat_retained_gj,
                wellbore_temperature_c=round(rod_effective_temp, 2),
                wellhead_temperature_c=round(surface_fluid_temp, 2),
                wellhead_pressure_bar=5.0,
                wellhead_pressure_provenance="ASSUMED / SCENARIO INPUT",
                pump_intake_pressure_bar=round(day_hydraulics.pump_intake_pressure_bar, 2),
                pump_intake_temperature_c=round(current_temp, 2),
                flowing_bottomhole_pressure_bar=round(pwf_bar, 2),
                oil_rate_bpd=round(actual_oil_bpd, 1),
                water_rate_bpd=round(actual_water_bpd, 1),
                liquid_rate_bpd=round(actual_liquid_bpd, 1),
                water_cut_pct=round(water_cut * 100.0, 1),
                cumulative_oil_bbl=round(cum_oil_bbl, 1),
                cumulative_water_bbl=round(cum_water_bbl, 1),
                cumulative_steam_tonnes=cfg.steam_volume_tonnes,
                oil_viscosity_cp=round(visc_cp, 1),
                mixture_density_kg_m3=round(fluid_state.mixture_density_kg_m3, 1),
                spm=cfg.spm,
                stroke_length_inch=cfg.stroke_length_inch,
                vfd_downstroke_ratio=cfg.vfd_downstroke_ratio,
                pump_fillage_pct=round(pump_state.pump_fillage_fraction * 100.0, 1),
                peak_polished_rod_load_lbs=round(dynacard.peak_polished_rod_load_lbs, 1),
                min_polished_rod_load_lbs=round(dynacard.min_polished_rod_load_lbs, 1),
                peak_gearbox_torque_in_lbs=round(dynacard.peak_gearbox_torque_in_lbs, 1),
                goodman_stress_ratio=round(stress_res.goodman_stress_ratio, 3),
                float_margin_index=round(float_res.float_margin_index, 3),
                is_rod_floating=float_res.is_rod_floating,
                diagnostic_card_label=dynacard.diagnostic_card_label,
                daily_electricity_kwh=round(motor_res.daily_electricity_kwh, 2),
                cumulative_electricity_kwh=round(total_kwh, 2),
                steam_oil_ratio=round(current_sor, 2),
                asphaltene_risk_score=round(fluid_state.asphaltene_risk_score, 3),
                failure_risk_probability=round(max(0.01, 1.0 - float_res.float_margin_index if float_res.is_rod_floating else 0.02), 3),
                fluid_pound_severity=round(pump_state.fluid_pound_severity, 3),
                provenance="SIMULATED"
            )
            states_history.append(dt_state)

            # Step Boberg-Lantz Thermal Model for Next Day
            current_thermal_state = self.thermal_model.simulate_production_step(
                current_state=current_thermal_state,
                day=d,
                daily_oil_m3=actual_oil_m3,
                daily_water_m3=actual_water_bpd / 6.2898,
                cooling_anomaly_severity_pct=anomaly_sev_pct
            )
            current_temp = current_thermal_state.average_temperature_c

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
            provenance="SIMULATED",
            states=states_history,
            latest_wellbore_profile=latest_wellbore_profile
        )
