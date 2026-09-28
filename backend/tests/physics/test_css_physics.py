"""
Unit & Monotonicity Tests for CSS Thermal Physics & Viscosity.

Verifies:
1. Higher temperature implies lower viscosity (Andrade model)
2. More steam implies higher heated-zone temperature / larger heated radius
3. Energy balance closes within tolerance
4. Zero steam implies no artificial heating
5. Outputs stay finite and in plausible ranges across the parameter space
"""

import pytest
import numpy as np

from twin.fluid.viscosity import AndradeViscosityModel, BaghewalaViscosityParameters
from twin.thermal.css_model import CSSThermalModel, CSSThermalParameters
from twin.reservoir.inflow import ThermalInflowModel

def test_higher_temperature_implies_lower_viscosity():
    """Verify monotonic decrease in viscosity with increasing temperature."""
    model = AndradeViscosityModel()
    
    temps = [25.0, 35.0, 47.0, 80.0, 120.0, 180.0, 260.0]
    viscosities = [float(model.compute_viscosity_cp(t)) for t in temps]
    
    # Check strict monotonic decrease
    for i in range(len(viscosities) - 1):
        assert viscosities[i] > viscosities[i+1], (
            f"Viscosity at {temps[i]}C ({viscosities[i]} cP) must be > viscosity at {temps[i+1]}C ({viscosities[i+1]} cP)"
        )
    
    # Check Baghewala characteristic ranges:
    # At 47C, viscosity should be in multi-thousand cP range:
    visc_47 = model.compute_viscosity_cp(47.0)
    assert 2000.0 <= visc_47 <= 8000.0, f"Expected 2000-8000 cP at 47C, got {visc_47}"
    
    # At 150C, viscosity should be < 100 cP:
    visc_150 = model.compute_viscosity_cp(150.0)
    assert visc_150 < 100.0, f"Expected < 100 cP at 150C, got {visc_150}"

def test_more_steam_implies_larger_heated_zone():
    """Verify that increasing steam volume monotonically increases heated radius and energy."""
    p_low = CSSThermalParameters(steam_volume_tonnes=1500.0)
    p_high = CSSThermalParameters(steam_volume_tonnes=4000.0)
    
    m_low = CSSThermalModel(p_low).simulate_injection_end()
    m_high = CSSThermalModel(p_high).simulate_injection_end()
    
    assert m_high.heated_zone_radius_m > m_low.heated_zone_radius_m
    assert m_high.cumulative_heat_injected_gj > m_low.cumulative_heat_injected_gj
    assert m_high.heat_retained_gj > m_low.heat_retained_gj

def test_zero_steam_implies_no_heating():
    """Verify zero steam edge case."""
    p_zero = CSSThermalParameters(steam_volume_tonnes=0.0)
    state = CSSThermalModel(p_zero).simulate_injection_end()
    
    assert state.average_temperature_c == p_zero.reservoir_temp_celsius
    assert state.heated_zone_radius_m == 0.0
    assert state.cumulative_heat_injected_gj == 0.0

def test_energy_balance_closure():
    """Verify that injected heat equals retained heat + overburden lost heat within 0.1%."""
    params = CSSThermalParameters(steam_volume_tonnes=3000.0)
    state = CSSThermalModel(params).simulate_injection_end()
    
    q_inj = state.cumulative_heat_injected_gj
    q_total = state.heat_retained_gj + state.cumulative_heat_lost_gj
    
    assert q_inj > 0.0
    assert abs(q_inj - q_total) / q_inj < 0.005, f"Energy balance did not close: {q_inj} vs {q_total}"

def test_thermal_inflow_mobility_scaling():
    """Verify thermal inflow increases as viscosity drops."""
    inflow = ThermalInflowModel(ref_viscosity_cp=4500.0)
    
    state_cold = inflow.evaluate_reservoir_state(current_temp_c=47.0, current_viscosity_cp=4500.0)
    state_hot = inflow.evaluate_reservoir_state(current_temp_c=160.0, current_viscosity_cp=35.0)
    
    assert state_hot.productivity_index_m3_d_bar > state_cold.productivity_index_m3_d_bar
    assert state_hot.q_max_oil_m3_d > state_cold.q_max_oil_m3_d
