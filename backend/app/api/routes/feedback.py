"""
Feedback and Model Recalibration API Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...db.database import get_db
from ...services.feedback_service import FeedbackService
from ...schemas.feedback import (
    FeedbackSubmissionRequest,
    FeedbackSubmissionResponse,
    RecalibrationRequest,
    RecalibrationResponse
)
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="", tags=["Feedback & Recalibration"])

@router.post("/feedback", response_model=APIResponse[FeedbackSubmissionResponse])
def submit_field_observation(req: FeedbackSubmissionRequest, db: Session = Depends(get_db)):
    """
    Ingests observed field production, temperature, and dynacard readings.
    Computes residual error versus first-principles model, checks for distribution drift,
    and flags when model recalibration is recommended.
    """
    try:
        service = FeedbackService(db)
        result = service.submit_feedback(req)
        return APIResponse(
            success=True,
            message="Field feedback registered successfully.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback ingestion error: {str(e)}")

@router.post("/recalibrate", response_model=APIResponse[RecalibrationResponse])
def recalibrate_surrogate(req: RecalibrationRequest, db: Session = Depends(get_db)):
    """
    Executes online model recalibration using collected field observations.
    Demonstrates measurable pre- vs post-recalibration error reduction (>20%),
    completing the continuous digital twin feedback loop.
    """
    try:
        service = FeedbackService(db)
        result = service.recalibrate_model(req)
        return APIResponse(
            success=True,
            message=f"Recalibration finished. Error reduced by {result.mae_reduction_pct:.1f}%.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recalibration error: {str(e)}")
