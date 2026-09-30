"""
Feedback and Model Recalibration Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .common import ProvenanceEnum

class FeedbackSubmissionRequest(BaseModel):
    well_id: str = "BGW-01"
    day: int = Field(default=30, ge=1)
    day_in_cycle: Optional[int] = None
    observed_oil_rate_bpd: float = Field(default=35.0, ge=0.0)
    observed_temperature_c: float = Field(default=65.0, ge=20.0, le=350.0)
    observed_water_cut_pct: Optional[float] = None
    observed_intake_pressure_bar: Optional[float] = None
    observed_float_events: int = Field(default=0, ge=0)
    observed_dynacard_label: Optional[str] = "NORMAL"
    operator_notes: Optional[str] = "Routine morning gauge reading"
    notes: Optional[str] = None

class FeedbackSubmissionResponse(BaseModel):
    feedback_id: str
    well_id: str
    day: int
    observed_oil_rate_bpd: float
    physics_expected_oil_bpd: float
    residual_error_bpd: float
    is_drift_detected: bool
    recalibration_recommended: bool
    message: str
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED

class RecalibrationRequest(BaseModel):
    well_id: str = "BGW-01"
    force_recalibrate: bool = False
    allow_synthetic_fallback: bool = False  # Deprecated and ignored: the synthetic demo fallback was removed.

class RecalibrationResponse(BaseModel):
    well_id: str
    model_name: str
    previous_model_version: str
    new_model_version: str
    sample_points_used: int
    train_mae_bpd: float = 0.0
    validation_mae_bpd: float = 0.0
    pre_recalibration_mae_bpd: float
    post_recalibration_mae_bpd: float
    mae_reduction_pct: float
    drift_status_cleared: bool
    status: str                         # "PROMOTED_CHAMPION", "REJECTED_CHALLENGER", "INSUFFICIENT_OBSERVATIONS"
    explanation: str
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
