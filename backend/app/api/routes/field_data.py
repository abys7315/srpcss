"""
Field data API (Phase 4): ingest observations, calibrate the thermal scalar, replay the twin as a stream.

POST   /telemetry/ingest            store daily observations for a well (source label required)
GET    /telemetry/{well_id}         list stored observations
DELETE /telemetry/{well_id}         delete observations (optionally one source)
POST   /calibrate/thermal           fit kappa on 70 % of the days, accept only if the last 30 % improve
GET    /calibrate/thermal/{well_id} active kappa and recent runs
DELETE /calibrate/thermal/{well_id} return the well to the default kappa
GET    /stream/{well_id}            Server-Sent Events: the twin's daily output, one event per simulated day
"""

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ...db.database import get_db, SessionLocal
from ...schemas.field_data import CalibrateRequest, IngestRequest
from ...services.field_data_service import FieldDataService

router = APIRouter(tags=["Field data"])


def _ok(data, message: str, provenance: str = "USER_SUPPLIED"):
    return {"success": True, "status": "COMPLETED", "message": message, "provenance": provenance, "data": data}


@router.post("/telemetry/ingest")
def ingest_observations(req: IngestRequest, db: Session = Depends(get_db)):
    data = FieldDataService(db).ingest(req)
    return _ok(data, f"Stored {data['inserted']} new and {data['updated']} updated observations.")


@router.get("/telemetry/{well_id}")
def list_observations(well_id: str, cycle_number: Optional[int] = None, db: Session = Depends(get_db)):
    rows = FieldDataService(db).list_observations(well_id, cycle_number)
    return _ok(rows, f"{len(rows)} observations.")


@router.delete("/telemetry/{well_id}")
def delete_observations(well_id: str, source_label: Optional[str] = None, db: Session = Depends(get_db)):
    n = FieldDataService(db).clear_observations(well_id, source_label)
    return _ok({"deleted": n}, f"Deleted {n} observations.")


@router.post("/calibrate/thermal")
def calibrate_thermal(req: CalibrateRequest, db: Session = Depends(get_db)):
    """Runs ~15 twin simulations; a plain def route runs on FastAPI's worker threadpool, so the server stays responsive."""
    data = FieldDataService(db).calibrate(req)
    return _ok(data, data["message"], provenance="SIMULATED")


@router.get("/calibrate/thermal/{well_id}")
def calibration_state(well_id: str, db: Session = Depends(get_db)):
    return _ok(FieldDataService(db).calibration_state(well_id), "Calibration state.", provenance="SIMULATED")


@router.delete("/calibrate/thermal/{well_id}")
def reset_calibration(well_id: str, db: Session = Depends(get_db)):
    FieldDataService(db).reset_calibration(well_id)
    return _ok({"well_id": well_id}, "Calibration reset to the default kappa.", provenance="SIMULATED")


def _sse(payload: dict, event: Optional[str] = None) -> str:
    head = f"event: {event}\n" if event else ""
    return f"{head}data: {json.dumps(payload)}\n\n"


@router.get("/stream/{well_id}")
async def stream_twin(well_id: str, speed: float = Query(10.0, ge=0.5, le=200.0, description="Simulated days per second"),
                      cycle_number: int = Query(1, ge=1)):
    """
    Replays the twin's daily output for the well's current setpoints as Server-Sent Events.
    Each event carries one production day and, where an observation was ingested for that day,
    the observed oil rate and the residual against the twin.
    """
    def build():
        db = SessionLocal()
        try:
            return FieldDataService(db).replay_series(well_id, cycle_number)
        finally:
            db.close()

    try:
        series = await run_in_threadpool(build)
    except Exception as exc:
        detail = getattr(exc, "detail", str(exc))

        async def failed():
            yield _sse({"error": str(detail)}, event="error")
        return StreamingResponse(failed(), media_type="text/event-stream")

    async def gen():
        yield _sse({"well_id": well_id, "days": len(series), "speed_days_per_s": speed}, event="start")
        for row in series:
            yield _sse(row)
            await asyncio.sleep(1.0 / speed)
        yield _sse({"well_id": well_id}, event="done")

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
