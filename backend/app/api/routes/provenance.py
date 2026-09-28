"""
Data Provenance and Audit API Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, HTTPException
from ...services.provenance_service import ProvenanceService
from ...schemas.provenance import ProvenanceSummaryResponse
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/provenance", tags=["Data Provenance"])

@router.get("", response_model=APIResponse[ProvenanceSummaryResponse])
def get_provenance_manifest():
    """
    Returns full data provenance audit report, distinguishing:
    REAL, PUBLIC_EXTERNAL, SIMULATED, and ASSUMED parameters.
    Displays mandatory Oil India Limited prototype disclaimers.
    """
    try:
        service = ProvenanceService()
        result = service.get_provenance_summary()
        return APIResponse(
            success=True,
            message="Data provenance manifest loaded.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provenance retrieval error: {str(e)}")
