"""
Production Forecaster with Quantile Uncertainty Intervals.

Predicts multi-horizon production curves with 10%, 50%, and 90% confidence bands:
[y_p10, y_p50, y_p90] using quantile regression.

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

@dataclass
class ForecastHorizonResult:
    horizon_days: List[int]
    median_forecast: List[float]       # 50th percentile (point prediction)
    lower_bound_p10: List[float]       # 10th percentile
    upper_bound_p90: List[float]       # 90th percentile
    average_uncertainty_spread: float
    variable_name: str
    units: str
    provenance: str = "SIMULATED"

class ProductionForecaster:
    """Multi-horizon probabilistic forecaster for production rates and temperatures."""

    def __init__(self, variable_name: str = "oil_rate_bpd", units: str = "BPD"):
        self.variable_name = variable_name
        self.units = units
        
        # Quantile regressors for uncertainty intervals:
        self.model_p10 = GradientBoostingRegressor(loss='quantile', alpha=0.10, n_estimators=60, max_depth=3, random_state=42)
        self.model_p50 = GradientBoostingRegressor(loss='quantile', alpha=0.50, n_estimators=60, max_depth=3, random_state=42)
        self.model_p90 = GradientBoostingRegressor(loss='quantile', alpha=0.90, n_estimators=60, max_depth=3, random_state=42)
        self.is_fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray):
        """Train quantile ensemble."""
        self.model_p10.fit(X, y)
        self.model_p50.fit(X, y)
        self.model_p90.fit(X, y)
        self.is_fitted = True

    def forecast_horizon(
        self,
        horizon_days: int,
        base_features: np.ndarray,
        physics_profile: Optional[List[float]] = None
    ) -> ForecastHorizonResult:
        """
        Generates forward prediction with p10, p50, and p90 intervals.
        If ML is not trained, uses calibrated physics profile with analytical uncertainty envelope.
        """
        days = list(range(1, horizon_days + 1))
        
        if self.is_fitted:
            # Build feature array for horizon:
            # Assuming first feature is day index
            X_future = np.repeat(base_features.reshape(1, -1), horizon_days, axis=0)
            X_future[:, 0] = np.array(days)
            
            p10 = [max(0.0, float(x)) for x in self.model_p10.predict(X_future)]
            p50 = [max(0.0, float(x)) for x in self.model_p50.predict(X_future)]
            p90 = [max(0.0, float(x)) for x in self.model_p90.predict(X_future)]
        else:
            # Physics-guided default forecast with increasing uncertainty over time:
            base_curve = physics_profile if physics_profile and len(physics_profile) >= horizon_days else [
                max(2.0, 50.0 * np.exp(-d / 35.0)) for d in days
            ]
            p50 = [round(float(val), 1) for val in base_curve[:horizon_days]]
            # Uncertainty expands with horizon sqrt(day):
            spread_factor = 0.08
            p10 = [round(max(0.0, val * (1.0 - spread_factor * np.sqrt(d))), 1) for d, val in zip(days, p50)]
            p90 = [round(val * (1.0 + spread_factor * np.sqrt(d)), 1) for d, val in zip(days, p50)]

        # Enforce monotonic quantile ordering
        for i in range(len(days)):
            p10[i] = min(p10[i], p50[i])
            p90[i] = max(p90[i], p50[i])

        spread = float(np.mean(np.array(p90) - np.array(p10)))

        return ForecastHorizonResult(
            horizon_days=days,
            median_forecast=p50,
            lower_bound_p10=p10,
            upper_bound_p90=p90,
            average_uncertainty_spread=round(spread, 2),
            variable_name=self.variable_name,
            units=self.units,
            provenance="SIMULATED"
        )
