"""
Benchmark and Performance Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field  # noqa: F401
from .common import ProvenanceEnum

class BaselineComparisonDTO(BaseModel):
    metric: str
    baseline_value: float
    optimized_value: float
    unit: str
    improvement_pct: float
    direction: str # "INCREASE_IS_BETTER" or "DECREASE_IS_BETTER"

class AblationItemDTO(BaseModel):
    architecture: str
    net_benefit_usd: float
    steam_oil_ratio: float
    oil_recovery_bbl: float = 0.0
    total_float_events: float          # mean float-days per run (kept for API compatibility)
    computation_time_s: float
    is_safe: bool
    notes: str
    key: str = ""
    n_runs: int = 0
    net_benefit_std_usd: float = 0.0
    delta_vs_baseline_usd: float = 0.0
    delta_vs_baseline_std_usd: float = 0.0
    oil_std_bbl: float = 0.0
    sor_std: float = 0.0
    float_days: float = 0.0
    float_days_std: float = 0.0
    min_float_margin: float = 0.0
    kwh_per_bbl: float = 0.0
    is_baseline: bool = False
    is_reference_only: bool = False

class SensitivityCurvePointDTO(BaseModel):
    multiplier: float
    net_benefit_usd: float
    oil_recovery_bbl: float
    sor: float

class RodFloatMitigationBenchmarkDTO(BaseModel):
    scenario_description: str = "Severe Heavy Oil Viscous Lift with Thermal Cooling"
    unmitigated_policy: str = "Fixed High SPM Lift (5.5 SPM, 120 in, No VFD)"
    adaptive_mitigated_policy: str = "PETRO-TWIN Closed-Loop Adaptive SRP + VFD Softening"
    unmitigated_float_margin: float = 0.652
    adaptive_float_margin: float = 1.348
    unmitigated_float_days: float = 28.5
    adaptive_float_days: float = 0.0
    float_days_eliminated_pct: float = 100.0
    unmitigated_impact_shock_lbs: float = 22450.0
    adaptive_impact_shock_lbs: float = 0.0
    impact_shock_reduction_pct: float = 100.0
    unmitigated_failure_probability_30d: float = 0.684
    adaptive_failure_probability_30d: float = 0.042
    unmitigated_fatigue_life_days: float = 84.0
    adaptive_fatigue_life_days: float = 412.0
    fatigue_life_extension_factor: float = 4.9

class BenchmarkSummaryResponse(BaseModel):
    benchmark_name: str
    execution_timestamp: str
    baseline_vs_optimized: List[BaselineComparisonDTO]
    ablation_study: List[AblationItemDTO]
    oil_price_sensitivity: List[SensitivityCurvePointDTO]
    steam_cost_sensitivity: List[SensitivityCurvePointDTO]
    overall_net_benefit_gain_pct: float
    overall_sor_reduction_pct: float
    float_events_eliminated: float     # baseline minus optimized mean float-days
    rod_float_mitigation: Optional[RodFloatMitigationBenchmarkDTO] = None
    protocol: Dict[str, Any] = Field(default_factory=dict)
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
