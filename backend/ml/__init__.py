"""
Petro-Twin Machine Learning and AI Augmentation Package.

Provides hybrid residual models, dynacard classifiers, production forecasters,
failure risk predictors, anomaly detectors, and computed confidence estimators.
"""

from .residual_models.corrector import HybridResidualCorrector, ResidualPrediction
from .production_forecasting.forecaster import ProductionForecaster, ForecastHorizonResult
from .dynacard_classification.classifier import DynacardClassifier, DynacardClassificationResult
from .failure_risk.predictor import FailureRiskPredictor, FailureRiskAssessment
from .anomaly_detection.detector import OperationalAnomalyDetector, AnomalyReport
from .confidence.estimator import ConfidenceEstimator, ConfidenceReport
from .drift.monitor import ModelDriftMonitor, DriftReport
from .registry.model_registry import ModelRegistry, ModelMetadata

__all__ = [
    "HybridResidualCorrector",
    "ResidualPrediction",
    "ProductionForecaster",
    "ForecastHorizonResult",
    "DynacardClassifier",
    "DynacardClassificationResult",
    "FailureRiskPredictor",
    "FailureRiskAssessment",
    "OperationalAnomalyDetector",
    "AnomalyReport",
    "ConfidenceEstimator",
    "ConfidenceReport",
    "ModelDriftMonitor",
    "DriftReport",
    "ModelRegistry",
    "ModelMetadata",
]
