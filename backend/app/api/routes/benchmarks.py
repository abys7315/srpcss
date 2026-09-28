"""
Benchmark and Validation Results API Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, HTTPException
from ...services.benchmark_service import BenchmarkService
from ...schemas.benchmark import BenchmarkSummaryResponse
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/benchmarks", tags=["Benchmarks"])

@router.get("", response_model=APIResponse[BenchmarkSummaryResponse])
def get_benchmarks():
    """
    Returns baseline vs optimized operational performance,
    ablation study results, and economic sensitivities (oil price & steam cost).
    """
    try:
        service = BenchmarkService()
        result = service.get_benchmark_summary()
        return APIResponse(
            success=True,
            message="Benchmark data retrieved.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmark retrieval error: {str(e)}")
