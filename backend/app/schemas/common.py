"""
Common Schemas and Enums for Petro-Twin API.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from enum import Enum
from typing import Generic, TypeVar, Optional, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field

T = TypeVar("T")

class ProvenanceEnum(str, Enum):
    REAL = "REAL"
    PUBLIC_EXTERNAL = "PUBLIC_EXTERNAL"
    SIMULATED = "SIMULATED"
    ASSUMED = "ASSUMED"

class OperationalStatusEnum(str, Enum):
    FEASIBLE = "FEASIBLE"
    NEAR_LIMIT = "NEAR_LIMIT"
    INFEASIBLE = "INFEASIBLE"
    NO_FEASIBLE_SOLUTION = "NO_FEASIBLE_SOLUTION"
    NO_IMPROVEMENT_FOUND = "NO_IMPROVEMENT_FOUND"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    HIGH_RISK = "HIGH_RISK"
    DATA_UNAVAILABLE = "DATA_UNAVAILABLE"
    SIMULATED_DATA = "SIMULATED_DATA"

class RecommendationModeEnum(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    VERY_LOW = "VERY_LOW"
    AUTONOMOUS_SETPOINT = "AUTONOMOUS_SETPOINT"
    ENGINEER_ADVISORY = "ENGINEER_ADVISORY"
    PHYSICS_FALLBACK = "PHYSICS_FALLBACK"
    MANUAL_INSPECTION_REQUIRED = "MANUAL_INSPECTION_REQUIRED"

class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    status: str = "SUCCESS"
    message: str = "Operation completed successfully."
    provenance: ProvenanceEnum = ProvenanceEnum.SIMULATED
    data: Optional[T] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
