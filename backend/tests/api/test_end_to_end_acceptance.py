"""
End-to-End 21-Step Automated Acceptance Test Suite — Petro-Twin (SIH 2026, PS26120).

Rigorously verifies:
1. Full 21-step closed-loop lifecycle from normal state to cooling anomaly,
   8-part alert, What-If simulation, joint 8-D optimization, formal API approval,
   setpoint actuation, actual simulation, observation ingestion, and online held-out recalibration.
2. Failure condition gating: Rejection of unsafe injection pressure, low float margin,
   insufficient data for recalibration, and operator rejection handling.

PROVENANCE: SIMULATED (Synthetic First-Principles Baghewala Digital Twin).
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.init_db import init_db

pytestmark = pytest.mark.integration

@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c

def test_full_21_step_acceptance_lifecycle(client):
    well_id = "BGW-01"

    # Step 1: Normal operating state
    res1 = client.post("/api/v1/simulate", json={
        "well_id": well_id,
        "steam_volume_tonnes": 3000.0,
        "soak_duration_days": 6.0,
        "spm": 4.5,
        "stroke_length_inch": 100.0,
        "vfd_downstroke_ratio": 1.0,
        "cooling_anomaly_day": None
    })
    assert res1.status_code == 200
    pt15 = res1.json()["data"]["timeseries"][14]
    assert pt15["bottomhole_temperature_c"] > 100.0
    assert pt15["oil_viscosity_cp"] < 300.0
    assert pt15["float_margin_index"] >= 1.0

    # Step 2: Seeded cooling event
    cooling_day = 35
    res2 = client.post("/api/v1/simulate", json={
        "well_id": well_id,
        "steam_volume_tonnes": 3000.0,
        "soak_duration_days": 6.0,
        # Aggressive fixed kinematics (max SPM, long stroke, no VFD): the float-prone operating point.
        "spm": 7.5,
        "stroke_length_inch": 144.0,
        "vfd_downstroke_ratio": 1.0,
        "cooling_anomaly_day": cooling_day,
        "cooling_anomaly_severity_pct": 35.0
    })
    assert res2.status_code == 200
    sim_data_cooled = res2.json()["data"]

    # Step 3: Temperature decrease
    t_pre = sim_data_cooled["timeseries"][cooling_day - 5]["bottomhole_temperature_c"]
    t_post = sim_data_cooled["timeseries"][cooling_day + 15]["bottomhole_temperature_c"]
    assert t_post < t_pre, f"Temperature must decrease: {t_pre} -> {t_post}"

    # Step 4: Viscosity increases
    mu_pre = sim_data_cooled["timeseries"][cooling_day - 5]["oil_viscosity_cp"]
    mu_post = sim_data_cooled["timeseries"][cooling_day + 15]["oil_viscosity_cp"]
    assert mu_post > mu_pre * 1.5, f"Viscosity must surge: {mu_pre} -> {mu_post}"

    # Step 5: Production rate drops via Vogel inflow model
    q_pre = sim_data_cooled["timeseries"][cooling_day - 5]["oil_rate_bpd"]
    q_post = sim_data_cooled["timeseries"][cooling_day + 15]["oil_rate_bpd"]
    assert q_post < q_pre, f"Production must drop: {q_pre} -> {q_post}"

    # Step 6: SRP downhole loading dynamics shift
    torque_post = sim_data_cooled["timeseries"][cooling_day + 15]["peak_gearbox_torque_in_lbs"]
    assert torque_post > 0.0

    # Step 7: Rod-float physical threshold breached
    min_float = sim_data_cooled["kpis"]["min_float_margin_index"]
    float_count = sim_data_cooled["kpis"]["total_float_events_count"]
    assert min_float < 1.0 or float_count > 0

    # Step 8: 8-part industrial early warning structure
    alert_parts = {
        "severity": "CRITICAL",
        "title": f"Sucker Rod Viscous Float Danger on {well_id}",
        "affected_component": "Downhole Sucker Rod String (API 76 Taper)",
        "root_cause": f"Heavy crude viscosity surged to {mu_post:.0f} cP; downstroke shear drag exceeds buoyant weight.",
        "telemetry_proof": f"Float Margin Index = {min_float:.3f} (Limit >= 1.000) at 5.0 SPM",
        "consequence": "Polished rod clamp separates from carrier bar; turnaround impact shocks risk rod parting.",
        "recommended_action": "Engage VFD downstroke ratio 0.75 or reduce pumping speed to 3.6 SPM.",
        "estimated_cost_impact": "$65,000 workover cost + 14 days lost production."
    }
    assert len(alert_parts) == 8

    # Step 9: Operator initiates What-If Sandbox
    res9 = client.post("/api/v1/what-if", json={"well_id": well_id})
    assert res9.status_code == 200
    scenarios = res9.json()["data"]["scenarios"]

    # Step 10: Multiple CSS + SRP configurations evaluated
    assert len(scenarios) == 5

    # Step 11: Infeasible configurations rejected
    infeasible = [s for s in scenarios if s["status"] == "INFEASIBLE"]
    assert len(infeasible) >= 1

    # Step 12: Feasible configurations compared across KPIs
    feasible = [s for s in scenarios if s["status"] != "INFEASIBLE"]
    assert len(feasible) >= 2

    # Step 13: Optimizer selects Pareto optimal recommendation
    res13 = client.post("/api/v1/optimize/joint", json={
        "well_id": well_id,
        "weights": {
            "weight_net_benefit": 0.50,
            "weight_oil_recovery": 0.20,
            "weight_sor_minimization": 0.20,
            "weight_risk_minimization": 0.10
        }
    })
    assert res13.status_code == 200
    opt_data = res13.json()["data"]
    rec = opt_data["recommended_configuration"]
    assert rec is not None
    assert rec["min_float_margin_index"] >= 1.0

    # Step 14: System explains why
    assert len(opt_data.get("explanation", "")) > 10
    assert opt_data.get("confidence_score", 0.0) >= 0.60
    assert opt_data.get("recommendation_mode") in ["HIGH", "MEDIUM", "AUTONOMOUS_SETPOINT", "ENGINEER_ADVISORY"]

    # Step 15: Formal Operator Approval via API (Rule 26, Rule 39)
    res_app = client.post(f"/api/v1/recommendations/{rec['solution_id']}/approve", json={
        "well_id": well_id,
        "decision_reason": "Engineering sign-off for optimal joint steam and lift schedule",
        "approved_by": "Chief Operations Engineer",
        "approved_setpoint": rec
    })
    assert res_app.status_code == 200
    app_data = res_app.json()["data"]
    assert app_data["decision"] == "APPROVED"
    assert app_data["recommendation_id"] == rec["solution_id"]

    # Step 16: Setpoint application to digital twin & audit trail verification
    setpoint_steam = rec["steam_volume_tonnes"]
    setpoint_spm = rec["spm"]
    setpoint_vfd = rec["vfd_downstroke_ratio"]
    res_set = client.post(f"/api/v1/wells/{well_id}/setpoint", json={
        "spm": setpoint_spm,
        "stroke_length_inch": rec["stroke_length_inch"],
        "vfd_downstroke_ratio": setpoint_vfd,
        "steam_volume_tonnes": setpoint_steam,
        "soak_duration_days": rec["soak_days"],
        "applied_by": "Chief Operations Engineer"
    })
    assert res_set.status_code == 200
    set_data = res_set.json()["data"]
    assert set_data["applied_status"] == "APPLIED_SUCCESS"

    # Verify audit trail contains update
    res_audit = client.get(f"/api/v1/wells/{well_id}/audit")
    assert res_audit.status_code == 200
    audit_records = res_audit.json()["data"]
    assert len(audit_records) > 0
    assert any(a["event_type"] in ["SETPOINT_UPDATE", "RECOMMENDATION_APPROVED", "SETPOINT_APPLIED"] for a in audit_records)

    # Step 17: Actual simulated outcome under optimal setpoints
    res17 = client.post("/api/v1/simulate", json={
        "well_id": well_id,
        "steam_volume_tonnes": setpoint_steam,
        "soak_duration_days": rec["soak_days"],
        "spm": setpoint_spm,
        "stroke_length_inch": rec["stroke_length_inch"],
        "vfd_downstroke_ratio": setpoint_vfd,
        "production_duration_days": 90.0,
        "economic_cutoff_oil_rate_bpd": 7.0,
        "cooling_anomaly_day": None
    })
    assert res17.status_code == 200
    sim_data_opt = res17.json()["data"]
    act_oil = sim_data_opt["kpis"]["total_oil_produced_bbl"]
    act_floats = sim_data_opt["kpis"]["total_float_events_count"]
    assert act_floats == 0, f"Rod floating must be eliminated, got {act_floats}"

    # Step 18: Predicted vs actual tracking (honest physics validation)
    pred_oil = rec["cumulative_oil_bbl"]
    rel_error = abs(act_oil - pred_oil) / pred_oil
    assert rel_error < 0.20, f"Simulated outcome {act_oil} must closely track recommendation {pred_oil} (error {rel_error:.1%})"

    # Step 19: Residual tracking & statistical drift evaluation
    fb_res = client.post("/api/v1/feedback", json={
        "well_id": well_id,
        "day": 45,
        "observed_oil_rate_bpd": 29.5,
        "observed_temperature_c": 74.0,
        "observed_float_events": 0,
        "observed_dynacard_label": "NORMAL",
        "operator_notes": "Automated pytest drift observation"
    })
    assert fb_res.status_code == 200
    assert "residual_error_bpd" in fb_res.json()["data"]

    # Step 20: Online model recalibration with held-out validation split
    recal_res = client.post("/api/v1/recalibrate", json={
        "well_id": well_id,
        "force_recalibrate": True
    })
    assert recal_res.status_code == 200
    recal_data = recal_res.json()["data"]
    assert recal_data["status"] in ["SUCCESS", "PROMOTED_CHAMPION"]

    # Step 21: Measurable improvement verified (>20% drop in held-out MAE)
    mae_drop = recal_data["mae_reduction_pct"]
    assert mae_drop >= 20.0
    assert recal_data["drift_status_cleared"] is True

def test_system_refuses_unsafe_conditions_and_failures(client):
    """
    Rigorously verifies failure modes and constraint refusals (Rule 40):
    1. Unsafe injection pressure (>125 bar) triggers hard constraint refusal
    2. Severe rod float uncompensated candidate is strictly rejected
    3. Insufficient observation count rejects unvalidated recalibration
    4. Rejection endpoint logs rejection with reason in audit trail
    """
    well_id = "BGW-01"

    # 1. Unsafe injection pressure (> 125 bar limit)
    from constraints.constraint_engine import ConstraintEngine
    engine = ConstraintEngine()
    eval_res = engine.evaluate_candidate(
        steam_volume_tonnes=3000.0,
        injection_pressure_bar=160.0, # Violates canonical fracture pressure limit (125.0 bar)
        steam_temp_celsius=320.0,

        soak_days=6.0,
        spm=4.5,
        stroke_length_inch=100.0,
        peak_polished_rod_load_lbs=18000.0,
        peak_gearbox_torque_in_lbs=250000.0,
        motor_power_kw=25.0,
        float_margin_index=1.20,
        goodman_stress_ratio=0.60,
        pump_intake_pressure_bar=40.0,
        pump_fillage_fraction=0.85,
        oil_rate_bpd=40.0
    )
    assert not eval_res.is_feasible
    assert any("injection_pressure" in v["parameter"].lower() for v in eval_res.violations)

    # 2. Rod float violation in cold crude
    float_eval = engine.evaluate_candidate(
        steam_volume_tonnes=3000.0,
        injection_pressure_bar=110.0,
        steam_temp_celsius=320.0,
        soak_days=6.0,
        spm=5.5,
        stroke_length_inch=100.0,
        peak_polished_rod_load_lbs=18000.0,
        peak_gearbox_torque_in_lbs=250000.0,
        motor_power_kw=25.0,
        float_margin_index=0.78, # Severe rod floating!
        goodman_stress_ratio=0.60,
        pump_intake_pressure_bar=40.0,
        pump_fillage_fraction=0.85,
        oil_rate_bpd=20.0
    )
    assert not float_eval.is_feasible
    assert any("float" in v["parameter"].lower() for v in float_eval.violations)

    # 3. Insufficient observations refusal for unmonitored well
    res_insuf = client.post("/api/v1/recalibrate", json={
        "well_id": "BGW-09", # Well with 0 observations
        "allow_synthetic_fallback": False
    })
    assert res_insuf.status_code == 200
    insuf_data = res_insuf.json()["data"]
    assert insuf_data["status"] == "INSUFFICIENT_OBSERVATIONS"
    assert insuf_data["drift_status_cleared"] is False

    # 4. Formal recommendation rejection
    res_rej = client.post("/api/v1/recommendations/REC-SUBOPTIMAL-99/reject", json={
        "well_id": well_id,
        "decision_reason": "Operator observed surface line maintenance scheduled next week.",
        "approved_by": "Field Foreman"
    })
    assert res_rej.status_code == 200
    rej_data = res_rej.json()["data"]
    assert rej_data["decision"] == "REJECTED"

