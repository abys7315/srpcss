"""
Equipment Failure Risk Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .common import ProvenanceEnum

class RiskFactorAttributionDTO(BaseModel):
    factor_name: str
    contribution_pct: float
    raw_value: float
    safe_threshold: float
    status: str # "SAFE", "ELEVATED", "CRITICAL"

class RiskEvaluationRequest(BaseModel):
    well_id: str = "BGW-01"
    float_margin_index: float = Field(default=1.45, ge=0.0)
    goodman_stress_ratio: float = Field(default=0.65, ge=0.0)
    fluid_pound_severity: float = Field(default=0.10, ge=0.0, le=1.0)
    gearbox_load_pct: float = Field(default=68.0, ge=0.0)
    asphaltene_risk_score: float = Field(default=0.25, ge=0.0, le=1.0)
    cumulative_float_events: int = Field(default=0, ge=0)

class RiskEvaluationResponse(BaseModel):
    well_id: str
    overall_failure_probability_30d: float
    risk_tier: str # "LOW", "MODERATE", "HIGH", "CRITICAL"
    factor_attributions: List[RiskFactorAttributionDTO]
    dominant_failure_mode: str
    suggested_mitigations: List[str]
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
