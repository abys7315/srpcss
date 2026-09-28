"""
Optimization Request and Response Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .common import ProvenanceEnum, OperationalStatusEnum, RecommendationModeEnum

class OptimizationWeightsDTO(BaseModel):
    weight_net_benefit: float = Field(default=0.45, ge=0.0, le=1.0)
    weight_oil_recovery: float = Field(default=0.25, ge=0.0, le=1.0)
    weight_sor_minimization: float = Field(default=0.15, ge=0.0, le=1.0)
    weight_risk_minimization: float = Field(default=0.15, ge=0.0, le=1.0)

class JointOptimizationRequest(BaseModel):
    well_id: str = "BGW-01"
    current_configuration: Optional[Dict[str, Any]] = None
    cycle_number: int = 1
    weights: OptimizationWeightsDTO = Field(default_factory=OptimizationWeightsDTO)
    cooling_anomaly_day: Optional[int] = None
    cooling_anomaly_severity_pct: float = 0.0

class CSSOptimizationRequest(BaseModel):
    well_id: str = "BGW-01"
    current_configuration: Optional[Dict[str, Any]] = None
    fixed_spm: float = 4.5
    cycle_number: int = 1

class SRPOptimizationRequest(BaseModel):
    well_id: str = "BGW-01"
    current_configuration: Optional[Dict[str, Any]] = None
    fixed_steam_tonnes: float = 3000.0
    cooling_anomaly_day: Optional[int] = None
    cycle_number: int = 1

class ParetoSolutionDTO(BaseModel):
    solution_id: str
    steam_volume_tonnes: float
    soak_days: float
    spm: float
    stroke_length_inch: float
    vfd_downstroke_ratio: float
    economic_cutoff_bpd: float
    cumulative_oil_bbl: float
    net_benefit_usd: float
    steam_oil_ratio: float
    energy_intensity_kwh_per_bbl: float
    failure_risk_probability: float
    min_float_margin_index: float
    pareto_rank: int
    is_non_dominated: bool
    status: OperationalStatusEnum
    composite_score: float
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED

class RecommendationComparisonDTO(BaseModel):
    parameter: str
    current: str
    recommended: str
    unit: str
    delta: str

class OptimizationResponse(BaseModel):
    well_id: str
    optimization_mode: str # "JOINT_CSS_SRP", "CSS_ONLY", "SRP_ONLY"
    status: OperationalStatusEnum
    current_configuration: Optional[ParetoSolutionDTO] = None
    recommended_configuration: Optional[ParetoSolutionDTO] = None
    pareto_front: List[ParetoSolutionDTO] = Field(default_factory=list)
    total_evaluated_count: int
    feasible_count: int
    infeasible_count: int
    comparison_table: List[RecommendationComparisonDTO] = Field(default_factory=list)
    delta_summary: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float
    recommendation_mode: RecommendationModeEnum
    explanation: str
    contributing_factors: List[str] = Field(default_factory=list)
    constraints_checked: List[Dict[str, Any]] = Field(default_factory=list)
    execution_time_seconds: float
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
