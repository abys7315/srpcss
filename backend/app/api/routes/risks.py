"""
Equipment Failure Risk API Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...db.database import get_db
from ...db.models import WellModel
from ...services.risk_service import RiskService
from ...schemas.risk import RiskEvaluationRequest, RiskEvaluationResponse
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/risks", tags=["Failure Risk"])

@router.post("/evaluate", response_model=APIResponse[RiskEvaluationResponse])
def evaluate_equipment_risk(req: RiskEvaluationRequest):
    """Evaluates 30-day failure probability and factor attribution breakdown."""
    try:
        service = RiskService()
        result = service.evaluate_risk(req)
        return APIResponse(
            success=True,
            message=f"Risk evaluation complete. Tier: {result.risk_tier}.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk evaluation error: {str(e)}")

@router.get("/{well_id}", response_model=APIResponse[RiskEvaluationResponse])
def get_well_risk(well_id: str, db: Session = Depends(get_db)):
    """Computes failure risk for a specific well using its latest stored telemetry."""
    well = db.query(WellModel).filter(WellModel.well_id == well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail=f"Well '{well_id}' not found.")

    req = RiskEvaluationRequest(
        well_id=well.well_id,
        float_margin_index=well.latest_float_margin,
        goodman_stress_ratio=well.latest_goodman_stress,
        fluid_pound_severity=0.15 if well.latest_dynacard_label == "FLUID_POUND" else 0.05,
        gearbox_load_pct=68.0,
        asphaltene_risk_score=0.25,
        cumulative_float_events=2 if well.status == "INFEASIBLE" else 0
    )
    service = RiskService()
    result = service.evaluate_risk(req)
    return APIResponse(
        success=True,
        message=f"Risk evaluation for {well_id} completed.",
        provenance=ProvenanceEnum.SIMULATED,
        data=result
    )
