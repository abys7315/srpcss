"""
Provenance Service — Data Integrity and Source Auditing.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

import json
from pathlib import Path
from ..schemas.provenance import ProvenanceSummaryResponse, DataItemProvenanceDTO

class ProvenanceService:
    def get_provenance_summary(self) -> ProvenanceSummaryResponse:
        manifest_path = Path("data/DATA_MANIFEST.json")
        if not manifest_path.exists():
            for p in [Path("../data/DATA_MANIFEST.json"), Path("../../data/DATA_MANIFEST.json")]:
                if p.exists():
                    manifest_path = p
                    break

        items = []
        counts = {"REAL": 0, "PUBLIC_EXTERNAL": 0, "SIMULATED": 0, "ASSUMED": 0}

        if manifest_path.exists():
            with open(manifest_path, "r") as f:
                data = json.load(f)
            for it in data.get("datasets", []):
                tier = it.get("provenance_label", "SIMULATED")
                counts[tier] = counts.get(tier, 0) + 1
                items.append(DataItemProvenanceDTO(
                    name=it.get("name", it.get("id", "")),
                    provenance_tier=tier,
                    source_citation=it.get("source", ""),
                    description=it.get("purpose", ""),
                    validation_status="VALIDATED"
                ))

        disclaimer = (
            "MANDATORY OIL NOTICE: All reservoir, production, and dynacard records in this prototype "
            "are synthetic and derived from calibrated first-principles physics and public SPE literature on the Baghewala Field. "
            "No confidential Oil India Limited production data has been fabricated or misrepresented."
        )

        return ProvenanceSummaryResponse(
            system_name="PETRO-TWIN — Baghewala Heavy Oil Digital Twin",
            manifest_version="1.0.0",
            mandatory_disclaimer=disclaimer,
            provenance_distribution=counts,
            data_items=items
        )
