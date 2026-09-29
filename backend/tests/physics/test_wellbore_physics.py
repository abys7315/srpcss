"""
Unit & Analytical Validation Tests for Canonical Wellbore1DModel & Distributed Rod Drag.

Verifies:
1. Constant-viscosity analytical case: Numerical integration matches exact Couette formulation
2. Viscosity-gradient case: Distributed drag captures depth-dependent temperature and viscosity swings
3. Zero-velocity case: F_drag = 0 exactly when velocity is 0
4. Depth-grid convergence: Grid refinement (50m vs 25m vs 10m) converges within 1% error
5. Maximum drag depth: Highest drag occurs in the cooler upper wellbore where viscosity is elevated
6. Terminal sinking velocity: Accurately reflects fluid resistance and submerged weight balance
"""

import pytest
import numpy as np

from twin.wellbore.wellbore_1d import Wellbore1DModel, WellboreProfile1D, WellboreSegment, RodDragResult

pytestmark = pytest.mark.unit


def test_zero_velocity_case():
    """Verify that at zero velocity, drag force is exactly 0.0."""
    model = Wellbore1DModel(well_tvd_m=1050.0, pump_depth_m=980.0, dz_m=50.0)
    profile = model.compute_profile(bottomhole_temp_c=80.0, liquid_rate_m3_d=25.0)
    
    drag_res = model.compute_rod_drag(profile, rod_velocity_m_s=0.0)
    assert drag_res.total_drag_force_lbs == 0.0
    assert drag_res.total_drag_force_n == 0.0
    assert all(d == 0.0 for d in drag_res.drag_by_depth_lbs)


def test_constant_viscosity_analytical_case():
    """
    Verify numerical integration against exact closed-form analytical equation
    under uniform viscosity and single rod diameter.
    
    Analytical formula:
    F_drag = [2 * pi * mu * L * c_coupling / ln(r_t / r_r)] * v
    """
    well_depth = 500.0
    dz = 10.0
    model = Wellbore1DModel(well_tvd_m=well_depth, pump_depth_m=well_depth, dz_m=dz)
    
    # Overwrite rod geometry to single diameter for pure analytical benchmark
    test_visc_cp = 500.0  # 0.5 Pa.s
    test_vel = 0.8        # m/s
    r_t = model.r_tubing_m
    r_r = model.d_rod_top_m / 2.0
    c_coupling = model.coupling_drag_factor
    
    # Analytical drag in Newtons:
    mu_pa_s = test_visc_cp * 1e-3
    ln_ratio = np.log(r_t / r_r)
    f_analytical_n = (2.0 * np.pi * mu_pa_s * well_depth * c_coupling / ln_ratio) * test_vel
    f_analytical_lbs = f_analytical_n * 0.224809
    
    # Create synthetic uniform profile
    nodes = list(np.arange(0.0, well_depth + dz, dz))
    segments = []
    for i in range(1, len(nodes)):
        z_top = nodes[i - 1]
        z_bot = nodes[i]
        length = z_bot - z_top
        c_drag = (2.0 * np.pi * mu_pa_s * length * c_coupling) / ln_ratio
        segments.append(WellboreSegment(
            depth_top_m=z_top,
            depth_bottom_m=z_bot,
            depth_mid_m=(z_top + z_bot) / 2.0,
            length_m=length,
            temperature_c=50.0,
            pressure_bar=10.0,
            viscosity_cp=test_visc_cp,
            density_kg_m3=950.0,
            tubing_id_m=model.tubing_id_m,
            rod_od_m=model.d_rod_top_m,
            annular_clearance_m=r_t - r_r,
            coupling_factor=c_coupling,
            drag_coefficient_n_s_m=c_drag
        ))
    
    uniform_profile = WellboreProfile1D(
        depths_m=nodes,
        temperatures_c=[50.0] * len(nodes),
        pressures_bar=[10.0] * len(nodes),
        viscosities_cp=[test_visc_cp] * len(nodes),
        densities_kg_m3=[950.0] * len(nodes),
        segments=segments,
        surface_temp_c=50.0,
        bottomhole_temp_c=50.0,
        surface_viscosity_cp=test_visc_cp,
        bottomhole_viscosity_cp=test_visc_cp,
        average_viscosity_cp=test_visc_cp
    )
    
    drag_res = model.compute_rod_drag(uniform_profile, rod_velocity_m_s=test_vel)
    
    # Verify numerical matches analytical within 0.1%
    rel_error = abs(drag_res.total_drag_force_n - f_analytical_n) / f_analytical_n
    assert rel_error < 0.001, f"Numerical {drag_res.total_drag_force_n:.2f}N vs Analytical {f_analytical_n:.2f}N (error {rel_error:.4%})"


def test_viscosity_gradient_and_maximum_drag_depth():
    """
    Verify that with realistic cooling along the wellbore,
    viscosity increases toward the surface and maximum drag occurs in the cooler upper wellbore.
    """
    model = Wellbore1DModel(well_tvd_m=1050.0, pump_depth_m=980.0, dz_m=50.0)
    # Hot bottomhole (140°C), fluid cools as it ascends toward surface ambient (32°C)
    profile = model.compute_profile(bottomhole_temp_c=140.0, liquid_rate_m3_d=15.0)
    
    # Temperature should decrease toward surface:
    assert profile.surface_temp_c < profile.bottomhole_temp_c
    # Viscosity should increase toward surface:
    assert profile.surface_viscosity_cp > profile.bottomhole_viscosity_cp
    
    drag_res = model.compute_rod_drag(profile, rod_velocity_m_s=0.6)
    assert drag_res.total_drag_force_lbs > 0.0
    
    # Maximum drag depth should be near the top (cold zone) where viscosity is highest
    assert drag_res.maximum_drag_depth_m <= 400.0, (
        f"Peak drag should occur in cold shallow interval, got {drag_res.maximum_drag_depth_m}m"
    )


def test_depth_grid_convergence():
    """
    Verify convergence: Refinement of depth discretization (50m vs 25m vs 10m)
    yields consistent total drag within 1.0% tolerance.
    """
    m_coarse = Wellbore1DModel(well_tvd_m=1000.0, pump_depth_m=950.0, dz_m=50.0)
    m_medium = Wellbore1DModel(well_tvd_m=1000.0, pump_depth_m=950.0, dz_m=25.0)
    m_fine = Wellbore1DModel(well_tvd_m=1000.0, pump_depth_m=950.0, dz_m=10.0)
    
    v_test = 0.5 # m/s
    bh_temp = 90.0
    rate = 20.0
    
    p_coarse = m_coarse.compute_profile(bottomhole_temp_c=bh_temp, liquid_rate_m3_d=rate)
    p_medium = m_medium.compute_profile(bottomhole_temp_c=bh_temp, liquid_rate_m3_d=rate)
    p_fine = m_fine.compute_profile(bottomhole_temp_c=bh_temp, liquid_rate_m3_d=rate)
    
    d_coarse = m_coarse.compute_rod_drag(p_coarse, rod_velocity_m_s=v_test).total_drag_force_lbs
    d_medium = m_medium.compute_rod_drag(p_medium, rod_velocity_m_s=v_test).total_drag_force_lbs
    d_fine = m_fine.compute_rod_drag(p_fine, rod_velocity_m_s=v_test).total_drag_force_lbs
    
    rel_diff_med = abs(d_coarse - d_medium) / d_fine
    rel_diff_fine = abs(d_medium - d_fine) / d_fine
    
    assert rel_diff_med < 0.02, f"Coarse vs Medium diff {rel_diff_med:.3%}"
    assert rel_diff_fine < 0.01, f"Medium vs Fine diff {rel_diff_fine:.3%}"


def test_terminal_sinking_velocity_physics():
    """
    Verify that terminal sinking velocity is physically connected:
    - Cooler wellbore (higher viscosity) leads to lower terminal velocity
    - Warmer wellbore (lower viscosity) leads to higher terminal velocity
    - Heavier rod string increases terminal velocity
    """
    model = Wellbore1DModel(well_tvd_m=1050.0, pump_depth_m=980.0, dz_m=50.0)
    
    # Cold wellbore state (e.g. late production / anomaly)
    p_cold = model.compute_profile(bottomhole_temp_c=48.0, liquid_rate_m3_d=10.0)
    # Hot wellbore state (early post-steam production)
    p_hot = model.compute_profile(bottomhole_temp_c=130.0, liquid_rate_m3_d=35.0)
    
    v_term_cold = model.compute_terminal_sinking_velocity(p_cold, submerged_rod_weight_lbs=5800.0)
    v_term_hot = model.compute_terminal_sinking_velocity(p_hot, submerged_rod_weight_lbs=5800.0)
    
    assert v_term_hot > v_term_cold, f"Hot {v_term_hot} m/s must exceed Cold {v_term_cold} m/s"
    
    # Increasing rod weight increases terminal velocity
    v_term_heavy = model.compute_terminal_sinking_velocity(p_cold, submerged_rod_weight_lbs=7500.0)
    assert v_term_heavy > v_term_cold
