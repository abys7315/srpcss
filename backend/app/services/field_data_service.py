"""
Field-data service (Phase 4): observation ingest, thermal calibration, twin replay.

Ingested rows are stored exactly as supplied, with the caller's source label. Calibration fits the
single thermal scalar kappa on the first 70 % of the observed days and accepts it only if it beats
the default on the last 30 % (twin/calibration.py). Accepted values are persisted in
twin/calibration_store.py and picked up by every subsequent simulation of that well.
"""

from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from twin import calibration_store
from twin.calibration import calibrate_thermal_kappa, default_kappa
from twin.cycle import CSSCycleSimulator, CycleConfig
from ..db.models import CalibrationRunModel, TelemetryObservationModel, WellModel
from ..schemas.field_data import CalibrateRequest, IngestRequest


class FieldDataService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------ helpers
    def _well(self, well_id: str) -> WellModel:
        well = self.db.query(WellModel).filter(WellModel.well_id == well_id).first()
        if well is None:
            raise HTTPException(status_code=404, detail=f"Unknown well '{well_id}'.")
        return well

    @staticmethod
    def _cycle_kwargs(well: WellModel, cycle_number: int) -> Dict[str, Any]:
        return {
            "well_id": well.well_id, "cycle_number": cycle_number,
            "steam_volume_tonnes": well.steam_volume_tonnes, "injection_pressure_bar": well.injection_pressure_bar,
            "soak_duration_days": well.soak_duration_days, "spm": well.spm,
            "stroke_length_inch": well.stroke_length_inch, "vfd_downstroke_ratio": well.vfd_downstroke_ratio,
        }

    # ------------------------------------------------------------------ ingest
    def ingest(self, req: IngestRequest) -> Dict[str, Any]:
        self._well(req.well_id)
        base = self.db.query(TelemetryObservationModel).filter(
            TelemetryObservationModel.well_id == req.well_id,
            TelemetryObservationModel.cycle_number == req.cycle_number,
            TelemetryObservationModel.source_label == req.source_label)
        if req.replace_existing:
            base.delete(synchronize_session=False)
            self.db.commit()
        existing = {r.day: r for r in base.all()}

        by_day = {o.day: o for o in req.observations}          # last row wins within one request
        inserted = updated = 0
        for day, o in by_day.items():
            row = existing.get(day)
            if row is None:
                self.db.add(TelemetryObservationModel(
                    well_id=req.well_id, cycle_number=req.cycle_number, day=day, oil_rate_bpd=o.oil_rate_bpd,
                    water_cut_pct=o.water_cut_pct, temperature_c=o.temperature_c,
                    pump_intake_pressure_bar=o.pump_intake_pressure_bar, source_label=req.source_label))
                inserted += 1
            else:
                row.oil_rate_bpd, row.water_cut_pct = o.oil_rate_bpd, o.water_cut_pct
                row.temperature_c, row.pump_intake_pressure_bar = o.temperature_c, o.pump_intake_pressure_bar
                updated += 1
        self.db.commit()
        total = self.db.query(TelemetryObservationModel).filter(TelemetryObservationModel.well_id == req.well_id).count()
        return {"well_id": req.well_id, "cycle_number": req.cycle_number, "source_label": req.source_label,
                "received": len(req.observations), "inserted": inserted, "updated": updated, "total_for_well": total,
                "note": "Stored as user-supplied data. The platform does not verify that it is field-measured."}

    def list_observations(self, well_id: str, cycle_number: Optional[int] = None) -> List[Dict[str, Any]]:
        q = self.db.query(TelemetryObservationModel).filter(TelemetryObservationModel.well_id == well_id)
        if cycle_number is not None:
            q = q.filter(TelemetryObservationModel.cycle_number == cycle_number)
        rows = q.order_by(TelemetryObservationModel.cycle_number, TelemetryObservationModel.day).all()
        return [{"cycle_number": r.cycle_number, "day": r.day, "oil_rate_bpd": r.oil_rate_bpd,
                 "water_cut_pct": r.water_cut_pct, "temperature_c": r.temperature_c,
                 "pump_intake_pressure_bar": r.pump_intake_pressure_bar, "source_label": r.source_label,
                 "ingested_at": r.ingested_at.isoformat() if r.ingested_at else None} for r in rows]

    def clear_observations(self, well_id: str, source_label: Optional[str] = None) -> int:
        q = self.db.query(TelemetryObservationModel).filter(TelemetryObservationModel.well_id == well_id)
        if source_label:
            q = q.filter(TelemetryObservationModel.source_label == source_label)
        n = q.delete(synchronize_session=False)
        self.db.commit()
        return n

    # ------------------------------------------------------------------ calibration
    def calibrate(self, req: CalibrateRequest) -> Dict[str, Any]:
        well = self._well(req.well_id)
        q = self.db.query(TelemetryObservationModel).filter(
            TelemetryObservationModel.well_id == req.well_id, TelemetryObservationModel.cycle_number == req.cycle_number)
        if req.source_label:
            q = q.filter(TelemetryObservationModel.source_label == req.source_label)
        rows = q.all()

        per_day: Dict[int, List[float]] = defaultdict(list)
        for r in rows:
            per_day[r.day].append(r.oil_rate_bpd)
        days = sorted(per_day)
        rates = [sum(per_day[d]) / len(per_day[d]) for d in days]

        kwargs = self._cycle_kwargs(well, req.cycle_number)
        kwargs.update(req.cycle_config or {})
        result = calibrate_thermal_kappa(req.well_id, days, rates, kwargs)

        applied = False
        if result.accepted and req.apply_if_accepted:
            calibration_store.set_calibration(req.well_id, result.kappa_fitted, {
                "n_observations": result.n_observations,
                "holdout_improvement_pct": result.holdout_improvement_pct,
                "source_label": req.source_label or "all sources",
            })
            applied = True

        self.db.add(CalibrationRunModel(
            well_id=req.well_id, kappa_default=result.kappa_default, kappa_fitted=result.kappa_fitted,
            status=result.status, applied=applied, n_observations=result.n_observations,
            holdout_rmse_default=result.holdout_rmse_default_bpd, holdout_rmse_fitted=result.holdout_rmse_fitted_bpd,
            holdout_improvement_pct=result.holdout_improvement_pct, message=result.message))
        self.db.commit()

        out = result.to_dict()
        out["applied"] = applied
        return out

    def calibration_state(self, well_id: str) -> Dict[str, Any]:
        self._well(well_id)
        runs = (self.db.query(CalibrationRunModel).filter(CalibrationRunModel.well_id == well_id)
                .order_by(CalibrationRunModel.id.desc()).limit(5).all())
        return {
            "well_id": well_id, "default_kappa": default_kappa(), "active_kappa": calibration_store.get_kappa(well_id),
            "runs": [{"id": r.id, "status": r.status, "applied": r.applied, "kappa_fitted": r.kappa_fitted,
                      "holdout_improvement_pct": r.holdout_improvement_pct, "n_observations": r.n_observations,
                      "created_at": r.created_at.isoformat() if r.created_at else None, "message": r.message} for r in runs],
        }

    def reset_calibration(self, well_id: str) -> None:
        self._well(well_id)
        calibration_store.clear_calibration(well_id)

    # ------------------------------------------------------------------ replay
    def replay_series(self, well_id: str, cycle_number: int = 1, srp_policy: str = "fixed",
                      srp_m_target: float = 1.15, srp_min_fillage: float = 0.85) -> List[Dict[str, Any]]:
        """Daily twin output for the well's current setpoints, joined with any ingested observation."""
        well = self._well(well_id)
        cal_kappa = calibration_store.get_kappa(well_id)
        sim = CSSCycleSimulator(CycleConfig(
            well_id=well_id, cycle_number=cycle_number, steam_volume_tonnes=well.steam_volume_tonnes,
            injection_pressure_bar=well.injection_pressure_bar, soak_duration_days=well.soak_duration_days,
            spm=well.spm, stroke_length_inch=well.stroke_length_inch, vfd_downstroke_ratio=well.vfd_downstroke_ratio,
            economic_cutoff_oil_rate_bpd=well.economic_cutoff_oil_rate_bpd,
            srp_policy=srp_policy, srp_m_target=srp_m_target, srp_min_fillage=srp_min_fillage,
            thermal_loss_calibration=cal_kappa)).run_simulation()
        obs: Dict[int, List[float]] = defaultdict(list)
        for r in self.db.query(TelemetryObservationModel).filter(
                TelemetryObservationModel.well_id == well_id, TelemetryObservationModel.cycle_number == cycle_number).all():
            obs[r.day].append(r.oil_rate_bpd)
        out = []
        for pt in sim.daily_history:
            o = obs.get(pt.day)
            observed = sum(o) / len(o) if o else None
            out.append({
                "day": pt.day, "phase": pt.cycle_phase, "oil_rate_bpd": round(pt.oil_rate_bpd, 2),
                "water_rate_bpd": round(pt.water_rate_bpd, 2), "temperature_c": round(pt.temperature_c, 2),
                "viscosity_cp": round(pt.viscosity_cp, 1), "float_margin_index": round(pt.float_margin_index, 3),
                "is_rod_floating": pt.is_rod_floating,
                "goodman_stress_ratio": round(pt.goodman_stress_ratio, 3), "pump_fillage_pct": round(pt.pump_fillage_pct, 1),
                "spm": round(pt.spm, 3), "vfd_downstroke_ratio": round(pt.vfd_downstroke_ratio, 2),
                "daily_electricity_kwh": round(pt.daily_electricity_kwh, 2),
                "srp_binding_limit": getattr(pt, "srp_binding_limit", "fixed"),
                "observed_oil_rate_bpd": observed,
                "residual_bpd": None if observed is None else round(observed - pt.oil_rate_bpd, 2),
            })
        return out
