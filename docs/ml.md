# Machine Learning & AI Augmentation — SIH 26120

## 1. Machine Learning Philosophy
In the SIH 26120 Digital Twin, Machine Learning acts as an **augmentation layer**, not a black-box replacement for physics:
1. **Explainability**: Every ML prediction must have feature attributions and physical bounds.
2. **Residual Correction**: ML models capture complex phenomena not easily resolved in closed-form physics (e.g. non-Newtonian emulsion shear thinning, asphaltene deposition, complex downhole drag).
3. **Safety Primacy**: ML predictions cannot override hard physical constraint boundaries.

---

## 2. Key ML Modules

### 2.1 Residual Error Modeling (`backend/ml/residual_models/`)
The primary predictor follows a hybrid physics + ML architecture:
$$y(t) = y_{\text{physics}}(t) + \delta_{\text{ML}}(x_t)$$
- $y_{\text{physics}}(t)$: Output from first-principles Marx-Langenheim thermal decline and SRP mechanics.
- $\delta_{\text{ML}}(x_t)$: Histogram Gradient Boosting residual corrector (`HistGradientBoostingRegressor`) modeling deviations between analytical physics and observed telemetry. When untrained or when observations are unavailable, system explicitly flags `model_type = PHYSICS_FALLBACK`.

### 2.2 Dynacard Classification (`backend/ml/dynacard_classification/`)
Dynacards (Surface and Pump Dynamometer Cards) plot load vs position over one pump stroke cycle. The classifier categorizes dynacard patterns:
- `NORMAL_OPERATION`: Full pump fillage, standard traveling/standing valve action.
- `ROD_FLOATING`: Delayed downstroke, bridle separation, low downstroke load.
- `FLUID_POUND`: Partial pump fillage; plunger strikes fluid level during downstroke.
- `GAS_LOCKING`: Delayed valve opening caused by compressible entrained gas.
- `PARTED_ROD`: Complete loss of tension load below the break point.
- `HEAVY_FLUID_DRAG`: Severe elliptical hysteresis loop caused by extreme viscous shear.

### 2.3 Production & Temperature Forecasting (`backend/ml/production_forecasting/`)
Multi-horizon forecasting predicting oil rate, water cut, and bottom-hole temperature over 30 to 180 days following CSS soak completion. Quantile bounds $[p_{10}, p_{50}, p_{90}]$ represent empirical uncertainty intervals.

### 2.4 Confidence Estimation (`backend/ml/confidence/`)
Every recommendation is scored with a candidate-specific multi-factor confidence metric $C \in [0.0, 1.0]$ integrating:
- Prediction uncertainty
- Historical validation error
- Out-of-Distribution (OOD) distance
- Data provenance rating
- Physical constraint margin

If $C < 0.60$, the recommendation is flagged as `LOW_CONFIDENCE` with an operator warning.

### 2.5 Model Registry & Champion/Challenger Recalibration (`backend/ml/registry/`)
Models are governed under strict MLOps lifecycle policies:
- Real cryptographic SHA-256 dataset and artifact hashing (`compute_sha256()`).
- Explicit train/validation splitting: a challenger model is promoted to `CHAMPION` only if its held-out validation MAE demonstrates a statistically significant improvement over the current champion.
- Complete rollback capability (`rollback_champion()`) if field drift or performance degradation is detected.

