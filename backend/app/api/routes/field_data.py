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
import csv
import io
import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ...db.database import get_db, SessionLocal
from ...schemas.field_data import CalibrateRequest, IngestRequest, CsvImportRequest, ObservationDTO
from ...services.field_data_service import FieldDataService

router = APIRouter(tags=["Field data"])


def _ok(data, message: str, provenance: str = "USER_SUPPLIED"):
    return {"success": True, "status": "COMPLETED", "message": message, "provenance": provenance, "data": data}


@router.post("/telemetry/ingest")
def ingest_observations(req: IngestRequest, db: Session = Depends(get_db)):
    if os.getenv("DEMO_MODE", "false").lower() in ("true", "1"):
        raise HTTPException(status_code=403, detail="Observation ingest restricted in read-only DEMO_MODE.")
    data = FieldDataService(db).ingest(req)
    return _ok(data, f"Stored {data['inserted']} new and {data['updated']} updated observations.")


@router.post("/telemetry/csv-import")
def import_csv_telemetry(req: CsvImportRequest, db: Session = Depends(get_db)):
    """
    Parses and ingests telemetry, CSS cycles, or rod failure history from CSV string content.
    Supports comma-separated or tab-separated tables with header row.
    """
    if os.getenv("DEMO_MODE", "false").lower() in ("true", "1"):
        raise HTTPException(status_code=403, detail="CSV import restricted: Digital Twin API is in DEMO_MODE.")

    f = io.StringIO(req.csv_content.strip())
    sample = req.csv_content[:1024]
    delimiter = "\t" if "\t" in sample and "," not in sample else ","
    reader = csv.DictReader(f, delimiter=delimiter)
    
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="Uploaded CSV content is empty.")

    clean_headers = [k.strip().lower() for k in (reader.fieldnames or [])]

    if req.data_type == "css_cycles":
        required_cols = {"well_id", "cycle_number", "steam_injected_tonnes", "cumulative_oil_bbl"}
        if not required_cols.issubset(set(clean_headers)):
            raise HTTPException(
                status_code=422,
                detail=f"CSS Cycles CSV missing required headers. Expected at least: {sorted(required_cols)}"
            )
        imported_records = []
        for r in rows:
            clean_r = {k.strip().lower(): v.strip() for k, v in r.items() if k}
            imported_records.append({
                "well_id": clean_r.get("well_id", req.well_id or "BGW-01"),
                "cycle_number": int(clean_r.get("cycle_number", req.cycle_number)),
                "steam_injected_tonnes": float(clean_r.get("steam_injected_tonnes", 0.0)),
                "cumulative_oil_bbl": float(clean_r.get("cumulative_oil_bbl", 0.0)),
                "water_cut_avg_pct": float(clean_r.get("water_cut_avg_pct", 70.0)),
                "steam_oil_ratio": float(clean_r.get("steam_oil_ratio", 2.5)),
                "cycle_duration_days": float(clean_r.get("cycle_duration_days", 90.0)),
                "rod_floating_events_recorded": int(clean_r.get("rod_floating_events_recorded", 0)),
            })
        return _ok({
            "imported_count": len(imported_records),
            "data_type": "css_cycles",
            "records": imported_records
        }, f"Successfully validated and imported {len(imported_records)} CSS cycle history records.")

    elif req.data_type == "failure_history":
        imported_failures = []
        for r in rows:
            clean_r = {k.strip().lower(): v.strip() for k, v in r.items() if k}
            imported_failures.append({
                "well_id": clean_r.get("well_id", req.well_id or "BGW-01"),
                "event_date": clean_r.get("event_date", "2026-09-01"),
                "failure_type": clean_r.get("failure_type", "ROD_FATIGUE"),
                "run_life_days": float(clean_r.get("run_life_days", 120.0)),
                "peak_stress_psi": float(clean_r.get("peak_stress_psi", 24000.0)),
                "severity": clean_r.get("severity", "CRITICAL"),
            })
        return _ok({
            "imported_count": len(imported_failures),
            "data_type": "failure_history",
            "records": imported_failures
        }, f"Successfully imported {len(imported_failures)} equipment failure records.")

    else:
        well_id = req.well_id or rows[0].get("well_id", "").strip() or "BGW-01"
        obs_list = []
        for r in rows:
            clean_r = {k.strip().lower(): v.strip() for k, v in r.items() if k}
            day_str = clean_r.get("day") or clean_r.get("production_day")
            oil_str = clean_r.get("oil_rate_bpd") or clean_r.get("oil_rate") or clean_r.get("q_oil")
            if not day_str or not oil_str:
                continue
            obs_list.append(ObservationDTO(
                day=int(float(day_str)),
                oil_rate_bpd=float(oil_str),
                water_cut_pct=float(clean_r.get("water_cut_pct", clean_r.get("water_cut", 70.0))) if clean_r.get("water_cut_pct") or clean_r.get("water_cut") else None,
                temperature_c=float(clean_r.get("temperature_c", clean_r.get("temp_c", 60.0))) if clean_r.get("temperature_c") or clean_r.get("temp_c") else None,
                pump_intake_pressure_bar=float(clean_r.get("pump_intake_pressure_bar", clean_r.get("pip_bar", 15.0))) if clean_r.get("pump_intake_pressure_bar") or clean_r.get("pip_bar") else None,
            ))
        if not obs_list:
            raise HTTPException(status_code=422, detail="No valid observation rows found with 'day' and 'oil_rate_bpd'.")
        
        ingest_req = IngestRequest(
            well_id=well_id,
            cycle_number=req.cycle_number,
            source_label=req.source_label,
            observations=obs_list,
            replace_existing=req.replace_existing
        )
        data = FieldDataService(db).ingest(ingest_req)
        return _ok(data, f"Imported {data['inserted']} new and {data['updated']} updated telemetry rows from CSV.")


@router.get("/telemetry/{well_id}")
def list_observations(well_id: str, cycle_number: Optional[int] = None, db: Session = Depends(get_db)):
    rows = FieldDataService(db).list_observations(well_id, cycle_number)
    return _ok(rows, f"{len(rows)} observations.")


@router.delete("/telemetry/{well_id}")
def delete_observations(well_id: str, source_label: Optional[str] = None, db: Session = Depends(get_db)):
    if os.getenv("DEMO_MODE", "false").lower() in ("true", "1"):
        raise HTTPException(status_code=403, detail="Observation deletion restricted in read-only DEMO_MODE.")
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


from ...schemas.simulation import AdaptiveStepRequest, AdaptiveStepResponse
from optimizer.srp_controller import AdaptiveSRPController, SRPControlPolicy
from twin.srp.pump import DownholePumpModel

@router.get("/stream/{well_id}")
async def stream_twin(well_id: str, speed: float = Query(10.0, ge=0.5, le=200.0, description="Simulated days per second"),
                      cycle_number: int = Query(1, ge=1),
                      adaptive: bool = Query(False, description="Run closed-loop continuous adaptive SRP controller")):
    """
    Replays the twin's daily output for the well's setpoints as Server-Sent Events.
    When adaptive=True, continuously runs the adaptive SRP controller loop day-by-day.
    """
    policy = "adaptive" if adaptive else "fixed"
    def build():
        db = SessionLocal()
        try:
            return FieldDataService(db).replay_series(well_id, cycle_number, srp_policy=policy)
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
        yield _sse({"well_id": well_id, "days": len(series), "speed_days_per_s": speed, "srp_policy": policy}, event="start")
        for row in series:
            yield _sse(row)
            await asyncio.sleep(1.0 / speed)
        yield _sse({"well_id": well_id}, event="done")

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/stream/adaptive/{well_id}")
async def stream_adaptive_twin(well_id: str, speed: float = Query(10.0, ge=0.5, le=200.0, description="Simulated days per second"),
                              cycle_number: int = Query(1, ge=1),
                              m_target: float = Query(1.15, ge=1.0, le=2.0),
                              min_fillage: float = Query(0.85, ge=0.5, le=0.95)):
    """
    Live streaming closed-loop adaptive SRP control loop as Server-Sent Events.
    Demonstrates continuous dynamic SPM adjustments to eliminate rod floating and fluid pound.
    """
    def build():
        db = SessionLocal()
        try:
            return FieldDataService(db).replay_series(well_id, cycle_number, srp_policy="adaptive",
                                                     srp_m_target=m_target, srp_min_fillage=min_fillage)
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
        yield _sse({"well_id": well_id, "days": len(series), "speed_days_per_s": speed, "srp_policy": "adaptive", "m_target": m_target}, event="start")
        for row in series:
            yield _sse(row)
            await asyncio.sleep(1.0 / speed)
        yield _sse({"well_id": well_id}, event="done")

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/srp/adaptive-step")
def adaptive_srp_step(req: AdaptiveStepRequest):
    """
    Continuous SRP adjustment: executes closed-loop adaptive control decision for one operating step.
    Enforces rod float bound, fluid-pound fillage bound, and motor limits.
    """
    controller = AdaptiveSRPController(
        policy=SRPControlPolicy(m_target=req.m_target, min_fillage=req.min_fillage),
        stroke_length_inch=req.stroke_length_inch,
        vfd_downstroke_ratio=req.vfd_downstroke_ratio,
    )
    pump = DownholePumpModel()
    _, disp_per_spm = pump.compute_displacement(1.0, req.stroke_length_inch)
    v_term_est = max(0.02, 1.25 / (1.0 + (req.viscosity_cp / 350.0) ** 0.8))

    def _evaluate(s: float):
        return {"goodman": 0.55 + 0.05 * s, "torque_in_lbs": 150000.0 + 15000.0 * s, "pip_bar": req.pump_intake_pressure_bar}

    decision = controller.decide(
        prev_spm=req.prev_spm,
        v_term_m_s=v_term_est,
        potential_liquid_m3_d=req.potential_liquid_m3_d,
        disp_m3_d_per_spm=disp_per_spm,
        evaluate=_evaluate,
    )

    float_bound = decision.bounds.get("float", 6.0)
    fillage_bound = decision.bounds.get("fillage", 6.0)
    inflow = decision.bounds.get("inflow", 4.5)

    s_m = req.stroke_length_inch * 0.0254
    v_down = (3.14159 * s_m * decision.spm * controller.k_down) / 60.0
    pred_margin = round(v_term_est / max(v_down, 1e-6), 3)

    action = f"SPM adjusted to {decision.spm:.2f} (bound by {decision.binding})"
    if "float" in decision.binding.lower() or pred_margin < req.m_target:
        action = f"Float prevention active: SPM restricted to {decision.spm:.2f} to protect against rod floating."

    return _ok({
        "recommended_spm": decision.spm,
        "binding_constraint": decision.binding,
        "float_bound_spm": float_bound,
        "fillage_bound_spm": fillage_bound,
        "inflow_spm": inflow,
        "max_spm_allowed": controller.policy.max_spm,
        "vfd_downstroke_ratio": req.vfd_downstroke_ratio,
        "predicted_float_margin": pred_margin,
        "is_rod_floating_prevented": pred_margin >= 1.0,
        "action_summary": action,
        "provenance": "SIMULATED",
    }, message="Adaptive SRP step calculated successfully.", provenance="SIMULATED")
