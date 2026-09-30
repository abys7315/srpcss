"""Phase 1 consistency checks: code == config == docs, steam tables, kinematics, carried state."""

import re
from pathlib import Path

import pytest

from core.config import canonical_config as C
from twin.fluid.viscosity import AndradeViscosityModel
from twin.thermal.steam_props import saturated_steam, saturation_pressure_bar
from twin.srp.float_detection import vfd_kinematics
from twin.cycle import CSSCycleSimulator, CycleConfig

ROOT = Path(__file__).resolve().parents[3]
pytestmark = pytest.mark.unit


def _doc_viscosity_table():
    text = (ROOT / "docs" / "physics.md").read_text(encoding="utf-8")
    section = text.split("## 4. Viscosity")[1].split("## 5.")[0]
    return [(float(t), float(m)) for t, m in re.findall(r"^\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|", section, re.M)]


def test_viscosity_code_config_docs_agree():
    model = AndradeViscosityModel()
    assert model.params.B == pytest.approx(C.fluid.andrade_b)
    assert model.params.B == pytest.approx(5320, rel=0.01)
    assert model.compute_viscosity_cp(47.0) == pytest.approx(C.fluid.dead_oil_viscosity_47c_cp, rel=0.05)
    assert model.compute_viscosity_cp(150.0) == pytest.approx(C.fluid.dead_oil_viscosity_150c_cp, rel=0.05)
    table = _doc_viscosity_table()
    assert len(table) >= 6
    for t, mu_doc in table:
        assert model.compute_viscosity_cp(t) == pytest.approx(mu_doc, rel=0.05), t


def test_iapws_saturation_anchor_points():
    assert saturated_steam(125.0).t_sat_c == pytest.approx(328.0, abs=1.0)
    assert saturation_pressure_bar(260.0) == pytest.approx(47.0, abs=0.5)


def test_fracture_limited_injection_pressure():
    r = C.reservoir
    assert C.safety_limits.max_allowable_injection_pressure_bar == pytest.approx(
        r.fracture_gradient_bar_per_m * r.depth_m * 0.9, abs=0.1)


def test_injection_pressure_changes_heat_delivered():
    lo = CSSCycleSimulator(CycleConfig(injection_pressure_bar=60.0, economic_cutoff_oil_rate_bpd=0)).run_simulation()
    hi = CSSCycleSimulator(CycleConfig(injection_pressure_bar=150.0, economic_cutoff_oil_rate_bpd=0)).run_simulation()
    assert lo.steam_saturation_temp_c < hi.steam_saturation_temp_c
    assert lo.heat_injected_gj != pytest.approx(hi.heat_injected_gj, rel=1e-3)


def test_baseline_day90_temperature_in_calibration_band():
    r = CSSCycleSimulator(CycleConfig(steam_volume_tonnes=3000, injection_pressure_bar=124.1, soak_duration_days=7,
                                      spm=4.0, economic_cutoff_oil_rate_bpd=0)).run_simulation()
    assert 75.0 <= r.daily_history[-1].temperature_c <= 85.0


def test_vfd_kinematics():
    sym = vfd_kinematics(4.0, 100.0, 1.0)
    assert sym.t_up_s == pytest.approx(sym.t_down_s) == pytest.approx(7.5)
    k = vfd_kinematics(4.0, 100.0, 0.75)
    assert k.t_up_s + k.t_down_s == pytest.approx(15.0)
    assert k.t_down_s == pytest.approx(15.0 / 1.5)
    assert k.v_down_m_s == pytest.approx(sym.v_down_m_s * 0.75)
    assert k.v_up_m_s == pytest.approx(sym.v_up_m_s / (2 - 1 / 0.75))
    assert k.accel_up_g > sym.accel_up_g
    with pytest.raises(ValueError):
        vfd_kinematics(4.0, 100.0, 0.5)


def test_slow_downstroke_raises_peak_load():
    base = CSSCycleSimulator(CycleConfig(vfd_downstroke_ratio=1.0, economic_cutoff_oil_rate_bpd=0)).run_simulation()
    vfd = CSSCycleSimulator(CycleConfig(vfd_downstroke_ratio=0.7, economic_cutoff_oil_rate_bpd=0)).run_simulation()
    assert max(s.peak_polished_rod_load_lbs for s in vfd.states) > max(s.peak_polished_rod_load_lbs for s in base.states)
    assert min(p.float_margin_index for p in vfd.daily_history) > min(p.float_margin_index for p in base.daily_history)


def test_multicycle_initial_pressure_is_kept():
    prior = 5000.0
    r = CSSCycleSimulator(CycleConfig(cumulative_prior_oil_produced_m3=prior, economic_cutoff_oil_rate_bpd=0)).run_simulation()
    fresh = CSSCycleSimulator(CycleConfig(economic_cutoff_oil_rate_bpd=0)).run_simulation()
    # Day-2 pressure must still reflect prior depletion (bug: was reset to reservoir_pressure_bar - in-cycle depletion)
    assert r.daily_history[1].reservoir_pressure_bar < fresh.daily_history[1].reservoir_pressure_bar - 3.0


def test_material_balance_and_carried_saturation():
    c1 = CSSCycleSimulator(CycleConfig(economic_cutoff_oil_rate_bpd=0)).run_simulation()
    oil_m3 = c1.total_oil_produced_bbl / 6.2898
    assert c1.recovery_factor_pct == pytest.approx(100 * oil_m3 / C.ooip_m3, rel=1e-3)
    assert c1.final_heated_zone_oil_saturation < 1.0 - C.reservoir.initial_water_saturation
    c2 = CSSCycleSimulator(CycleConfig(
        cycle_number=2, cumulative_prior_oil_produced_m3=oil_m3,
        prior_heated_pore_volume_m3=c1.heated_pore_volume_m3,
        prior_heated_zone_oil_saturation=c1.final_heated_zone_oil_saturation,
        economic_cutoff_oil_rate_bpd=0)).run_simulation()
    assert c2.total_oil_produced_bbl <= c1.total_oil_produced_bbl
    assert c2.recovery_factor_pct > c1.recovery_factor_pct
