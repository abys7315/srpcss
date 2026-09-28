# Model Card — SIH 26120 Digital Twin & AI Optimizers

## Model Details
- **Developer**: SIH 26120 Technical Team
- **Model Date**: September 2026
- **Model Type**: Hybrid Physics-Informed Digital Twin (Analytical Thermal Reservoir + 1D Damped Wave Mechanical SRP) augmented with Gradient Boosted Trees and Conformal Uncertainty Estimation.
- **Problem Statement**: Smart India Hackathon 2026 — PS 26120.

---

## Intended Use
- **Primary Use**: Operator decision support for Cyclic Steam Stimulation (CSS) and Sucker Rod Pump (SRP) scheduling in heavy oil fields (specifically tailored to Baghewala reservoir physics).
- **Users**: Reservoir engineers, production optimization engineers, field superintendents.
- **Decision Mode**: Advisory only. All recommendations require engineer review and manual approval before field actuation.

---

## Out-of-Scope & Misuse
- **Closed-Loop Actuation**: The model is NOT certified for autonomous closed-loop control of wellhead valves or surface motor drives without operator sign-off.
- **Conventional Reservoirs**: Not calibrated for light oil reservoirs (<25° API) or gas condensate fields where thermal stimulation physics do not apply.
- **Uncalibrated Production Actuation**: Operating recommendations must not be executed without field calibration against historical well records.

---

## Factors & Subpopulations
- **Thermal Cycles**: Performance varies across cycle sequence ($N=1$ initial steam soak vs $N \ge 4$ depleted thermal chambers).
- **Viscosity Regimes**: Model validity spans temperatures between $30^\circ\text{C}$ ($>10^4\text{ cP}$) and $300^\circ\text{C}$ ($<10\text{ cP}$).

---

## Environmental & Safety Impact
Optimizing the Steam-Oil Ratio (SOR) directly decreases natural gas / fuel consumption at steam generators (OTSG), leading to measurable reductions in Scope 1 greenhouse gas emissions per barrel of heavy oil produced.
