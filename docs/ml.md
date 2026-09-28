# Machine Learning & AI Augmentation — SIH 26120

## 1. Machine Learning Philosophy
In the SIH 26120 Digital Twin, Machine Learning acts as an **augmentation layer**, not a black-box replacement for physics:
1. **Explainability**: Every ML prediction must have feature attributions and physical bounds.
2. **Residual Correction**: ML models capture complex phenomena not easily resolved in closed-form physics (e.g. non-Newtonian emulsion shear thinning, asphaltene deposition, complex downhole drag).
3. **Safety Primacy**: ML predictions cannot override hard physical constraint boundaries.

---

## 2. Key ML Modules

### 2.1 Residual Error Modeling (`backend/ml/residual_models/`)
The primary predictor follows a hybrid architecture:
$$y(t) = y_{\text{physics}}(t) + \delta_{\text{ML}}(x_t)$$
- $y_{\text{physics}}(t)$: Output from first-principles Marx-Langenheim and SRP Gibbs wave equation.
- $\delta_{\text{ML}}(x_t)$: Trained gradient-boosted tree (XGBoost) or multi-layer perceptron modeling deviations between analytical models and field telemetry.

### 2.2 Dynacard Classification (`backend/ml/dynacard_classification/`)
Dynacards (Surface and Pump Dynamometer Cards) plot load vs position over one pump stroke cycle. The classifier categorizes dynacard patterns:
- `NORMAL_OPERATION`: Full pump fillage, standard traveling/standing valve action.
- `ROD_FLOATING`: Delayed downstroke, bridle separation, low downstroke load.
- `FLUID_POUND`: Partial pump fillage; plunger strikes fluid level during downstroke.
- `GAS_LOCKING`: Delayed valve opening caused by compressible entrained gas.
- `PARTED_ROD`: Complete loss of tension load below the break point.
- `HEAVY_FLUID_DRAG`: Severe elliptical hysteresis loop caused by extreme viscous shear.

### 2.3 Production & Temperature Forecasting (`backend/ml/production_forecasting/`)
Multi-horizon forecasting predicting oil rate, water cut, and bottom-hole temperature over 30 to 180 days following CSS soak completion. Employs quantile regression to produce uncertainty intervals:
$$[\hat{y}_{10\%}, \hat{y}_{50\%}, \hat{y}_{90\%}]$$

### 2.4 Confidence Estimation (`backend/ml/confidence/`)
Every recommendation is scored with a confidence metric $C \in [0.0, 1.0]$ based on:
- Distance to training/calibration distribution (Mahalanobis / Out-of-Distribution score).
- Residual variance from ensemble predictions.
- Data provenance rating of input features.
If $C < \text{threshold}$ (default 0.70), the recommendation is flagged as `LOW_CONFIDENCE`.

### 2.5 Concept & Operational Drift (`backend/ml/drift/`)
Reservoir cooling and depleted steam chambers lead to distribution shifts across subsequent CSS cycles (Cycle 1 vs Cycle 4+). The drift detector tracks feature Kolmogorov-Smirnov statistics to notify operators when recalibration is necessary.
