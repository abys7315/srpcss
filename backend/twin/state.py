"""
Digital Twin State Object — Petro-Twin (SIH 2026, PS26120).

Provides centralized, strongly typed state management across the well-to-surface digital twin chain:
Reservoir State -> Thermal Evolution -> Wellbore Hydraulics -> SRP Mechanics -> Surface Energy -> Failure Risk.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List

@dataclass
class DigitalTwinState:
    """Represents the complete instantaneous physical and mechanical state of a heavy oil well."""
    well_id: str
    cycle_number: int
    day: int
    phase: str                           # "INJECTION", "SOAK", "PRODUCTION"

    # Thermal & Reservoir State
    reservoir_pressure_bar: float
    reservoir_temperature_c: float
    heated_zone_radius_m: float
    cumulative_heat_retained_gj: float

    # Wellbore & Intake State
    wellbore_temperature_c: float        # Average fluid temperature along casing/tubing
    wellhead_temperature_c: float        # Surface fluid discharge temperature
    pump_intake_pressure_bar: float
    pump_intake_temperature_c: float
    flowing_bottomhole_pressure_bar: float

    # Production & Fluids
    oil_rate_bpd: float
    water_rate_bpd: float
    liquid_rate_bpd: float
    water_cut_pct: float
    cumulative_oil_bbl: float
    cumulative_water_bbl: float
    cumulative_steam_tonnes: float
    oil_viscosity_cp: float
    mixture_density_kg_m3: float

    # SRP Lift Dynamics
    spm: float
    stroke_length_inch: float
    vfd_downstroke_ratio: float
    pump_fillage_pct: float
    peak_polished_rod_load_lbs: float
    min_polished_rod_load_lbs: float
    peak_gearbox_torque_in_lbs: float
    goodman_stress_ratio: float
    float_margin_index: float
    is_rod_floating: bool
    diagnostic_card_label: str

    # Surface Energy & Economics
    daily_electricity_kwh: float
    cumulative_electricity_kwh: float
    steam_oil_ratio: float               # Mass basis: steam tonnes / oil tonnes

    # Risk & Precursors
    asphaltene_risk_score: float
    failure_risk_probability: float
    fluid_pound_severity: float
    wellhead_pressure_bar: float = 5.0   # Surface line backpressure (PROVENANCE: ASSUMED / SCENARIO INPUT)
    wellhead_pressure_provenance: str = "ASSUMED / SCENARIO INPUT"
    provenance: str = "SIMULATED"

    def to_dict(self) -> Dict[str, Any]:
        """Serializes digital twin state to dictionary."""
        return {k: round(v, 3) if isinstance(v, float) else v for k, v in self.__dict__.items()}
