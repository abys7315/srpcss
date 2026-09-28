"""
Prediction Service — Forecasting, Dynacard Classification, and Anomaly Detection.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import List, Dict, Any, Optional
import numpy as np

from ml.production_forecasting.forecaster import ProductionForecaster
from ml.dynacard_classification.classifier import DynacardClassifier
from ml.anomaly_detection.detector import OperationalAnomalyDetector
from ml.confidence.estimator import ConfidenceEstimator
from twin.cycle import CSSCycleSimulator, CycleConfig
from ..schemas.prediction import (
    QuantileForecastRequest,
    QuantileForecastResponse,
    QuantilePointDTO,
    DynacardClassifyRequest,
    DynacardClassifyResponse,
    AnomalyDetectRequest,
    AnomalyDetectResponse,
    AnomalyPointDTO
)
from ..schemas.common import ProvenanceEnum, RecommendationModeEnum

class PredictionService:
    def __init__(self):
        self.forecaster = ProductionForecaster()
        self.dynacard_clf = DynacardClassifier()
        self.anomaly_detector = OperationalAnomalyDetector()
        self.conf_estimator = ConfidenceEstimator()

    def generate_forecast(self, req: QuantileForecastRequest) -> QuantileForecastResponse:
        # Generate baseline physics profile using twin:
        cfg = CycleConfig(
            well_id=req.well_id,
            steam_volume_tonnes=req.steam_volume_tonnes,
            soak_duration_days=req.soak_days,
            production_duration_days=float(req.horizon_days),
            spm=req.spm
        )
        sim = CSSCycleSimulator(cfg)
        sim_res = sim.run_simulation()

        phys_profile = [pt.oil_rate_bpd for pt in sim_res.daily_history[:req.horizon_days]]
        while len(phys_profile) < req.horizon_days:
            phys_profile.append(max(2.0, phys_profile[-1] * 0.98 if phys_profile else 10.0))

        # Run multi-horizon quantile forecast:
        fc_res = self.forecaster.forecast_horizon(
            horizon_days=req.horizon_days,
            base_features=np.array([req.steam_volume_tonnes, req.spm, req.current_temp_c]),
            physics_profile=phys_profile
        )

        quantile_pts = [
            QuantilePointDTO(
                day=d,
                p10=round(fc_res.lower_bound_p10[i], 1),
                p50=round(fc_res.median_forecast[i], 1),
                p90=round(fc_res.upper_bound_p90[i], 1),
                physics_baseline=round(phys_profile[i], 1)
            )
            for i, d in enumerate(fc_res.horizon_days)
        ]

        total_p50 = float(sum(fc_res.median_forecast))

        # Confidence Estimation:
        conf_res = self.conf_estimator.compute_confidence(
            prediction_spread_pct=0.25,
            validation_error_pct=0.12,
            distance_to_training_distribution=0.10,
            data_quality_score=0.95,
            are_physics_inputs_in_range=True,
            min_constraint_margin_pct=0.30
        )

        rmode = RecommendationModeEnum(conf_res.recommendation_mode) if conf_res.recommendation_mode in RecommendationModeEnum._value2member_map_ else RecommendationModeEnum.ENGINEER_ADVISORY

        return QuantileForecastResponse(
            well_id=req.well_id,
            horizon_days=req.horizon_days,
            forecast=quantile_pts,
            p50_cumulative_oil_bbl=round(total_p50, 1),
            confidence_score=round(conf_res.overall_confidence_score, 2),
            recommendation_mode=rmode,
            provenance=ProvenanceEnum.SIMULATED
        )

    def classify_dynacard(self, req: DynacardClassifyRequest) -> DynacardClassifyResponse:
        res = self.dynacard_clf.classify_card(
            positions=req.surface_position_inch,
            loads=req.surface_load_lbs
        )

        return DynacardClassifyResponse(
            predicted_label=res.predicted_class,
            class_probabilities={k: round(v, 3) for k, v in res.class_probabilities.items()},
            confidence=round(res.confidence_score, 2),
            is_anomaly=(res.predicted_class != "NORMAL"),
            diagnostic_insight=res.diagnostic_explanation,
            provenance=ProvenanceEnum.SIMULATED
        )

    def detect_anomalies(self, req: AnomalyDetectRequest) -> AnomalyDetectResponse:
        temps = req.daily_temperatures_c
        pts: List[AnomalyPointDTO] = []
        anomaly_count = 0
        latest_report = None

        for idx, t in enumerate(temps):
            day_num = idx + 1
            hist = temps[:idx+1]
            rep = self.anomaly_detector.evaluate_point(
                oil_rate_bpd=35.0,
                temperature_c=t,
                pressure_bar=45.0,
                peak_load_lbs=14500.0,
                electricity_kwh=30.0,
                rolling_temp_history=hist
            )
            latest_report = rep
            is_anom = rep.is_anomaly
            if is_anom:
                anomaly_count += 1
            pts.append(AnomalyPointDTO(
                day=day_num,
                observed_value=round(t, 1),
                expected_value=round(temps[0] - 0.4 * idx, 1),
                z_score=round(rep.anomaly_score, 2),
                is_anomaly=is_anom,
                anomaly_type=rep.anomaly_severity if is_anom else "NORMAL"
            ))

        return AnomalyDetectResponse(
            well_id=req.well_id,
            anomalies_detected_count=anomaly_count,
            anomaly_points=pts,
            overall_anomaly_flag=(anomaly_count > 0),
            insight=latest_report.root_cause_explanation if latest_report else "All normal",
            provenance=ProvenanceEnum.SIMULATED
        )
