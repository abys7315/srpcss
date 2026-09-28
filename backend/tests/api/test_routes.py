"""
Integration Tests for PETRO-TWIN REST API Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.

Verifies:
1. Health and component readiness
2. Well inventory and detailed telemetry
3. High-fidelity digital twin simulation
4. Joint CSS+SRP optimization and Pareto solution selection
5. Standalone CSS and SRP optimizers
6. 5-column What-If sandbox comparison
7. Quantile forecasting (p10/p50/p90), dynacard classification, and anomaly detection
8. Equipment failure risk prediction and factor attribution
9. Continuous feedback ingestion and online recalibration cycle (verifying MAE reduction)
10. Benchmark reports and data provenance manifest
"""

import pytest
from fastapi.testclient import TestClient
import numpy as np

from app.main import app
from app.db.init_db import init_db

@pytest.fixture(scope="module")
def client():
    # Initialize DB before tests
    init_db()
    with TestClient(app) as c:
        yield c

def test_health_check(client):
    """Verify system health endpoint reports all twin and ML components online."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["components"]["physics_twin_engine"] == "ONLINE"
    assert data["components"]["joint_optimizer"] == "READY"
    assert data["components"]["constraint_engine"] == "ENFORCING"

def test_wells_list_and_detail(client):
    """Verify inventory of Baghewala wells and individual telemetry inspection."""
    res = client.get("/api/v1/wells")
    assert res.status_code == 200
    wells = res.json()["data"]
    assert len(wells) >= 5
    well_ids = [w["well_id"] for w in wells]
    assert "BGW-01" in well_ids

    # Detail check
    res_det = client.get("/api/v1/wells/BGW-01")
    assert res_det.status_code == 200
    detail = res_det.json()["data"]
    assert detail["well_id"] == "BGW-01"
    assert detail["formation"] == "Jodhpur Sandstone"
    assert detail["depth_m"] > 900.0
    assert detail["provenance"] == "SIMULATED"

def test_simulation_endpoint(client):
    """Verify high-fidelity cycle simulation produces daily timeseries and dynacards."""
    payload = {
        "well_id": "BGW-01",
        "cycle_number": 1,
        "steam_volume_tonnes": 2800.0,
        "injection_duration_days": 14.0,
        "injection_pressure_bar": 125.0,
        "steam_temp_celsius": 260.0,
        "soak_duration_days": 5.0,
        "production_duration_days": 180.0,
        "economic_cutoff_oil_rate_bpd": 7.0,
        "spm": 3.5,
        "stroke_length_inch": 100.0,
        "vfd_downstroke_ratio": 0.75
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["well_id"] == "BGW-01"
    assert data["kpis"]["total_oil_produced_bbl"] > 1000.0
    assert data["kpis"]["steam_oil_ratio"] > 0.0
    assert len(data["timeseries"]) > 20
    assert "final" in data["dynacards"]
    assert data["constraints"]["is_feasible"] is True

def test_joint_optimization_endpoint(client):
    """Verify joint optimizer generates Pareto front and compliant recommendation."""
    payload = {
        "well_id": "BGW-01",
        "cycle_number": 1,
        "current_configuration": {
            "steam_volume_tonnes": 3000.0,
            "soak_duration_days": 6.0,
            "spm": 4.8,
            "stroke_length_inch": 100.0,
            "vfd_downstroke_ratio": 1.0,
            "economic_cutoff_bpd": 7.0
        },
        "weights": {
            "weight_net_benefit": 0.45,
            "weight_oil_recovery": 0.25,
            "weight_sor_minimization": 0.15,
            "weight_risk_minimization": 0.15
        }
    }
    res = client.post("/api/v1/optimize/joint", json=payload)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] in ["FEASIBLE", "NO_IMPROVEMENT_FOUND"]
    assert data["recommended_configuration"] is not None
    rec = data["recommended_configuration"]
    assert rec["status"] in ["FEASIBLE", "NEAR_LIMIT"]
    assert rec["min_float_margin_index"] >= 1.0
    assert len(data["pareto_front"]) > 0
    assert len(data["comparison_table"]) > 0
    assert data["confidence_score"] > 0.50

def test_css_and_srp_optimizers(client):
    """Verify standalone slow loop CSS and fast loop SRP endpoints."""
    # CSS Slow Loop
    res_css = client.post("/api/v1/optimize/css", json={"well_id": "BGW-01", "fixed_spm": 4.0})
    assert res_css.status_code == 200
    assert res_css.json()["data"]["optimization_mode"] == "CSS_ONLY"

    # SRP Fast Loop
    res_srp = client.post("/api/v1/optimize/srp", json={"well_id": "BGW-01", "fixed_steam_tonnes": 2800.0})
    assert res_srp.status_code == 200
    assert res_srp.json()["data"]["optimization_mode"] == "SRP_ONLY"

def test_what_if_sandbox(client):
    """Verify 5-column side-by-side What-If scenario sandbox."""
    payload = {
        "well_id": "BGW-01",
        "scenario_a": {
            "label": "Increased Steam Volume (+25%)",
            "description": "Evaluate recovery uplift from 3750 tonnes steam.",
            "steam_volume_tonnes": 3750.0,
            "soak_days": 7.0,
            "spm": 4.5,
            "stroke_length_inch": 100.0,
            "vfd_downstroke_ratio": 1.0,
            "economic_cutoff_bpd": 7.0
        }
    }
    res = client.post("/api/v1/what-if", json=payload)
    assert res.status_code == 200
    data = res.json()["data"]
    scenarios = data["scenarios"]
    assert len(scenarios) >= 3
    scenario_ids = [s["scenario_id"] for s in scenarios]
    assert "CURRENT" in scenario_ids
    assert "RECOMMENDED" in scenario_ids

def test_prediction_endpoints(client):
    """Verify quantile forecasting, dynacard classification, and anomaly detection."""
    # 1. Quantile Forecast
    fc_res = client.post("/api/v1/predictions/forecast", json={
        "well_id": "BGW-01",
        "horizon_days": 60,
        "steam_volume_tonnes": 3000.0,
        "soak_days": 6.0,
        "spm": 4.2
    })
    assert fc_res.status_code == 200
    fc_data = fc_res.json()["data"]
    assert len(fc_data["forecast"]) == 60
    assert fc_data["forecast"][0]["p10"] <= fc_data["forecast"][0]["p50"] <= fc_data["forecast"][0]["p90"]

    # 2. Dynacard Classifier
    th = np.linspace(0, 2 * np.pi, 50)
    pos = list(50.0 * (1 - np.cos(th)))
    loads = list(8500.0 + 4000.0 * np.sin(th))
    clf_res = client.post("/api/v1/predictions/classify-dynacard", json={
        "surface_position_inch": pos,
        "surface_load_lbs": loads
    })
    assert clf_res.status_code == 200
    assert clf_res.json()["data"]["predicted_label"] in ["NORMAL", "ROD_FLOATING", "FLUID_POUND", "GAS_INTERFERENCE", "OVERLOAD"]

    # 3. Anomaly Detection
    normal_temps = [180.0 - 0.5 * i for i in range(40)]
    anom_res = client.post("/api/v1/predictions/detect-anomalies", json={
        "well_id": "BGW-01",
        "daily_temperatures_c": normal_temps
    })
    assert anom_res.status_code == 200
    assert "anomalies_detected_count" in anom_res.json()["data"]

def test_risk_evaluation_endpoints(client):
    """Verify equipment failure risk assessment and factor breakdown."""
    payload = {
        "well_id": "BGW-01",
        "float_margin_index": 1.45,
        "goodman_stress_ratio": 0.65,
        "fluid_pound_severity": 0.10,
        "gearbox_load_pct": 68.0,
        "asphaltene_risk_score": 0.25,
        "cumulative_float_events": 0
    }
    res = client.post("/api/v1/risks/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()["data"]
    assert 0.0 <= data["overall_failure_probability_30d"] <= 1.0
    assert len(data["factor_attributions"]) > 0

    # Test GET well risk
    res_well = client.get("/api/v1/risks/BGW-01")
    assert res_well.status_code == 200

def test_continuous_feedback_and_recalibration_loop(client):
    """
    CRITICAL SIH 26120 REQUIREMENT:
    Demonstrates the closed-loop continuous adaptation cycle:
    1. Operator records field gauge observation
    2. API computes residual physics error and checks for drift
    3. Operator requests online model recalibration
    4. API retrains residual model and verifies measurable error reduction (> 20%).
    """
    # 1. Ingest observation with mild drift
    fb_payload = {
        "well_id": "BGW-01",
        "day": 45,
        "observed_oil_rate_bpd": 29.5,
        "observed_temperature_c": 74.0,
        "observed_float_events": 0,
        "observed_dynacard_label": "NORMAL",
        "operator_notes": "Tested production rate at separator."
    }
    res_fb = client.post("/api/v1/feedback", json=fb_payload)
    assert res_fb.status_code == 200
    fb_data = res_fb.json()["data"]
    assert "feedback_id" in fb_data
    assert "residual_error_bpd" in fb_data

    # 2. Trigger online recalibration
    recal_payload = {
        "well_id": "BGW-01",
        "force_recalibrate": True
    }
    res_recal = client.post("/api/v1/recalibrate", json=recal_payload)
    assert res_recal.status_code == 200
    recal_data = res_recal.json()["data"]
    assert recal_data["status"] == "SUCCESS"
    assert recal_data["sample_points_used"] > 0
    assert recal_data["pre_recalibration_mae_bpd"] > 0.0
    assert recal_data["post_recalibration_mae_bpd"] < recal_data["pre_recalibration_mae_bpd"]
    assert recal_data["mae_reduction_pct"] >= 20.0, f"Expected >20% MAE reduction, got {recal_data['mae_reduction_pct']}%"
    assert recal_data["drift_status_cleared"] is True

def test_benchmarks_and_provenance(client):
    """Verify performance benchmarks and data provenance manifest."""
    res_bench = client.get("/api/v1/benchmarks")
    assert res_bench.status_code == 200
    b_data = res_bench.json()["data"]
    assert len(b_data["baseline_vs_optimized"]) > 0
    assert b_data["overall_net_benefit_gain_pct"] > 0.0

    res_prov = client.get("/api/v1/provenance")
    assert res_prov.status_code == 200
    p_data = res_prov.json()["data"]
    assert "mandatory_disclaimer" in p_data
    assert len(p_data["data_items"]) > 0
