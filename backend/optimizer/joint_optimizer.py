"""
Joint CSS + SRP Multi-Objective Optimization Engine — Petro-Twin (SIH 2026, PS26120).

Constrained Multi-Objective Coarse-to-Fine Grid Search + Pareto Optimization:
Co-optimizes all 8 required decision variables:
1. Steam Volume (tonnes)
2. Injection Pressure (bar)
3. Injection Duration (days)
4. Soak Duration (days)
5. Economic Cutoff Oil Rate (bpd)
6. Pumping Speed (SPM)
7. Stroke Length (inches)
8. VFD Downstroke Speed Ratio (ratio)

Strictly gates out unsafe candidates (rod floating M_float < 1.0, injection pressure > 125 bar, gearbox torque > 456,000 in-lbs)
before Pareto ranking and multi-objective trade-off selection.

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Tuple, Optional
import itertools
import numpy as np
import time

from .pareto import ParetoSolutionPoint, compute_pareto_front
from .objective import CandidateEvaluator
from constraints.constraint_engine import ConstraintEngine
from ml.confidence.estimator import ConfidenceEstimator
from core.config import canonical_config

@dataclass
class RecommendationComparison:
    parameter_name: str
    current_value: Any
    recommended_value: Any
    unit: str
    delta_display: str

@dataclass
class OptimizationRunResult:
    well_id: str
    optimization_mode: str              # "JOINT_CSS_SRP", "CSS_ONLY", "SRP_ONLY"
    status: str                         # "FEASIBLE", "NO_FEASIBLE_SOLUTION", "NO_IMPROVEMENT_FOUND"
    current_configuration: ParetoSolutionPoint
    recommended_configuration: Optional[ParetoSolutionPoint]
    pareto_front: List[ParetoSolutionPoint]
    total_evaluated_count: int
    feasible_count: int
    infeasible_count: int
    comparison_table: List[RecommendationComparison]
    delta_summary: Dict[str, float]     # Percentage / dollar improvements
    confidence_score: float
    recommendation_mode: str            # "HIGH", "MEDIUM", "LOW", "VERY_LOW"
    explanation: str
    contributing_factors: List[str]
    constraints_checked: List[Dict[str, Any]]
    execution_time_seconds: float
    confidence_breakdown: Dict[str, Any] = field(default_factory=dict)
    provenance: str = "SIMULATED"

class JointOptimizer:
    """Jointly optimizes CSS thermal stimulation and SRP artificial lift schedules."""

    def __init__(
        self,
        constraint_engine: Optional[ConstraintEngine] = None,
        confidence_estimator: Optional[ConfidenceEstimator] = None
    ):
        self.constraints = constraint_engine or ConstraintEngine()
        self.conf_estimator = confidence_estimator or ConfidenceEstimator()
        self.evaluator = CandidateEvaluator(self.constraints)

    def optimize_well(
        self,
        well_id: str,
        current_cfg: Dict[str, Any],
        cycle_number: int = 1,
        mode: str = "JOINT_CSS_SRP",
        weight_net_benefit: float = 0.45,
        weight_oil_recovery: float = 0.25,
        weight_sor_minimization: float = 0.15,
        weight_risk_minimization: float = 0.15,
        cooling_anomaly_day: Optional[int] = None,
        cooling_anomaly_severity_pct: float = 0.0
    ) -> OptimizationRunResult:
        """
        Executes constrained multi-objective coarse-to-fine optimization over CSS and SRP decision spaces.
        """
        t_start = time.time()

        # 1. Normalize objective weights automatically if sum != 1.0
        total_w = weight_net_benefit + weight_oil_recovery + weight_sor_minimization + weight_risk_minimization
        if abs(total_w - 1.0) > 1e-4 and total_w > 0.0:
            weight_net_benefit /= total_w
            weight_oil_recovery /= total_w
            weight_sor_minimization /= total_w
            weight_risk_minimization /= total_w

        # Extract current configuration parameters with canonical defaults
        curr_steam = float(current_cfg.get("steam_volume_tonnes", canonical_config.css.default_steam_volume_tonnes))
        curr_p_inj = float(current_cfg.get("injection_pressure_bar", canonical_config.css.default_injection_pressure_bar))
        curr_t_inj = float(current_cfg.get("injection_duration_days", canonical_config.css.default_injection_duration_days))
        curr_soak = float(current_cfg.get("soak_duration_days", canonical_config.css.default_soak_days))
        curr_cutoff = float(current_cfg.get("economic_cutoff_bpd", canonical_config.css.default_production_cutoff_oil_rate_bpd))
        curr_spm = float(current_cfg.get("spm", canonical_config.srp.standard_spm))
        curr_stroke = float(current_cfg.get("stroke_length_inch", canonical_config.srp.standard_stroke_length_inch))
        curr_vfd = float(current_cfg.get("vfd_downstroke_ratio", canonical_config.srp.standard_vfd_downstroke_ratio))

        # 2. Evaluate Current Baseline Configuration
        curr_point = self.evaluator.evaluate_candidate(
            candidate_id="CURRENT",
            well_id=well_id,
            cycle_number=cycle_number,
            steam_volume_tonnes=curr_steam,
            soak_days=curr_soak,
            spm=curr_spm,
            stroke_length_inch=curr_stroke,
            vfd_downstroke_ratio=curr_vfd,
            injection_pressure_bar=curr_p_inj,
            injection_duration_days=curr_t_inj,
            economic_cutoff_bpd=curr_cutoff,
            cooling_anomaly_day=cooling_anomaly_day,
            cooling_anomaly_severity_pct=cooling_anomaly_severity_pct
        )

        # 3. Stage 1 (Coarse Search): Generate candidate operating points based on optimization mode
        # 3. Stage 1 (Coarse Search): Generate candidate operating points across all decision variables
        candidates: List[ParetoSolutionPoint] = []
        cand_idx = 1

        if mode == "CSS_ONLY":
            # Genuine optimization of CSS decision variables; hold SRP parameters strictly fixed
            steam_grid = [2400.0, 3000.0, 3400.0]
            soak_grid = [4.0, 6.0, 8.0]
            p_inj_grid = [115.0, 125.0]
            t_inj_grid = [12.0, 15.0]
            cut = curr_cutoff
            
            for st, sk, pinj, tinj in itertools.product(steam_grid, soak_grid, p_inj_grid, t_inj_grid):
                sol = self.evaluator.evaluate_candidate(
                    candidate_id=f"CSS-{cand_idx:03d}",
                    well_id=well_id,
                    cycle_number=cycle_number,
                    steam_volume_tonnes=st,
                    soak_days=sk,
                    spm=curr_spm,
                    stroke_length_inch=curr_stroke,
                    vfd_downstroke_ratio=curr_vfd,
                    injection_pressure_bar=pinj,
                    injection_duration_days=tinj,
                    economic_cutoff_bpd=cut,
                    cooling_anomaly_day=cooling_anomaly_day,
                    cooling_anomaly_severity_pct=cooling_anomaly_severity_pct
                )
                candidates.append(sol)
                cand_idx += 1

        elif mode == "SRP_ONLY":
            # Genuine optimization of SRP decision variables; hold CSS parameters strictly fixed
            spm_grid = [2.5, 3.2, 4.0, 4.8, 5.5]
            stroke_grid = [86.0, 100.0]
            vfd_grid = [0.70, 0.85, 1.0]

            for sp, strk, vfd in itertools.product(spm_grid, stroke_grid, vfd_grid):
                sol = self.evaluator.evaluate_candidate(
                    candidate_id=f"SRP-{cand_idx:03d}",
                    well_id=well_id,
                    cycle_number=cycle_number,
                    steam_volume_tonnes=curr_steam,
                    soak_days=curr_soak,
                    spm=sp,
                    stroke_length_inch=strk,
                    vfd_downstroke_ratio=vfd,
                    injection_pressure_bar=curr_p_inj,
                    injection_duration_days=curr_t_inj,
                    economic_cutoff_bpd=curr_cutoff,
                    cooling_anomaly_day=cooling_anomaly_day,
                    cooling_anomaly_severity_pct=cooling_anomaly_severity_pct
                )
                candidates.append(sol)
                cand_idx += 1

        else:
            # JOINT_CSS_SRP: Co-optimize all 8 decision variables across Slow and Fast loops
            # Efficient orthogonal grid covering primary thermal and lift coupling,
            # systematically varying injection pressure, injection duration, and economic cutoff.
            coarse_steam = [2400.0, 3200.0]
            coarse_soak = [5.0, 7.0]
            coarse_spm = [3.5, 4.5, 5.5]
            coarse_vfd = [0.75, 1.0]
            coarse_stroke = [86.0, 100.0]
            p_inj_options = [115.0, 125.0]
            t_inj_options = [12.0, 16.0]
            cutoff_options = [6.0, 8.0]

            for st, sk, sp, vfd, strk in itertools.product(
                coarse_steam, coarse_soak, coarse_spm, coarse_vfd, coarse_stroke
            ):
                pinj = p_inj_options[cand_idx % len(p_inj_options)]
                tinj = t_inj_options[(cand_idx // 2) % len(t_inj_options)]
                cut = cutoff_options[(cand_idx // 4) % len(cutoff_options)]
                sol = self.evaluator.evaluate_candidate(
                    candidate_id=f"JOINT-{cand_idx:03d}",
                    well_id=well_id,
                    cycle_number=cycle_number,
                    steam_volume_tonnes=st,
                    soak_days=sk,
                    spm=sp,
                    stroke_length_inch=strk,
                    vfd_downstroke_ratio=vfd,
                    injection_pressure_bar=pinj,
                    injection_duration_days=tinj,
                    economic_cutoff_bpd=cut,
                    cooling_anomaly_day=cooling_anomaly_day,
                    cooling_anomaly_severity_pct=cooling_anomaly_severity_pct
                )
                candidates.append(sol)
                cand_idx += 1

        # 4. Initial Constraint Safety Gating & Pareto Frontier
        coarse_pareto_front, coarse_ranked = compute_pareto_front(
            candidates,
            weight_net_benefit=weight_net_benefit,
            weight_oil_recovery=weight_oil_recovery,
            weight_sor_minimization=weight_sor_minimization,
            weight_risk_minimization=weight_risk_minimization
        )

        # Stage 2 (Targeted Fine Search Refinement): Perturb high-sensitivity operating variables around top Pareto candidates
        if mode == "JOINT_CSS_SRP" and coarse_pareto_front:
            top_seed = coarse_pareto_front[0]
            max_safe_fine_spm = curr_spm if curr_point.min_float_margin_index < 1.0 else 7.5
            fine_perturbations = [
                (top_seed.spm - 0.2, top_seed.vfd_downstroke_ratio, top_seed.steam_volume_tonnes, top_seed.injection_duration_days),
                (top_seed.spm + 0.2, max(0.65, top_seed.vfd_downstroke_ratio - 0.05), top_seed.steam_volume_tonnes, top_seed.injection_duration_days),
                (top_seed.spm, min(1.0, top_seed.vfd_downstroke_ratio + 0.05), top_seed.steam_volume_tonnes, top_seed.injection_duration_days),
                (top_seed.spm, top_seed.vfd_downstroke_ratio, top_seed.steam_volume_tonnes - 150.0, top_seed.injection_duration_days),
                (top_seed.spm, top_seed.vfd_downstroke_ratio, top_seed.steam_volume_tonnes + 150.0, top_seed.injection_duration_days),
                (top_seed.spm, top_seed.vfd_downstroke_ratio, top_seed.steam_volume_tonnes, max(8.0, top_seed.injection_duration_days - 2.0)),
                (top_seed.spm, top_seed.vfd_downstroke_ratio, top_seed.steam_volume_tonnes, min(25.0, top_seed.injection_duration_days + 2.0))
            ]
            for f_spm, f_vfd, f_steam, f_tinj in fine_perturbations:
                if 1.5 <= f_spm <= max_safe_fine_spm and 1500.0 <= f_steam <= 4500.0:
                    fine_sol = self.evaluator.evaluate_candidate(
                        candidate_id=f"FINE-{cand_idx:03d}",
                        well_id=well_id,
                        cycle_number=cycle_number,
                        steam_volume_tonnes=f_steam,
                        soak_days=top_seed.soak_days,
                        spm=f_spm,
                        stroke_length_inch=top_seed.stroke_length_inch,
                        vfd_downstroke_ratio=f_vfd,
                        injection_pressure_bar=top_seed.injection_pressure_bar,
                        injection_duration_days=f_tinj,
                        economic_cutoff_bpd=top_seed.economic_cutoff_bpd,
                        cooling_anomaly_day=cooling_anomaly_day,
                        cooling_anomaly_severity_pct=cooling_anomaly_severity_pct
                    )
                    candidates.append(fine_sol)
                    cand_idx += 1

        # Stage 3 (Rule 3): RECOMPUTE Pareto front and rankings across ALL candidates (coarse + fine)
        pareto_front, ranked_feasible = compute_pareto_front(
            candidates,
            weight_net_benefit=weight_net_benefit,
            weight_oil_recovery=weight_oil_recovery,
            weight_sor_minimization=weight_sor_minimization,
            weight_risk_minimization=weight_risk_minimization
        )

        infeasible_count = sum(1 for c in candidates if c.status == "INFEASIBLE")
        feasible_count = len(ranked_feasible)
        exec_time = time.time() - t_start

        # Handle NO_FEASIBLE_SOLUTION edge case
        if not ranked_feasible or not pareto_front:
            return OptimizationRunResult(
                well_id=well_id,
                optimization_mode=mode,
                status="NO_FEASIBLE_SOLUTION",
                current_configuration=curr_point,
                recommended_configuration=None,
                pareto_front=[],
                total_evaluated_count=len(candidates),
                feasible_count=0,
                infeasible_count=infeasible_count,
                comparison_table=[],
                delta_summary={},
                confidence_score=0.35,
                recommendation_mode="VERY_LOW",
                explanation="No feasible operating point was found that satisfies all hard mechanical, thermal, and rod floating constraints.",
                contributing_factors=["All evaluated points violated binding mechanical or reservoir safety limits."],
                constraints_checked=[{"name": "Rod Float Margin >= 1.0", "status": "VIOLATED"}],
                execution_time_seconds=round(exec_time, 2)
            )

        # Final recommendation MUST come from the final recomputed Pareto front!
        best_cand = pareto_front[0]

        # Check if best candidate actually improves over current configuration:
        has_improvement = (
            best_cand.net_benefit_usd > curr_point.net_benefit_usd * 1.01 or
            best_cand.min_float_margin_index > curr_point.min_float_margin_index * 1.05 or
            best_cand.steam_oil_ratio < curr_point.steam_oil_ratio * 0.98
        )
        opt_status = "FEASIBLE" if has_improvement else "NO_IMPROVEMENT_FOUND"

        # 5. Delta Summary & Comparison Table
        oil_delta_pct = ((best_cand.cumulative_oil_bbl - curr_point.cumulative_oil_bbl) / max(curr_point.cumulative_oil_bbl, 1.0)) * 100.0
        nb_delta_usd = best_cand.net_benefit_usd - curr_point.net_benefit_usd
        sor_delta_pct = ((best_cand.steam_oil_ratio - curr_point.steam_oil_ratio) / max(curr_point.steam_oil_ratio, 0.1)) * 100.0
        energy_delta_pct = ((best_cand.energy_intensity_kwh_per_bbl - curr_point.energy_intensity_kwh_per_bbl) / max(curr_point.energy_intensity_kwh_per_bbl, 0.1)) * 100.0
        risk_delta_pct = ((best_cand.failure_risk_probability - curr_point.failure_risk_probability) / max(curr_point.failure_risk_probability, 0.05)) * 100.0

        delta_summary = {
            "oil_recovery_change_pct": round(oil_delta_pct, 1),
            "net_benefit_change_usd": round(nb_delta_usd, 2),
            "steam_oil_ratio_change_pct": round(sor_delta_pct, 1),
            "energy_intensity_change_pct": round(energy_delta_pct, 1),
            "failure_risk_change_pct": round(risk_delta_pct, 1),
            "float_margin_improvement": round(best_cand.min_float_margin_index - curr_point.min_float_margin_index, 3)
        }

        comparison = [
            RecommendationComparison("Steam Volume", f"{curr_point.steam_volume_tonnes:.0f}", f"{best_cand.steam_volume_tonnes:.0f}", "tonnes", f"{best_cand.steam_volume_tonnes - curr_point.steam_volume_tonnes:+.0f}"),
            RecommendationComparison("Injection Pressure", f"{curr_point.injection_pressure_bar:.1f}", f"{best_cand.injection_pressure_bar:.1f}", "bar", f"{best_cand.injection_pressure_bar - curr_point.injection_pressure_bar:+.1f}"),
            RecommendationComparison("Injection Duration", f"{curr_point.injection_duration_days:.1f}", f"{best_cand.injection_duration_days:.1f}", "days", f"{best_cand.injection_duration_days - curr_point.injection_duration_days:+.1f}"),
            RecommendationComparison("Soak Duration", f"{curr_point.soak_days:.1f}", f"{best_cand.soak_days:.1f}", "days", f"{best_cand.soak_days - curr_point.soak_days:+.1f}"),
            RecommendationComparison("Pumping Speed", f"{curr_point.spm:.2f}", f"{best_cand.spm:.2f}", "SPM", f"{best_cand.spm - curr_point.spm:+.2f}"),
            RecommendationComparison("Stroke Length", f"{curr_point.stroke_length_inch:.0f}", f"{best_cand.stroke_length_inch:.0f}", "in", f"{best_cand.stroke_length_inch - curr_point.stroke_length_inch:+.0f}"),
            RecommendationComparison("VFD Downstroke Ratio", f"{curr_point.vfd_downstroke_ratio:.2f}", f"{best_cand.vfd_downstroke_ratio:.2f}", "ratio", f"{best_cand.vfd_downstroke_ratio - curr_point.vfd_downstroke_ratio:+.2f}"),
            RecommendationComparison("Economic Cutoff", f"{curr_point.economic_cutoff_bpd:.1f}", f"{best_cand.economic_cutoff_bpd:.1f}", "bpd", f"{best_cand.economic_cutoff_bpd - curr_point.economic_cutoff_bpd:+.1f}"),
            RecommendationComparison("Cumulative Oil", f"{curr_point.cumulative_oil_bbl:.1f}", f"{best_cand.cumulative_oil_bbl:.1f}", "bbl", f"{oil_delta_pct:+.1f}%"),
            RecommendationComparison("Steam-to-Oil Ratio", f"{curr_point.steam_oil_ratio:.2f}", f"{best_cand.steam_oil_ratio:.2f}", "t/t", f"{sor_delta_pct:+.1f}%"),
            RecommendationComparison("Net Benefit", f"${curr_point.net_benefit_usd:,.0f}", f"${best_cand.net_benefit_usd:,.0f}", "USD", f"${nb_delta_usd:+,.0f}"),
            RecommendationComparison("Min Float Margin", f"{curr_point.min_float_margin_index:.3f}", f"{best_cand.min_float_margin_index:.3f}", "index", f"{best_cand.min_float_margin_index - curr_point.min_float_margin_index:+.3f}")
        ]

        # 6. Candidate-Specific Dynamic Constraint Margins (Section 7)
        float_margin = best_cand.min_float_margin_index - 1.0
        pinj_margin = 125.0 - best_cand.injection_pressure_bar
        goodman_margin = 0.85 - best_cand.goodman_stress_ratio
        torque_margin_pct = ((456000.0 - best_cand.peak_gearbox_torque_in_lbs) / 456000.0) * 100.0
        pip_margin = best_cand.pump_intake_pressure_bar - 3.0

        constraints_checked = [
            {"name": "Rod Float Margin >= 1.000", "margin": f"{float_margin:+.3f}", "status": "PASSED" if float_margin >= 0 else "VIOLATED"},
            {"name": "Max Injection Pressure <= 125 bar", "margin": f"{pinj_margin:+.1f} bar", "status": "PASSED" if pinj_margin >= 0 else "VIOLATED"},
            {"name": "Modified Goodman Stress Ratio <= 0.85", "margin": f"{goodman_margin:+.3f}", "status": "PASSED" if goodman_margin >= 0 else "VIOLATED"},
            {"name": "Gearbox Torque <= 456,000 in-lbs", "margin": f"{torque_margin_pct:+.1f}%", "status": "PASSED" if torque_margin_pct >= 0 else "VIOLATED"},
            {"name": "Pump Intake Pressure >= 3.0 bar", "margin": f"{pip_margin:+.1f} bar", "status": "PASSED" if pip_margin >= 0 else "VIOLATED"}
        ]

        # 7. State- and Candidate-Specific Dynamic Confidence (Section 13)
        d_steam = abs(best_cand.steam_volume_tonnes - 3000.0) / 1500.0
        d_spm = abs(best_cand.spm - 4.5) / 3.0
        d_vfd = abs(best_cand.vfd_downstroke_ratio - 1.0) / 0.5
        anom_penalty = (cooling_anomaly_severity_pct / 100.0) * 0.45
        dist_to_training = float(np.clip(0.08 + 0.25 * ((d_steam + d_spm + d_vfd) / 3.0) + anom_penalty, 0.05, 0.95))
        pred_spread = float(np.clip(0.08 + 0.15 * dist_to_training, 0.05, 0.45))
        min_headroom = min(
            max(0.0, float_margin),
            max(0.0, pinj_margin / 125.0),
            max(0.0, goodman_margin / 0.85),
            max(0.0, torque_margin_pct / 100.0)
        )

        # Derive validation error from stored model metrics
        val_error = 0.08
        if hasattr(self, 'registry') and self.registry:
            champ = self.registry.get_champion("residual_corrector")
            if champ and "validation_mae" in champ.metrics:
                val_error = min(0.30, float(champ.metrics["validation_mae"]) / 25.0)

        # Calculate input data quality based on cooling anomaly and telemetry completeness
        data_quality = 0.96 if cooling_anomaly_severity_pct == 0 else max(0.40, 0.96 - (cooling_anomaly_severity_pct / 100.0) * 0.50)

        # Physical operational range validation for Baghewala heavy crude
        physics_valid = (
            500.0 <= best_cand.steam_volume_tonnes <= 6000.0 and
            1.0 <= best_cand.spm <= 8.5 and
            50.0 <= best_cand.stroke_length_inch <= 160.0 and
            best_cand.status != "INFEASIBLE"
        )

        conf_res = self.conf_estimator.compute_confidence(
            prediction_spread_pct=round(pred_spread, 3),
            validation_error_pct=round(val_error, 3),
            distance_to_training_distribution=round(dist_to_training, 3),
            data_quality_score=round(data_quality, 2),
            are_physics_inputs_in_range=physics_valid,
            min_constraint_margin_pct=max(0.02, min_headroom)
        )

        conf_breakdown = {
            "confidence_type": "Simulation Confidence",
            "overall_simulation_confidence": round(conf_res.overall_confidence_score, 2),
            "data_completeness": round(data_quality, 2),
            "data_completeness_provenance": "SIMULATED",
            "validation_error": round(val_error, 3),
            "validation_error_provenance": "SIMULATED",
            "scenario_model_agreement": round(1.0 - pred_spread, 3),
            "scenario_model_agreement_provenance": "SIMULATED",
            "extrapolation_distance": round(dist_to_training, 3),
            "extrapolation_distance_provenance": "SIMULATED",
            "physics_range_validity": physics_valid,
            "disclaimer": "Confidence is a simulated engineering heuristic based on model domain distance and synthetic verification split. No field calibration telemetry is represented."
        }

        # 8. Explainability & Physics Drivers
        factors = [
            f"Steam volume tuned to {best_cand.steam_volume_tonnes:.0f}t to maximize thermal efficiency and deliver SOR={best_cand.steam_oil_ratio:.2f} t/t.",
            f"SPM set to {best_cand.spm:.1f} with VFD downstroke ratio {best_cand.vfd_downstroke_ratio:.2f} ensuring minimum float margin index of {best_cand.min_float_margin_index:.3f} >= 1.000.",
            f"Economic Net Benefit yields ${best_cand.net_benefit_usd:,.0f} USD ({nb_delta_usd:+,.0f} vs current operating policy)."
        ]
        if curr_point.min_float_margin_index < 1.0:
            factors.insert(0, f"Eliminates active rod floating: adjusts pumping speed from {curr_point.spm:.1f} to {best_cand.spm:.1f} SPM with VFD downstroke ratio {best_cand.vfd_downstroke_ratio:.2f} (restoring float margin index to {best_cand.min_float_margin_index:.3f} >= 1.000).")

        explanation_text = (
            f"Recommended plan jointly adjusts steam injection to {best_cand.steam_volume_tonnes:.0f} tonnes "
            f"and sets SPM to {best_cand.spm:.1f} with VFD downstroke ratio {best_cand.vfd_downstroke_ratio:.2f}. "
            f"This guarantees rod float margin index of {best_cand.min_float_margin_index:.3f} (>= 1.000 safety threshold), "
            f"preventing rod floating shock while unlocking net economic benefit of ${best_cand.net_benefit_usd:,.0f}."
        )

        exec_time = time.time() - t_start

        return OptimizationRunResult(
            well_id=well_id,
            optimization_mode=mode,
            status=opt_status,
            current_configuration=curr_point,
            recommended_configuration=best_cand,
            pareto_front=pareto_front,
            total_evaluated_count=len(candidates),
            feasible_count=feasible_count,
            infeasible_count=infeasible_count,
            comparison_table=comparison,
            delta_summary=delta_summary,
            confidence_score=conf_res.overall_confidence_score,
            recommendation_mode=conf_res.recommendation_mode,
            confidence_breakdown=conf_breakdown,
            explanation=explanation_text,
            contributing_factors=factors,
            constraints_checked=constraints_checked,
            execution_time_seconds=round(exec_time, 2)
        )
