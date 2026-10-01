"""
Hybrid Physics-ML Residual Error Correction Model.

Equation:
y_final(t) = y_physics(t) + delta_ML(X_t)

Where:
- y_physics(t) is computed by first-principles CSSThermalModel and ThermalInflowModel.
- delta_ML(X_t) is trained via gradient-boosted trees on empirical deviations
  (capturing asphaltene slip, emulsion non-Newtonian effects, and completion variations).

PROVENANCE: SIMULATED (Trained on synthetic field telemetry with model mismatch).
"""

from dataclasses import dataclass
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

@dataclass
class ResidualPrediction:
    physics_prediction: float
    ml_residual_correction: float
    final_hybrid_prediction: float
    residual_uncertainty_std: float
    provenance: str = "SIMULATED"

class HybridResidualCorrector:
    """Trains and predicts residual adjustments on top of physical simulator outputs."""

    def __init__(self, target_variable: str = "oil_rate_bpd"):
        self.target_variable = target_variable
        self.model = HistGradientBoostingRegressor(
            max_iter=100,
            learning_rate=0.08,
            max_depth=4,
            random_state=42
        )
        self.is_fitted = False
        self.training_mae = 0.0

    def fit(self, X: np.ndarray, y_observed: np.ndarray, y_physics: np.ndarray):
        """
        Fits the residual model on:
        residual = y_observed - y_physics
        
        Args:
            X: Feature matrix [N, D] (temperature, viscosity, SPM, stroke, water_cut, etc.)
            y_observed: Measured / noisy field observations
            y_physics: First-principles physics baseline predictions
        """
        residuals = y_observed - y_physics
        self.model.fit(X, residuals)
        self.is_fitted = True
        
        preds = self.model.predict(X)
        self.training_mae = float(np.mean(np.abs(residuals - preds)))

    def predict(self, X_point: np.ndarray, y_physics_val: float) -> ResidualPrediction:
        """Evaluates hybrid prediction: y_final = y_physics + delta_ML."""
        if not self.is_fitted:
            # Fallback to pure physics if ML not yet trained
            return ResidualPrediction(
                physics_prediction=round(float(y_physics_val), 2),
                ml_residual_correction=0.0,
                final_hybrid_prediction=round(float(y_physics_val), 2),
                residual_uncertainty_std=0.5
            )

        X_in = np.asarray(X_point).reshape(1, -1)
        residual_corr = float(self.model.predict(X_in)[0])
        final_val = max(0.0, y_physics_val + residual_corr)

        return ResidualPrediction(
            physics_prediction=round(float(y_physics_val), 2),
            ml_residual_correction=round(float(residual_corr), 2),
            final_hybrid_prediction=round(float(final_val), 2),
            residual_uncertainty_std=round(max(0.2, self.training_mae), 2)
        )

    def save(self, filepath: Any) -> str:
        """Serializes fitted corrector to disk via joblib."""
        import joblib
        from pathlib import Path
        p = Path(filepath)
        p.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, p)
        return str(p)

    @classmethod
    def load(cls, filepath: Any) -> "HybridResidualCorrector":
        """Loads serialized corrector from disk."""
        import joblib
        from pathlib import Path
        p = Path(filepath)
        if not p.is_file():
            raise FileNotFoundError(f"Model file not found: {p}")
        return joblib.load(p)
