"""Adaptive SRP controller and NSGA-II optimizer checks."""

import math

import numpy as np
import pytest

from core.config import canonical_config as C
from optimizer.srp_controller import AdaptiveSRPController, SRPControlPolicy
from twin.cycle import CSSCycleSimulator, CycleConfig

pytestmark = pytest.mark.unit

BASE = dict(steam_volume_tonnes=3000.0, injection_pressure_bar=124.1, soak_duration_days=7.0,
            spm=4.0, economic_cutoff_oil_rate_bpd=0.0)


def _ok(_):
    return {"goodman": 0.3, "torque_in_lbs": 1e5, "pip_bar": 20.0}


def test_float_bound_closed_form_uses_vfd_kinematics():
    ctl = AdaptiveSRPController(SRPControlPolicy(m_target=1.15), stroke_length_inch=100.0, vfd_downstroke_ratio=0.75)
    v_term = 0.5
    expected = 60 * v_term / (math.pi * 100 * 0.0254 * 0.75 * 1.15)
    assert ctl.float_bound_spm(v_term) == pytest.approx(expected)


def test_controller_respects_ramp_and_bounds():
    ctl = AdaptiveSRPController(stroke_length_inch=100.0)
    d = ctl.decide(prev_spm=3.0, v_term_m_s=5.0, potential_liquid_m3_d=1e4, disp_m3_d_per_spm=10.0, evaluate=_ok)
    assert d.spm == pytest.approx(3.3) and d.binding == "ramp"
    # Float bound below the current speed is applied at once (safety), not ramped.
    d = ctl.decide(prev_spm=6.0, v_term_m_s=0.3, potential_liquid_m3_d=1e4, disp_m3_d_per_spm=10.0, evaluate=_ok)
    assert d.spm == pytest.approx(ctl.float_bound_spm(0.3), rel=1e-3)
    # Load limit violated -> bisection finds a lower feasible SPM.
    load = lambda s: {"goodman": 0.1 * s, "torque_in_lbs": 1e5, "pip_bar": 20.0}  # noqa: E731
    d = ctl.decide(prev_spm=7.5, v_term_m_s=5.0, potential_liquid_m3_d=1e4, disp_m3_d_per_spm=10.0, evaluate=load)
    assert d.spm <= 8.1 and 0.1 * d.spm <= 0.81


def test_adaptive_policy_keeps_limits_every_day():
    r = CSSCycleSimulator(CycleConfig(srp_policy="adaptive", **BASE)).run_simulation()
    spm = [p.spm for p in r.daily_history]
    assert max(np.diff(spm)) <= 0.3 + 1e-6
    assert min(p.float_margin_index for p in r.daily_history) >= 1.0
    assert r.max_goodman_stress_ratio <= 0.81 + 0.02
    assert r.max_gearbox_torque_in_lbs <= 0.95 * C.srp.gearbox_rating_in_lbs * 1.02


def test_recommended_spm_insensitive_to_coupling_factor(monkeypatch):
    """+/-30 % on both coupling factors shifts the controller's cycle-mean SPM by <= 15 %."""
    def mean_spm(scale):
        monkeypatch.setattr(C.srp, "coupling_drag_factor", 4.5 * scale)
        monkeypatch.setattr(C.srp, "distributed_coupling_factor", 1.15 * scale)
        r = CSSCycleSimulator(CycleConfig(srp_policy="adaptive", **BASE)).run_simulation()
        return float(np.mean([p.spm for p in r.daily_history]))
    ref = mean_spm(1.0)
    for s in (0.7, 1.3):
        assert abs(mean_spm(s) - ref) / ref <= 0.15


def test_nsga2_joint_optimizer_reports_evaluations_and_seed():
    from optimizer.joint_optimizer import JointOptimizer
    cur = {"steam_volume_tonnes": 3000, "soak_duration_days": 7, "spm": 4.0, "injection_pressure_bar": 124.1}
    r = JointOptimizer(pop_size=8, n_gen=3).optimize_well("BGW-02", cur, seed=7)
    assert r.evaluations == 24 and r.seed == 7
    assert r.recommended_configuration is not None
    assert r.recommended_configuration.min_float_margin_index >= 1.0
    assert r.recommended_configuration.injection_pressure_bar <= C.safety_limits.max_allowable_injection_pressure_bar
