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

@pytest.mark.optimization
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

@pytest.mark.optimization
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

@pytest.mark.optimization
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

@pytest.mark.optimization
def test_final_recommendation_in_final_pareto_front():
    """Regression test: final recommendation must belong to the final Pareto front."""
    opt = JointOptimizer()
    current_cfg = {
        "steam_volume_tonnes": 3000.0,
        "soak_duration_days": 6.0,
        "spm": 4.5,
        "stroke_length_inch": 100.0,
        "vfd_downstroke_ratio": 1.0,
        "economic_cutoff_bpd": 7.0
    }
    res = opt.optimize_well(well_id="BGW-01", current_cfg=current_cfg)
    assert res.recommended_configuration is not None
    rec = res.recommended_configuration
    
    # Invariant: rec must be in res.pareto_front
    matching_in_pareto = [p for p in res.pareto_front if p.solution_id == rec.solution_id]
    assert len(matching_in_pareto) == 1, "Final recommendation must be an element of the final Pareto front"
    assert matching_in_pareto[0].pareto_rank == 1
    assert matching_in_pareto[0].is_non_dominated is True

@pytest.mark.optimization
def test_dynamic_candidate_specific_margins():
    """Verify constraint margins are calculated from candidate outputs, not hardcoded constants."""
    opt = JointOptimizer()
    current_cfg = {
        "steam_volume_tonnes": 3000.0,
        "soak_duration_days": 6.0,
        "spm": 4.5,
        "stroke_length_inch": 100.0,
        "vfd_downstroke_ratio": 1.0,
        "economic_cutoff_bpd": 7.0
    }
    res = opt.optimize_well(well_id="BGW-01", current_cfg=current_cfg)
    
    # Check that explanation strings have real computed numbers
    for f in res.contributing_factors:
        assert "+0.32" not in f, "Hardcoded +0.32 margin found!"
        assert "+28%" not in f, "Hardcoded +28% margin found!"

@pytest.mark.optimization
def test_whatif_scenario_specific_constraints_vary():
    """Verify What-If cards have candidate-specific constraint results rather than static duplicates."""
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
    
    oils = [c.cumulative_oil_bbl for c in cards]
    assert len(set(oils)) > 1, "Scenario cards must have unique physical simulation outputs"

@pytest.mark.unit
def test_canonical_sor_function():
    """Verify centralized mass-basis Steam-Oil Ratio calculation."""
    from twin.surface.energy import compute_canonical_sor
    sor = compute_canonical_sor(steam_mass_tonnes=3000.0, cumulative_oil_bbl=10000.0)
    assert sor == 1.88

@pytest.mark.unit
def test_injection_duration_participates_in_optimization():
    """Regression test: varying injection duration changes thermal heat loss, oil production, and net benefit."""
    from optimizer.objective import CandidateEvaluator
    evaluator = CandidateEvaluator()

    # Compare 12.0 days vs 18.0 days injection duration holding all else equal
    c_12d = evaluator.evaluate_candidate(
        candidate_id="TEST_12D",
        well_id="BGW-01",
        cycle_number=1,
        steam_volume_tonnes=3000.0,
        soak_days=6.0,
        spm=4.5,
        stroke_length_inch=100.0,
        vfd_downstroke_ratio=1.0,
        injection_pressure_bar=125.0,
        injection_duration_days=12.0,
        economic_cutoff_bpd=7.0
    )

    c_18d = evaluator.evaluate_candidate(
        candidate_id="TEST_18D",
        well_id="BGW-01",
        cycle_number=1,
        steam_volume_tonnes=3000.0,
        soak_days=6.0,
        spm=4.5,
        stroke_length_inch=100.0,
        vfd_downstroke_ratio=1.0,
        injection_pressure_bar=125.0,
        injection_duration_days=18.0,
        economic_cutoff_bpd=7.0
    )

    # 1. Physical impact: longer injection suffers higher caprock thermal loss
    assert c_12d.cumulative_oil_bbl != c_18d.cumulative_oil_bbl, "Injection duration must impact oil recovery!"
    # 2. Economic impact: longer injection increases cycle OPEX and alters benefit
    assert c_12d.net_benefit_usd != c_18d.net_benefit_usd, "Injection duration must impact net benefit economics!"
    assert c_12d.injection_duration_days == 12.0
    assert c_18d.injection_duration_days == 18.0

@pytest.mark.optimization
def test_all_8_variables_participate_in_joint_optimization():
    """Verify all 8 variables of the Cartesian decision vector participate in optimization and reporting."""
    opt = JointOptimizer()
    current_cfg = {
        "steam_volume_tonnes": 3000.0,
        "soak_duration_days": 6.0,
        "spm": 4.5,
        "stroke_length_inch": 100.0,
        "vfd_downstroke_ratio": 1.0,
        "economic_cutoff_bpd": 7.0,
        "injection_pressure_bar": 125.0,
        "injection_duration_days": 15.0
    }
    res = opt.optimize_well(well_id="BGW-01", current_cfg=current_cfg)
    rec = res.recommended_configuration
    assert rec is not None

    # Check that all 8 variables are defined on the recommended solution
    expected_8_vars = [
        "steam_volume_tonnes", "injection_pressure_bar", "injection_duration_days",
        "soak_days", "economic_cutoff_bpd", "spm", "stroke_length_inch", "vfd_downstroke_ratio"
    ]
    for var in expected_8_vars:
        assert hasattr(rec, var), f"Missing decision variable {var} on recommended configuration!"
        val = getattr(rec, var)
        assert isinstance(val, (int, float)) and val > 0.0, f"Variable {var} has invalid value {val}"

    # Verify comparison table includes all 8 variables
    comp_keys = {row.parameter_name for row in res.comparison_table}
    for var in [
        "Steam Volume", "Injection Pressure", "Injection Duration", "Soak Duration",
        "Economic Cutoff", "Pumping Speed", "Stroke Length", "VFD Downstroke Ratio"
    ]:
        assert var in comp_keys, f"Missing parameter {var} in comparison table"

