"""
Risk Service — Failure Probability and Component Risk Attribution.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from ml.failure_risk.predictor import FailureRiskPredictor
from ..schemas.risk import RiskEvaluationRequest, RiskEvaluationResponse, RiskFactorAttributionDTO
from ..schemas.common import ProvenanceEnum

class RiskService:
    def __init__(self):
        self.predictor = FailureRiskPredictor()

    def evaluate_risk(self, req: RiskEvaluationRequest) -> RiskEvaluationResponse:
        res = self.predictor.evaluate_risk(
            float_margin_index=req.float_margin_index,
            goodman_stress_ratio=req.goodman_stress_ratio,
            fluid_pound_severity=req.fluid_pound_severity,
            gearbox_load_pct=req.gearbox_load_pct,
            asphaltene_risk_score=req.asphaltene_risk_score,
            cumulative_float_events=req.cumulative_float_events
        )

        factors = []
        for f in res.top_contributing_factors:
            factors.append(RiskFactorAttributionDTO(
                factor_name=f.get("factor", "Unknown"),
                contribution_pct=round(f.get("attribution_pct", 0.0), 1),
                raw_value=round(f.get("raw_value", 0.0), 3),
                safe_threshold=f.get("safe_threshold", 1.0),
                status=f.get("status", "SAFE")
            ))

        dominant = factors[0].factor_name if factors else "Mechanical Fatigue"

        mitigations = [res.recommended_mitigation]
        if req.float_margin_index < 1.25:
            mitigations.append("Reduce SPM by 0.5–1.0 or engage VFD downstroke slow speed (< 0.85) to mitigate viscous drag.")
        if req.goodman_stress_ratio > 0.85:
            mitigations.append("Shorten stroke length or rebalance counterweights to lower peak polished rod tensile stress.")

        return RiskEvaluationResponse(
            well_id=req.well_id,
            overall_failure_probability_30d=round(res.overall_failure_probability, 3),
            risk_tier=res.risk_level,
            factor_attributions=factors,
            dominant_failure_mode=dominant,
            suggested_mitigations=mitigations,
            provenance=ProvenanceEnum.SIMULATED
        )
