# PETRO-TWIN

**Problem Statement 26120: Digital Twin for Well-to-Surface Optimization of CSS and SRP Operations for Heavy Oil Wells of Baghewala Field**

PETRO-TWIN is a research and demonstration prototype for integrated cyclic steam stimulation (CSS) and sucker-rod-pump (SRP) analysis. It combines a configurable thermal/reservoir model, wellbore and rod/pump calculations, constrained optimization, a FastAPI service, and a React/Vite operations interface.

> **Data and safety status:** This repository is not connected to Oil India Limited operational systems and is not a field-control system. Default well histories, rates, reservoir properties, predictions, benchmark reports, and recommendations are simulated, assumed, or derived from public context. A value entered by a user is labelled user-supplied; storage does not establish that it is a verified field measurement. Do not use this prototype to actuate equipment or replace qualified engineering review.

## Contents

- [Problem and goals](#problem-and-goals)
- [What the prototype does](#what-the-prototype-does)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API overview](#api-overview)
- [Data, provenance, and calibration](#data-provenance-and-calibration)
- [Tests and development checks](#tests-and-development-checks)
- [Deploy to Vercel and Render](#deploy-to-vercel-and-render)
- [Repository map](#repository-map)
- [Further documentation](#further-documentation)

## Problem and Goals

Baghewala heavy oil is represented by a reference case with low reservoir temperature and pressure, high viscosity, and limited primary oil mobility. CSS adds heat to improve mobility, while SRP provides artificial lift. These operating decisions interact: reservoir cooling can increase viscosity, alter pump fillage and rod loading, raise floating and equipment-risk indicators, and change the value of a CSS schedule.

The project explores an integrated workflow to:

- Evaluate CSS steam volume, injection conditions, soak time, and production cutoff together with SRP stroke, speed, and VFD settings.
- Simulate heating, cooling, viscosity changes, pressure and production response over a cycle.
- Estimate rod/pump operating indicators, including float margin, loading, and mechanical constraint status.
- Compare feasible operating scenarios and optimize economic and production objectives subject to configured limits.
- Present data provenance and uncertainty so generated estimates are not mistaken for field observations.

These are prototype capabilities, not claims of field-validated performance. The current configuration is a simulated Baghewala reference case, not a calibrated copy of an operating well.

## What the Prototype Does

### Simulation and engineering models

- Calculates CSS cycle response using thermal, fluid, reservoir, and production models. Steam properties use IAPWS-IF97; oil viscosity varies with temperature.
- Represents wellbore heat transfer and pressure behavior, SRP kinematics, rod loading, dynacard-related indicators, and float detection.
- Carries selected reservoir state between cycles for multi-cycle planning.
- Applies mechanical and operating constraints during scenario evaluation. Constraints are software checks against configured assumptions and are not a substitute for certified equipment limits.

### Optimization and diagnostics

- Jointly searches CSS and SRP settings with a multi-objective NSGA-II optimizer.
- Provides separate CSS, SRP, and multi-cycle optimization paths, plus what-if scenario comparisons.
- Supports asynchronous joint optimization for longer requests. Start a job with `POST /api/v1/optimize/joint/jobs`, then poll `GET /api/v1/optimize/jobs/{job_id}`.
- Provides prediction, anomaly, risk, benchmark, and provenance interfaces where data and model components are available.

### User interface

The React application includes a command center, well digital twin, CSS and SRP optimizers, joint optimization, what-if simulation, predictions, economics, risk/integrity, model registry, benchmarks, and data provenance views. It calls the FastAPI backend; when the API cannot be reached, the UI may display an explicitly labelled simulated demo fallback.

## Architecture

```text
Browser
  |
  +-- Vercel: React + Vite static frontend
          |
          +-- HTTPS JSON/SSE requests --> Render: FastAPI backend
                                                |
                                                +-- PostgreSQL for persistent deployment
                                                +-- CSS/SRP twin, constraints, optimizers, ML interfaces
```

| Area | Location | Responsibility |
|---|---|---|
| Frontend | `frontend/` | React interface, API client, page workflows, Vercel SPA routing. |
| API | `backend/app/` | FastAPI endpoints, request/response schemas, persistence, and service orchestration. |
| Physics twin | `backend/twin/` | CSS cycle, fluids, reservoir, thermal, wellbore, surface, SRP, and calibration. |
| Optimization | `backend/optimizer/` | CSS, SRP, joint, adaptive, and multi-cycle search. |
| Safety/economics | `backend/constraints/`, `backend/economics/` | Feasibility checks and net-benefit calculations. |
| Configuration | `configs/` | Canonical field, physics, optimization, ML, and economics assumptions. |
| Tests | `backend/tests/` | API, physics, optimization, benchmark, and ML contract checks. |
| Deploy | `render.yaml`, `frontend/vercel.json` | Render API service and Vercel SPA routing configuration. |

## Quick Start

### Requirements

- Python 3.11 is the version used by backend CI and the Render Blueprint. Use a supported Python 3.10+ interpreter for local work.
- Node.js 22.12 or newer for Vite 8. The frontend workflow checks Node 22 and 24.
- npm, included with Node.js.

### Install and start the backend

From the repository root, create and activate a virtual environment, then install the backend requirements:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python run_backend.py
```

On macOS/Linux, activate with `source .venv/bin/activate`. Keep the backend running in this terminal. By default the API listens on port `8000`.

### Install and start the frontend

Open a second terminal from the repository root:

```powershell
Push-Location frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173/`. The development server proxies `/api` requests to `http://127.0.0.1:8000`. The API documentation is at `http://127.0.0.1:8000/docs`; health checks are available at `/health` and `/api/v1/health`.

Stop each development server with `Ctrl+C`. For separate shells, `cd frontend` can be used instead of `Push-Location`.

## Configuration

The backend reads configuration from the YAML files under `configs/` and from process environment variables. Set environment values in your shell or hosting provider dashboard; do not assume a local `.env` file is loaded automatically.

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | SQLAlchemy connection. Without it, the application falls back to local SQLite; use managed PostgreSQL for deployed persistent data. |
| `CORS_ORIGINS` | Backend | Comma-separated browser origins, for example `https://your-app.vercel.app,https://app.example.com`. Do not use JSON brackets or include paths/trailing slashes. |
| `VITE_API_URL` | Frontend build | Optional backend origin, such as `https://your-api.onrender.com`. The client adds `/api/v1`. Set it in Vercel before building. |
| `GEMINI_API_KEY` | Backend only | Optional server-side Gemini provider for Copilot functionality. |
| `GROQ_API_KEY` | Backend only | Optional server-side Groq provider for Copilot functionality. |

Never put provider credentials in `VITE_*` variables: those values are shipped to the browser. See [.env.example](.env.example) and [frontend/.env.example](frontend/.env.example) for templates.

## API Overview

The API base path is `/api/v1`. Successful responses generally wrap payloads in the project's standard response envelope; inspect the OpenAPI page at `/docs` for current schemas and request fields.

| Capability | Method and path |
|---|---|
| Health check | `GET /health` or `GET /api/v1/health` |
| List wells / inspect one | `GET /api/v1/wells`, `GET /api/v1/wells/{well_id}` |
| Run a CSS/SRP cycle | `POST /api/v1/simulate` |
| Compare what-if cases | `POST /api/v1/what-if` |
| Optimize joint CSS/SRP settings | `POST /api/v1/optimize/joint` |
| Start/poll a joint optimization job | `POST /api/v1/optimize/joint/jobs`, `GET /api/v1/optimize/jobs/{job_id}` |
| Run focused/multi-cycle optimization | `POST /api/v1/optimize/css`, `/srp`, or `/multicycle` |
| Submit feedback / request recalibration | `POST /api/v1/feedback`, `POST /api/v1/recalibrate` |
| Ingest/list/delete observations | `POST /api/v1/telemetry/ingest`, `GET` or `DELETE /api/v1/telemetry/{well_id}` |
| Fit/reset thermal calibration | `POST /api/v1/calibrate/thermal`, `GET` or `DELETE /api/v1/calibrate/thermal/{well_id}` |
| Stream a simulated cycle | `GET /api/v1/stream/{well_id}?speed=10` (Server-Sent Events) |

For detailed payloads and behavior, see the [API contract](docs/api_contract.md). The contract document may lag the implementation; `/docs` generated by the running application is the authoritative live schema reference.

## Data, Provenance, and Calibration

- Seed wells and generated benchmark outputs are simulated. The canonical assumptions live in `configs/field.yaml`, `configs/physics.yaml`, and related configuration files.
- User observations require a source label and are stored as `USER_SUPPLIED`. That label records origin only; it does not verify accuracy, ownership, representativeness, or permission to use the data.
- Thermal calibration uses chronologically sorted observations, fits on the first 70%, and evaluates on the remaining 30%. It is accepted only if held-out error improves by the configured threshold and the fitted parameter does not land on a search bound. Otherwise the configured default remains active.
- Residual-model recalibration also has an explicit minimum sample and held-out promotion gate. A request can correctly return an insufficient-data or rejected-challenger status; recalibration is not guaranteed to improve a model.
- Benchmark scripts may regenerate checked-in report files. Review generated differences and provenance before publishing benchmark results.
- Do not upload private, regulated, or operational data until data handling, retention, access control, and validation requirements are approved.

The prototype has no SCADA connector and makes no autonomous control changes. All settings and outputs require review by qualified petroleum, production, and facilities engineers before any operational use.

## Tests and Development Checks

From the repository root:

```powershell
python -m pytest backend/tests -q
Push-Location frontend
npm ci
npm run lint
npm run build
Pop-Location
```

The backend GitHub workflow runs the pytest suite with coverage and a focused Ruff correctness check. The frontend workflow runs Oxlint and the Vite/TypeScript production build on supported Node versions. Oxlint may report warnings while exiting successfully; review warnings separately from CI failures.

To regenerate benchmark outputs, run:

```powershell
python scripts/run_benchmark.py
```

This command can overwrite files under `benchmarks/results/`; inspect the output before committing it. For physics assumptions, optimizer objective details, and model limitations, use the references below.

## Deploy to Vercel and Render

1. Deploy `backend/` as a Render Web Service using the root [render.yaml](render.yaml). Configure a persistent Render PostgreSQL database and set `DATABASE_URL`.
2. Deploy `frontend/` as a Vercel project with root directory `frontend`, build command `npm run build`, and output directory `dist`.
3. Set Vercel's `VITE_API_URL` to the Render API origin. Set Render's `CORS_ORIGINS` to the exact Vercel production origin, then redeploy Render.
4. Verify the API at `https://<your-render-service>.onrender.com/health` and load the Vercel UI.

The existing cron ping target is `GET https://<your-render-service>.onrender.com/health`. It checks/wakes the service; it does not run an optimizer or change data. Replace the placeholder with the public service URL shown in Render. Ping schedules may use service hours and do not eliminate cold starts on a suspended plan.

See the [Vercel + Render deployment guide](docs/deployment.md) for step-by-step configuration, environment variables, CORS troubleshooting, health checks, persistent storage, and release verification.

## Repository Map

```text
backend/
  app/                 FastAPI routes, schemas, persistence, and services
  constraints/         Hard and soft operating constraints
  core/                Canonical configuration loading
  economics/           Net-benefit and economic objective calculations
  ml/                  Prediction, classification, confidence, and drift components
  optimizer/           CSS, SRP, joint, and multi-cycle optimizers
  tests/               API, physics, optimization, ML, and benchmark tests
  twin/                Reservoir, thermal, wellbore, fluid, surface, and SRP models
configs/               Field, physics, economics, optimization, and ML settings
data/                  Data manifest, schemas, and simulated/reference datasets
docs/                  Architecture, API, safety, physics, optimization, and deployment docs
frontend/              React + TypeScript + Vite application
scripts/               Simulation, benchmark, synthetic-data, and verification tools
```

## Further Documentation

- [Deployment guide](docs/deployment.md)
- [Architecture](docs/architecture.md)
- [API contract](docs/api_contract.md)
- [Physics assumptions](docs/physics.md)
- [Optimization approach](docs/optimization.md)
- [Safety and limitations](docs/safety.md)
- [Model card](docs/model_card.md)
- [Data manifest](data/DATA_MANIFEST.md)
