"""
Joint CSS + SRP multi-objective optimizer (NSGA-II, pymoo).

Decision variables
  CSS : steam volume [t], bottomhole injection pressure [bar], injection duration [d],
        soak [d], economic cutoff [bbl/d]
  SRP : fixed policy    -> SPM, stroke [in], VFD downstroke ratio
        adaptive policy -> controller M_target, min fillage, stroke [in], VFD downstroke ratio
        (the daily controller in optimizer/srp_controller.py then sets SPM(t))
Objectives (minimised): -net benefit [USD], SOR [t/t], failure risk [-]
Constraints (g <= 0):   M_float >= 1, Goodman <= limit, torque <= rating, PIP >= limit,
                        p_inj <= fracture-derived limit, constraint-engine status != INFEASIBLE
Modes: JOINT_CSS_SRP (all free), CSS_ONLY (SRP frozen at current), SRP_ONLY (CSS frozen at current).

The recommendation is the highest composite-score point on the non-dominated set of all feasible
evaluations (weights from the request). Evaluations go through the shared simulation cache.
PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass, field
from typing import Callable, List, Dict, Any, Optional, Tuple
import time
import numpy as np

from pymoo.core.problem import ElementwiseProblem
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.optimize import minimize

from .pareto import ParetoSolutionPoint, compute_pareto_front
from .objective import CandidateEvaluator
from constraints.constraint_engine import ConstraintEngine
from ml.confidence.estimator import ConfidenceEstimator
from core.config import canonical_config

_SL = canonical_config.safety_limits
P_INJ_LIMIT = _SL.max_allowable_injection_pressure_bar

# name -> (lower, upper)
CSS_BOUNDS: Dict[str, Tuple[float, float]] = {
    "steam_volume_tonnes": (1500.0, 4500.0),
    "injection_pressure_bar": (60.0, P_INJ_LIMIT),
    "injection_duration_days": (8.0, 25.0),
    "soak_duration_days": (2.0, 14.0),
    "economic_cutoff_bpd": (4.0, 12.0),
}
SRP_FIXED_BOUNDS: Dict[str, Tuple[float, float]] = {
    "spm": (_SL.min_allowable_spm, _SL.max_allowable_spm),
    "stroke_length_inch": (_SL.min_stroke_length_inch, _SL.max_stroke_length_inch),
    "vfd_downstroke_ratio": (0.6, 1.0),
}
SRP_ADAPTIVE_BOUNDS: Dict[str, Tuple[float, float]] = {
    "srp_m_target": (1.05, 1.6),
    "srp_min_fillage": (0.75, 0.95),
    "stroke_length_inch": (_SL.min_stroke_length_inch, _SL.max_stroke_length_inch),
    "vfd_downstroke_ratio": (0.6, 1.0),
}


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
    optimization_mode: str
    status: str                         # "FEASIBLE", "NO_FEASIBLE_SOLUTION", "NO_IMPROVEMENT_FOUND"
    current_configuration: ParetoSolutionPoint
    recommended_configuration: Optional[ParetoSolutionPoint]
    pareto_front: List[ParetoSolutionPoint]
    total_evaluated_count: int
    feasible_count: int
    infeasible_count: int
    comparison_table: List[RecommendationComparison]
    delta_summary: Dict[str, float]
    confidence_score: float
    recommendation_mode: str
    explanation: str
    contributing_factors: List[str]
    constraints_checked: List[Dict[str, Any]]
    execution_time_seconds: float
    confidence_breakdown: Dict[str, Any] = field(default_factory=dict)
    evaluations: int = 0
    seed: int = 0
    srp_policy: str = "fixed"
    evaluated_points: List[ParetoSolutionPoint] = field(default_factory=list)
    provenance: str = "SIMULATED"


def _current_values(cfg: Dict[str, Any]) -> Dict[str, float]:
    c = canonical_config
    return {
        "steam_volume_tonnes": float(cfg.get("steam_volume_tonnes", c.css.default_steam_volume_tonnes)),
        "injection_pressure_bar": float(cfg.get("injection_pressure_bar", c.css.default_injection_pressure_bar)),
        "injection_duration_days": float(cfg.get("injection_duration_days", c.css.default_injection_duration_days)),
        "soak_duration_days": float(cfg.get("soak_duration_days", cfg.get("soak_days", c.css.default_soak_days))),
        "economic_cutoff_bpd": float(cfg.get("economic_cutoff_bpd", c.css.default_production_cutoff_oil_rate_bpd)),
        "spm": float(cfg.get("spm", c.srp.standard_spm)),
        "stroke_length_inch": float(cfg.get("stroke_length_inch", c.srp.standard_stroke_length_inch)),
        "vfd_downstroke_ratio": float(cfg.get("vfd_downstroke_ratio", c.srp.standard_vfd_downstroke_ratio)),
        "srp_m_target": float(cfg.get("srp_m_target", 1.15)),
        "srp_min_fillage": float(cfg.get("srp_min_fillage", 0.85)),
    }


class _CycleProblem(ElementwiseProblem):
    def __init__(self, names: List[str], bounds: Dict[str, Tuple[float, float]], frozen: Dict[str, float], run_one):
        self.names = names
        self.frozen = frozen
        self.run_one = run_one
        xl = np.array([bounds[n][0] for n in names])
        xu = np.array([bounds[n][1] for n in names])
        super().__init__(n_var=len(names), n_obj=3, n_ieq_constr=6, xl=xl, xu=xu)

    def _evaluate(self, x, out, *args, **kwargs):
        vals = dict(self.frozen)
        vals.update({n: float(v) for n, v in zip(self.names, x)})
        pt = self.run_one(vals)
        out["F"] = [-pt.net_benefit_usd, pt.steam_oil_ratio, pt.failure_risk_probability]
        out["G"] = [
            _SL.min_rod_float_margin_index - pt.min_float_margin_index,
            pt.goodman_stress_ratio - _SL.max_goodman_stress_ratio,
            (pt.peak_gearbox_torque_in_lbs - _SL.max_gearbox_torque_in_lbs) / _SL.max_gearbox_torque_in_lbs,
            _SL.min_pump_intake_pressure_bar - pt.pump_intake_pressure_bar,
            vals["injection_pressure_bar"] - P_INJ_LIMIT,
            0.5 if pt.status == "INFEASIBLE" else -0.5,
        ]


class JointOptimizer:
    """NSGA-II co-optimisation of the CSS schedule and the SRP policy."""

    def __init__(self, constraint_engine: Optional[ConstraintEngine] = None,
                 confidence_estimator: Optional[ConfidenceEstimator] = None,
                 pop_size: int = 12, n_gen: int = 6):
        self.constraints = constraint_engine or ConstraintEngine()
        self.conf_estimator = confidence_estimator or ConfidenceEstimator()
        self.evaluator = CandidateEvaluator(self.constraints)
        self.pop_size = pop_size
        self.n_gen = n_gen

    def _evaluate(self, cid: str, well_id: str, cycle_number: int, v: Dict[str, float], policy: str,
                  anomaly_day, anomaly_sev, carried_state=None) -> ParetoSolutionPoint:
        return self.evaluator.evaluate_candidate(
            candidate_id=cid, well_id=well_id, cycle_number=cycle_number,
            steam_volume_tonnes=round(v["steam_volume_tonnes"], 1), soak_days=round(v["soak_duration_days"], 2),
            spm=round(v["spm"], 2), stroke_length_inch=round(v["stroke_length_inch"], 1),
            vfd_downstroke_ratio=round(v["vfd_downstroke_ratio"], 3),
            injection_pressure_bar=round(v["injection_pressure_bar"], 1),
            injection_duration_days=round(v["injection_duration_days"], 2),
            economic_cutoff_bpd=round(v["economic_cutoff_bpd"], 2),
            cooling_anomaly_day=anomaly_day, cooling_anomaly_severity_pct=anomaly_sev,
            srp_policy=policy, srp_m_target=round(v["srp_m_target"], 3), srp_min_fillage=round(v["srp_min_fillage"], 3),
            carried_state=carried_state,
        )

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
        cooling_anomaly_severity_pct: float = 0.0,
        srp_policy: str = "adaptive",
        seed: int = 42,
        carried_state: Optional[Dict[str, Any]] = None,
        current_policy: Optional[str] = None,
        progress_cb: Optional[Callable[[int, int], None]] = None,
    ) -> OptimizationRunResult:
        t_start = time.time()
        total_w = weight_net_benefit + weight_oil_recovery + weight_sor_minimization + weight_risk_minimization
        if total_w > 0 and abs(total_w - 1.0) > 1e-4:
            weight_net_benefit, weight_oil_recovery, weight_sor_minimization, weight_risk_minimization = (
                w / total_w for w in (weight_net_benefit, weight_oil_recovery, weight_sor_minimization, weight_risk_minimization))

        cur = _current_values(current_cfg)
        cur_policy = current_policy or current_cfg.get("srp_policy", "fixed")
        curr_point = self._evaluate("CURRENT", well_id, cycle_number, cur, cur_policy,
                                    cooling_anomaly_day, cooling_anomaly_severity_pct, carried_state)

        # Variable set by mode; frozen variables stay at the current configuration.
        srp_bounds = SRP_ADAPTIVE_BOUNDS if srp_policy == "adaptive" else SRP_FIXED_BOUNDS
        policy = srp_policy
        if mode == "CSS_ONLY":
            bounds, policy = dict(CSS_BOUNDS), cur_policy
        elif mode == "SRP_ONLY":
            bounds = dict(srp_bounds)
        else:
            bounds = {**CSS_BOUNDS, **srp_bounds}
        names = list(bounds)
        frozen = {k: v for k, v in cur.items() if k not in bounds}

        evaluated: List[ParetoSolutionPoint] = []
        total_evals = self.pop_size * self.n_gen + 2      # NSGA-II evaluates pop_size per generation; +2 for reference points

        def run_one(vals: Dict[str, float]) -> ParetoSolutionPoint:
            pt = self._evaluate(f"NSGA-{len(evaluated) + 1:03d}", well_id, cycle_number, vals, policy,
                                cooling_anomaly_day, cooling_anomaly_severity_pct, carried_state)
            evaluated.append(pt)
            if progress_cb is not None:
                progress_cb(len(evaluated), total_evals)
            return pt

        problem = _CycleProblem(names, bounds, frozen, run_one)
        minimize(problem, NSGA2(pop_size=self.pop_size), ("n_gen", self.n_gen), seed=seed, verbose=False)

        pareto_front, ranked = compute_pareto_front(
            evaluated, weight_net_benefit=weight_net_benefit, weight_oil_recovery=weight_oil_recovery,
            weight_sor_minimization=weight_sor_minimization, weight_risk_minimization=weight_risk_minimization)
        infeasible = sum(1 for c in evaluated if c.status == "INFEASIBLE")
        exec_time = round(time.time() - t_start, 2)

        if not pareto_front:
            return OptimizationRunResult(
                well_id=well_id, optimization_mode=mode, status="NO_FEASIBLE_SOLUTION",
                current_configuration=curr_point, recommended_configuration=None, pareto_front=[],
                total_evaluated_count=len(evaluated), feasible_count=0, infeasible_count=infeasible,
                comparison_table=[], delta_summary={}, confidence_score=0.35, recommendation_mode="VERY_LOW",
                explanation="No evaluated operating point satisfied all hard constraints.",
                contributing_factors=["Every candidate violated at least one mechanical, thermal or float limit."],
                constraints_checked=[], execution_time_seconds=exec_time, evaluations=len(evaluated), seed=seed,
                srp_policy=policy, evaluated_points=evaluated)

        best = pareto_front[0]
        improves = (best.net_benefit_usd > curr_point.net_benefit_usd * 1.01
                    or best.min_float_margin_index > curr_point.min_float_margin_index * 1.05
                    or best.steam_oil_ratio < curr_point.steam_oil_ratio * 0.98
                    or curr_point.status == "INFEASIBLE")
        opt_status = "FEASIBLE" if improves else "NO_IMPROVEMENT_FOUND"

        pct = lambda a, b, floor: (a - b) / max(abs(b), floor) * 100.0  # noqa: E731
        delta_summary = {
            "oil_recovery_change_pct": round(pct(best.cumulative_oil_bbl, curr_point.cumulative_oil_bbl, 1.0), 1),
            "net_benefit_change_usd": round(best.net_benefit_usd - curr_point.net_benefit_usd, 2),
            "steam_oil_ratio_change_pct": round(pct(best.steam_oil_ratio, curr_point.steam_oil_ratio, 0.1), 1),
            "energy_intensity_change_pct": round(pct(best.energy_intensity_kwh_per_bbl, curr_point.energy_intensity_kwh_per_bbl, 0.1), 1),
            "failure_risk_change_pct": round(pct(best.failure_risk_probability, curr_point.failure_risk_probability, 0.05), 1),
            "float_margin_improvement": round(best.min_float_margin_index - curr_point.min_float_margin_index, 3),
            "float_days_change": best.float_days - curr_point.float_days,
        }

        def row(name, a, b, unit, f="{:.1f}", d="{:+.1f}"):
            return RecommendationComparison(name, f.format(a), f.format(b), unit, d.format(b - a))

        comparison = [
            row("Steam Volume", curr_point.steam_volume_tonnes, best.steam_volume_tonnes, "t", "{:.0f}", "{:+.0f}"),
            row("Injection Pressure", curr_point.injection_pressure_bar, best.injection_pressure_bar, "bar"),
            row("Injection Duration", curr_point.injection_duration_days, best.injection_duration_days, "d"),
            row("Soak Duration", curr_point.soak_days, best.soak_days, "d"),
            row("Pumping Speed", curr_point.spm, best.spm, "SPM", "{:.2f}", "{:+.2f}"),
            row("Stroke Length", curr_point.stroke_length_inch, best.stroke_length_inch, "in", "{:.0f}", "{:+.0f}"),
            row("VFD Downstroke Ratio", curr_point.vfd_downstroke_ratio, best.vfd_downstroke_ratio, "-", "{:.2f}", "{:+.2f}"),
            row("Economic Cutoff", curr_point.economic_cutoff_bpd, best.economic_cutoff_bpd, "bbl/d"),
            row("Cumulative oil", curr_point.cumulative_oil_bbl, best.cumulative_oil_bbl, "bbl", "{:.0f}", "{:+.0f}"),
            row("Steam-oil ratio", curr_point.steam_oil_ratio, best.steam_oil_ratio, "t/t", "{:.2f}", "{:+.2f}"),
            row("Net benefit", curr_point.net_benefit_usd, best.net_benefit_usd, "USD", "{:,.0f}", "{:+,.0f}"),
            row("Min float margin", curr_point.min_float_margin_index, best.min_float_margin_index, "-", "{:.3f}", "{:+.3f}"),
            row("Float-days", curr_point.float_days, best.float_days, "d", "{:.0f}", "{:+.0f}"),
        ]
        if best.srp_policy == "adaptive":
            comparison.append(RecommendationComparison("SRP policy", curr_point.srp_policy, "adaptive", "-",
                                                       f"M_target {best.srp_m_target:.2f}, fillage >= {best.srp_min_fillage:.2f}"))

        margins = {
            "float": best.min_float_margin_index - _SL.min_rod_float_margin_index,
            "p_inj": P_INJ_LIMIT - best.injection_pressure_bar,
            "goodman": _SL.max_goodman_stress_ratio - best.goodman_stress_ratio,
            "torque_pct": (_SL.max_gearbox_torque_in_lbs - best.peak_gearbox_torque_in_lbs) / _SL.max_gearbox_torque_in_lbs * 100.0,
            "pip": best.pump_intake_pressure_bar - _SL.min_pump_intake_pressure_bar,
        }
        st = lambda m: "PASSED" if m >= 0 else "VIOLATED"  # noqa: E731
        constraints_checked = [
            {"name": f"Rod float margin >= {_SL.min_rod_float_margin_index:.2f}", "margin": f"{margins['float']:+.3f}", "status": st(margins["float"])},
            {"name": f"Injection pressure <= {P_INJ_LIMIT:.0f} bar (0.9 x fracture)", "margin": f"{margins['p_inj']:+.1f} bar", "status": st(margins["p_inj"])},
            {"name": f"Goodman ratio <= {_SL.max_goodman_stress_ratio:.2f}", "margin": f"{margins['goodman']:+.3f}", "status": st(margins["goodman"])},
            {"name": f"Gearbox torque <= {_SL.max_gearbox_torque_in_lbs:,.0f} in-lbf", "margin": f"{margins['torque_pct']:+.1f}%", "status": st(margins["torque_pct"])},
            {"name": f"Pump intake pressure >= {_SL.min_pump_intake_pressure_bar:.1f} bar", "margin": f"{margins['pip']:+.1f} bar", "status": st(margins["pip"])},
        ]

        # Scenario-robustness error (replaces the former hardcoded 8 % 'validation error').
        # No field history exists, so there is no validation error to report. What can be computed is how much of
        # the projected net benefit disappears when the chosen plan meets a heat-loss anomaly it was not planned for.
        # It feeds the same confidence slot and is labelled as such.
        stress_day = cooling_anomaly_day if cooling_anomaly_day else 35
        stress_sev = max(20.0, cooling_anomaly_severity_pct + 15.0)
        robust_err = 0.30            # worst case if the stress evaluation cannot run
        robust_evaluated = False
        try:
            best_vals = {
                "steam_volume_tonnes": best.steam_volume_tonnes, "soak_duration_days": best.soak_days,
                "spm": cur["spm"] if best.srp_policy == "adaptive" else best.spm,
                "stroke_length_inch": best.stroke_length_inch, "vfd_downstroke_ratio": best.vfd_downstroke_ratio,
                "injection_pressure_bar": best.injection_pressure_bar, "injection_duration_days": best.injection_duration_days,
                "economic_cutoff_bpd": best.economic_cutoff_bpd, "srp_m_target": best.srp_m_target,
                "srp_min_fillage": best.srp_min_fillage,
            }
            stressed = self._evaluate("ROBUST", well_id, cycle_number, best_vals, best.srp_policy,
                                      stress_day, stress_sev, carried_state)
            robust_err = float(np.clip(abs(best.net_benefit_usd - stressed.net_benefit_usd)
                                       / max(abs(best.net_benefit_usd), 1.0), 0.0, 0.30))
            robust_evaluated = True
        except Exception:
            pass

        # Confidence heuristic (distance from the nominal operating point)
        d_steam = abs(best.steam_volume_tonnes - 3000.0) / 1500.0
        d_spm = abs(best.spm - 4.5) / 3.0
        d_vfd = abs(best.vfd_downstroke_ratio - 1.0) / 0.5
        anom = (cooling_anomaly_severity_pct / 100.0) * 0.45
        dist = float(np.clip(0.08 + 0.25 * ((d_steam + d_spm + d_vfd) / 3.0) + anom, 0.05, 0.95))
        spread = float(np.clip(0.08 + 0.15 * dist, 0.05, 0.45))
        headroom = min(max(0.0, margins["float"]), max(0.0, margins["p_inj"] / P_INJ_LIMIT),
                       max(0.0, margins["goodman"] / _SL.max_goodman_stress_ratio), max(0.0, margins["torque_pct"] / 100.0))
        quality = 0.96 if cooling_anomaly_severity_pct == 0 else max(0.40, 0.96 - cooling_anomaly_severity_pct / 200.0)
        conf = self.conf_estimator.compute_confidence(
            prediction_spread_pct=round(spread, 3), validation_error_pct=round(robust_err, 3),
            distance_to_training_distribution=round(dist, 3), data_quality_score=round(quality, 2),
            are_physics_inputs_in_range=best.status != "INFEASIBLE", min_constraint_margin_pct=max(0.02, headroom))
        conf_breakdown = {
            "confidence_type": "Simulation confidence (heuristic)",
            "overall_simulation_confidence": round(conf.overall_confidence_score, 2),
            "data_completeness": round(quality, 2),
            "extrapolation_distance": round(dist, 3),
            "scenario_model_agreement": round(1.0 - spread, 3),
            "scenario_robustness_error_pct": round(robust_err * 100.0, 1),
            "robustness_scenario": f"{stress_sev:.0f} % heat-loss anomaly from day {stress_day}" if robust_evaluated else "not evaluated (worst case assumed)",
            "disclaimer": ("Heuristic. The 'historical validation error' term is the net-benefit loss under an unplanned heat-loss "
                           "anomaly, not an error against field data (none exists). Not calibrated to field data."),
        }

        lift = (f"adaptive daily SPM (M_target {best.srp_m_target:.2f}, fillage >= {best.srp_min_fillage:.2f}), "
                f"cycle-mean {best.spm:.2f} SPM, max {best.max_spm:.2f}") if best.srp_policy == "adaptive" else f"{best.spm:.2f} SPM"
        factors = [
            f"Steam {best.steam_volume_tonnes:.0f} t at {best.injection_pressure_bar:.0f} bar bottomhole; SOR {best.steam_oil_ratio:.2f} t/t.",
            f"Lift: {lift}, stroke {best.stroke_length_inch:.0f} in, VFD ratio {best.vfd_downstroke_ratio:.2f}; "
            f"min float margin {best.min_float_margin_index:.3f}, {best.float_days} float-days.",
            f"Simulated net benefit ${best.net_benefit_usd:,.0f} ({delta_summary['net_benefit_change_usd']:+,.0f} vs current).",
        ]
        # Injection pressure pinned to its search bound is a model artifact, not an optimum: heat delivered per tonne
        # is nearly flat in pressure and no injectivity benefit is modelled, so flag it instead of presenting it as insight.
        p_lo = CSS_BOUNDS["injection_pressure_bar"][0]
        p_tol = 0.02 * (P_INJ_LIMIT - p_lo)
        p_at_upper = best.injection_pressure_bar >= P_INJ_LIMIT - p_tol
        p_at_lower = best.injection_pressure_bar <= p_lo + p_tol
        if mode != "SRP_ONLY" and (p_at_upper or p_at_lower):
            side = "upper" if p_at_upper else "lower"
            factors.append(
                f"Injection pressure ({best.injection_pressure_bar:.0f} bar) sits at the {side} search bound. Treat this as a "
                f"model artifact: heat per tonne is nearly flat in pressure and injectivity is not modelled.")
            conf_breakdown["injection_pressure_at_bound"] = side

        explanation = (f"NSGA-II ({len(evaluated)} evaluations, seed {seed}) over {len(names)} free variables in mode {mode}. "
                       f"Recommended: {factors[0]} {factors[1]}")

        return OptimizationRunResult(
            well_id=well_id, optimization_mode=mode, status=opt_status, current_configuration=curr_point,
            recommended_configuration=best, pareto_front=pareto_front, total_evaluated_count=len(evaluated),
            feasible_count=len(ranked), infeasible_count=infeasible, comparison_table=comparison,
            delta_summary=delta_summary, confidence_score=conf.overall_confidence_score,
            recommendation_mode=conf.recommendation_mode, confidence_breakdown=conf_breakdown,
            explanation=explanation, contributing_factors=factors, constraints_checked=constraints_checked,
            execution_time_seconds=round(time.time() - t_start, 2), evaluations=len(evaluated), seed=seed,
            srp_policy=policy, evaluated_points=evaluated)
