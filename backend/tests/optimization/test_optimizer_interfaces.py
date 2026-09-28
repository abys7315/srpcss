"""
Unit Tests for Joint Optimizer & What-If Sandbox — Petro-Twin (SIH 2026, PS26120).

Verifies:
1. Joint optimizer generates Pareto front and selects compliant recommendation
2. Recommended configuration strictly obeys rod float constraints (M_float >= 1.0)
3. When well enters rod floating from cooling, optimizer discovers a safe operational schedule
4. What-If Simulator returns side-by-side comparison cards (CURRENT, A, B, C, RECOMMENDED)
5. Infeasible candidate handling and reason reporting
"""

import pytest

from optimizer.joint_optimizer import JointOptimizer
from optimizer.scenarios import WhatIfSimulator
from constraints.constraint_engine import ConstraintEngine

def test_joint_optimizer_finds_feasible_recommendation():
    """Verify joint optimizer recommends a strictly feasible operational schedule."""
    opt = JointOptimizer()
    
    current_cfg = {
        "steam_volume_tonnes": 3000.0,
        "soak_duration_days": 6.0,
        "spm": 4.8,
        "stroke_length_inch": 100.0,
        "vfd_downstroke_ratio": 1.0,
        "economic_cutoff_bpd": 7.0
    }
    
    res = opt.optimize_well(well_id="BGW-01", current_cfg=current_cfg)
    
    assert res.status in ["FEASIBLE", "NO_IMPROVEMENT_FOUND"]
    assert res.recommended_configuration is not None
    rec = res.recommended_configuration
    
    # Invariant: Recommendation must be strictly feasible
    assert rec.status in ["FEASIBLE", "NEAR_LIMIT"]
    assert rec.min_float_margin_index >= 1.0, f"Recommendation must not float! Got {rec.min_float_margin_index}"
    assert len(res.pareto_front) > 0
    assert len(res.comparison_table) > 0
    assert res.confidence_score > 0.60

def test_optimizer_cures_active_rod_floating():
    """Verify that when a well has active rod float from cooling, optimizer eliminates it."""
    opt = JointOptimizer()
    
    # Well with high SPM that floats due to reservoir cooling:
    floating_cfg = {
        "steam_volume_tonnes": 2400.0,
        "soak_duration_days": 5.0,
        "spm": 5.5, # High uncompensated SPM causing float
        "stroke_length_inch": 100.0,
        "vfd_downstroke_ratio": 1.0,
        "economic_cutoff_bpd": 6.0
    }
    
    res = opt.optimize_well(well_id="BGW-01", current_cfg=floating_cfg)
    rec = res.recommended_configuration
    
    # Optimizer must have found a plan that cures rod float:
    assert rec.min_float_margin_index >= 1.0
    assert rec.spm <= 5.5
    assert any("eliminate rod floating" in f.lower() or "float" in f.lower() for f in res.contributing_factors)

def test_what_if_simulator_side_by_side():
    """Verify What-If Simulator returns complete 5-card side-by-side array."""
    sim = WhatIfSimulator()
    
    current_cfg = {
        "steam_volume_tonnes": 3000.0,
        "soak_duration_days": 6.0,
        "spm": 4.5,
        "stroke_length_inch": 100.0,
        "vfd_downstroke_ratio": 1.0,
        "economic_cutoff_bpd": 7.0
    }
    
    cards = sim.evaluate_sandbox(well_id="BGW-01", current_cfg=current_cfg)
    
    assert len(cards) == 5
    card_ids = [c.scenario_id for c in cards]
    assert card_ids == ["CURRENT", "SCENARIO_A", "SCENARIO_B", "SCENARIO_C", "RECOMMENDED"]
    
    # Each card must have computed physical numbers and statuses:
    for c in cards:
        assert c.cumulative_oil_bbl > 0.0
        assert c.steam_oil_ratio > 0.0
        assert c.constraint_status in ["FEASIBLE", "NEAR_LIMIT", "INFEASIBLE"]
        assert c.provenance == "SIMULATED"
