"""
Unit & Dynamic Tests for SRP Mechanics & Rod Floating.

Verifies:
1. Higher viscosity at fixed SPM implies lower float margin (higher float risk) and higher fluid drag
2. Rod floating onset detected when float margin index < 1.0
3. Reducing SPM or downstroke speed restores safe float margin (> 1.0)
4. Dynacard generator outputs valid closed loops and correct diagnostic labels
5. Full cycle simulation reproduces heating, cooling, viscosity swing, and late-cycle float onset
"""

import pytest
import numpy as np

from twin.srp.float_detection import RodFloatDetector
from twin.srp.dynacard import GibbsDynacardModel
from twin.srp.rod_string import RodStringModel
from twin.cycle import CSSCycleSimulator, CycleConfig

pytestmark = pytest.mark.unit

def test_higher_viscosity_increases_float_risk_at_fixed_spm():
    """Verify that as viscosity rises, float margin monotonically decreases."""
    detector = RodFloatDetector(submerged_weight_lbs=5800.0)
    spm = 5.0
    stroke = 100.0
    
    viscosities = [50.0, 500.0, 2000.0, 6000.0, 12000.0]
    margins = []
    drags = []
    
    for v in viscosities:
        res = detector.evaluate_float_margin(spm=spm, stroke_length_inch=stroke, viscosity_cp=v)
        margins.append(res.float_margin_index)
        drags.append(res.viscous_drag_force_lbs)
        
    # Check monotonic decrease of float margin:
    for i in range(len(margins) - 1):
        assert margins[i] > margins[i+1], (
            f"Float margin at {viscosities[i]} cP ({margins[i]}) must be > at {viscosities[i+1]} cP ({margins[i+1]})"
        )
        assert drags[i] < drags[i+1], (
            f"Drag force at {viscosities[i]} cP ({drags[i]}) must be < at {viscosities[i+1]} cP ({drags[i+1]})"
        )
        
    # At low viscosity (hot wellbore), margin is very safe (> 2.0)
    assert margins[0] > 2.0
    # At extreme viscosity (cold dead oil ~12000 cP), float occurs (margin < 1.0)
    assert margins[-1] < 1.0
    assert detector.evaluate_float_margin(spm=spm, stroke_length_inch=stroke, viscosity_cp=12000.0).is_rod_floating

def test_speed_reduction_restores_float_margin():
    """Verify that lowering SPM or using VFD downstroke ratio cures active rod floating."""
    detector = RodFloatDetector(submerged_weight_lbs=5800.0)
    high_visc = 7000.0
    
    # At 6.0 SPM, floating occurs:
    res_high_spm = detector.evaluate_float_margin(spm=6.0, stroke_length_inch=100.0, viscosity_cp=high_visc)
    assert res_high_spm.is_rod_floating
    assert res_high_spm.float_margin_index < 1.0
    
    # Reduce SPM to 2.5 SPM:
    res_low_spm = detector.evaluate_float_margin(spm=2.5, stroke_length_inch=100.0, viscosity_cp=high_visc)
    assert res_low_spm.float_margin_index > res_high_spm.float_margin_index
    assert res_low_spm.float_margin_index >= 1.0 # Restored!
    assert not res_low_spm.is_rod_floating

def test_dynacard_generation_and_labels():
    """Verify dynacards produce correct coordinates and diagnostic labels."""
    model = GibbsDynacardModel(num_card_points=100)
    
    # Normal card:
    res_norm = model.generate_dynacards(
        stroke_length_inch=100.0,
        spm=4.0,
        submerged_rod_weight_lbs=5500.0,
        plunger_fluid_load_lbs=4200.0,
        viscosity_cp=80.0,
        pump_fillage=1.0,
        float_margin_index=2.5
    )
    assert len(res_norm.surface_position_inch) == 100
    assert len(res_norm.surface_load_lbs) == 100
    assert res_norm.diagnostic_card_label == "NORMAL"
    assert res_norm.peak_polished_rod_load_lbs > res_norm.min_polished_rod_load_lbs
    
    # Rod floating card:
    res_float = model.generate_dynacards(
        stroke_length_inch=100.0,
        spm=5.5,
        submerged_rod_weight_lbs=5500.0,
        plunger_fluid_load_lbs=4200.0,
        viscosity_cp=8000.0,
        pump_fillage=1.0,
        float_margin_index=0.65
    )
    assert res_float.diagnostic_card_label == "ROD_FLOATING"
    # When floating occurs, downstroke load drops to near-zero or negative
    assert res_float.min_polished_rod_load_lbs < 200.0

def test_full_cycle_simulation_heating_cooling_and_float_onset():
    """
    End-to-end Phase 1 test:
    Verifies that a full cycle shows:
    1. Initial high temperature after steam injection
    2. Viscosity drops by orders of magnitude initially
    3. Gradual reservoir cooling during the production phase
    4. Viscosity climbs back up as well cools
    5. At fixed SPM, float margin drops and eventually triggers float events as cooling progresses!
    """
    cfg = CycleConfig(
        well_id="TEST-WELL-01",
        steam_volume_tonnes=3000.0,
        injection_duration_days=15.0,
        soak_duration_days=6.0,
        production_duration_days=90.0,
        spm=7.5,                  # maximum fixed SPM, long stroke, no VFD compensation
        stroke_length_inch=144.0,
        economic_cutoff_oil_rate_bpd=5.0
    )
    sim = CSSCycleSimulator(cfg)
    result = sim.run_simulation()
    
    assert len(result.daily_history) > 30
    assert result.total_oil_produced_bbl > 100.0
    assert result.steam_oil_ratio > 0.0
    
    first_day = result.daily_history[0]
    last_day = result.daily_history[-1]
    
    # Verify heating then cooling:
    assert first_day.temperature_c > last_day.temperature_c
    assert first_day.temperature_c > 100.0 # Hot after soak
    assert last_day.temperature_c < 90.0   # Cooled down

    # Viscosity swing (Andrade): thin hot crude early, at least 10x thicker at end of cycle
    assert first_day.viscosity_cp < 100.0
    assert last_day.viscosity_cp > 10.0 * first_day.viscosity_cp

    # Float margin declines as viscosity rises
    assert first_day.float_margin_index > last_day.float_margin_index
    assert first_day.float_margin_index > 1.5
    # At fixed 7.5 SPM x 144 in without VFD the cooled well floats late in the cycle
    assert result.total_float_events_count > 0
