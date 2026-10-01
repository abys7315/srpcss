"""
API Routes for External Benchmark Datasets.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional

from app.db.database import get_db
from app.services.dataset_service import dataset_service

router = APIRouter(prefix="/datasets", tags=["External Benchmark Datasets"])


@router.get("", summary="List available external benchmark datasets")
@router.get("/available", summary="List available external benchmark datasets")
def get_available_datasets():
    """Returns catalog of public industry benchmark datasets integrated into PETRO-TWIN."""
    return {
        "datasets": dataset_service.list_datasets(),
        "andrade_verification": dataset_service.verify_andrade_viscosity_fit()
    }


@router.get("/everitt-jennings", summary="Fetch 16 canonical Everitt-Jennings dynacards")
def get_everitt_jennings_cards():
    """Returns 16 standard SRP dynamometer card conditions from Everitt, Jennings & Gault (1992) / API RP 11L."""
    try:
        return dataset_service.get_everitt_jennings_cards()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/volve-telemetry", summary="Fetch Equinor Volve Field SCADA telemetry sample")
def get_volve_telemetry(
    well_id: Optional[str] = Query(None, description="Filter by Volve well: '15/9-F-1C' or '15/9-F-11B'"),
    limit: int = Query(100, ge=1, le=1460, description="Max records to return")
):
    """Returns rows of authentic daily production telemetry from Equinor's Volve Field open dataset."""
    try:
        data = dataset_service.get_volve_telemetry(well_id=well_id, limit=limit)
        return {
            "dataset": "Equinor Volve Public SCADA Telemetry",
            "license": "CC-BY 4.0",
            "records_returned": len(data),
            "telemetry": data
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/volve-telemetry/ingest/{target_well_id}", summary="Ingest Volve field telemetry into digital twin well")
def ingest_volve_telemetry(
    target_well_id: str,
    days: int = Query(90, ge=7, le=730, description="Number of daily records to ingest"),
    db: Session = Depends(get_db)
):
    """
    Ingests real SCADA observations from Equinor Volve Field into target well's telemetry store.
    Enables testing decline curve fitting and physics-data residual calibration against real offshore data.
    """
    try:
        result = dataset_service.ingest_volve_telemetry(db=db, target_well_id=target_well_id, days=days)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/petrobras-3w", summary="Fetch Petrobras 3W downhole transient sensor benchmark")
def get_petrobras_3w():
    """Returns high-frequency downhole sensor transients (Petrobras 3W) showing severe flow restriction."""
    try:
        return dataset_service.get_petrobras_3w_transients()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/baghewala-pvt", summary="Fetch DGH / Oil India Baghewala Core Lab PVT Data")
def get_baghewala_pvt():
    """Returns official laboratory PVT and water-in-oil emulsion measurements for Baghewala heavy crude."""
    try:
        return dataset_service.get_baghewala_lab_pvt()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/baghewala-pvt/verify", summary="Verify Andrade Viscosity Model against Baghewala Core Lab Points")
def verify_pvt_model():
    """Computes exact RMSE and relative error between model and Baghewala lab measurements."""
    try:
        return dataset_service.verify_pvt_model_vs_lab()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
