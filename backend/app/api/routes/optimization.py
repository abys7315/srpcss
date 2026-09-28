"""
Optimization API Endpoints (Joint CSS+SRP, Slow Loop CSS, Fast Loop SRP).
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...db.database import get_db
from ...services.optimization_service import OptimizationService
from ...schemas.optimization import (
    JointOptimizationRequest,
    CSSOptimizationRequest,
    SRPOptimizationRequest,
    OptimizationResponse
)
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/optimize", tags=["Optimization"])

@router.post("/joint", response_model=APIResponse[OptimizationResponse])
def optimize_joint_cycle(req: JointOptimizationRequest, db: Session = Depends(get_db)):
    """
    Jointly optimizes CSS thermal parameters and SRP lifting settings.
    Discovers non-dominated Pareto frontier and selects the optimal operating point.
    Hard safety constraint gating strictly rejects rod-floating candidates.
    """
    try:
        service = OptimizationService(db=db)
        result = service.optimize_joint(req)
        return APIResponse(
            success=True,
            status=result.status.value,
            message="Joint CSS+SRP multi-objective optimization completed.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Joint optimization error: {str(e)}")

@router.post("/css", response_model=APIResponse[OptimizationResponse])
def optimize_css_slow_loop(req: CSSOptimizationRequest, db: Session = Depends(get_db)):
    """Slow loop optimizer: Optimizes steam volume and soak duration for fixed lifting schedule."""
    try:
        service = OptimizationService(db=db)
        result = service.optimize_css(req)
        return APIResponse(
            success=True,
            status=result.status.value,
            message="CSS slow-loop thermal optimization completed.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSS optimization error: {str(e)}")

@router.post("/srp", response_model=APIResponse[OptimizationResponse])
def optimize_srp_fast_loop(req: SRPOptimizationRequest, db: Session = Depends(get_db)):
    """Fast loop optimizer: Optimizes SPM and VFD speed ratio to prevent rod float in cold heavy crude."""
    try:
        service = OptimizationService(db=db)
        result = service.optimize_srp(req)
        return APIResponse(
            success=True,
            status=result.status.value,
            message="SRP fast-loop lift optimization completed.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SRP optimization error: {str(e)}")
