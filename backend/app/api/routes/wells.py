"""
Wells API Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ...db.database import get_db
from ...services.well_service import WellService
from ...schemas.well import (
    WellSummaryDTO,
    WellDetailDTO,
    SetpointUpdateRequest,
    SetpointUpdateResponse,
    AuditRecordDTO
)
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

@router.post("/{well_id}/setpoint", response_model=APIResponse[SetpointUpdateResponse])
def update_well_setpoint(well_id: str, req: SetpointUpdateRequest, db: Session = Depends(get_db)):
    """Applies approved setpoint to the digital twin and wellbore state."""
    try:
        service = WellService(db)
        res = service.update_setpoint(well_id, req)
        return APIResponse(
            success=True,
            message=res.message,
            provenance=ProvenanceEnum.SIMULATED,
            data=res
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{well_id}/audit", response_model=APIResponse[List[AuditRecordDTO]])
def get_well_audit_trail(well_id: str, db: Session = Depends(get_db)):
    """Returns chronological digital twin audit trail for a well."""
    try:
        service = WellService(db)
        records = service.get_audit_trail(well_id)
        return APIResponse(
            success=True,
            message=f"Retrieved {len(records)} audit records for {well_id}.",
            provenance=ProvenanceEnum.SIMULATED,
            data=records
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
