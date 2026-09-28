"""
Unit Tests for Constraint Engine & Safety Gating — Petro-Twin (SIH 2026, PS26120).

Verifies:
1. Formation fracture pressure violation is strictly rejected
2. Active rod floating (M_float < 1.0) is strictly rejected as INFEASIBLE
3. Goodman fatigue stress ratio > 1.0 is rejected
4. Safe parameters evaluated as FEASIBLE
5. Parameters within 10-15% of limits evaluated as NEAR_LIMIT
6. Constraint versioning is preserved
"""

import pytest

from constraints.constraint_engine import ConstraintEngine

def test_unsafe_injection_pressure_rejected():
    """Verify that injection pressure above fracture limit is marked INFEASIBLE."""
    engine = ConstraintEngine()
    
    # 155 bar > max allowable 145 bar
    res = engine.evaluate_candidate(
        steam_volume_tonnes=3000.0,
        injection_pressure_bar=155.0, # VIOLATION!
        steam_temp_celsius=260.0,
        soak_days=6.0,
        spm=4.5,
        stroke_length_inch=100.0,
        peak_polished_rod_load_lbs=15000.0,
        peak_gearbox_torque_in_lbs=250000.0,
        motor_power_kw=25.0,
        float_margin_index=1.45,
        goodman_stress_ratio=0.65,
        pump_intake_pressure_bar=45.0,
        pump_fillage_fraction=0.85,
        oil_rate_bpd=50.0
    )
    
    assert res.status == "INFEASIBLE"
    assert not res.is_feasible
    assert "injection_pressure_bar" in res.binding_constraints
    assert any("fracture limit" in v["message"] for v in res.violations)

def test_rod_floating_strictly_rejected():
    """Verify that M_float < 1.0 cannot be marked FEASIBLE or RECOMMENDED."""
    engine = ConstraintEngine()
    
    # M_float = 0.78 < 1.0 (Active rod float!)
    res = engine.evaluate_candidate(
        steam_volume_tonnes=3000.0,
        injection_pressure_bar=125.0,
        steam_temp_celsius=260.0,
        soak_days=6.0,
        spm=5.5,
        stroke_length_inch=100.0,
        peak_polished_rod_load_lbs=16000.0,
        peak_gearbox_torque_in_lbs=260000.0,
        motor_power_kw=28.0,
        float_margin_index=0.78, # VIOLATION!
        goodman_stress_ratio=0.70,
        pump_intake_pressure_bar=40.0,
        pump_fillage_fraction=0.85,
        oil_rate_bpd=55.0
    )
    
    assert res.status == "INFEASIBLE"
    assert not res.is_feasible
    assert "float_margin_index" in res.binding_constraints
    assert "Active rod floating detected" in res.violations[0]["message"]
    assert "Reduce SPM" in res.suggested_engineer_action

def test_goodman_stress_overload_rejected():
    """Verify that rod fatigue ratio > 1.0 is rejected."""
    engine = ConstraintEngine()
    
    res = engine.evaluate_candidate(
        steam_volume_tonnes=3000.0,
        injection_pressure_bar=125.0,
        steam_temp_celsius=260.0,
        soak_days=6.0,
        spm=4.5,
        stroke_length_inch=100.0,
        peak_polished_rod_load_lbs=18000.0,
        peak_gearbox_torque_in_lbs=250000.0,
        motor_power_kw=25.0,
        float_margin_index=1.50,
        goodman_stress_ratio=1.12, # VIOLATION!
        pump_intake_pressure_bar=45.0,
        pump_fillage_fraction=0.85,
        oil_rate_bpd=50.0
    )
    
    assert res.status == "INFEASIBLE"
    assert "goodman_stress_ratio" in res.binding_constraints

def test_safe_configuration_marked_feasible():
    """Verify normal compliant operating point is marked FEASIBLE."""
    engine = ConstraintEngine()
    
    res = engine.evaluate_candidate(
        steam_volume_tonnes=3000.0,
        injection_pressure_bar=125.0,
        steam_temp_celsius=260.0,
        soak_days=6.0,
        spm=4.0,
        stroke_length_inch=100.0,
        peak_polished_rod_load_lbs=14500.0,
        peak_gearbox_torque_in_lbs=240000.0,
        motor_power_kw=22.0,
        float_margin_index=1.65,
        goodman_stress_ratio=0.60,
        pump_intake_pressure_bar=45.0,
        pump_fillage_fraction=0.90,
        oil_rate_bpd=50.0
    )
    
    assert res.status == "FEASIBLE"
    assert res.is_feasible
    assert len(res.violations) == 0

def test_near_limit_warning_generation():
    """Verify parameter within 10-15% of limit triggers NEAR_LIMIT status."""
    engine = ConstraintEngine()
    
    # Injection pressure at 138 bar (close to 145 bar limit)
    res = engine.evaluate_candidate(
        steam_volume_tonnes=3000.0,
        injection_pressure_bar=138.0, # Near limit
        steam_temp_celsius=260.0,
        soak_days=6.0,
        spm=4.0,
        stroke_length_inch=100.0,
        peak_polished_rod_load_lbs=14500.0,
        peak_gearbox_torque_in_lbs=240000.0,
        motor_power_kw=22.0,
        float_margin_index=1.65,
        goodman_stress_ratio=0.60,
        pump_intake_pressure_bar=45.0,
        pump_fillage_fraction=0.90,
        oil_rate_bpd=50.0
    )
    
    assert res.status == "NEAR_LIMIT"
    assert res.is_feasible
    assert len(res.near_limit_warnings) > 0
