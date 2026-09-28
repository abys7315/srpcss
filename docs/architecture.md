# System Architecture — SIH 26120 Digital Twin

## 1. Overview
The Digital Twin for Well-to-Surface Optimization of Cyclic Steam Stimulation (CSS) and Sucker Rod Pump (SRP) Operations for Heavy Oil Wells of Baghewala Field is an integrated, physics-informed decision support platform.

Baghewala crude is an extra-heavy oil characterized by extremely low API gravity (~6–8° API), very high viscosity at reservoir temperature (>10,000 cP at initial conditions), and significant asphaltic content. Heavy oil extraction requires thermal stimulation (CSS) to reduce viscosity, coupled with mechanical lifting (SRP) carefully managed to prevent rod floating, fluid pound, and mechanical fatigue.

The system connects six interconnected physical and economic domains:
$$\text{Reservoir} \longrightarrow \text{CSS Injection} \longrightarrow \text{Wellbore Dynamics} \longrightarrow \text{SRP Dynamics} \longrightarrow \text{Surface Facilities} \longrightarrow \text{Field Economics}$$

---

## 2. Layered Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer (Frontend)                   │
│   • Command Center Dashboard    • Digital Twin Visualizer (3D/2D)      │
│   • CSS / SRP / Joint Optimizer • What-If Scenario Sandbox             │
│   • Dynacard Diagnostic Suite   • Economics & Provenance Audit         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API / WebSocket
┌───────────────────────────────────▼────────────────────────────────────┐
│                         FastAPI Gateway & Core                         │
│   • Request Validation (Pydantic v2) • Authentication & Role Control   │
│   • Provenance Enforcement & Logging • Exception Handlers              │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │                                        │
┌───────────────▼────────────────┐      ┌────────────────▼───────────────┐
│     Physics Digital Twin       │      │       ML & Surrogate Layer     │
│ • CSS Thermal Reservoir Model  │      │ • Physics-Guided Forecaster    │
│ • Viscosity-Temperature Model  │      │ • Dynacard Fault Classifier    │
│ • Wellbore Heat & Hydraulics   │◄────►│ • Hybrid Residual Corrector    │
│ • SRP Dynamics (Gibbs Equation)│      │ • Rod Float & Anomaly Detector │
│ • Surface Steam & Flowlines    │      │ • Conformal Confidence Engine  │
└───────────────┬────────────────┘      └────────────────┬───────────────┘
                │                                        │
                └───────────────────┬────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Constraint & Safety Engine                          │
│   • Formation Fracture Pressure Limit  • Casing Thermal Stress Limit   │
│   • Rod String Goodman Fatigue Limit   • Sucker Rod Float Margin Check │
│   • Surface Gearbox Peak Torque Rating • Motor Thermal Overload Check  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                   Multi-Objective Optimization Engine                  │
│   • NSGA-II / Pareto Front Generation  • Dynamic Cycle Cutoff          │
│   • Steam-Oil Ratio (SOR) Minimizer    • Net Present Value Maximizer   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Field Economics & Decision Support                  │
│   • OPEX Breakdown (Steam, Power, Chem) • Net Benefit Calculation      │
│   • Explainability & Rationale Log      • Operator Confidence Scoring  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                   Feedback & Recalibration Engine                      │
│   • Real Telemetry Ingestion (SCADA)   • Model Drift Monitoring        │
│   • Parameter Bayesian Recalibration   • Provenance Verification Tag   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Breakdown

### 3.1 Digital Twin Engine (`backend/twin/`)
The physics engine operates strictly on first-principles physics equations and is decoupled from machine learning:
- **Thermal Reservoir Model (`thermal/`)**: Marx-Langenheim / Boberg-Lantz model for steam chamber growth, heated zone radius $r_h(t)$, and conductive/convective heat losses to caprock and baserock.
- **Fluid Viscosity Model (`fluid/`)**: Andrade / Walther temperature-viscosity relationship calibrated for Baghewala heavy oil, calculating exponential viscosity drop from $10^4\text{ cP}$ at $30^\circ\text{C}$ to $<50\text{ cP}$ at steam temperatures ($>200^\circ\text{C}$).
- **Wellbore Heat Transfer & Hydraulics (`wellbore/`)**: Multiphase pressure drop and enthalpy loss during steam injection down the tubing string and subsequent production up the annulus/tubing.
- **SRP Mechanical System (`srp/`)**: Solves the damped 1D Gibbs wave equation along the rod string to compute polished rod loads, downhole pump card, fluid fillage, and valve drag forces to evaluate rod floating during the downstroke.
- **Surface Systems (`surface/`)**: Steam generator boiler efficiency, steam quality ($x \ge 0.8$), fuel consumption, and surface flowline heat dissipation.

### 3.2 Machine Learning & Hybrid Residuals (`backend/ml/`)
ML augments the physics engine:
- **Residual Correction**: $y(t) = y_{\text{physics}}(t) + \delta_{\text{ML}}(t)$ where ML models unmodeled phenomena (asphaltene precipitation, emulsion slip).
- **Dynacard Classification**: Pattern recognition on surface and pump dynamometer cards to diagnose conditions (fluid pound, gas locking, unanchored tubing, friction).
- **Risk & Anomaly Detection**: Early warning system for rod floating, motor stall, and thermal casing integrity breaches.
- **Confidence Estimation**: Computes predictive uncertainty intervals to inform operators when model predictions lack historical support.

### 3.3 Constraint & Safety Engine (`backend/constraints/`)
Ensures no operational recommendation exceeds physical or mechanical thresholds. Solutions with constraint violations are labeled `INFEASIBLE` and cannot be marked `RECOMMENDED`.

### 3.4 Optimization Engine (`backend/optimizer/`)
Provides standalone and joint optimization:
1. **CSS Optimization**: Injected steam volume ($m^3$), injection pressure, soak period (days), and production cutoff timing.
2. **SRP Optimization**: Strokes per minute (SPM), stroke length, and variable frequency drive (VFD) profile.
3. **Joint Optimization**: Co-optimizes the thermal cycle with the lift profile to maximize Net Present Value (NPV) while minimizing Steam-Oil Ratio (SOR).

### 3.5 Operator Feedback & Recalibration (`backend/app/services/feedback_service.py`)
Closes the loop by receiving actual operator measurements, comparing simulated vs actual performance, and triggering Bayesian recalibration of reservoir and pump parameters.
