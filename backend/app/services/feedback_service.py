"""
Feedback and Model Recalibration Service.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.

Implements the continuous online adaptation loop:
1. Ingestion of field gauges (oil rate, bottomhole temp, dynacard diagnosis)
2. Evaluation of residual physics error (delta = y_obs - y_phys)
3. Kolmogorov-Smirnov drift detection
4. Online recalibration of residual corrector
5. Verification of measurable MAE reduction (> 20%).
"""

import time
from typing import List, Optional, Tuple
import numpy as np
from sqlalchemy.orm import Session

from ..db.models import FeedbackModel, RecalibrationLogModel, WellModel
from ..schemas.feedback import (
    FeedbackSubmissionRequest,
    FeedbackSubmissionResponse,
    RecalibrationRequest,
    RecalibrationResponse
)
from ..schemas.common import ProvenanceEnum
from ml.drift.monitor import ModelDriftMonitor
from ml.residual_models.corrector import HybridResidualCorrector
from twin.cycle import CSSCycleSimulator, CycleConfig

class FeedbackService:
    def __init__(self, db: Session):
        self.db = db
        self.drift_monitor = ModelDriftMonitor()
        self.residual_corrector = HybridResidualCorrector()

    def submit_feedback(self, req: FeedbackSubmissionRequest) -> FeedbackSubmissionResponse:
        # Retrieve well parameters from DB or defaults:
        well = self.db.query(WellModel).filter(WellModel.well_id == req.well_id).first()
        st_vol = well.steam_volume_tonnes if well else 3000.0
        soak_d = well.soak_duration_days if well else 6.0
        spm_val = well.spm if well else 4.5

        effective_day = req.day_in_cycle if req.day_in_cycle is not None else req.day
        effective_notes = req.notes if req.notes is not None else req.operator_notes

        # Compute physics-expected production for this day:
        sim = CSSCycleSimulator(CycleConfig(
            well_id=req.well_id,
            steam_volume_tonnes=st_vol,
            soak_duration_days=soak_d,
            spm=spm_val,
            production_duration_days=float(max(effective_day + 5, 60))
        ))
        sim_res = sim.run_simulation()
        
        day_idx = min(effective_day - 1, len(sim_res.daily_history) - 1)
        expected_oil = sim_res.daily_history[day_idx].oil_rate_bpd if sim_res.daily_history else 35.0
        residual_error = req.observed_oil_rate_bpd - expected_oil

        # Check existing historical residuals to detect distribution drift:
        past_feedbacks = (
            self.db.query(FeedbackModel)
            .filter(FeedbackModel.well_id == req.well_id)
            .order_by(FeedbackModel.created_at.desc())
            .limit(20)
            .all()
        )

        baseline_res = [f.residual_error_bpd for f in past_feedbacks[5:]] if len(past_feedbacks) >= 10 else [-1.5, 1.2, -0.8, 0.9, -1.1]
        recent_res = [f.residual_error_bpd for f in past_feedbacks[:5]] + [residual_error]

        drift_report = self.drift_monitor.evaluate_residual_drift(
            baseline_residuals=baseline_res,
            recent_residuals=recent_res
        )

        is_drift = drift_report.drift_detected or abs(residual_error) > 8.0

        # Save feedback to DB
        fb = FeedbackModel(
            well_id=req.well_id,
            day=effective_day,
            observed_oil_rate_bpd=round(req.observed_oil_rate_bpd, 2),
            observed_temperature_c=round(req.observed_temperature_c, 1),
            observed_float_events=req.observed_float_events,
            observed_dynacard_label=req.observed_dynacard_label or "NORMAL",
            physics_expected_oil_bpd=round(expected_oil, 2),
            residual_error_bpd=round(residual_error, 2),
            operator_notes=effective_notes,
            is_drift_detected=is_drift
        )
        self.db.add(fb)
        self.db.commit()
        self.db.refresh(fb)

        msg = (
            f"Observation recorded. Residual error: {residual_error:+.2f} BPD. "
            + ("Statistical drift confirmed: Recalibration recommended." if is_drift else "Operating within expected model variance.")
        )

        return FeedbackSubmissionResponse(
            feedback_id=f"FB-{fb.id:04d}",
            well_id=req.well_id,
            day=effective_day,
            observed_oil_rate_bpd=req.observed_oil_rate_bpd,
            physics_expected_oil_bpd=round(expected_oil, 2),
            residual_error_bpd=round(residual_error, 2),
            is_drift_detected=is_drift,
            recalibration_recommended=is_drift,
            message=msg,
            provenance=ProvenanceEnum.SIMULATED
        )

    def recalibrate_model(self, req: RecalibrationRequest) -> RecalibrationResponse:
        """
        Executes online recalibration of the residual corrector using recorded observations.
        Rigorously implements train / validation split on held-out observations to ensure honest metrics.
        Promotes challenger to champion only if validation MAE shows measurable reduction.
        """
        feedbacks = (
            self.db.query(FeedbackModel)
            .filter(FeedbackModel.well_id == req.well_id)
            .order_by(FeedbackModel.day.asc())
            .all()
        )

        is_demo_mode = False
        unique_days = set(f.day for f in feedbacks)
        if len(feedbacks) < 8 or len(unique_days) < 4:
            if not req.allow_synthetic_fallback:
                return RecalibrationResponse(
                    well_id=req.well_id,
                    model_name="ResidualCorrector-HistogramGradientBoosting",
                    previous_model_version="v1.2.0",
                    new_model_version="v1.2.0",
                    sample_points_used=len(feedbacks),
                    train_mae_bpd=0.0,
                    validation_mae_bpd=0.0,
                    pre_recalibration_mae_bpd=0.0,
                    post_recalibration_mae_bpd=0.0,
                    mae_reduction_pct=0.0,
                    drift_status_cleared=False,
                    status="INSUFFICIENT_OBSERVATIONS",
                    explanation=f"Insufficient distinct observations ({len(unique_days)}/4 distinct days, {len(feedbacks)}/8 required) for statistical model recalibration. Record more field gauge points or request SIMULATION DEMO MODE.",
                    provenance=ProvenanceEnum.SIMULATED
                )
            # SIMULATION DEMO MODE with explicit provenance disclosure
            is_demo_mode = True
            days = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
            obs_rates = [48.0, 42.0, 37.0, 32.0, 26.0, 21.0, 17.0, 13.5, 10.5, 8.0]
            exp_rates = [42.0, 36.0, 30.0, 25.0, 20.0, 15.5, 12.0, 9.0, 7.0, 5.5]
            temps = [160.0, 142.0, 126.0, 110.0, 95.0, 82.0, 70.0, 60.0, 52.0, 48.0]
        else:
            days = [f.day for f in feedbacks]
            obs_rates = [f.observed_oil_rate_bpd for f in feedbacks]
            exp_rates = [f.physics_expected_oil_bpd for f in feedbacks]
            temps = [f.observed_temperature_c for f in feedbacks]

        # Features: [day, temp, spm]
        X = np.column_stack([
            np.array(days, dtype=float),
            np.array(temps, dtype=float),
            np.full(len(days), 4.5, dtype=float)
        ])
        y_obs = np.array(obs_rates, dtype=float)
        y_exp = np.array(exp_rates, dtype=float)

        # -------------------------------------------------------------
        # Real Train / Validation Split (70% train, 30% held-out)
        # -------------------------------------------------------------
        n_samples = len(days)
        split_idx = max(2, int(n_samples * 0.70))
        
        # Chronological split for time-series field data
        X_train, X_val = X[:split_idx], X[split_idx:]
        obs_train, obs_val = y_obs[:split_idx], y_obs[split_idx:]
        exp_train, exp_val = y_exp[:split_idx], y_exp[split_idx:]

        # 1. Baseline Model Validation MAE on held-out split
        baseline_val_residuals = obs_val - exp_val
        pre_val_mae = float(np.mean(np.abs(baseline_val_residuals)))

        # 2. Train Challenger Model on training set
        challenger = HybridResidualCorrector()
        challenger.fit(X_train, y_observed=obs_train, y_physics=exp_train)
        train_mae = float(challenger.training_mae)

        # 3. Evaluate Challenger Model on held-out validation set
        val_preds = []
        for i in range(len(X_val)):
            pred_obj = challenger.predict(X_val[i], exp_val[i])
            val_preds.append(pred_obj.final_hybrid_prediction)
        
        post_val_mae = float(np.mean(np.abs(obs_val - np.array(val_preds))))

        # Calculate genuine validation improvement percentage
        reduction_pct = max(0.0, ((pre_val_mae - post_val_mae) / max(pre_val_mae, 0.01)) * 100.0)

        prev_v = "v1.2.0"
        new_v = f"v1.2.{int(time.time()) % 1000}"

        # Canonical promotion threshold: Challenger becomes Champion only if held-out validation MAE improves by >= 20.0%
        canonical_threshold = 20.0
        is_promoted = reduction_pct >= canonical_threshold
        model_status = "PROMOTED_CHAMPION" if is_promoted else "REJECTED_CHALLENGER"

        if is_promoted:
            self.residual_corrector = challenger

        demo_prefix = "[SIMULATION DEMO MODE] " if is_demo_mode else ""
        explanation_msg = (
            f"{demo_prefix}Online challenger model trained on {len(X_train)} samples, evaluated on {len(X_val)} held-out validation points. "
            f"Held-out Validation MAE reduced by {reduction_pct:.1f}% ({pre_val_mae:.2f} -> {post_val_mae:.2f} BPD). "
            f"Status: {model_status}."
        )

        # Record recalibration event
        log = RecalibrationLogModel(
            well_id=req.well_id,
            model_name="ResidualCorrector-HistogramGradientBoosting",
            previous_version=prev_v,
            new_version=new_v,
            sample_count=n_samples,
            pre_mae=round(pre_val_mae, 3),
            post_mae=round(post_val_mae, 3),
            reduction_pct=round(reduction_pct, 1),
            explanation=explanation_msg
        )
        self.db.add(log)

        # Clear drift flag on recent feedback if model was promoted:
        if is_promoted:
            for f in feedbacks:
                f.is_drift_detected = False
        self.db.commit()

        return RecalibrationResponse(
            well_id=req.well_id,
            model_name="ResidualCorrector-HistogramGradientBoosting",
            previous_model_version=prev_v,
            new_model_version=new_v if is_promoted else prev_v,
            sample_points_used=n_samples,
            train_mae_bpd=round(train_mae, 2),
            validation_mae_bpd=round(post_val_mae, 2),
            pre_recalibration_mae_bpd=round(pre_val_mae, 2),
            post_recalibration_mae_bpd=round(post_val_mae, 2),
            mae_reduction_pct=round(reduction_pct, 1),
            drift_status_cleared=is_promoted,
            status=model_status,
            explanation=explanation_msg,
            provenance=ProvenanceEnum.SIMULATED
        )
