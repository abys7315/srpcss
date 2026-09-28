"""
Optimization Objective Evaluator with Hard Safety Gating.

Chains: Candidate Params -> Physics Simulation -> Risk Evaluation -> Constraint Gate -> Economics

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional
import numpy as np

from twin.cycle import CSSCycleSimulator, CycleConfig
from constraints.constraint_engine import ConstraintEngine, ConstraintEvaluationResult
from ml.failure_risk.predictor import FailureRiskPredictor
from economics.net_benefit import FieldEconomicsCalculator
from .pareto import ParetoSolutionPoint

class CandidateEvaluator:
    """Evaluates a single operating parameter vector through the full digital twin chain."""

    def __init__(
        self,
        constraint_engine: Optional[ConstraintEngine] = None,
        risk_predictor: Optional[FailureRiskPredictor] = None,
        economics_calc: Optional[FieldEconomicsCalculator] = None
    ):
        self.constraints = constraint_engine or ConstraintEngine()
        self.risk_predictor = risk_predictor or FailureRiskPredictor()
        self.economics = economics_calc or FieldEconomicsCalculator()

    def evaluate_candidate(
        self,
        candidate_id: str,
        well_id: str,
        cycle_number: int,
        steam_volume_tonnes: float,
        soak_days: float,
        spm: float,
        stroke_length_inch: float,
        vfd_downstroke_ratio: float,
        economic_cutoff_bpd: float = 6.0,
        production_duration_days: float = 90.0,
        cooling_anomaly_day: Optional[int] = None,
        cooling_anomaly_severity_pct: float = 0.0
    ) -> ParetoSolutionPoint:
        """
        Executes forward physics simulation and checks constraints.
        """
        cfg = CycleConfig(
            well_id=well_id,
            cycle_number=cycle_number,
            steam_volume_tonnes=steam_volume_tonnes,
            injection_duration_days=15.0,
            injection_pressure_bar=125.0,
            steam_temp_celsius=260.0,
            soak_duration_days=soak_days,
            production_duration_days=production_duration_days,
            economic_cutoff_oil_rate_bpd=economic_cutoff_bpd,
            spm=spm,
            stroke_length_inch=stroke_length_inch,
            vfd_downstroke_ratio=vfd_downstroke_ratio,
            cooling_anomaly_day=cooling_anomaly_day,
            cooling_anomaly_severity_pct=cooling_anomaly_severity_pct
        )

        sim = CSSCycleSimulator(cfg)
        sim_res = sim.run_simulation()

        # Find extrema across daily history
        min_float_margin = min(pt.float_margin_index for pt in sim_res.daily_history)
        max_goodman = sim_res.max_goodman_stress_ratio
        min_pip = min(pt.pump_intake_pressure_bar for pt in sim_res.daily_history)
        avg_oil_bpd = float(np.mean([pt.oil_rate_bpd for pt in sim_res.daily_history]))

        # Evaluate Safety Constraints:
        con_res = self.constraints.evaluate_candidate(
            steam_volume_tonnes=steam_volume_tonnes,
            injection_pressure_bar=125.0,
            steam_temp_celsius=260.0,
            soak_days=soak_days,
            spm=spm,
            stroke_length_inch=stroke_length_inch,
            peak_polished_rod_load_lbs=sim_res.final_dynacard.peak_polished_rod_load_lbs,
            peak_gearbox_torque_in_lbs=sim_res.final_dynacard.peak_gearbox_torque_in_lbs,
            motor_power_kw=sim_res.kpis.electrical_energy_kwh_per_bbl * (avg_oil_bpd / 24.0),
            float_margin_index=min_float_margin,
            goodman_stress_ratio=max_goodman,
            pump_intake_pressure_bar=min_pip,
            pump_fillage_fraction=sim_res.average_pump_fillage_pct / 100.0,
            oil_rate_bpd=avg_oil_bpd,
            vfd_downstroke_ratio=vfd_downstroke_ratio
        )

        # Evaluate Failure Risk:
        fluid_pound_sev = max(0.0, (0.85 - sim_res.average_pump_fillage_pct / 100.0) / 0.85)
        risk_res = self.risk_predictor.evaluate_risk(
            float_margin_index=min_float_margin,
            goodman_stress_ratio=max_goodman,
            fluid_pound_severity=fluid_pound_sev,
            gearbox_load_pct=(sim_res.final_dynacard.peak_gearbox_torque_in_lbs / 320000.0) * 100.0,
            asphaltene_risk_score=0.25,
            cumulative_float_events=sim_res.total_float_events_count
        )

        # Evaluate Net Benefit Economics:
        econ_res = self.economics.compute_net_benefit(
            cumulative_oil_bbl=sim_res.total_oil_produced_bbl,
            cumulative_water_bbl=sim_res.total_water_produced_bbl,
            steam_volume_tonnes=steam_volume_tonnes,
            total_pumping_kwh=sim_res.total_electricity_kwh,
            cycle_duration_days=sim_res.production_cutoff_day_actual + 21.0,
            failure_probability=risk_res.overall_failure_probability,
            steam_oil_ratio=sim_res.steam_oil_ratio
        )

        return ParetoSolutionPoint(
            solution_id=candidate_id,
            steam_volume_tonnes=steam_volume_tonnes,
            soak_days=soak_days,
            spm=spm,
            stroke_length_inch=stroke_length_inch,
            vfd_downstroke_ratio=vfd_downstroke_ratio,
            economic_cutoff_bpd=economic_cutoff_bpd,
            cumulative_oil_bbl=sim_res.total_oil_produced_bbl,
            net_benefit_usd=econ_res.net_benefit_usd,
            steam_oil_ratio=sim_res.steam_oil_ratio,
            energy_intensity_kwh_per_bbl=sim_res.kpis.electrical_energy_kwh_per_bbl,
            failure_risk_probability=risk_res.overall_failure_probability,
            min_float_margin_index=round(min_float_margin, 3),
            pareto_rank=2,
            is_non_dominated=False,
            status=con_res.status,
            composite_score=0.0,
            provenance="SIMULATED"
        )
