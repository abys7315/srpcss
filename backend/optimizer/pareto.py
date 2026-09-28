"""
Pareto Multi-Objective Analysis & Non-Dominated Sorting.

Finds the Pareto-optimal frontier balancing:
1. Oil Production / Recovery (Maximize)
2. Net Economic Benefit (Maximize)
3. Steam-to-Oil Ratio - SOR (Minimize)
4. Equipment / Rod Floating Risk (Minimize)

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
import numpy as np

@dataclass
class ParetoSolutionPoint:
    solution_id: str
    steam_volume_tonnes: float
    soak_days: float
    spm: float
    stroke_length_inch: float
    vfd_downstroke_ratio: float
    economic_cutoff_bpd: float
    
    # Objective metrics
    cumulative_oil_bbl: float
    net_benefit_usd: float
    steam_oil_ratio: float
    energy_intensity_kwh_per_bbl: float
    failure_risk_probability: float
    min_float_margin_index: float
    
    # Status & Pareto Rank
    pareto_rank: int
    is_non_dominated: bool
    status: str                         # "FEASIBLE", "NEAR_LIMIT", "INFEASIBLE"
    composite_score: float              # Weighted objective score
    provenance: str = "SIMULATED"

def compute_pareto_front(
    candidates: List[ParetoSolutionPoint],
    weight_net_benefit: float = 0.45,
    weight_oil_recovery: float = 0.25,
    weight_sor_minimization: float = 0.15,
    weight_risk_minimization: float = 0.15
) -> Tuple[List[ParetoSolutionPoint], List[ParetoSolutionPoint]]:
    """
    Computes non-dominated front and ranks feasible solutions.
    Returns (non_dominated_front, all_ranked_candidates).
    """
    # Filter only feasible or near_limit solutions for Pareto consideration:
    feasible_cands = [c for c in candidates if c.status in ["FEASIBLE", "NEAR_LIMIT"]]
    if not feasible_cands:
        return [], []

    # Objectives vector for minimization:
    # Obj 1: -Oil (min)
    # Obj 2: -NetBenefit (min)
    # Obj 3: +SOR (min)
    # Obj 4: +Risk (min)
    objs = np.array([
        [-c.cumulative_oil_bbl, -c.net_benefit_usd, c.steam_oil_ratio, c.failure_risk_probability]
        for c in feasible_cands
    ])

    n = len(feasible_cands)
    is_dominated = np.zeros(n, dtype=bool)

    for i in range(n):
        for j in range(n):
            if i != j:
                # Does j dominate i? (j <= i on all and j < i on at least one)
                if np.all(objs[j] <= objs[i]) and np.any(objs[j] < objs[i]):
                    is_dominated[i] = True
                    break

    # Normalize objectives for composite score ranking [0, 1]:
    oil_vals = np.array([c.cumulative_oil_bbl for c in feasible_cands])
    nb_vals = np.array([c.net_benefit_usd for c in feasible_cands])
    sor_vals = np.array([c.steam_oil_ratio for c in feasible_cands])
    risk_vals = np.array([c.failure_risk_probability for c in feasible_cands])

    norm_oil = (oil_vals - np.min(oil_vals)) / max(np.ptp(oil_vals), 1.0)
    norm_nb = (nb_vals - np.min(nb_vals)) / max(np.ptp(nb_vals), 1.0)
    norm_sor = 1.0 - (sor_vals - np.min(sor_vals)) / max(np.ptp(sor_vals), 0.1) # Inverse: lower is better
    norm_risk = 1.0 - (risk_vals - np.min(risk_vals)) / max(np.ptp(risk_vals), 0.05)

    composite_scores = (
        weight_oil_recovery * norm_oil +
        weight_net_benefit * norm_nb +
        weight_sor_minimization * norm_sor +
        weight_risk_minimization * norm_risk
    )

    ranked_list = []
    front = []
    for idx, cand in enumerate(feasible_cands):
        is_front = not is_dominated[idx]
        cand.is_non_dominated = is_front
        cand.pareto_rank = 1 if is_front else 2
        cand.composite_score = round(float(composite_scores[idx]), 3)
        ranked_list.append(cand)
        if is_front:
            front.append(cand)

    # Sort by composite score descending
    ranked_list.sort(key=lambda x: x.composite_score, reverse=True)
    front.sort(key=lambda x: x.composite_score, reverse=True)

    return front, ranked_list
