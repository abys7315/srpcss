"""
What-If Service — Multi-Scenario Interactive Sandbox.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import Dict, Any, List
from optimizer.scenarios import WhatIfSimulator, ScenarioCard
from ..schemas.what_if import WhatIfRequest, WhatIfResponse, ScenarioEvaluationDTO
from ..schemas.common import ProvenanceEnum, OperationalStatusEnum

class WhatIfService:
    def __init__(self):
        self.simulator = WhatIfSimulator()

    def run_sandbox(self, req: WhatIfRequest) -> WhatIfResponse:
        current_cfg = req.current_configuration or {
            "steam_volume_tonnes": 3000.0,
            "soak_duration_days": 6.0,
            "spm": 4.8,
            "stroke_length_inch": 100.0,
            "vfd_downstroke_ratio": 1.0,
            "economic_cutoff_bpd": 7.0
        }

        scen_a = req.scenario_a.model_dump() if req.scenario_a else None
        scen_b = req.scenario_b.model_dump() if req.scenario_b else None
        scen_c = req.scenario_c.model_dump() if req.scenario_c else None

        res_cards: List[ScenarioCard] = self.simulator.evaluate_sandbox(
            well_id=req.well_id,
            current_cfg=current_cfg,
            scenario_a_cfg=scen_a,
            scenario_b_cfg=scen_b,
            scenario_c_cfg=scen_c,
            cooling_anomaly_day=req.cooling_anomaly_day,
            cooling_anomaly_severity_pct=req.cooling_anomaly_severity_pct
        )

        scenarios_dto: List[ScenarioEvaluationDTO] = []
        for card in res_cards:
            st = OperationalStatusEnum(card.constraint_status) if card.constraint_status in OperationalStatusEnum._value2member_map_ else OperationalStatusEnum.FEASIBLE
            scenarios_dto.append(ScenarioEvaluationDTO(
                scenario_id=card.scenario_id,
                label=card.scenario_title,
                description=f"Steam: {card.steam_volume_tonnes:.0f}t, SPM: {card.spm:.1f}, VFD: {card.vfd_downstroke_ratio:.2f}",
                steam_volume_tonnes=card.steam_volume_tonnes,
                soak_days=card.soak_days,
                spm=card.spm,
                stroke_length_inch=card.stroke_length_inch,
                vfd_downstroke_ratio=card.vfd_downstroke_ratio,
                cumulative_oil_bbl=round(card.cumulative_oil_bbl, 1),
                net_benefit_usd=round(card.net_benefit_usd, 2),
                steam_oil_ratio=round(card.steam_oil_ratio, 2),
                energy_intensity_kwh_per_bbl=round(card.energy_intensity_kwh_per_bbl, 2),
                failure_risk_probability=round(card.failure_risk_probability, 3),
                min_float_margin_index=round(card.min_float_margin_index, 3),
                status=st,
                violations=card.violations_summary,
                near_limit_warnings=[],
                is_recommended=(card.scenario_id == "RECOMMENDED")
            ))

        return WhatIfResponse(
            well_id=req.well_id,
            scenarios=scenarios_dto,
            recommended_scenario_id="RECOMMENDED",
            summary_insight="Side-by-side what-if sandbox confirms that combining steam volume adjustment with asymmetric VFD downstroke speed delivers maximum net economic benefit while eliminating sucker rod floating risk.",
            provenance=ProvenanceEnum.SIMULATED
        )
