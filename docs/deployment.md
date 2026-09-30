# Production Deployment: Vercel + Render

PETRO-TWIN is one GitHub repository with two hosted services:

```text
Browser -> Vercel static React app -> HTTPS -> Render FastAPI -> Render PostgreSQL
```

Vercel builds only `frontend/`. Render runs the API from `backend/`. The checked-in [render.yaml](../render.yaml) and [frontend/vercel.json](../frontend/vercel.json) provide the service and SPA routing configuration.

## Before You Start

- Push the source branch to GitHub and confirm the latest commit is on the branch you will deploy.
- Have access to the same GitHub repository in Vercel and Render.
- Choose a Vercel project name first; its production origin will be `https://<project-name>.vercel.app` unless you add a custom domain.
- Plan for a persistent PostgreSQL database. The application can run on local SQLite, but a Render web service's local filesystem is not durable storage.
- Treat all current wells, production history, and benchmark output as simulated unless separately validated. Deployment does not make the included data real field measurements.

## 1. Create the Render Database

1. In Render, create a **PostgreSQL** database in the same region as the API web service.
2. Choose a plan with persistence and retention appropriate for the data you will collect. Review Render's current plan and expiry limits; do not assume an evaluation database is a permanent production store.
3. After creation, copy the database's **internal connection string**. Keep it private; it grants database access.

## 2. Deploy the API on Render

1. In Render, choose **New > Blueprint**, connect the GitHub repository, and select the branch to deploy. Render reads the root [render.yaml](../render.yaml).
2. Set the Blueprint's `DATABASE_URL` to the internal URL copied above.
3. Set `CORS_ORIGINS` to the Vercel production origin if known, for example `https://petro-twin.vercel.app`. If the final Vercel URL is not known yet, set it after creating the Vercel project and redeploy the API.
4. Create and deploy the `petro-twin-api` web service. Its important settings are:

   | Setting | Value |
   |---|---|
   | Root directory | `backend` |
   | Runtime | Python 3.11.9 (set by `render.yaml`) |
   | Build command | `pip install -r requirements.txt` |
   | Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | Health check path | `/health` |

5. Wait for Render to report **Live**. Copy the service's public HTTPS URL, such as `https://petro-twin-api.onrender.com`, and verify:

   ```text
   https://YOUR-RENDER-SERVICE.onrender.com/health
   https://YOUR-RENDER-SERVICE.onrender.com/api/v1/health
   ```

Both health endpoints should return HTTP 200. `/docs` provides the interactive API reference; restrict or disable public API documentation if that is not appropriate for your deployment.

### Render environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes for persistent deployment | Render PostgreSQL internal connection string. |
| `CORS_ORIGINS` | Yes for browser access | Comma-separated exact origins, such as `https://petro-twin.vercel.app,https://app.example.com`; no paths or trailing slash. |
| `GEMINI_API_KEY` | Optional | Backend-only Gemini integration for Copilot. |
| `GROQ_API_KEY` | Optional | Backend-only Groq integration for Copilot. |

Add optional provider keys in the Render service dashboard only when needed. Never put them in Vercel or in a `VITE_*` variable; frontend-prefixed values are included in browser assets.

## 3. Deploy the Frontend on Vercel

1. In Vercel, choose **Add New > Project**, import the same GitHub repository, and set **Root Directory** to `frontend`.
2. Use these project build settings:

   | Setting | Value |
   |---|---|
   | Framework preset | Vite |
   | Install command | `npm ci` |
   | Build command | `npm run build` |
   | Output directory | `dist` |
   | Node.js version | `22.x` or newer (Vite 8 requires Node `^20.19.0` or `>=22.12.0`) |

   `frontend/package.json` declares Node `>=22.12.0`; the GitHub workflow checks Node 22 and 24.

3. Add this environment variable under **Settings > Environment Variables** for Production:

   ```text
   VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
   ```

   Use the Render service's origin only: no `/api/v1` suffix and no trailing slash. The client appends `/api/v1`. Set the same variable for Preview only if preview builds should call this API. Vite embeds it at build time, so redeploy after changing it.

4. Deploy the project. `frontend/vercel.json` rewrites client-side routes to `index.html`, so refreshing a nested page continues to serve the React app.
5. Copy the deployed Vercel origin into Render's `CORS_ORIGINS`. Include any custom production domain as another comma-separated origin, then redeploy the Render service.

## 4. Verify the Deployment

1. Open the Vercel production URL. The well selector should populate from the Render API; the UI should not display the “Backend data unavailable” banner.
2. Open browser developer tools and check the Network tab for successful requests to `https://YOUR-RENDER-SERVICE.onrender.com/api/v1/...` and for absence of CORS errors.
3. Run a non-destructive simulation from the UI and confirm the response appears.
4. For long joint optimizations, submit `POST /api/v1/optimize/joint/jobs`, then poll `GET /api/v1/optimize/jobs/{job_id}` rather than holding a single HTTP request open.
5. Confirm Render is connected to PostgreSQL and verify its backup/retention settings before collecting user-supplied observations.

### Optional Cron Health Ping

The API already exposes a public, unauthenticated `GET /health` endpoint. Use the deployed Render service URL shown on its dashboard and append `/health` as your cron target:

```text
https://<your-render-service>.onrender.com/health
```

For example, if Render assigns `https://petro-twin-api.onrender.com`, use [https://petro-twin-api.onrender.com/health](https://petro-twin-api.onrender.com/health). A successful request returns HTTP 200 and JSON containing `"status": "HEALTHY"`. Do not add `/api/v1` to this URL.

Configure the cron to make a plain `GET` request. If you create a Render Cron Job service instead of using an external scheduler, its command can be:

```sh
curl --fail --silent --show-error "${API_BASE_URL}/health"
```

Set `API_BASE_URL` on that Cron Job to the Render API's public origin (without a trailing slash). This only checks/wakes the API; it does not run an optimization or change well data. Requests may incur usage, and scheduled pings do not guarantee that a suspended/free service has no cold start. Use an always-on web-service plan if immediate availability is required.

## Local Checks Before Deploying

Run from the repository root:

```powershell
python -m pytest backend/tests -q
Push-Location frontend
npm ci
npm run lint
npm run build
Pop-Location
```

The GitHub Actions workflows run the backend suite and frontend lint/build checks. A green build is not a validation of reservoir parameters or a substitute for review against approved field data.

## Troubleshooting

| Symptom | Checks and fix |
|---|---|
| Vercel shows “Backend data unavailable” | Confirm `VITE_API_URL` is the Render HTTPS origin, set it for the correct Vercel environment, and redeploy. |
| Browser reports CORS | Set Render `CORS_ORIGINS` to the exact Vercel origin including `https://`, with no path or trailing slash; comma-separate additional origins and redeploy Render. |
| Render returns 404 for `/health` | Confirm the service was created from `render.yaml`, its root is `backend`, and the health-check path is `/health`. |
| Render cannot import `app` | Keep root directory `backend` and start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. |
| Data disappears after a deploy/restart | Set `DATABASE_URL` to Render PostgreSQL; SQLite in the service filesystem is not persistent production storage. |
| Vercel build reports unsupported Node | Select Node 22.x or newer (22.12+); redeploy after changing the project setting. |
| First request after idle is slow | The selected Render plan may suspend idle services. Wait for the health check to recover and retry; use an always-on plan if the workflow requires immediate responses. |
| Optimization request times out | Use the asynchronous joint-optimization job endpoints and poll for progress/result. |

## Data and Operational Limits

- The shipped wells and benchmark data are simulated. Keep the UI's simulation/provenance labels visible and do not present generated values as measured Oil India data.
- Do not connect the prototype directly to control equipment. Recommendations require qualified engineering review and independent safety validation.
- Back up PostgreSQL and test restoring it. The application initializes tables on startup but does not provide a general schema migration system; review model/schema changes before applying them to an existing production database.
- Use HTTPS for public endpoints and keep database/provider credentials only in Render's server-side environment.

## Platform References

- [Render FastAPI deployment](https://render.com/docs/deploy-fastapi)
- [Render web services](https://render.com/docs/web-services)
- [Render PostgreSQL](https://render.com/docs/databases)
- [Vercel Vite deployments](https://vercel.com/docs/frameworks/frontend/vite)
