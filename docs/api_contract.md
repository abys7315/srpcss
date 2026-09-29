# API Contract & Endpoint Specifications

This document defines the stable REST API contract for the **SIH 26120 Digital Twin Backend**. Both backend service implementations and frontend clients adhere to this specification.

Base URL: `http://localhost:8000/api/v1`  
Health check is accessible at `/health` and `/api/v1/health`.

---

## 1. Standard Enums & Error Formats

### 1.1 Provenance Types
All responses include a `provenance` metadata block:
```json
{
  "provenance_type": "REAL | PUBLIC_EXTERNAL | SIMULATED | ASSUMED",
  "source_description": "First-principles CSS Marx-Langenheim simulation",
  "timestamp": "2026-09-28T12:00:00Z",
  "calibration_version": "v1.0-sim"
}
```

### 1.2 Solution Statuses
```typescript
type SolutionStatus = 
  | "FEASIBLE"
  | "NEAR_LIMIT"
  | "INFEASIBLE"
  | "NO_FEASIBLE_SOLUTION"
  | "NO_IMPROVEMENT_FOUND"
  | "LOW_CONFIDENCE"
  | "HIGH_RISK"
  | "DATA_UNAVAILABLE"
  | "SIMULATED_DATA";
```

### 1.3 Standard Error Format
```json
{
  "detail": {
    "error_code": "CONSTRAINT_VIOLATION",
    "message": "Maximum allowable injection pressure exceeded.",
    "violations": [
      {
        "parameter": "injection_pressure_psi",
        "current_value": 2400.0,
        "allowed_range": [800.0, 2100.0],
        "violation_severity": "CRITICAL"
      }
    ]
  }
}
```

---

## 2. Endpoints

### 2.1 Health Check
- **Endpoint**: `GET /health` and `GET /api/v1/health`
- **Response**:
```json
{
  "status": "HEALTHY",
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "database": "UP",
    "digital_twin": "READY",
    "optimizer": "READY",
    "ml_engine": "READY"
  }
}
```

---

### 2.2 Wells Management

#### `GET /api/v1/wells/{well_id}`
Returns well static properties and completion metadata.
- **Path Parameter**: `well_id: str` (e.g. `BGW-01`)
- **Response**:
```json
{
  "well_id": "BGW-01",
  "well_name": "Baghewala-01",
  "field_name": "Baghewala",
  "formation": "Jodhpur Sandstone",
  "api_gravity": 18.0,
  "reservoir_depth_m": 1050.0,
  "reservoir_temperature_c": 47.0,
  "initial_viscosity_cp": 2400.0,
  "casing_od_inch": 7.0,
  "tubing_od_inch": 3.5,
  "rod_string_grade": "Grade D",
  "pump_depth_m": 980.0,
  "pump_bore_inch": 2.25,
  "provenance": {
    "provenance_type": "ASSUMED",
    "source_description": "Canonical Baghewala reference well definition (configs/field.yaml)"
  }
}
```

#### `GET /api/v1/wells/{well_id}/state`
Returns the current dynamic state of the well.
- **Response**:
```json
{
  "well_id": "BGW-01",
  "cycle_number": 3,
  "cycle_phase": "PRODUCTION",
  "days_in_phase": 42.0,
  "current_spm": 4.5,
  "stroke_length_inch": 100.0,
  "bottom_hole_temp_c": 85.0,
  "oil_rate_bpd": 45.0,
  "water_cut_pct": 68.0,
  "rod_float_risk": "LOW",
  "status": "FEASIBLE",
  "provenance": {
    "provenance_type": "SIMULATED",
    "source_description": "Current cycle simulation state"
  }
}
```

---

### 2.3 Digital Twin Simulation

#### `POST /api/v1/simulate`
Executes forward physics simulation for a given well and operational profile.
- **Request Body**:
```json
{
  "well_id": "BGW-01",
  "css_parameters": {
    "steam_volume_tonnes": 3000.0,
    "injection_pressure_psi": 1850.0,
    "steam_temperature_c": 260.0,
    "steam_quality": 0.85,
    "injection_duration_days": 18.0,
    "soak_duration_days": 7.0,
    "production_duration_days": 90.0
  },
  "srp_parameters": {
    "spm": 4.5,
    "stroke_length_inch": 100.0,
    "pump_diameter_inch": 2.25,
    "vfd_enabled": true
  }
}
```
- **Response**:
```json
{
  "simulation_id": "sim_20260928_001",
  "well_id": "BGW-01",
  "status": "SIMULATED_DATA",
  "thermal_state": {
    "heated_zone_radius_m": 18.4,
    "bottom_hole_temperature_c": 145.0,
    "heat_loss_overburden_fraction": 0.28,
    "effective_viscosity_cp": 85.0
  },
  "production_forecast": {
    "time_days": [1, 2, 3, 5, 10, 30, 60, 90],
    "oil_rate_bpd": [120.0, 115.0, 108.0, 95.0, 80.0, 52.0, 38.0, 25.0],
    "cumulative_oil_bbl": 4650.0,
    "steam_oil_ratio": 3.8
  },
  "srp_performance": {
    "peak_polished_rod_load_lbs": 18500.0,
    "minimum_rod_load_lbs": 4200.0,
    "peak_gearbox_torque_in_lbs": 310000.0,
    "pump_fillage_pct": 88.0,
    "float_margin_lbs": 650.0,
    "rod_floating_detected": false
  },
  "provenance": {
    "provenance_type": "SIMULATED",
    "source_description": "First-principles twin simulation"
  }
}
```

---

### 2.4 What-If Scenario Sandbox

#### `POST /api/v1/what-if`
Evaluates perturbations relative to a baseline run.
- **Request Body**:
```json
{
  "well_id": "BGW-01",
  "baseline_simulation_id": "sim_20260928_001",
  "perturbations": {
    "spm_delta": 1.0,
    "steam_volume_multiplier": 1.15
  }
}
```
- **Response**:
```json
{
  "scenario_id": "whatif_001",
  "status": "FEASIBLE",
  "baseline_metrics": { "cumulative_oil_bbl": 4650.0, "net_benefit_usd": 125000.0 },
  "scenario_metrics": { "cumulative_oil_bbl": 5120.0, "net_benefit_usd": 139500.0 },
  "deltas": { "oil_delta_pct": 10.1, "benefit_delta_usd": 14500.0 },
  "constraint_check": {
    "status": "FEASIBLE",
    "warnings": ["Rod stress near 85% of allowable Goodman limit"]
  },
  "confidence_score": 0.82,
  "provenance": { "provenance_type": "SIMULATED" }
}
```

---

### 2.5 Optimization Endpoints

#### `POST /api/v1/optimize/css`
- **Request**: Optimization bounds, objective weights (maximize oil vs minimize SOR).
- **Response**: Recommended steam volume, soak days, injection rate, Pareto front points.

#### `POST /api/v1/optimize/srp`
- **Request**: Well ID, target drawdown, mechanical constraints.
- **Response**: Recommended SPM, stroke length, VFD speed curve, float margin safety check.

#### `POST /api/v1/optimize/joint`
- **Request**: Integrated cycle and lifting parameter ranges and economic targets.
- **Response**: Jointly optimal CSS and SRP schedule, Pareto front, and confidence rating.

---

### 2.6 Predictions & Risks

#### `GET /api/v1/predictions?well_id={well_id}&horizon_days=90`
Returns production, temperature, and viscosity forecasts with confidence intervals.

#### `GET /api/v1/risks?well_id={well_id}`
Returns real-time risk scores:
- `rod_floating_risk`: `LOW | MODERATE | HIGH | CRITICAL`
- `mechanical_fatigue_risk`: Goodman ratio evaluation.
- `fluid_pound_risk`: Based on downhole dynacard fillage.

---

### 2.7 Feedback & Recalibration

#### `POST /api/v1/feedback`
Submits real field measurements (actual oil rate, measured temperature, surface card points).

#### `POST /api/v1/recalibrate`
Triggers Bayesian parameter adjustment to minimize sim-to-real gap.

---

### 2.8 Benchmarks & Provenance

#### `GET /api/v1/benchmarks`
Returns performance metrics of the Digital Twin vs standard baseline heuristics.

#### `GET /api/v1/provenance`
Returns audit logs of model versions, input datasets, and validation statuses.
