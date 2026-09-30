"""
Multi-cycle CSS planning with carried reservoir state and one-cycle lookahead.

Cycles are chained: cumulative oil, heated pore volume and heated-zone oil saturation from cycle k
initialise cycle k+1 (twin/cycle.py). For each cycle the steam volume is chosen from a grid to
maximise  NB_k(s_k) + max_{s_{k+1}} NB_{k+1}(s_{k+1} | state after s_k)  (no lookahead on the last
cycle). Other settings are held at the supplied configuration; the SRP policy defaults to adaptive.
A constant-steam plan with the same settings is simulated for comparison.

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
import time

from core.config import canonical_config
from .objective import CandidateEvaluator
from .pareto import ParetoSolutionPoint

STEAM_GRID = [1500.0, 2000.0, 2500.0, 3000.0, 3500.0, 4000.0, 4500.0]
BBL_PER_M3 = 6.2898


@dataclass
class CyclePlanRow:
    cycle_number: int
    steam_volume_tonnes: float
    cumulative_oil_bbl: float
    steam_oil_ratio: float
    net_benefit_usd: float
    recovery_factor_pct: float
    heated_zone_oil_saturation_end: float
    float_days: int
    min_float_margin_index: float
    status: str


@dataclass
class MulticyclePlan:
    well_id: str
    n_cycles: int
    srp_policy: str
    optimized: List[CyclePlanRow]
    constant_steam: List[CyclePlanRow]
    optimized_total_net_benefit_usd: float
    constant_total_net_benefit_usd: float
    optimized_total_oil_bbl: float
    constant_total_oil_bbl: float
    evaluations: int
    execution_time_seconds: float
    method: str = "Per-cycle steam grid search with one-cycle lookahead over carried state"
    provenance: str = "SIMULATED"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _next_state(prev: Dict[str, Any], pt: ParetoSolutionPoint) -> Dict[str, Any]:
    return {
        "cumulative_prior_oil_produced_m3": round(prev.get("cumulative_prior_oil_produced_m3", 0.0) + pt.cumulative_oil_bbl / BBL_PER_M3, 3),
        "prior_heated_pore_volume_m3": round(max(prev.get("prior_heated_pore_volume_m3", 0.0), pt.heated_pore_volume_m3), 3),
        "prior_heated_zone_oil_saturation": round(pt.final_heated_zone_oil_saturation, 5),
        "prior_elapsed_days": round(prev.get("prior_elapsed_days", 0.0) + pt.cycle_duration_days, 2),
    }


def _row(k: int, pt: ParetoSolutionPoint) -> CyclePlanRow:
    return CyclePlanRow(k, pt.steam_volume_tonnes, round(pt.cumulative_oil_bbl, 1), round(pt.steam_oil_ratio, 2),
                        round(pt.net_benefit_usd, 0), round(pt.recovery_factor_pct, 3),
                        round(pt.final_heated_zone_oil_saturation, 4), pt.float_days,
                        round(pt.min_float_margin_index, 3), pt.status)


def optimize_multicycle(well_id: str, n_cycles: int = 3, base_cfg: Optional[Dict[str, Any]] = None,
                        srp_policy: str = "adaptive", start_cycle: int = 1) -> MulticyclePlan:
    t0 = time.time()
    c = canonical_config
    cfg = {
        "soak_duration_days": c.css.default_soak_days, "spm": c.srp.standard_spm,
        "stroke_length_inch": c.srp.standard_stroke_length_inch, "vfd_downstroke_ratio": 1.0,
        "injection_pressure_bar": c.css.default_injection_pressure_bar,
        "injection_duration_days": c.css.default_injection_duration_days,
        "economic_cutoff_bpd": c.css.default_production_cutoff_oil_rate_bpd,
        "steam_volume_tonnes": c.css.default_steam_volume_tonnes,
        **(base_cfg or {}),
    }
    ev = CandidateEvaluator()
    count = {"n": 0}

    def sim(k: int, steam: float, state: Dict[str, Any]) -> ParetoSolutionPoint:
        count["n"] += 1
        pt = ev.evaluate_candidate(
            candidate_id=f"C{k}-{steam:.0f}", well_id=well_id, cycle_number=k, steam_volume_tonnes=steam,
            soak_days=cfg["soak_duration_days"], spm=cfg["spm"], stroke_length_inch=cfg["stroke_length_inch"],
            vfd_downstroke_ratio=cfg["vfd_downstroke_ratio"], injection_pressure_bar=cfg["injection_pressure_bar"],
            injection_duration_days=cfg["injection_duration_days"], economic_cutoff_bpd=cfg["economic_cutoff_bpd"],
            srp_policy=srp_policy, carried_state=state or None,
        )
        return pt

    def value(pt: ParetoSolutionPoint) -> float:
        return pt.net_benefit_usd if pt.status != "INFEASIBLE" else -1e12

    optimized: List[CyclePlanRow] = []
    state: Dict[str, Any] = {}
    last = start_cycle + n_cycles - 1
    for k in range(start_cycle, last + 1):
        best_pt, best_score = None, -float("inf")
        for s in STEAM_GRID:
            pt = sim(k, s, state)
            score = value(pt)
            if k < last:
                nxt = _next_state(state, pt)
                score += max(value(sim(k + 1, s2, nxt)) for s2 in STEAM_GRID)
            if score > best_score:
                best_pt, best_score = pt, score
        optimized.append(_row(k, best_pt))
        state = _next_state(state, best_pt)

    constant: List[CyclePlanRow] = []
    state = {}
    for k in range(start_cycle, last + 1):
        pt = sim(k, cfg["steam_volume_tonnes"], state)
        constant.append(_row(k, pt))
        state = _next_state(state, pt)

    return MulticyclePlan(
        well_id=well_id, n_cycles=n_cycles, srp_policy=srp_policy, optimized=optimized, constant_steam=constant,
        optimized_total_net_benefit_usd=round(sum(r.net_benefit_usd for r in optimized), 0),
        constant_total_net_benefit_usd=round(sum(r.net_benefit_usd for r in constant), 0),
        optimized_total_oil_bbl=round(sum(r.cumulative_oil_bbl for r in optimized), 1),
        constant_total_oil_bbl=round(sum(r.cumulative_oil_bbl for r in constant), 1),
        evaluations=count["n"], execution_time_seconds=round(time.time() - t0, 2),
    )
