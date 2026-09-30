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
    protocol: Dict[str, Any] = Field(default_factory=dict)
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
