"""
Well Schemas and Data Transfer Objects.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .common import ProvenanceEnum, OperationalStatusEnum

class WellOperatingParameters(BaseModel):
    steam_volume_tonnes: float = 3000.0
    injection_pressure_bar: float = 125.0
    steam_temp_celsius: float = 260.0
    soak_duration_days: float = 6.0
    spm: float = 4.5
    stroke_length_inch: float = 100.0
    vfd_downstroke_ratio: float = 1.0
    economic_cutoff_oil_rate_bpd: float = 7.0

class WellTelemetryDTO(BaseModel):
    current_day_in_cycle: int = 45
    current_temperature_c: float = 85.0
    current_viscosity_cp: float = 280.0
    current_oil_rate_bpd: float = 42.5
    current_water_cut_pct: float = 65.0
    current_float_margin_index: float = 1.85
    current_goodman_stress_ratio: float = 0.62
    current_gearbox_load_pct: float = 68.0
    current_pump_intake_pressure_bar: float = 42.0
    latest_dynacard_label: str = "NORMAL"

class WellSummaryDTO(BaseModel):
    well_id: str
    well_name: str
    field_name: str = "Baghewala"
    formation: str = "Jodhpur Sandstone"
    crude_api: float = 18.0
    depth_m: float = 1050.0
    current_cycle_number: int = 1
    cycle_phase: str = "PRODUCTION" # "INJECTION", "SOAK", "PRODUCTION"
    status: OperationalStatusEnum = OperationalStatusEnum.FEASIBLE
    telemetry: WellTelemetryDTO
    operating_parameters: WellOperatingParameters
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED

class WellDetailDTO(WellSummaryDTO):
    casing_od_inch: float = 7.0
    tubing_od_inch: float = 3.5
    pump_depth_m: float = 1000.0
    rod_string_description: str = "API Grade D Taper 76 (1.00\", 0.875\", 0.750\")"
    surface_unit_description: str = "API C-456-256-100 Conventional Beam Unit"
    max_allowable_injection_pressure_bar: float = 145.0
    reservoir_permeability_md: float = 250.0
    reservoir_porosity: float = 0.28
    asphaltene_content_pct: float = 14.5
