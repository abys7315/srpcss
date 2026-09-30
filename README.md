# PETRO-TWIN

PETRO-TWIN is a simulated decision-support prototype for cyclic steam stimulation (CSS) and sucker-rod-pump (SRP) operation in a Baghewala heavy-oil reference field. It is not a field-control system and contains no verified Oil India telemetry.

## What is implemented

- First-principles CSS/SRP cycles with IAPWS steam properties, temperature-dependent viscosity, pressure depletion, material balance, VFD kinematics, dynacards, and hard mechanical constraints.
- Joint NSGA-II CSS+SRP optimization, adaptive SRP control, and multi-cycle planning with carried reservoir state.
- FastAPI services for simulations, optimization, provenance, governance, feedback, benchmarks, user-labelled field data, and daily SSE replay.
- A React control-room UI with a cool-neutral, high-contrast theme, data-bound depth track, cycle trace, and calibration workflow.

## Honest data statement

Every reservoir value, production trace, benchmark, ML score, and well state is **simulated, assumed, or public-context derived** unless explicitly labelled otherwise. Ingested observations remain `USER_SUPPLIED`; storing them does not validate them as field measurements. A thermal fit is applied only if it improves a chronological holdout set. This prototype does not authorize equipment operation.

## Run locally

```powershell
python -m pip install -r backend/requirements.txt
python run_backend.py
cd frontend
npm ci
npm run dev
```

Open the Vite address shown in the terminal. API documentation: `http://127.0.0.1:8000/docs`.

## Verify

```powershell
pytest backend/tests -q
cd frontend; npm run build
python scripts/run_benchmark.py
```

The benchmark command regenerates `benchmarks/results/`; checked-in figures are not current until it completes. Compare against a fixed, safety-feasible baseline—not an unsafe heuristic schedule.

## Field-data workflow

1. Open **Well digital twin** and select a well.
2. Add an auditable source label and rows in `day, oil bbl/d, temperature °C, water cut %` format.
3. Store observations; the UI labels them user-supplied.
4. Run thermal calibration. It fits κ on the first 70% of chronological rows and scores the final 30% only.
5. A fit becomes active only when the holdout gate accepts it; **Reset** restores the configured default.

See [API contract](docs/api_contract.md), [physics](docs/physics.md), [optimization](docs/optimization.md), and [model card](docs/model_card.md) for implementation details.

## Project layout

```text
backend/twin/       physics model and calibration
backend/optimizer/  constrained CSS/SRP optimization
backend/app/        API, services, persistence
frontend/           React control-room UI
backend/tests/      physics, optimization, API and ML tests
docs/               architecture, model and API documentation
```
