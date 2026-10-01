"""
Simulation Request and Response Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from .common import ProvenanceEnum, OperationalStatusEnum

class SimulationRequest(BaseModel):
    well_id: str = "BGW-01"
    cycle_number: int = Field(default=1, ge=1, le=10)
    steam_volume_tonnes: float = Field(default=3000.0, ge=100.0, le=15000.0)
    injection_duration_days: float = Field(default=15.0, ge=1.0, le=60.0)
    injection_pressure_bar: float = Field(default=125.0, ge=10.0, le=250.0, description="Bottomhole; sets Tsat via IAPWS-IF97")
    steam_temp_celsius: Optional[float] = Field(default=None, description="Ignored: steam temperature is Tsat(injection_pressure_bar)")
    soak_duration_days: float = Field(default=6.0, ge=0.0, le=60.0)
    production_duration_days: float = Field(default=90.0, ge=5.0, le=730.0)
    economic_cutoff_oil_rate_bpd: float = Field(default=7.0, ge=0.0, le=50.0)
    spm: float = Field(default=4.5, ge=0.5, le=15.0)
    stroke_length_inch: float = Field(default=100.0, ge=30.0, le=240.0)
    vfd_downstroke_ratio: float = Field(default=1.0, ge=0.2, le=3.0)
    srp_policy: Literal["fixed", "adaptive"] = "fixed"
    srp_m_target: float = Field(default=1.15, ge=1.0, le=2.0)
    srp_min_fillage: float = Field(default=0.85, ge=0.5, le=0.98)
    cooling_anomaly_day: Optional[int] = Field(default=None, description="Day of seeded heat-loss anomaly (scenario input)")
    cooling_anomaly_severity_pct: float = Field(default=0.0, ge=0.0, le=100.0)

class AdaptiveStepRequest(BaseModel):
    well_id: str = "BGW-01"
    prev_spm: float = Field(default=4.5, ge=0.5, le=15.0)
    stroke_length_inch: float = Field(default=100.0, ge=30.0, le=240.0)
    vfd_downstroke_ratio: float = Field(default=0.85, ge=0.2, le=3.0)
    temperature_c: float = Field(default=75.0, ge=20.0, le=350.0)
    viscosity_cp: float = Field(default=850.0, ge=1.0, le=50000.0)
    pump_intake_pressure_bar: float = Field(default=35.0, ge=1.0, le=200.0)
    potential_liquid_m3_d: float = Field(default=18.0, ge=0.1, le=500.0)
    m_target: float = Field(default=1.15, ge=1.0, le=2.5)
    min_fillage: float = Field(default=0.85, ge=0.5, le=0.98)

class AdaptiveStepResponse(BaseModel):
    recommended_spm: float
    binding_constraint: str
    float_bound_spm: float
    fillage_bound_spm: float
    inflow_spm: float
    max_spm_allowed: float
    vfd_downstroke_ratio: float
    predicted_float_margin: float
    is_rod_floating_prevented: bool
    action_summary: str
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED

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
    reservoir_pressure_bar: float = 0.0
    spm: float = 0.0
    vfd_downstroke_ratio: float = 1.0
    is_rod_floating: bool = False
    recovery_factor_pct: float = 0.0
    heated_zone_oil_saturation: float = 0.0
    srp_binding_limit: str = "fixed"
    cycle_day: float = 0.0            # days since start of injection

class PhaseBandDTO(BaseModel):
    phase: str
    start_day: float
    end_day: float

class ThermalSummaryDTO(BaseModel):
    steam_saturation_temp_c: float
    steam_latent_heat_kj_kg: float
    delivered_steam_quality: float
    heat_injected_gj: float
    heated_zone_radius_m: float
    injection_end_temp_c: float
    soak_end_temp_c: float
    ooip_m3: float
    recovery_factor_pct: float
    heated_pore_volume_m3: float
    final_heated_zone_oil_saturation: float
    fracture_limit_bar: float

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
    recovery_factor_pct: float = 0.0
    float_days: int = 0

class ConstraintStatusDTO(BaseModel):
    status: OperationalStatusEnum
    is_feasible: bool
    violations: List[Dict[str, Any]]
    near_limit_warnings: List[str]
    binding_constraints: List[str]
    suggested_engineer_action: str
    margins: List[Dict[str, Any]] = Field(default_factory=list)

class SimulationResponse(BaseModel):
    well_id: str
    cycle_number: int
    status: OperationalStatusEnum
    kpis: CycleKPIsDTO
    constraints: ConstraintStatusDTO
    dynacards: Dict[str, DynacardDTO] # "day_10", "day_60", "final"
    timeseries: List[DailyTimeseriesDTO]
    phase_bands: List[PhaseBandDTO] = Field(default_factory=list)
    thermal: Optional[ThermalSummaryDTO] = None
    wellbore_profile: List[Dict[str, float]] = Field(default_factory=list)  # depth-resolved T, mu, p (final day)
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
