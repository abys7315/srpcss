"""
ML Prediction and Forecasting Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .common import ProvenanceEnum, RecommendationModeEnum

class QuantilePointDTO(BaseModel):
    day: int
    p10: float
    p50: float
    p90: float
    physics_baseline: float

class QuantileForecastRequest(BaseModel):
    well_id: str = "BGW-01"
    horizon_days: int = Field(default=90, ge=14, le=180)
    steam_volume_tonnes: float = 3000.0
    soak_days: float = 6.0
    spm: float = 4.5
    current_temp_c: float = 85.0
    current_visc_cp: float = 280.0

class QuantileForecastResponse(BaseModel):
    well_id: str
    horizon_days: int
    forecast: List[QuantilePointDTO]
    p50_cumulative_oil_bbl: float
    confidence_score: float
    recommendation_mode: RecommendationModeEnum
    days: List[int] = Field(default_factory=list)
    p10: List[float] = Field(default_factory=list)
    p50: List[float] = Field(default_factory=list)
    p90: List[float] = Field(default_factory=list)
    cumulative_p50_bbl: float = 0.0
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED

class DynacardClassifyRequest(BaseModel):
    well_id: Optional[str] = "BGW-01"
    card_type: Optional[str] = "NORMAL"
    surface_position_inch: Optional[List[float]] = None
    surface_load_lbs: Optional[List[float]] = None
    stroke_length_inch: float = 100.0
    spm: float = 4.5

class DynacardClassifyResponse(BaseModel):
    predicted_label: str  # "NORMAL", "ROD_FLOATING", "FLUID_POUND", "GAS_INTERFERENCE", "OVERLOAD"
    class_probabilities: Dict[str, float]
    probabilities: Dict[str, float] = Field(default_factory=dict)
    confidence: float
    is_anomaly: bool
    diagnostic_insight: str
    root_cause: str = ""
    recommended_mitigation: str = ""
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED

class AnomalyDetectRequest(BaseModel):
    well_id: str = "BGW-01"
    daily_temperatures_c: Optional[List[float]] = None
    expected_temperatures_c: Optional[List[float]] = None

class AnomalyPointDTO(BaseModel):
    day: int
    observed_value: float
    expected_value: float
    z_score: float
    is_anomaly: bool
    anomaly_type: str

class AnomalyDetectResponse(BaseModel):
    well_id: str
    anomalies_detected_count: int
    anomaly_points: List[AnomalyPointDTO]
    anomalies: List[Dict[str, Any]] = Field(default_factory=list)
    overall_anomaly_flag: bool
    insight: str
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
