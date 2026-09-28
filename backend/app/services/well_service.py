"""
Well Service — Database & Well State Management.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from ..db.models import WellModel
from ..schemas.well import WellSummaryDTO, WellDetailDTO, WellTelemetryDTO, WellOperatingParameters
from ..schemas.common import ProvenanceEnum, OperationalStatusEnum

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
            max_allowable_injection_pressure_bar=145.0,
            reservoir_permeability_md=250.0,
            reservoir_porosity=0.28,
            asphaltene_content_pct=14.5
        )
