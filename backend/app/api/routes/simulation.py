"""
Digital Twin Simulation API Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, HTTPException
from ...services.simulation_service import SimulationService
from ...schemas.simulation import SimulationRequest, SimulationResponse
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/simulate", tags=["Digital Twin Simulation"])

@router.post("", response_model=APIResponse[SimulationResponse])
def run_cycle_simulation(req: SimulationRequest):
    """
    Executes a high-fidelity first-principles CSS cycle simulation.
    Models Marx-Langenheim heating, Boberg-Lantz cooling, Vogel heavy oil inflow,
    dynamic rod string wave equation dynacards, and checks hard safety constraints.
    """
    try:
        service = SimulationService()
        result = service.run_simulation(req)
        return APIResponse(
            success=True,
            status=result.status.value,
            message="CSS Cycle simulation executed successfully.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")
