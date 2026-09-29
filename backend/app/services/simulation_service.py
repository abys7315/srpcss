"""
Simulation Service — High-Fidelity Physics Twin Execution.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import Dict, Any, List
import numpy as np

from twin.cycle import CSSCycleSimulator, CycleConfig
from constraints.constraint_engine import ConstraintEngine
from ..schemas.simulation import (
    SimulationRequest,
    SimulationResponse,
    DailyTimeseriesDTO,
    DynacardDTO,
    CycleKPIsDTO,
    ConstraintStatusDTO
)
from ..schemas.common import ProvenanceEnum, OperationalStatusEnum

class SimulationService:
    def __init__(self, constraint_engine: ConstraintEngine = None):
        self.constraints = constraint_engine or ConstraintEngine()

    def run_simulation(self, req: SimulationRequest) -> SimulationResponse:
        """Executes full CSS cycle digital twin simulation."""
        cfg = CycleConfig(
            well_id=req.well_id,
            cycle_number=req.cycle_number,
            steam_volume_tonnes=req.steam_volume_tonnes,
            injection_duration_days=req.injection_duration_days,
            injection_pressure_bar=req.injection_pressure_bar,
            steam_temp_celsius=req.steam_temp_celsius,
            soak_duration_days=req.soak_duration_days,
            production_duration_days=req.production_duration_days,
            economic_cutoff_oil_rate_bpd=req.economic_cutoff_oil_rate_bpd,
            spm=req.spm,
            stroke_length_inch=req.stroke_length_inch,
            vfd_downstroke_ratio=req.vfd_downstroke_ratio,
            cooling_anomaly_day=req.cooling_anomaly_day,
            cooling_anomaly_severity_pct=req.cooling_anomaly_severity_pct
        )

        sim = CSSCycleSimulator(cfg)
        sim_res = sim.run_simulation()

        # Constraints
        min_float = min(pt.float_margin_index for pt in sim_res.daily_history)
        max_stress = sim_res.max_goodman_stress_ratio
        min_pip = min(pt.pump_intake_pressure_bar for pt in sim_res.daily_history)
        avg_oil = float(np.mean([pt.oil_rate_bpd for pt in sim_res.daily_history]))

        con_res = self.constraints.evaluate_candidate(
            steam_volume_tonnes=req.steam_volume_tonnes,
            injection_pressure_bar=req.injection_pressure_bar,
            steam_temp_celsius=req.steam_temp_celsius,
            soak_days=req.soak_duration_days,
            spm=req.spm,
            stroke_length_inch=req.stroke_length_inch,
            peak_polished_rod_load_lbs=sim_res.final_dynacard.peak_polished_rod_load_lbs,
            peak_gearbox_torque_in_lbs=sim_res.final_dynacard.peak_gearbox_torque_in_lbs,
            motor_power_kw=sim_res.kpis.electrical_energy_kwh_per_bbl * (avg_oil / 24.0),
            float_margin_index=min_float,
            goodman_stress_ratio=max_stress,
            pump_intake_pressure_bar=min_pip,
            pump_fillage_fraction=sim_res.average_pump_fillage_pct / 100.0,
            oil_rate_bpd=avg_oil,
            vfd_downstroke_ratio=req.vfd_downstroke_ratio
        )

        # Net Benefit Economics
        from economics.net_benefit import FieldEconomicsCalculator
        econ = FieldEconomicsCalculator()
        econ_res = econ.compute_net_benefit(
            cumulative_oil_bbl=sim_res.total_oil_produced_bbl,
            cumulative_water_bbl=sim_res.total_water_produced_bbl,
            steam_volume_tonnes=req.steam_volume_tonnes,
            total_pumping_kwh=sim_res.total_electricity_kwh,
            cycle_duration_days=sim_res.production_cutoff_day_actual + int(req.injection_duration_days + req.soak_duration_days),
            failure_probability=0.08 if min_float >= 1.25 else (0.25 if min_float >= 1.0 else 0.85),
            steam_oil_ratio=sim_res.steam_oil_ratio
        )

        # Map Timeseries
        ts_dto = [
            DailyTimeseriesDTO(
                day=pt.day,
                bottomhole_temperature_c=round(pt.temperature_c, 1),
                oil_viscosity_cp=round(pt.viscosity_cp, 1),
                oil_rate_bpd=round(pt.oil_rate_bpd, 1),
                water_rate_bpd=round(pt.water_rate_bpd, 1),
                cumulative_oil_bbl=round(pt.cumulative_oil_bbl, 1),
                float_margin_index=round(pt.float_margin_index, 3),
                goodman_stress_ratio=round(pt.goodman_stress_ratio, 3),
                peak_gearbox_torque_in_lbs=round(sim_res.final_dynacard.peak_gearbox_torque_in_lbs, 1),
                pump_intake_pressure_bar=round(pt.pump_intake_pressure_bar, 1),
                pump_fillage_pct=round(pt.pump_fillage_pct, 1)
            )
            for pt in sim_res.daily_history
        ]

        # Dynacards mapping
        dynacards_map = {}
        # Initial card (e.g. day 10)
        day10_dyn = sim.dynacard_model.generate_dynacards(
            stroke_length_inch=req.stroke_length_inch,
            spm=req.spm,
            submerged_rod_weight_lbs=8500.0,
            plunger_fluid_load_lbs=5500.0,
            viscosity_cp=sim_res.daily_history[min(10, len(sim_res.daily_history)-1)].viscosity_cp,
            pump_fillage=0.92,
            float_margin_index=sim_res.daily_history[min(10, len(sim_res.daily_history)-1)].float_margin_index,
            vfd_downstroke_ratio=req.vfd_downstroke_ratio
        )
        dynacards_map["day_10"] = DynacardDTO(**day10_dyn.__dict__)

        # Mid-cycle card (day 60)
        mid_idx = min(60, len(sim_res.daily_history)-1)
        day60_dyn = sim.dynacard_model.generate_dynacards(
            stroke_length_inch=req.stroke_length_inch,
            spm=req.spm,
            submerged_rod_weight_lbs=8500.0,
            plunger_fluid_load_lbs=5200.0,
            viscosity_cp=sim_res.daily_history[mid_idx].viscosity_cp,
            pump_fillage=0.85,
            float_margin_index=sim_res.daily_history[mid_idx].float_margin_index,
            vfd_downstroke_ratio=req.vfd_downstroke_ratio
        )
        dynacards_map["day_60"] = DynacardDTO(**day60_dyn.__dict__)

        # Final card
        dynacards_map["final"] = DynacardDTO(**sim_res.final_dynacard.__dict__)

        # Overall Status
        st = OperationalStatusEnum(con_res.status) if con_res.status in OperationalStatusEnum._value2member_map_ else OperationalStatusEnum.FEASIBLE

        return SimulationResponse(
            well_id=req.well_id,
            cycle_number=req.cycle_number,
            status=st,
            kpis=CycleKPIsDTO(
                total_oil_produced_bbl=round(sim_res.total_oil_produced_bbl, 1),
                total_water_produced_bbl=round(sim_res.total_water_produced_bbl, 1),
                total_steam_injected_tonnes=req.steam_volume_tonnes,
                steam_oil_ratio=round(sim_res.steam_oil_ratio, 2),
                total_electricity_kwh=round(sim_res.total_electricity_kwh, 1),
                electrical_energy_kwh_per_bbl=round(sim_res.kpis.electrical_energy_kwh_per_bbl, 2),
                net_economic_benefit_usd=round(econ_res.net_benefit_usd, 2),
                cycle_duration_days=sim_res.production_cutoff_day_actual + int(req.injection_duration_days + req.soak_duration_days),
                production_days=sim_res.production_cutoff_day_actual,
                total_float_events_count=sim_res.total_float_events_count,
                max_goodman_stress_ratio=round(sim_res.max_goodman_stress_ratio, 3),
                min_float_margin_index=round(min_float, 3),
                average_pump_fillage_pct=round(sim_res.average_pump_fillage_pct, 1)
            ),
            constraints=ConstraintStatusDTO(
                status=st,
                is_feasible=con_res.is_feasible,
                violations=con_res.violations,
                near_limit_warnings=con_res.near_limit_warnings,
                binding_constraints=con_res.binding_constraints,
                suggested_engineer_action=con_res.suggested_engineer_action,
                margins=con_res.margins
            ),
            dynacards=dynacards_map,
            timeseries=ts_dto,
            provenance=ProvenanceEnum.SIMULATED
        )
