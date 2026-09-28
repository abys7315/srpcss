"""
Benchmark and Performance Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
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
    total_float_events: int
    computation_time_s: float
    is_safe: bool
    notes: str

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
    float_events_eliminated: int
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
