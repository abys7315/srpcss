"""
Wells API Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ...db.database import get_db
from ...services.well_service import WellService
from ...schemas.well import WellSummaryDTO, WellDetailDTO
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/wells", tags=["Wells"])

@router.get("", response_model=APIResponse[List[WellSummaryDTO]])
def list_wells(db: Session = Depends(get_db)):
    """Returns overview of all 10 monitored Baghewala wells."""
    service = WellService(db)
    wells = service.get_all_wells()
    return APIResponse(
        success=True,
        message=f"Successfully retrieved {len(wells)} wells.",
        provenance=ProvenanceEnum.SIMULATED,
        data=wells
    )

@router.get("/{well_id}", response_model=APIResponse[WellDetailDTO])
def get_well(well_id: str, db: Session = Depends(get_db)):
    """Returns complete structural, operational, and telemetry details for a well."""
    service = WellService(db)
    well = service.get_well_by_id(well_id)
    if not well:
        raise HTTPException(status_code=404, detail=f"Well '{well_id}' not found.")
    return APIResponse(
        success=True,
        message=f"Well {well_id} retrieved.",
        provenance=ProvenanceEnum.SIMULATED,
        data=well
    )
