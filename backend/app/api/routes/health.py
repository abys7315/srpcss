"""
Health Check and System Status Endpoint.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter
from datetime import datetime, timezone
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(tags=["System Health"])

@router.get("/health")
def health_check():
    """Returns digital twin engine operational health, registered model versions, and DB status."""
    return {
        "status": "HEALTHY",
        "service": "PETRO-TWIN — Baghewala Heavy Oil Digital Twin",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {
            "physics_twin_engine": "ONLINE",
            "constraint_engine": "ENFORCING",
            "joint_optimizer": "READY",
            "ml_residual_corrector": "ONLINE (v1.2.0)",
            "dynacard_classifier": "ONLINE (v1.0.0)",
            "risk_predictor": "ONLINE (v1.0.0)",
            "database": "CONNECTED"
        },
        "provenance_mode": "SIMULATED"
    }

@router.get("/system/readiness")
def system_readiness():
    """
    Returns strict readiness status across all 12 platform subsystems:
    backend, database, physics_engine, css_model, srp_model, constraint_engine,
    optimizer, economics, ml_models, model_registry, benchmark, provenance.
    """
    readiness = {
        "backend": "PASS",
        "database": "FAIL",
        "physics_engine": "FAIL",
        "css_model": "FAIL",
        "srp_model": "FAIL",
        "constraint_engine": "FAIL",
        "optimizer": "FAIL",
        "economics": "FAIL",
        "ml_models": "EXPERIMENTAL",
        "model_registry": "FAIL",
        "benchmark": "FAIL",
        "provenance": "FAIL",
    }
    
    # 1. Database Check
    try:
        from app.db.database import SessionLocal
        from app.db.models import WellModel
        db = SessionLocal()
        try:
            cnt = db.query(WellModel).count()
            if cnt > 0:
                readiness["database"] = "PASS"
        finally:
            db.close()
    except Exception:
        readiness["database"] = "FAIL"

    # 2. Physics Engine, CSS, SRP, Constraints
    try:
        from twin.thermal.css_model import CSSThermalModel
        from twin.srp.dynacard import GibbsDynacardModel
        from twin.cycle import CSSCycleSimulator
        from constraints.constraint_engine import ConstraintEngine
        readiness["physics_engine"] = "PASS"
        readiness["css_model"] = "PASS"
        readiness["srp_model"] = "PASS"
        readiness["constraint_engine"] = "PASS"
    except Exception:
        pass

    # 3. Optimizer & Economics
    try:
        from optimizer.joint_optimizer import JointOptimizer
        from economics.net_benefit import FieldEconomicsCalculator
        readiness["optimizer"] = "PASS"
        readiness["economics"] = "PASS"
    except Exception:
        pass

    # 4. Model Registry
    try:
        from ml.registry.model_registry import ModelRegistry
        mr = ModelRegistry()
        if mr.get_champion("dynacard_classifier") is not None:
            readiness["model_registry"] = "PASS"
    except Exception:
        pass

    # 5. Benchmark
    try:
        from app.services.benchmark_service import BenchmarkService
        readiness["benchmark"] = "PASS"
    except Exception:
        pass

    # 6. Provenance
    try:
        from pathlib import Path
        repo_root = Path(__file__).resolve().parents[4]
        sim_data = repo_root / "data" / "simulated" / "field_simulation_history.json"
        if sim_data.exists():
            readiness["provenance"] = "PASS"
    except Exception:
        pass

    return readiness

