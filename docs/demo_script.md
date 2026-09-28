# PETRO-TWIN: 7-Minute Hackathon Demo Script (SIH 2026, PS26120)

**Problem Statement:** Digital Twin for Well-to-Surface Optimization of CSS and SRP Operations for Heavy Oil Wells of Baghewala Field (Oil India Limited).

---

## Demo Timing & Walkthrough

| Minute | Screen / Feature | Key Actions & Speaking Points |
| :--- | :--- | :--- |
| **0:00 – 1:00** | **Command Center** (`/`) | • **Introduce Problem:** Baghewala field heavy oil (17–19° API, 1,200 cP viscosity).<br>• Show fleet table of 10 wells with real-time telemetry, KPIs, and status badges.<br>• Highlight strict data provenance badge (`SIMULATED` / `PUBLIC_EXTERNAL`) and mandatory Oil India disclaimer. |
| **1:00 – 2:15** | **Digital Twin & Cooling Anomaly** (`/digital-twin`) | • Select well `BGW-01`.<br>• Point out 2D Wellbore Schematic: Casing, Tubing, API 76 Taper Rods, and heated radial zone ($R_h$).<br>• **Trigger Seeded Cooling Event:** Slide cooling anomaly to Day 35.<br>• Watch bottomhole temperature drop ($121^\circ\text{C} \to 47^\circ\text{C}$) and viscosity skyrocket to 4,497 cP.<br>• **The Danger Emerges:** Float Margin Index crashes below 1.000 ($M_{float} = 0.599$). Dynacard shows severe carrier bar separation and impact shocks.<br>• Full 8-part industrial early warning banner pops up with exact root cause and proof! |
| **2:15 – 3:30** | **5-Column What-If Sandbox** (`/what-if`) | • Click **"Launch What-If Sandbox"**.<br>• Show 5 simultaneous side-by-side columns: **CURRENT | SCENARIO A | SCENARIO B | SCENARIO C | RECOMMENDED**.<br>• **Show Engineering Honesty:** Point out that Scenario A (Aggressive 6.5 SPM) is strictly tagged **`INFEASIBLE`** and blocked because it causes 14 catastrophic rod floating events.<br>• Highlight Recommended scenario with green border: $M_{float} \ge 1.05$, Net Benefit $+44.8\%$. |
| **3:30 – 4:45** | **Joint Pareto Optimizer** (`/joint-optimizer`) | • Show the bi-level Pareto frontier scatter plot (SOR vs Net Benefit $USD).<br>• Adjust multi-objective sliders (Net Benefit, SOR, Energy Intensity, Risk).<br>• Observe real-time Pareto selection and decision mode: **`AUTONOMOUS_SETPOINT`** (Confidence: 84.3%).<br>• Explain the physics cure: By applying **VFD downstroke shaping ($\alpha_{down} = 0.75$)**, the rod string has time to sink through cold heavy crude without floating!<br>• Click **"Apply Setpoint to Well"**. |
| **4:45 – 5:45** | **Closed-Loop Feedback & Recalibration** (`/feedback`) | • Operator enters field gauge reading: Observed 29.5 bpd at Day 45.<br>• System detects systematic model drift via Kolmogorov-Smirnov statistical test ($p = 0.012 < 0.05$).<br>• Click **"1-Click Online Recalibrate"**.<br>• System retrains residual LightGBM corrector and confirms: **MAE drops from 34.1 bpd to < 4.0 bpd (>20% error drop requirement met, drift cleared)**.<br>• Version incremented to `v1.0.1` in the audit log. |
| **5:45 – 6:30** | **Benchmarks & Ablation Study** (`/benchmarks`) | • Show empirical proof of value table:<br>  - Net Economic Benefit: **+$56,800/cycle (+44.8%)**<br>  - Steam-Oil Ratio: **-13.3%**<br>  - Rod Floating Events: **8 $\to$ 0 (100% eliminated)**.<br>• **4-Variant Ablation Table:** Show why Pure ML fails (it recommends unfeasible high SPM, destroying rods), and why Petro-Twin's physics-informed approach wins. |
| **6:30 – 7:00** | **Data Provenance & OIL Roadmap** (`/provenance`) | • Show complete audit manifest table with all academic citations (SPE-165448, Marx-Langenheim 1959, API Spec 11B/11E).<br>• Conclude with Oil India integration roadmap (OPC UA, Edge VFD control, ISA/IEC 62443 security). |

---

## Backup / Emergency Commands
- Run backend locally: `python -m uvicorn app.main:app --app-dir backend --port 8000`
- Run frontend locally: `cd frontend && npm run dev`
- Run automated 21-step acceptance test: `python scripts/verify_end_to_end_acceptance.py`
