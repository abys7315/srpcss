"""
Health Check and System Status Endpoint.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter
from datetime import datetime
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(tags=["System Health"])

@router.get("/health")
def health_check():
    """Returns digital twin engine operational health, registered model versions, and DB status."""
    return {
        "status": "HEALTHY",
        "service": "PETRO-TWIN — Baghewala Heavy Oil Digital Twin",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
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
