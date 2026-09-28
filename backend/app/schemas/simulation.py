"""
Simulation Request and Response Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .common import ProvenanceEnum, OperationalStatusEnum

class SimulationRequest(BaseModel):
    well_id: str = "BGW-01"
    cycle_number: int = Field(default=1, ge=1, le=10)
    steam_volume_tonnes: float = Field(default=3000.0, ge=800.0, le=5500.0)
    injection_duration_days: float = Field(default=15.0, ge=5.0, le=30.0)
    injection_pressure_bar: float = Field(default=125.0, ge=80.0, le=160.0)
    steam_temp_celsius: float = Field(default=260.0, ge=200.0, le=320.0)
    soak_duration_days: float = Field(default=6.0, ge=3.0, le=21.0)
    production_duration_days: float = Field(default=250.0, ge=30.0, le=365.0)
    economic_cutoff_oil_rate_bpd: float = Field(default=7.0, ge=2.0, le=25.0)
    spm: float = Field(default=4.5, ge=1.2, le=7.0)
    stroke_length_inch: float = Field(default=100.0, ge=54.0, le=144.0)
    vfd_downstroke_ratio: float = Field(default=1.0, ge=0.4, le=1.5)
    cooling_anomaly_day: Optional[int] = Field(default=None, description="Day of sudden reservoir heat loss anomaly")
    cooling_anomaly_severity_pct: float = Field(default=0.0, ge=0.0, le=60.0)

class DailyTimeseriesDTO(BaseModel):
    day: int
    bottomhole_temperature_c: float
    oil_viscosity_cp: float
    oil_rate_bpd: float
    water_rate_bpd: float
    cumulative_oil_bbl: float
    float_margin_index: float
    goodman_stress_ratio: float
    peak_gearbox_torque_in_lbs: float
    pump_intake_pressure_bar: float
    pump_fillage_pct: float

class DynacardDTO(BaseModel):
    surface_position_inch: List[float]
    surface_load_lbs: List[float]
    downhole_position_inch: List[float]
    downhole_load_lbs: List[float]
    peak_polished_rod_load_lbs: float
    min_polished_rod_load_lbs: float
    load_range_lbs: float
    stroke_length_inch: float
    spm: float
    diagnostic_card_label: str
    card_area_in_lbs: float
    peak_gearbox_torque_in_lbs: float
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED

class CycleKPIsDTO(BaseModel):
    total_oil_produced_bbl: float
    total_water_produced_bbl: float
    total_steam_injected_tonnes: float
    steam_oil_ratio: float
    total_electricity_kwh: float
    electrical_energy_kwh_per_bbl: float
    net_economic_benefit_usd: float
    cycle_duration_days: int
    production_days: int
    total_float_events_count: int
    max_goodman_stress_ratio: float
    min_float_margin_index: float
    average_pump_fillage_pct: float

class ConstraintStatusDTO(BaseModel):
    status: OperationalStatusEnum
    is_feasible: bool
    violations: List[Dict[str, Any]]
    near_limit_warnings: List[str]
    binding_constraints: List[str]
    suggested_engineer_action: str

class SimulationResponse(BaseModel):
    well_id: str
    cycle_number: int
    status: OperationalStatusEnum
    kpis: CycleKPIsDTO
    constraints: ConstraintStatusDTO
    dynacards: Dict[str, DynacardDTO] # "day_10", "day_60", "final"
    timeseries: List[DailyTimeseriesDTO]
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
