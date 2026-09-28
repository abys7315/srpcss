"""
Computed Confidence & Recommendation Mode Engine.

Confidence is computed, never arbitrary, combining:
1. Prediction Uncertainty (ensemble spread / interval width)
2. Historical / Simulated Validation Error in operating region
3. Distance from Training Distribution (OOD score)
4. Input Data Quality Score (missing sensors, noise level)
5. Physics-Model Validity (operational range checks)
6. Constraint Safety Margin of the proposed plan

Recommendation Modes:
- HIGH (>= 0.85): Normal advisory recommendation
- MEDIUM (0.70 - 0.84): Advisory with warning and requirement for engineer review
- LOW (0.50 - 0.69): Advisory only; no simulated auto-adjustment
- VERY_LOW (< 0.50): Suppress recommendation; explain why and what data is needed

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass
from typing import Dict, Any, List, Optional
import numpy as np

@dataclass
class ConfidenceReport:
    overall_confidence_score: float     # [0.0, 1.0]
    recommendation_mode: str            # "HIGH", "MEDIUM", "LOW", "VERY_LOW"
    sub_scores: Dict[str, float]        # Breakdown across 6 pillars
    weights: Dict[str, float]
    formula_explanation: str
    is_recommendation_permitted: bool
    rejection_reason: Optional[str] = None
    provenance: str = "SIMULATED"

class ConfidenceEstimator:
    """Computes transparent, auditable confidence scores governing recommendation modes."""

    WEIGHTS = {
        "prediction_uncertainty": 0.20,
        "historical_validation_error": 0.20,
        "training_distribution_distance": 0.15,
        "input_data_quality": 0.20,
        "physics_validity_range": 0.15,
        "constraint_safety_margin": 0.10,
    }

    def compute_confidence(
        self,
        prediction_spread_pct: float,        # (p90 - p10) / p50
        validation_error_pct: float,         # Observed regional MAPE
        distance_to_training_distribution: float, # Normalized Mahalanobis distance [0, 1]
        data_quality_score: float,           # [0, 1] based on missing sensors
        are_physics_inputs_in_range: bool,
        min_constraint_margin_pct: float     # Lowest safety margin to limits (e.g. 15%)
    ) -> ConfidenceReport:
        """
        Calculates composite confidence score.
        """
        # 1. Prediction Uncertainty score: Higher spread -> lower confidence
        s_uncert = float(np.clip(1.0 - (prediction_spread_pct / 0.50), 0.0, 1.0))
        
        # 2. Historical Error score: Higher error -> lower confidence
        s_hist = float(np.clip(1.0 - (validation_error_pct / 0.30), 0.0, 1.0))
        
        # 3. Distribution Distance score: Out of distribution -> lower confidence
        s_dist = float(np.clip(1.0 - distance_to_training_distribution, 0.0, 1.0))
        
        # 4. Input Data Quality score:
        s_qual = float(np.clip(data_quality_score, 0.0, 1.0))
        
        # 5. Physics Validity Range:
        s_phys = 1.0 if are_physics_inputs_in_range else 0.20
        
        # 6. Constraint Safety Margin score:
        # If plan is within 5% of a hard limit, lower confidence
        s_margin = float(np.clip(min_constraint_margin_pct / 0.20, 0.0, 1.0))

        sub_scores = {
            "prediction_uncertainty": round(s_uncert, 3),
            "historical_validation_error": round(s_hist, 3),
            "training_distribution_distance": round(s_dist, 3),
            "input_data_quality": round(s_qual, 3),
            "physics_validity_range": round(s_phys, 3),
            "constraint_safety_margin": round(s_margin, 3),
        }

        # Weighted composite score:
        total_conf = sum(sub_scores[k] * self.WEIGHTS[k] for k in self.WEIGHTS)
        total_conf = float(np.clip(total_conf, 0.05, 0.99))

        # Determine Recommendation Mode:
        if s_qual < 0.40:
            mode = "VERY_LOW"
            permitted = False
            reason = "Input sensor telemetry quality failed threshold (< 40%). Key wellhead sensors missing."
        elif not are_physics_inputs_in_range:
            mode = "VERY_LOW"
            permitted = False
            reason = "Operating parameters outside physical validity bounds of the thermal/wave model."
        elif total_conf >= 0.85:
            mode = "HIGH"
            permitted = True
            reason = None
        elif total_conf >= 0.70:
            mode = "MEDIUM"
            permitted = True
            reason = "Medium confidence: Recommendation requires engineer review before simulated execution."
        elif total_conf >= 0.50:
            mode = "LOW"
            permitted = True
            reason = "Low confidence: Displayed for advisory comparison only; automated adjustment locked."
        else:
            mode = "VERY_LOW"
            permitted = False
            reason = "Overall confidence below minimum operational threshold (50%)."

        formula_text = (
            "Confidence = 0.20*(1 - Spread/50%) + 0.20*(1 - MAPE/30%) + 0.15*(1 - Dist) "
            "+ 0.20*DataQuality + 0.15*PhysicsValid + 0.10*ConstraintMargin"
        )

        return ConfidenceReport(
            overall_confidence_score=round(total_conf, 3),
            recommendation_mode=mode,
            sub_scores=sub_scores,
            weights=self.WEIGHTS,
            formula_explanation=formula_text,
            is_recommendation_permitted=permitted,
            rejection_reason=reason,
            provenance="SIMULATED"
        )
