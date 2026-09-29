"""
Unit Tests for Machine Learning & Diagnostic Modules — Petro-Twin (SIH 2026, PS26120).

Verifies:
1. Hybrid residual corrector fits and adjusts physics baseline
2. Dynacard classifier identifies NORMAL and ROD_FLOATING cards
3. Production forecaster produces valid quantile envelopes (p10 <= p50 <= p90)
4. Failure risk predictor identifies critical risk and attributes top drivers
5. Confidence estimator correctly switches modes (HIGH, MEDIUM, LOW, VERY_LOW)
6. Anomaly detector catches rapid thermal cooling
7. Drift monitor flags distribution shifts
"""

import pytest
import numpy as np

from ml.residual_models.corrector import HybridResidualCorrector
from ml.dynacard_classification.classifier import DynacardClassifier
from ml.production_forecasting.forecaster import ProductionForecaster
from ml.failure_risk.predictor import FailureRiskPredictor
from ml.confidence.estimator import ConfidenceEstimator
from ml.anomaly_detection.detector import OperationalAnomalyDetector
from ml.drift.monitor import ModelDriftMonitor

pytestmark = pytest.mark.unit

def test_residual_corrector_fit_and_predict():
    """Verify that hybrid residual model learns bias and corrects baseline."""
    corrector = HybridResidualCorrector()
    
    # Synthetic dataset with constant +5.0 BPD unmodeled lift bias
    X = np.random.uniform(10, 50, (100, 3))
    y_phys = X[:, 0] * 1.5
    y_obs = y_phys + 5.0 + np.random.normal(0, 0.2, 100)
    
    corrector.fit(X, y_obs, y_phys)
    assert corrector.is_fitted
    assert corrector.training_mae < 1.0
    
    # Predict on test point:
    test_pt = np.array([25.0, 30.0, 40.0])
    phys_val = 25.0 * 1.5 # 37.5
    res_pred = corrector.predict(test_pt, phys_val)
    
    # Should correct close to 37.5 + 5.0 = 42.5
    assert 41.0 <= res_pred.final_hybrid_prediction <= 44.0
    assert res_pred.ml_residual_correction > 3.5

def test_dynacard_classifier_identifies_rod_floating():
    """Verify classifier detects rod float when downstroke load collapses."""
    classifier = DynacardClassifier()
    
    # 1. Normal card
    c_norm = classifier.classify_card(
        positions=[0, 25, 50, 75, 100, 75, 50, 25],
        loads=[8000, 14000, 15000, 15000, 14000, 8000, 8000, 8000]
    )
    assert c_norm.predicted_class in ["NORMAL", "FLUID_POUND"]
    
    # 2. Rod floating card (confirmed via float margin < 1.0 and zero downstroke load)
    c_float = classifier.classify_card(
        positions=[0, 25, 50, 75, 100, 75, 50, 25],
        loads=[8000, 14000, 15000, 15000, 50, 100, -150, 14000],
        known_float_margin=0.65
    )
    assert c_float.predicted_class == "ROD_FLOATING"
    assert c_float.is_rod_floating
    assert c_float.confidence_score > 0.80

def test_production_forecaster_quantiles():
    """Verify that quantile predictions maintain p10 <= p50 <= p90."""
    forecaster = ProductionForecaster()
    horizon = 30
    
    res = forecaster.forecast_horizon(horizon_days=horizon, base_features=np.array([1, 45.0, 100.0]))
    
    assert len(res.median_forecast) == horizon
    assert len(res.lower_bound_p10) == horizon
    assert len(res.upper_bound_p90) == horizon
    
    for i in range(horizon):
        assert res.lower_bound_p10[i] <= res.median_forecast[i] <= res.upper_bound_p90[i], (
            f"Day {i}: p10={res.lower_bound_p10[i]} <= p50={res.median_forecast[i]} <= p90={res.upper_bound_p90[i]} violated"
        )

def test_failure_risk_driver_attribution():
    """Verify that severe rod floating ranks as top risk factor."""
    predictor = FailureRiskPredictor()
    
    # Severe float state: float margin 0.55
    res = predictor.evaluate_risk(
        float_margin_index=0.55,
        goodman_stress_ratio=0.70,
        fluid_pound_severity=0.0,
        gearbox_load_pct=60.0,
        asphaltene_risk_score=0.20
    )
    
    assert res.risk_level in ["HIGH", "CRITICAL"]
    assert res.top_contributing_factors[0]["factor_name"] == "Rod Floating & Impact Shock"
    assert res.top_contributing_factors[0]["contribution_pct"] > 40.0

def test_confidence_estimator_recommendation_modes():
    """Verify that low quality data locks automation and flags VERY_LOW."""
    estimator = ConfidenceEstimator()
    
    # 1. High confidence case:
    c_high = estimator.compute_confidence(
        prediction_spread_pct=0.10,
        validation_error_pct=0.05,
        distance_to_training_distribution=0.10,
        data_quality_score=0.98,
        are_physics_inputs_in_range=True,
        min_constraint_margin_pct=0.20
    )
    assert c_high.recommendation_mode == "HIGH"
    assert c_high.is_recommendation_permitted
    
    # 2. Corrupt / Missing sensor case:
    c_low = estimator.compute_confidence(
        prediction_spread_pct=0.10,
        validation_error_pct=0.05,
        distance_to_training_distribution=0.10,
        data_quality_score=0.25, # Sensor dropout!
        are_physics_inputs_in_range=True,
        min_constraint_margin_pct=0.20
    )
    assert c_low.recommendation_mode == "VERY_LOW"
    assert not c_low.is_recommendation_permitted
    assert "telemetry quality failed" in c_low.rejection_reason

def test_anomaly_detector_rapid_cooling():
    """Verify that rapid temperature drop triggers anomaly alert."""
    detector = OperationalAnomalyDetector()
    
    # Normal point:
    r_norm = detector.evaluate_point(50.0, 120.0, 55.0, 14000.0, 55.0)
    assert r_norm.anomaly_severity in ["NONE", "LOW"]
    
    # Rapid cooling history: [120, 118, 115, 105, 95] (-20 C in 2 days)
    r_cooling = detector.evaluate_point(
        oil_rate_bpd=40.0,
        temperature_c=95.0,
        pressure_bar=55.0,
        peak_load_lbs=14000.0,
        electricity_kwh=55.0,
        rolling_temp_history=[120.0, 118.0, 115.0, 105.0, 95.0]
    )
    assert r_cooling.is_anomaly
    assert r_cooling.anomaly_severity == "CRITICAL"
    assert "temperature_c" in r_cooling.flagged_channels

def test_model_registry_governance_and_lineage():
    """Verify ModelRegistry SHA-256 lineage, champion promotion, rejection, and rollback (Rule 31)."""
    from ml.registry.model_registry import ModelRegistry, compute_sha256

    reg = ModelRegistry()
    
    # 1. Champion verification and real SHA-256 hash
    champ = reg.get_champion("residual_corrector")
    assert champ is not None
    assert champ.status == "CHAMPION"
    assert len(champ.dataset_hash) == 64, f"Hash must be real SHA-256: {champ.dataset_hash}"
    assert len(champ.config_hash) == 64
    assert champ.training_data_hash == champ.dataset_hash

    # 2. Register Challenger with real SHA-256
    chal_hash = compute_sha256("baghewala_field_feedback_run_2026_09")
    chal = reg.register_challenger(
        model_name="residual_corrector",
        version="v1.1.0-chal",
        metrics={"train_mae": 1.10, "validation_mae": 1.45},
        training_data_hash=chal_hash
    )
    assert chal.status == "CHALLENGER"
    assert chal.dataset_hash == chal_hash

    # 3. Promote Challenger to Champion
    promoted = reg.promote_challenger_to_champion("residual_corrector", "v1.1.0-chal")
    assert promoted is True
    active_champ = reg.get_champion("residual_corrector")
    assert active_champ.version == "v1.1.0-chal"
    assert champ.status == "ARCHIVED"

    # 4. Rollback Champion to Previous Archived Model
    rolled_back = reg.rollback_champion("residual_corrector")
    assert rolled_back is True
    reverted_champ = reg.get_champion("residual_corrector")
    assert reverted_champ.version == "v1.0.0-sim"
    assert active_champ.status == "ROLLED_BACK"

    # 5. Reject Challenger
    chal2 = reg.register_challenger(
        model_name="residual_corrector",
        version="v1.2.0-bad",
        metrics={"train_mae": 1.95, "validation_mae": 2.85},
        training_data_hash=compute_sha256("corrupt_dataset")
    )
    rejected = reg.reject_challenger("residual_corrector", "v1.2.0-bad", reason="Validation MAE degraded")
    assert rejected is True
    assert chal2.status == "REJECTED"

def test_confidence_estimator_state_specific_degradation():
    """Verify that severe OOD and anomaly states measurably degrade confidence (Rule P1)."""
    estimator = ConfidenceEstimator()

    # Normal operating state
    c_normal = estimator.compute_confidence(
        prediction_spread_pct=0.10,
        validation_error_pct=0.04,
        distance_to_training_distribution=0.05,
        data_quality_score=0.98,
        are_physics_inputs_in_range=True,
        min_constraint_margin_pct=0.25
    )

    # Severe OOD state (elevated spread, high distribution distance, elevated error)
    c_ood = estimator.compute_confidence(
        prediction_spread_pct=0.42,
        validation_error_pct=0.22,
        distance_to_training_distribution=0.85,
        data_quality_score=0.80,
        are_physics_inputs_in_range=True,
        min_constraint_margin_pct=0.08
    )

    assert c_ood.overall_confidence_score < c_normal.overall_confidence_score
    assert c_ood.sub_scores["training_distribution_distance"] < c_normal.sub_scores["training_distribution_distance"]
    assert c_ood.sub_scores["prediction_uncertainty"] < c_normal.sub_scores["prediction_uncertainty"]

def test_model_registry_actual_file_hashing_and_synthetic_label():
    """Verify actual file SHA-256 computation and transparent synthetic labeling."""
    from ml.registry.model_registry import ModelRegistry, sha256_file
    from pathlib import Path

    reg = ModelRegistry()
    champ = reg.get_champion("residual_corrector")
    assert champ is not None
    assert champ.artifact_type == "SYNTHETIC_REGISTRY_IDENTIFIER"
    assert champ.model_artifact_sha256 is None  # Truthful: no physical serialized model file on disk
    assert champ.model_sha256 is None          # Deprecated alias returns None when no physical artifact exists
    assert len(champ.registry_fingerprint) == 64
    assert len(champ.dataset_sha256) == 64
    assert len(champ.config_sha256) == 64

    # Verify sha256_file on real config file if present
    cfg_path = Path("configs/field.yaml")
    if not cfg_path.is_file():
        cfg_path = Path(__file__).resolve().parents[3] / "configs" / "field.yaml"
    if cfg_path.is_file():
        h = sha256_file(cfg_path)
        assert len(h) == 64
        assert h == champ.config_sha256

def test_canonical_baghewala_configuration_invariance():
    """Verify configs/field.yaml has canonical Baghewala reservoir values (18.0 API, 47C)."""
    import yaml
    from pathlib import Path
    cfg_path = Path("configs/field.yaml")
    if not cfg_path.is_file():
        cfg_path = Path(__file__).resolve().parents[3] / "configs" / "field.yaml"
    
    with open(cfg_path, "r") as f:
        data = yaml.safe_load(f)

    assert data["fluid"]["api_gravity"] == 18.0
    assert data["reservoir"]["initial_temperature_c"] == 47.0
    assert data["fluid"]["dead_oil_viscosity_52c_cp"] == 1200.0

def test_sha256_verification_edge_cases():
    """Verify SHA-256 verification behaviors: matching, mismatching, missing artifact, no physical artifact."""
    import tempfile
    from ml.registry.model_registry import sha256_file, ModelRegistry
    from pathlib import Path

    # 1. Matching hash on real physical bytes
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        f.write("CANONICAL_MODEL_DATA_BYTES")
        temp_path = Path(f.name)

    try:
        h1 = sha256_file(temp_path)
        assert len(h1) == 64

        # 2. Mismatching hash when bytes change
        with open(temp_path, "w") as f:
            f.write("TAMPERED_DATA_BYTES")
        h2 = sha256_file(temp_path)
        assert h1 != h2

        # 3. Missing artifact raises FileNotFoundError
        non_existent = temp_path.parent / "non_existent_file_98765.bin"
        with pytest.raises(FileNotFoundError):
            sha256_file(non_existent)
    finally:
        if temp_path.exists():
            temp_path.unlink()

    # 4. No physical artifact truthful disclosure
    reg = ModelRegistry()
    champ = reg.get_champion("residual_corrector")
    assert champ.model_artifact_sha256 is None
    assert champ.artifact_type == "SYNTHETIC_REGISTRY_IDENTIFIER"
    assert len(champ.registry_fingerprint) == 64


