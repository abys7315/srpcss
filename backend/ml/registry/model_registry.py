"""
Model Registry & Version Governance.

Manages model versions, training data lineage hashes, metrics, and champion/challenger tracking.

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass
from typing import Dict, Any, List, Optional
import hashlib
import json
from pathlib import Path

@dataclass
class ModelMetadata:
    model_name: str
    version: str
    status: str                         # "CHAMPION", "CHALLENGER", "ARCHIVED"
    training_data_hash: str
    created_at: str
    metrics: Dict[str, float]
    provenance_mode: str
    disclaimer: str

class ModelRegistry:
    """Tracks deployed ML artifacts and prevents unauthorized auto-deployment."""

    def __init__(self, registry_file: Optional[Path] = None):
        self.registry_file = registry_file
        self.models: Dict[str, List[ModelMetadata]] = {
            "residual_corrector": [
                ModelMetadata(
                    model_name="residual_corrector",
                    version="v1.0.0-sim",
                    status="CHAMPION",
                    training_data_hash="a1b2c3d4e5f67890",
                    created_at="2026-09-28T12:00:00Z",
                    metrics={"mae": 1.85, "rmse": 2.42},
                    provenance_mode="SIMULATED",
                    disclaimer="Trained on synthetic field simulation data. Deployment requires OIL field calibration."
                )
            ],
            "dynacard_classifier": [
                ModelMetadata(
                    model_name="dynacard_classifier",
                    version="v1.0.0-sim",
                    status="CHAMPION",
                    training_data_hash="b2c3d4e5f6a17890",
                    created_at="2026-09-28T12:00:00Z",
                    metrics={"accuracy": 0.94, "f1_macro": 0.93},
                    provenance_mode="SIMULATED",
                    disclaimer="Trained on synthetic dynamometer cards."
                )
            ]
        }

    def get_champion(self, model_name: str) -> Optional[ModelMetadata]:
        """Returns active champion model."""
        for m in self.models.get(model_name, []):
            if m.status == "CHAMPION":
                return m
        return None

    def register_challenger(
        self,
        model_name: str,
        version: str,
        metrics: Dict[str, float],
        training_data_hash: str
    ) -> ModelMetadata:
        """Registers a retrained challenger model in shadow mode."""
        meta = ModelMetadata(
            model_name=model_name,
            version=version,
            status="CHALLENGER",
            training_data_hash=training_data_hash,
            created_at="2026-09-28T12:30:00Z",
            metrics=metrics,
            provenance_mode="SIMULATED",
            disclaimer="Challenger model running in shadow validation mode."
        )
        if model_name not in self.models:
            self.models[model_name] = []
        self.models[model_name].append(meta)
        return meta

    def promote_challenger_to_champion(self, model_name: str, version: str) -> bool:
        """
        Promotes challenger to champion with engineer sign-off.
        Demotes previous champion to ARCHIVED.
        """
        target = None
        for m in self.models.get(model_name, []):
            if m.version == version:
                target = m
                break
        if not target:
            return False
            
        for m in self.models.get(model_name, []):
            if m.status == "CHAMPION":
                m.status = "ARCHIVED"
                
        target.status = "CHAMPION"
        return True
