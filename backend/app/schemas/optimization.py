"""
Optimization Request and Response Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any, Literal
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
    weight_net_benefit: Optional[float] = None
    weight_sor: Optional[float] = None
    weight_energy: Optional[float] = None
    weight_failure_risk: Optional[float] = None
    weight_oil_recovery: Optional[float] = None
    cooling_anomaly_day: Optional[int] = None
    cooling_anomaly_severity_pct: float = 0.0
    srp_policy: Literal["fixed", "adaptive"] = "adaptive"
    seed: int = 42

class MulticycleRequest(BaseModel):
    well_id: str = "BGW-01"
    n_cycles: int = Field(default=3, ge=1, le=5)
    srp_policy: Literal["fixed", "adaptive"] = "adaptive"
    base_configuration: Optional[Dict[str, Any]] = None

class CSSOptimizationRequest(BaseModel):
    well_id: str = "BGW-01"
    current_configuration: Optional[Dict[str, Any]] = None
    steam_volume_tonnes: Optional[float] = None
    soak_duration_days: Optional[float] = None
    cutoff_bpd: Optional[float] = None
    fixed_spm: float = 4.5
    cycle_number: int = 1
    seed: int = 42

class SRPOptimizationRequest(BaseModel):
    well_id: str = "BGW-01"
    current_configuration: Optional[Dict[str, Any]] = None
    spm: Optional[float] = None
    stroke_length_inch: Optional[float] = None
    vfd_downstroke_ratio: Optional[float] = None
    fixed_steam_tonnes: float = 3000.0
    cooling_anomaly_day: Optional[int] = None
    cycle_number: int = 1
    srp_policy: Literal["fixed", "adaptive"] = "adaptive"
    seed: int = 42

class ParetoSolutionDTO(BaseModel):
    solution_id: str
    steam_volume_tonnes: float
    soak_days: float
    spm: float
    stroke_length_inch: float
    vfd_downstroke_ratio: float
    economic_cutoff_bpd: float
    injection_pressure_bar: float = 125.0
    injection_duration_days: float = 15.0
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
    srp_policy: str = "fixed"
    srp_m_target: float = 1.15
    srp_min_fillage: float = 0.85
    max_spm: float = 0.0
    float_days: int = 0
    recovery_factor_pct: float = 0.0
    goodman_stress_ratio: float = 0.0
    peak_gearbox_torque_in_lbs: float = 0.0
    pump_intake_pressure_bar: float = 0.0
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
    pareto_options: Dict[str, ParetoSolutionDTO] = Field(default_factory=dict)
    total_evaluated_count: int
    feasible_count: int
    infeasible_count: int
    comparison_table: List[RecommendationComparisonDTO] = Field(default_factory=list)
    delta_summary: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float
    recommendation_mode: RecommendationModeEnum
    confidence_breakdown: Dict[str, Any] = Field(default_factory=dict)
    explanation: str
    contributing_factors: List[str] = Field(default_factory=list)
    constraints_checked: List[Dict[str, Any]] = Field(default_factory=list)
    execution_time_seconds: float
    evaluations: int = 0
    seed: int = 0
    srp_policy: str = "fixed"
    algorithm: str = "NSGA-II (pymoo), pop 24, 12 generations"
    evaluated_points: List[ParetoSolutionDTO] = Field(default_factory=list)
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
