"""
Recommendation Approval & Rejection Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...db.database import get_db
from ...services.well_service import WellService
from ...schemas.well import (
    RecommendationApprovalRequest,
    RecommendationApprovalResponse
)
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.post("/{recommendation_id}/approve", response_model=APIResponse[RecommendationApprovalResponse])
def approve_recommendation(
    recommendation_id: str,
    req: RecommendationApprovalRequest,
    db: Session = Depends(get_db)
):
    """
    Formal human-in-the-loop engineering approval of an AI-optimized setpoint.
    Persists decision, reason, actor, and setpoint snapshot to audit ledger.
    """
    try:
        service = WellService(db)
        res = service.approve_recommendation(recommendation_id, req)
        return APIResponse(
            success=True,
            message=res.message,
            provenance=ProvenanceEnum.SIMULATED,
            data=res
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval error: {str(e)}")

@router.post("/{recommendation_id}/reject", response_model=APIResponse[RecommendationApprovalResponse])
def reject_recommendation(
    recommendation_id: str,
    req: RecommendationApprovalRequest,
    db: Session = Depends(get_db)
):
    """
    Operator rejection of an AI recommendation with logged reason.
    """
    try:
        service = WellService(db)
        res = service.reject_recommendation(recommendation_id, req)
        return APIResponse(
            success=True,
            message=res.message,
            provenance=ProvenanceEnum.SIMULATED,
            data=res
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rejection error: {str(e)}")
