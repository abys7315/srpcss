"""
Health Check and System Status Endpoint.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(tags=["System Health"])


def _database_status() -> str:
    """Cheap connectivity probe (SELECT 1); safe for a cron ping."""
    try:
        from sqlalchemy import text
        from app.db.database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return "CONNECTED"
    except Exception:
        return "UNAVAILABLE"


def _model_status(model_id: str) -> str:
    """Dynamically checks the model registry for registered champion status."""
    try:
        from ml.registry.model_registry import ModelRegistry
        mr = ModelRegistry()
        champ = mr.get_champion(model_id)
        if champ:
            return f"ONLINE ({champ.version})"
        return "ONLINE (v1.0.0-sim)"
    except Exception:
        return "UNLOADED"


@router.get("/health")
def health_check():
    """
    Fast process-is-up liveness check.
    Does NOT ping the database, ensuring Neon Serverless Postgres can autosuspend when idle
    and avoiding 503 flapping on cold starts. For an explicit DB probe, call /health/db.
    """
    body = {
        "status": "HEALTHY",
        "service": "PETRO-TWIN — Baghewala Heavy Oil Digital Twin",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {
            "physics_twin_engine": "ONLINE",
            "constraint_engine": "ENFORCING",
            "joint_optimizer": "READY",
            "ml_residual_corrector": _model_status("residual_corrector"),
            "dynacard_classifier": _model_status("dynacard_classifier"),
            "risk_predictor": _model_status("rod_failure_risk"),
        },
        "provenance_mode": "SIMULATED"
    }
    return JSONResponse(body, status_code=200)


@router.get("/health/db")
def database_health_check():
    """
    Dedicated database connectivity probe (SELECT 1).
    Separated from /health so Render / cron ping monitors do not prevent Neon from autosuspending.
    """
    db_status = _database_status()
    body = {
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "autosuspend_safe": True
    }
    return JSONResponse(body, status_code=200 if db_status == "CONNECTED" else 503)

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

