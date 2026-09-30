"""
SQLAlchemy ORM Data Models.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, UniqueConstraint
from datetime import datetime, timezone
from .database import Base

def utc_now():
    return datetime.now(timezone.utc)

class WellModel(Base):
    __tablename__ = "wells"

    well_id = Column(String(32), primary_key=True, index=True)
    well_name = Column(String(64), nullable=False)
    field_name = Column(String(64), default="Baghewala")
    formation = Column(String(64), default="Jodhpur Sandstone")
    crude_api = Column(Float, default=18.0)
    depth_m = Column(Float, default=1050.0)
    casing_od_inch = Column(Float, default=7.0)
    tubing_od_inch = Column(Float, default=3.5)
    pump_depth_m = Column(Float, default=1000.0)
    rod_string_description = Column(String(128), default="API Grade D Taper 76")
    surface_unit_description = Column(String(128), default="API C-456-256-100 Conventional Beam Unit")
    current_cycle_number = Column(Integer, default=1)
    cycle_phase = Column(String(32), default="PRODUCTION")
    status = Column(String(32), default="FEASIBLE")

    # Current Telemetry
    latest_temperature_c = Column(Float, default=85.0)
    latest_viscosity_cp = Column(Float, default=280.0)
    latest_oil_rate_bpd = Column(Float, default=42.5)
    latest_water_cut_pct = Column(Float, default=65.0)
    latest_float_margin = Column(Float, default=1.85)
    latest_goodman_stress = Column(Float, default=0.62)
    latest_dynacard_label = Column(String(32), default="NORMAL")

    # Current Operating Parameters
    steam_volume_tonnes = Column(Float, default=3000.0)
    injection_pressure_bar = Column(Float, default=125.0)
    steam_temp_celsius = Column(Float, default=260.0)
    soak_duration_days = Column(Float, default=6.0)
    spm = Column(Float, default=4.5)
    stroke_length_inch = Column(Float, default=100.0)
    vfd_downstroke_ratio = Column(Float, default=1.0)
    economic_cutoff_oil_rate_bpd = Column(Float, default=7.0)

    provenance = Column(String(32), default="SIMULATED")
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class FeedbackModel(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    well_id = Column(String(32), index=True, nullable=False)
    day = Column(Integer, nullable=False)
    observed_oil_rate_bpd = Column(Float, nullable=False)
    observed_temperature_c = Column(Float, nullable=False)
    observed_float_events = Column(Integer, default=0)
    observed_dynacard_label = Column(String(32), default="NORMAL")
    physics_expected_oil_bpd = Column(Float, nullable=False)
    residual_error_bpd = Column(Float, nullable=False)
    operator_notes = Column(Text, nullable=True)
    is_drift_detected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

class RecalibrationLogModel(Base):
    __tablename__ = "recalibration_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    well_id = Column(String(32), index=True, nullable=False)
    model_name = Column(String(64), nullable=False)
    previous_version = Column(String(32), nullable=False)
    new_version = Column(String(32), nullable=False)
    sample_count = Column(Integer, nullable=False)
    pre_mae = Column(Float, nullable=False)
    post_mae = Column(Float, nullable=False)
    reduction_pct = Column(Float, nullable=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

class OptimizationLogModel(Base):
    __tablename__ = "optimization_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    well_id = Column(String(32), index=True, nullable=False)
    optimization_mode = Column(String(32), nullable=False)
    status = Column(String(32), nullable=False)
    recommended_steam = Column(Float, nullable=True)
    recommended_soak = Column(Float, nullable=True)
    recommended_spm = Column(Float, nullable=True)
    recommended_vfd = Column(Float, nullable=True)
    cumulative_oil_bbl = Column(Float, nullable=True)
    net_benefit_usd = Column(Float, nullable=True)
    steam_oil_ratio = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    recommendation_mode = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=utc_now)

class ApprovalLogModel(Base):
    __tablename__ = "approval_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recommendation_id = Column(String(64), index=True, nullable=False)
    well_id = Column(String(32), index=True, nullable=False)
    approved_by = Column(String(64), default="Lead Operations Engineer")
    decision = Column(String(32), nullable=False)       # "APPROVED", "REJECTED"
    decision_reason = Column(Text, nullable=True)
    approved_setpoint = Column(Text, nullable=False)    # JSON string
    previous_setpoint = Column(Text, nullable=False)    # JSON string
    created_at = Column(DateTime, default=utc_now)

class WellAuditLogModel(Base):
    __tablename__ = "well_audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    well_id = Column(String(32), index=True, nullable=False)
    event_type = Column(String(64), nullable=False)     # "SETPOINT_APPLIED", "OPERATOR_APPROVAL", "OPERATOR_REJECTION"
    actor = Column(String(64), default="Engineer")
    description = Column(Text, nullable=False)
    details = Column(Text, nullable=True)               # JSON string of state diff
    created_at = Column(DateTime, default=utc_now)


class TelemetryObservationModel(Base):
    """One ingested daily observation (user-supplied; the source label says where it came from)."""
    __tablename__ = "telemetry_observations"
    __table_args__ = (UniqueConstraint("well_id", "cycle_number", "day", "source_label", name="uq_obs_well_cycle_day_source"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    well_id = Column(String(32), index=True, nullable=False)
    cycle_number = Column(Integer, default=1, nullable=False)
    day = Column(Integer, nullable=False)                       # production day, 1-indexed
    oil_rate_bpd = Column(Float, nullable=False)
    water_cut_pct = Column(Float, nullable=True)
    temperature_c = Column(Float, nullable=True)
    pump_intake_pressure_bar = Column(Float, nullable=True)
    source_label = Column(String(64), nullable=False)          # e.g. "field gauge export 2026-09", "synthetic test"
    ingested_at = Column(DateTime, default=utc_now)


class CalibrationRunModel(Base):
    __tablename__ = "calibration_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    well_id = Column(String(32), index=True, nullable=False)
    parameter = Column(String(32), default="thermal_loss_kappa")
    kappa_default = Column(Float, nullable=False)
    kappa_fitted = Column(Float, nullable=False)
    status = Column(String(32), nullable=False)
    applied = Column(Boolean, default=False)
    n_observations = Column(Integer, nullable=False)
    holdout_rmse_default = Column(Float, nullable=True)
    holdout_rmse_fitted = Column(Float, nullable=True)
    holdout_improvement_pct = Column(Float, nullable=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

