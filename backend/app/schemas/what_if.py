"""
What-If Scenario Request and Response Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .common import ProvenanceEnum, OperationalStatusEnum
from .optimization import ParetoSolutionDTO

class ScenarioConfigDTO(BaseModel):
    label: str
    description: str
    steam_volume_tonnes: float
    soak_days: float
    spm: float
    stroke_length_inch: float = 100.0
    vfd_downstroke_ratio: float = 1.0
    economic_cutoff_bpd: float = 7.0

class WhatIfRequest(BaseModel):
    well_id: str = "BGW-01"
    current_configuration: Optional[Dict[str, Any]] = None
    scenario_a: Optional[ScenarioConfigDTO] = None
    scenario_b: Optional[ScenarioConfigDTO] = None
    scenario_c: Optional[ScenarioConfigDTO] = None
    cooling_anomaly_day: Optional[int] = None
    cooling_anomaly_severity_pct: float = 0.0

class ScenarioEvaluationDTO(BaseModel):
    scenario_id: str # "CURRENT", "SCENARIO_A", "SCENARIO_B", "SCENARIO_C", "RECOMMENDED"
    label: str
    description: str
    steam_volume_tonnes: float
    soak_days: float
    spm: float
    stroke_length_inch: float
    vfd_downstroke_ratio: float
    cumulative_oil_bbl: float
    net_benefit_usd: float
    steam_oil_ratio: float
    energy_intensity_kwh_per_bbl: float
    failure_risk_probability: float
    min_float_margin_index: float
    status: OperationalStatusEnum
    violations: List[str] = Field(default_factory=list)
    near_limit_warnings: List[str] = Field(default_factory=list)
    is_recommended: bool = False

class WhatIfResponse(BaseModel):
    well_id: str
    scenarios: List[ScenarioEvaluationDTO]
    recommended_scenario_id: str
    summary_insight: str
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
