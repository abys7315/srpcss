# Data Management & Provenance Protocol — SIH 26120

## 1. Provenance Governance
To maintain full scientific integrity and industrial auditability, all datasets, model inputs, and simulation runs are tagged with a mandatory provenance level:

| Level | Tag | Description | Permitted Usage |
| :--- | :--- | :--- | :--- |
| **Level 1** | `REAL` | Measured field sensor telemetry directly from Baghewala wellheads/SCADA. | Benchmarking & final production calibration. |
| **Level 2** | `PUBLIC_EXTERNAL` | Published literature, SPE benchmark studies, academic physical constants. | Model initialization, validation baselines. |
| **Level 3** | `SIMULATED` | Generated internally by the Digital Twin physics engine. | Optimization, surrogate model training, UI dev. |
| **Level 4** | `ASSUMED` | Default engineering approximations where measurements are absent. | Fallback defaults, initial sandbox testing. |

---

## 2. Baghewala Field Operational Disclaimer
> [!IMPORTANT]
> **Simulated Data Notice**: Unless specifically accompanied by an authenticated `REAL` provenance certificate from Oil India Limited (OIL), all data used in this hackathon project is synthetic or derived from public literature. Any production operational deployment requires formal recalibration with verified telemetry.

---

## 3. Directory Layout
```text
data/
├── raw/                 # Unaltered external telemetry files (gitignored)
├── processed/           # Normalized, cleaned tensors and parquets (gitignored)
├── simulated/           # Digital Twin forward simulation outputs (gitignored)
├── external/            # Published reference tables (e.g. steam tables, ASTM viscosity curves)
├── schemas/             # JSON schemas governing record validity
└── DATA_MANIFEST.md     # Registry tracking every dataset's lineage and hash
```

---

## 4. Schemas
Data schemas in `data/schemas/` enforce strict validation:
1. `well_schema.json`: Static well geometry, casing, tubing, pump depth, reservoir properties.
2. `simulation_input_schema.json`: Input CSS thermal cycle parameters and SRP operational settings.
3. `css_cycle_schema.json`: Multi-day production timeseries, steam injection logs, dynacard traces.
