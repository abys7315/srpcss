"""
Operational Anomaly Detection Engine (Rolling Z-Score + Isolation Forest).

Monitors multivariate telemetry:
[oil_rate_bpd, temperature_c, bottomhole_pressure_bar, peak_load_lbs, electricity_kwh]
to flag operational anomalies (sensor dropouts, casing integrity leaks, unexpected cooling, rod float onset).

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.ensemble import IsolationForest

@dataclass
class AnomalyReport:
    is_anomaly: bool
    anomaly_score: float                # [-1.0, 1.0] where < 0 indicates anomaly in Isolation Forest
    anomaly_severity: str               # "NONE", "LOW", "MODERATE", "CRITICAL"
    flagged_channels: List[str]
    root_cause_explanation: str
    recommended_operator_action: str
    provenance: str = "SIMULATED"

class OperationalAnomalyDetector:
    """Combines statistical Z-scores with Isolation Forest for multivariate anomaly detection."""

    CHANNELS = ["oil_rate_bpd", "temperature_c", "pressure_bar", "peak_load_lbs", "electricity_kwh"]

    def __init__(self, contamination: float = 0.05):
        self.isolation_forest = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=80
        )
        self.is_fitted = False
        self._initialize_baseline_model()

    def _initialize_baseline_model(self):
        """Initializes Isolation Forest on calibrated normal operating domain."""
        # Generate representative normal operation matrix
        # [oil_rate ~ 40-90, temp ~ 60-180, press ~ 45-65, load ~ 12000-17000, kwh ~ 40-75]
        N = 200
        normal_samples = np.column_stack([
            np.random.uniform(30.0, 85.0, N),
            np.random.uniform(65.0, 180.0, N),
            np.random.uniform(45.0, 65.0, N),
            np.random.uniform(12000.0, 17000.0, N),
            np.random.uniform(40.0, 75.0, N)
        ])
        self.isolation_forest.fit(normal_samples)
        self.is_fitted = True

    def evaluate_point(
        self,
        oil_rate_bpd: float,
        temperature_c: float,
        pressure_bar: float,
        peak_load_lbs: float,
        electricity_kwh: float,
        rolling_temp_history: Optional[List[float]] = None
    ) -> AnomalyReport:
        """
        Evaluates current operational state against baseline distribution and rolling trends.
        """
        X_pt = np.array([[oil_rate_bpd, temperature_c, pressure_bar, peak_load_lbs, electricity_kwh]])
        
        # 1. Isolation Forest score:
        if_score = float(self.isolation_forest.decision_function(X_pt)[0])
        is_if_anomaly = (if_score < 0.0)

        # 2. Rolling Z-Score on temperature (detects rapid cooling events):
        flagged = []
        is_rapid_cooling = False
        if rolling_temp_history and len(rolling_temp_history) >= 5:
            arr = np.array(rolling_temp_history[-5:])
            diffs = np.diff(arr)
            # If cooling faster than 6 C in 2 days:
            if len(diffs) >= 2 and np.sum(diffs[-2:]) < -6.0:
                is_rapid_cooling = True
                flagged.append("temperature_c")

        # Check individual channels for extreme out-of-range:
        if temperature_c < 45.0:
            flagged.append("temperature_c (cold reservoir / severe viscous drag)")
        if peak_load_lbs > 19500.0:
            flagged.append("peak_load_lbs (beam structural overload)")
        if oil_rate_bpd < 4.0:
            flagged.append("oil_rate_bpd (severe production loss)")
        if electricity_kwh > 90.0:
            flagged.append("electricity_kwh (motor thermal overload)")

        is_anomaly = is_if_anomaly or is_rapid_cooling or (len(flagged) > 0)

        # Determine severity and explanation:
        if is_rapid_cooling:
            severity = "CRITICAL"
            explanation = "Reservoir temperature cooling significantly faster than physical Boberg-Lantz model predicts."
            action = "Inspect steam chamber pressure and verify whether cold water breakthrough occurred."
        elif "peak_load_lbs (beam structural overload)" in flagged:
            severity = "CRITICAL"
            explanation = "Polished rod load approaching structural beam rating limit."
            action = "Lower SPM immediately to avoid rod parted failure."
        elif is_if_anomaly:
            severity = "MODERATE"
            explanation = "Multivariate state is anomalous relative to standard operating envelope."
            action = "Verify downhole dynamometer card and sensor calibrations."
        elif len(flagged) > 0:
            severity = "LOW"
            explanation = f"Sensor deviation flagged on channels: {', '.join(flagged)}"
            action = "Monitor trend over next 24 hours."
        else:
            severity = "NONE"
            explanation = "All operating channels within normal statistical envelope."
            action = "Continue regular monitoring."

        return AnomalyReport(
            is_anomaly=is_anomaly,
            anomaly_score=round(if_score, 3),
            anomaly_severity=severity,
            flagged_channels=flagged,
            root_cause_explanation=explanation,
            recommended_operator_action=action,
            provenance="SIMULATED"
        )
