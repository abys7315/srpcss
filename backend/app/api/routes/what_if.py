"""
What-If Scenario Sandbox Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, HTTPException
from ...services.what_if_service import WhatIfService
from ...schemas.what_if import WhatIfRequest, WhatIfResponse
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/what-if", tags=["What-If Simulator"])

@router.post("", response_model=APIResponse[WhatIfResponse])
def run_what_if_analysis(req: WhatIfRequest):
    """
    Evaluates 5-column side-by-side scenarios:
    1. CURRENT: Baseline operating point
    2. SCENARIO A: User hypothesis 1 (e.g. +20% steam volume)
    3. SCENARIO B: User hypothesis 2 (e.g. +1.0 SPM with standard stroke)
    4. SCENARIO C: User hypothesis 3 (e.g. VFD asymmetric speed control)
    5. RECOMMENDED: Pareto-optimal AI+Physics recommendation.
    """
    try:
        service = WhatIfService()
        result = service.run_sandbox(req)
        return APIResponse(
            success=True,
            message="What-If multi-scenario analysis generated successfully.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"What-if evaluation error: {str(e)}")
