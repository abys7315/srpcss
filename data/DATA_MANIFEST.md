# Data Manifest & Provenance Registry — SIH 26120

> **Deployment Disclaimer**: All dataset entries below labeled `SIMULATED`, `ASSUMED`, or `PUBLIC_EXTERNAL` are demonstration / synthetic data. Deployment onto operational Oil India Limited (OIL) assets requires calibration on validated Baghewala field data.

---

## Provenance Taxonomy
- **`REAL`**: Sensor measurements directly recorded from Baghewala wellheads, surface dynamometers, or steam generators.
- **`PUBLIC_EXTERNAL`**: Extracted from published scientific literature, SPE technical papers, or standard physical tables (e.g. NIST steam tables, Andrade parameters).
- **`SIMULATED`**: Generated synthetically by the digital twin physics engine (Marx-Langenheim thermal equations, Gibbs wave SRP simulation).
- **`ASSUMED`**: Standard engineering assumptions and default boundary parameters when field telemetry is unavailable.

---

## Active Dataset Registry

| Dataset ID | Directory Path | Provenance | Source / Reference | Validation Status |
| :--- | :--- | :--- | :--- | :--- |
| `DS-BAGH-001` | `data/external/baghewala_fluid_properties.json` | `PUBLIC_EXTERNAL` | Published literature on Rajasthan extra-heavy oil (SPE-165518 / Petrotech) | Validated against published viscosity curves |
| `DS-BAGH-002` | `data/schemas/well_schema.json` | `ASSUMED` | Typical Baghewala well completion geometry (7" casing, 3.5" tubing) | Schema verification active |
| `DS-BAGH-003` | `data/simulated/baseline_cycle_sim.json` | `SIMULATED` | Physics engine forward run: CSS 3,000 tonnes steam, 4.5 SPM | Simulated baseline only |
| `DS-BAGH-004` | `benchmarks/baseline/standard_cycles.json` | `ASSUMED` | Traditional fixed-schedule operational policy (heuristic) | Industry standard heuristic |

---

## Integrity & Verification Checklist
1. Never commit binary `.csv` / `.parquet` files directly without adding a corresponding hash and entry in this manifest.
2. Every simulation run saved to `data/simulated/` must include a metadata envelope specifying the Git commit hash, model configuration version, and date of simulation.
