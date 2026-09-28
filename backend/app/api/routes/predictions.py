"""
ML Predictions, Forecasting, Dynacards, and Anomalies Endpoints.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from fastapi import APIRouter, HTTPException
from ...services.prediction_service import PredictionService
from ...schemas.prediction import (
    QuantileForecastRequest,
    QuantileForecastResponse,
    DynacardClassifyRequest,
    DynacardClassifyResponse,
    AnomalyDetectRequest,
    AnomalyDetectResponse
)
from ...schemas.common import APIResponse, ProvenanceEnum

router = APIRouter(prefix="/predictions", tags=["ML Predictions & Analytics"])

@router.post("/forecast", response_model=APIResponse[QuantileForecastResponse])
def forecast_production(req: QuantileForecastRequest):
    """Generates multi-horizon probabilistic production forecasts with p10, p50, p90 quantile bands."""
    try:
        service = PredictionService()
        result = service.generate_forecast(req)
        return APIResponse(
            success=True,
            message="Quantile production forecast generated.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")

@router.post("/classify-dynacard", response_model=APIResponse[DynacardClassifyResponse])
def classify_dynacard(req: DynacardClassifyRequest):
    """Classifies dynamometer card diagnostic pattern (NORMAL, ROD_FLOATING, FLUID_POUND, etc.)."""
    try:
        service = PredictionService()
        result = service.classify_dynacard(req)
        return APIResponse(
            success=True,
            message=f"Dynacard classified as {result.predicted_label}.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dynacard classification error: {str(e)}")

@router.post("/detect-anomalies", response_model=APIResponse[AnomalyDetectResponse])
def detect_cooling_anomalies(req: AnomalyDetectRequest):
    """Detects rapid thermal cooling anomalies in bottomhole temperature timeseries."""
    try:
        service = PredictionService()
        result = service.detect_anomalies(req)
        return APIResponse(
            success=True,
            message=f"Detected {result.anomalies_detected_count} thermal anomalies.",
            provenance=ProvenanceEnum.SIMULATED,
            data=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection error: {str(e)}")
