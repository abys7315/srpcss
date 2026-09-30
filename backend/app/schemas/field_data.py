"""
Field-data ingest and calibration schemas (Phase 4).
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ObservationDTO(BaseModel):
    day: int = Field(ge=1, le=730, description="Production day, 1-indexed from the start of production.")
    oil_rate_bpd: float = Field(ge=0.0, le=5000.0)
    water_cut_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    temperature_c: Optional[float] = Field(default=None, ge=10.0, le=400.0)
    pump_intake_pressure_bar: Optional[float] = Field(default=None, ge=0.0, le=500.0)


class IngestRequest(BaseModel):
    well_id: str
    cycle_number: int = Field(default=1, ge=1)
    source_label: str = Field(min_length=3, max_length=64,
                              description="Where these numbers come from, e.g. 'gauge export 2026-09' or 'synthetic test'.")
    observations: List[ObservationDTO] = Field(min_length=1, max_length=2000)
    replace_existing: bool = Field(default=False, description="Delete earlier rows with the same source label first.")


class IngestResponse(BaseModel):
    well_id: str
    cycle_number: int
    source_label: str
    received: int
    inserted: int
    updated: int
    total_for_well: int
    note: str = "Stored as user-supplied data. The platform does not verify that it is field-measured."


class CalibrateRequest(BaseModel):
    well_id: str
    cycle_number: int = Field(default=1, ge=1)
    source_label: Optional[str] = Field(default=None, description="Restrict to one source; default uses all rows for the well and cycle.")
    apply_if_accepted: bool = True
    cycle_config: Optional[Dict[str, Any]] = Field(default=None, description="Overrides for the simulated cycle (steam volume, SPM, ...).")
