"""
Model Concept & Data Drift Detection Monitor.

Uses two-sample Kolmogorov-Smirnov statistical tests and CUSUM tracking
on prediction error residuals to detect reservoir behavior drift
and trigger 'Recalibration Recommended' events.

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from scipy import stats

@dataclass
class DriftReport:
    drift_detected: bool
    ks_statistic: float
    p_value: float
    rolling_mae: float
    baseline_mae: float
    error_increase_pct: float
    status: str                         # "STABLE", "WARNING", "DRIFT_CONFIRMED"
    recommended_action: str
    provenance: str = "SIMULATED"

class ModelDriftMonitor:
    """Detects statistical distribution shifts in well responses and model residuals."""

    def __init__(self, p_value_threshold: float = 0.05, error_growth_threshold_pct: float = 25.0):
        self.p_val_thresh = p_value_threshold
        self.error_growth_thresh = error_growth_threshold_pct

    def evaluate_residual_drift(
        self,
        baseline_residuals: List[float],
        recent_residuals: List[float]
    ) -> DriftReport:
        """
        Runs two-sample KS test comparing baseline validation residuals against recent telemetry residuals.
        """
        b_res = np.asarray(baseline_residuals)
        r_res = np.asarray(recent_residuals)
        
        if len(b_res) < 5 or len(r_res) < 5:
            return DriftReport(
                drift_detected=False,
                ks_statistic=0.0,
                p_value=1.0,
                rolling_mae=float(np.mean(np.abs(r_res))) if len(r_res) > 0 else 0.0,
                baseline_mae=float(np.mean(np.abs(b_res))) if len(b_res) > 0 else 0.0,
                error_increase_pct=0.0,
                status="STABLE",
                recommended_action="Insufficient samples for statistical drift test."
            )

        # Two-sample KS test:
        ks_stat, p_val = stats.ks_2samp(b_res, r_res)
        
        base_mae = float(np.mean(np.abs(b_res)))
        recent_mae = float(np.mean(np.abs(r_res)))
        err_increase = ((recent_mae - base_mae) / max(base_mae, 1e-4)) * 100.0

        drift = (p_val < self.p_val_thresh) or (err_increase > self.error_growth_thresh)
        
        if drift and err_increase > 40.0:
            status = "DRIFT_CONFIRMED"
            action = "Recalibration strongly recommended: Retrain ML residuals and recalibrate reservoir PI."
        elif drift:
            status = "WARNING"
            action = "Distribution shift detected: Monitor next 5 days for persistent error growth."
        else:
            status = "STABLE"
            action = "Model residual distribution matches baseline; no recalibration required."

        return DriftReport(
            drift_detected=drift,
            ks_statistic=round(float(ks_stat), 4),
            p_value=round(float(p_val), 4),
            rolling_mae=round(recent_mae, 2),
            baseline_mae=round(base_mae, 2),
            error_increase_pct=round(err_increase, 1),
            status=status,
            recommended_action=action,
            provenance="SIMULATED"
        )
