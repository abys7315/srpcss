"""
Data Provenance and Manifest Schemas.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class DataItemProvenanceDTO(BaseModel):
    name: str
    provenance_tier: str # "REAL", "PUBLIC_EXTERNAL", "SIMULATED", "ASSUMED"
    source_citation: str
    description: str
    validation_status: str

class ProvenanceSummaryResponse(BaseModel):
    system_name: str = "PETRO-TWIN — Baghewala CSS+SRP Optimization"
    manifest_version: str = "1.0.0"
    mandatory_disclaimer: str
    provenance_distribution: Dict[str, int]
    data_items: List[DataItemProvenanceDTO]
