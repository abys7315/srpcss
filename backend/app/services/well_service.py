"""
Well Service — Database, Well State Management, Approvals & Audit Trail.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json

from ..db.models import WellModel, ApprovalLogModel, WellAuditLogModel
from ..schemas.well import (
    WellSummaryDTO,
    WellDetailDTO,
    WellTelemetryDTO,
    WellOperatingParameters,
    RecommendationApprovalRequest,
    RecommendationApprovalResponse,
    SetpointUpdateRequest,
    SetpointUpdateResponse,
    AuditRecordDTO
)
from ..schemas.common import ProvenanceEnum, OperationalStatusEnum
from core.config import canonical_config

class WellService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_wells(self) -> List[WellSummaryDTO]:
        wells = self.db.query(WellModel).all()
        return [self._map_summary(w) for w in wells]

    def get_well_by_id(self, well_id: str) -> Optional[WellDetailDTO]:
        w = self.db.query(WellModel).filter(WellModel.well_id == well_id).first()
        if not w:
            return None
        return self._map_detail(w)

    def update_telemetry(self, well_id: str, oil_rate: float, temp_c: float, float_margin: float, label: str):
        w = self.db.query(WellModel).filter(WellModel.well_id == well_id).first()
        if w:
            w.latest_oil_rate_bpd = oil_rate
            w.latest_temperature_c = temp_c
            w.latest_float_margin = float_margin
            w.latest_dynacard_label = label
            if float_margin < 1.0:
                w.status = "INFEASIBLE"
            elif float_margin < 1.25:
                w.status = "NEAR_LIMIT"
            else:
                w.status = "FEASIBLE"
            self.db.commit()

    def approve_recommendation(self, rec_id: str, req: RecommendationApprovalRequest) -> RecommendationApprovalResponse:
        """Persists engineer approval of an optimal recommendation."""
        well = self.db.query(WellModel).filter(WellModel.well_id == req.well_id).first()
        prev_setpoint = {
            "steam_volume_tonnes": well.steam_volume_tonnes if well else 3000.0,
            "spm": well.spm if well else 4.5,
            "vfd_downstroke_ratio": well.vfd_downstroke_ratio if well else 1.0,
            "soak_duration_days": well.soak_duration_days if well else 6.0
        }
        
        effective_setpoint = req.approved_setpoint if req.approved_setpoint is not None else req.setpoint
        app_log = ApprovalLogModel(
            recommendation_id=rec_id,
            well_id=req.well_id,
            approved_by=req.approved_by,
            decision=req.decision,
            decision_reason=req.decision_reason,
            approved_setpoint=json.dumps(effective_setpoint),
            previous_setpoint=json.dumps(prev_setpoint)
        )
        self.db.add(app_log)

        # Also add audit log
        audit = WellAuditLogModel(
            well_id=req.well_id,
            event_type="RECOMMENDATION_APPROVED" if req.decision == "APPROVED" else "OPERATOR_APPROVAL",
            actor=req.approved_by,
            description=f"Recommendation {rec_id} approved: {req.decision_reason}",
            details=json.dumps({"approved_setpoint": effective_setpoint, "previous_setpoint": prev_setpoint})
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(audit)

        return RecommendationApprovalResponse(
            recommendation_id=rec_id,
            well_id=req.well_id,
            decision=req.decision,
            approved_by=req.approved_by,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message=f"Recommendation {rec_id} successfully {req.decision.lower()} by {req.approved_by}.",
            audit_id=audit.id
        )


    def reject_recommendation(self, rec_id: str, req: RecommendationApprovalRequest) -> RecommendationApprovalResponse:
        """Persists engineer rejection of an optimization recommendation."""
        well = self.db.query(WellModel).filter(WellModel.well_id == req.well_id).first()
        prev_setpoint = {
            "steam_volume_tonnes": well.steam_volume_tonnes if well else 3000.0,
            "spm": well.spm if well else 4.5,
            "vfd_downstroke_ratio": well.vfd_downstroke_ratio if well else 1.0
        }
        
        app_log = ApprovalLogModel(
            recommendation_id=rec_id,
            well_id=req.well_id,
            approved_by=req.approved_by,
            decision="REJECTED",
            decision_reason=req.decision_reason,
            approved_setpoint=json.dumps({}),
            previous_setpoint=json.dumps(prev_setpoint)
        )
        self.db.add(app_log)

        audit = WellAuditLogModel(
            well_id=req.well_id,
            event_type="OPERATOR_REJECTION",
            actor=req.approved_by,
            description=f"Recommendation {rec_id} rejected: {req.decision_reason}",
            details=json.dumps({"reason": req.decision_reason})
        )
        self.db.add(audit)
        self.db.commit()

        return RecommendationApprovalResponse(
            recommendation_id=rec_id,
            well_id=req.well_id,
            decision="REJECTED",
            approved_by=req.approved_by,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message=f"Recommendation {rec_id} rejected: {req.decision_reason}."
        )

    def update_setpoint(self, well_id: str, req: SetpointUpdateRequest) -> SetpointUpdateResponse:
        """Applies approved setpoint to the digital twin and wellbore state."""
        w = self.db.query(WellModel).filter(WellModel.well_id == well_id).first()
        if not w:
            raise ValueError(f"Well '{well_id}' not found.")

        prev_sp = {
            "steam_volume_tonnes": w.steam_volume_tonnes,
            "soak_duration_days": w.soak_duration_days,
            "spm": w.spm,
            "stroke_length_inch": w.stroke_length_inch,
            "vfd_downstroke_ratio": w.vfd_downstroke_ratio,
            "economic_cutoff_oil_rate_bpd": w.economic_cutoff_oil_rate_bpd
        }

        # Apply new setpoint
        sp = dict(req.setpoint) if req.setpoint else {}
        if req.spm is not None:
            sp["spm"] = req.spm
        if req.stroke_length_inch is not None:
            sp["stroke_length_inch"] = req.stroke_length_inch
        if req.vfd_downstroke_ratio is not None:
            sp["vfd_downstroke_ratio"] = req.vfd_downstroke_ratio
        if req.steam_volume_tonnes is not None:
            sp["steam_volume_tonnes"] = req.steam_volume_tonnes
        if req.soak_duration_days is not None:
            sp["soak_duration_days"] = req.soak_duration_days
        actor_name = req.applied_by or req.actor

        if "steam_volume_tonnes" in sp:
            w.steam_volume_tonnes = float(sp["steam_volume_tonnes"])
        if "soak_duration_days" in sp or "soak_days" in sp:
            w.soak_duration_days = float(sp.get("soak_duration_days", sp.get("soak_days")))
        if "spm" in sp:
            w.spm = float(sp["spm"])
        if "stroke_length_inch" in sp:
            w.stroke_length_inch = float(sp["stroke_length_inch"])
        if "vfd_downstroke_ratio" in sp:
            w.vfd_downstroke_ratio = float(sp["vfd_downstroke_ratio"])
        if "economic_cutoff_oil_rate_bpd" in sp or "economic_cutoff_bpd" in sp:
            w.economic_cutoff_oil_rate_bpd = float(sp.get("economic_cutoff_oil_rate_bpd", sp.get("economic_cutoff_bpd")))

        # When setpoint is applied, state clears into FEASIBLE operating mode
        w.status = "FEASIBLE"
        
        # Add to audit log
        audit = WellAuditLogModel(
            well_id=well_id,
            event_type="SETPOINT_UPDATE",
            actor=actor_name,
            description=req.reason,
            details=json.dumps({"previous_setpoint": prev_sp, "new_setpoint": sp})
        )
        self.db.add(audit)
        self.db.commit()

        return SetpointUpdateResponse(
            well_id=well_id,
            applied_setpoint=sp,
            previous_setpoint=prev_sp,
            applied_status="APPLIED_SUCCESS",
            status="APPLIED",
            message=f"Setpoint successfully applied to {well_id}. Digital Twin updated."
        )


    def get_audit_trail(self, well_id: str) -> List[AuditRecordDTO]:
        """Returns chronological audit trail for a well."""
        records = (
            self.db.query(WellAuditLogModel)
            .filter(WellAuditLogModel.well_id == well_id)
            .order_by(WellAuditLogModel.created_at.desc())
            .all()
        )
        out = []
        for r in records:
            details_dict = None
            if r.details:
                try:
                    details_dict = json.loads(r.details)
                except Exception:
                    details_dict = {"raw": r.details}
            out.append(AuditRecordDTO(
                id=r.id,
                well_id=r.well_id,
                event_type=r.event_type,
                actor=r.actor,
                description=r.description,
                details=details_dict,
                created_at=r.created_at.isoformat() + "Z"
            ))
        return out

    def _map_summary(self, w: WellModel) -> WellSummaryDTO:
        return WellSummaryDTO(
            well_id=w.well_id,
            well_name=w.well_name,
            field_name=w.field_name,
            formation=w.formation,
            crude_api=w.crude_api,
            depth_m=w.depth_m,
            current_cycle_number=w.current_cycle_number,
            cycle_phase=w.cycle_phase,
            status=OperationalStatusEnum(w.status) if w.status in OperationalStatusEnum._value2member_map_ else OperationalStatusEnum.FEASIBLE,
            telemetry=WellTelemetryDTO(
                current_day_in_cycle=45,
                current_temperature_c=w.latest_temperature_c,
                current_viscosity_cp=w.latest_viscosity_cp,
                current_oil_rate_bpd=w.latest_oil_rate_bpd,
                current_water_cut_pct=w.latest_water_cut_pct,
                current_float_margin_index=w.latest_float_margin,
                current_goodman_stress_ratio=w.latest_goodman_stress,
                current_gearbox_load_pct=68.0,
                current_pump_intake_pressure_bar=42.0,
                latest_dynacard_label=w.latest_dynacard_label
            ),
            operating_parameters=WellOperatingParameters(
                steam_volume_tonnes=w.steam_volume_tonnes,
                injection_pressure_bar=w.injection_pressure_bar,
                steam_temp_celsius=w.steam_temp_celsius,
                soak_duration_days=w.soak_duration_days,
                spm=w.spm,
                stroke_length_inch=w.stroke_length_inch,
                vfd_downstroke_ratio=w.vfd_downstroke_ratio,
                economic_cutoff_oil_rate_bpd=w.economic_cutoff_oil_rate_bpd
            ),
            provenance=ProvenanceEnum.SIMULATED
        )

    def _map_detail(self, w: WellModel) -> WellDetailDTO:
        summary = self._map_summary(w)
        return WellDetailDTO(
            **summary.model_dump(),
            casing_od_inch=w.casing_od_inch,
            tubing_od_inch=w.tubing_od_inch,
            pump_depth_m=w.pump_depth_m,
            rod_string_description=w.rod_string_description,
            surface_unit_description=w.surface_unit_description,
            max_allowable_injection_pressure_bar=canonical_config.safety_limits.max_allowable_injection_pressure_bar,
            reservoir_permeability_md=250.0,
            reservoir_porosity=0.28,
            asphaltene_content_pct=14.5
        )
