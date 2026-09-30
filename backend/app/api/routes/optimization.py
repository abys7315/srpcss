"""
Optimization API Endpoints (Joint CSS+SRP, Slow Loop CSS, Fast Loop SRP).
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...db.database import get_db, SessionLocal
from ...services import job_manager
from ...services.optimization_service import OptimizationService
from ...schemas.optimization import (
    JointOptimizationRequest,
    CSSOptimizationRequest,
    SRPOptimizationRequest,
    OptimizationResponse,
    MulticycleRequest,
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

@router.post("/joint/jobs")
def start_joint_optimization_job(req: JointOptimizationRequest):
    """
    Starts the joint optimization in the background and returns a job id immediately.
    Poll GET /optimize/jobs/{job_id} for progress (evaluations done / expected) and the result.
    """
    def work(progress):
        db = SessionLocal()          # the request session is closed once this handler returns
        try:
            result = OptimizationService(db=db).optimize_joint(req, progress_cb=progress)
            return {
                "success": True, "status": result.status.value,
                "message": "Joint CSS+SRP multi-objective optimization completed.",
                "provenance": "SIMULATED", "data": result.model_dump(mode="json"),
            }
        finally:
            db.close()

    return {"job_id": job_manager.submit(work, f"joint:{req.well_id}")}


@router.get("/jobs/{job_id}")
def get_optimization_job(job_id: str):
    job = job_manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown or expired job id.")
    return job


@router.post("/multicycle")
def optimize_multicycle(req: MulticycleRequest, db: Session = Depends(get_db)):
    """Chains n CSS cycles with carried state; per-cycle steam with one-cycle lookahead."""
    try:
        data = OptimizationService(db=db).optimize_multicycle(req)
        return {"success": True, "status": "COMPLETED", "message": "Multi-cycle plan computed.",
                "provenance": "SIMULATED", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multi-cycle optimization error: {str(e)}")

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
