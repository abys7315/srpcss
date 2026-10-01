import sys
import os
from pathlib import Path

# Add backend directory and repository root to sys.path so modules like twin, optimizer, app are always resolvable
_backend_dir = Path(__file__).resolve().parent.parent
_root_dir = _backend_dir.parent
for _dir_path in [str(_backend_dir), str(_root_dir)]:
    if _dir_path not in sys.path:
        sys.path.insert(0, _dir_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

try:
    from app.db.init_db import init_db
    from app.api.routes import (
        wells,
        simulation,
        optimization,
        what_if,
        predictions,
        risks,
        feedback,
        benchmarks,
        provenance,
        health,
        recommendations,
        models,
        copilot,
        field_data
    )
except ImportError:
    from .db.init_db import init_db
    from .api.routes import (
        wells,
        simulation,
        optimization,
        what_if,
        predictions,
        risks,
        feedback,
        benchmarks,
        provenance,
        health,
        recommendations,
        models,
        copilot,
        field_data
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables and seed wells
    init_db()
    yield
    # Shutdown logic if any

app = FastAPI(
    title="PETRO-TWIN API",
    description="Physics-Informed, AI-Augmented Digital Twin for Joint CSS+SRP Optimization in Baghewala Heavy Oil Field (SIH 2026, PS26120)",
    version="1.0.0",
    lifespan=lifespan
)

# Robust CORS configuration supporting Vite dev server, preview, and direct browser connections
_default_origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:8000", "http://127.0.0.1:8000",
]
# Comma-separated production origins, for example https://petro-twin.vercel.app.
# Never use '*' while allow_credentials is enabled.
_configured_origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

# Optional extra regex, e.g. to allow Vercel preview deployments:
#   CORS_ORIGIN_REGEX=^https://petro-twin(-[a-z0-9-]+)?\.vercel\.app$
# Keep it anchored and specific; never use a catch-all pattern.
_LOCAL_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
_extra_regex = os.getenv("CORS_ORIGIN_REGEX", "").strip()
_origin_regex = f"(?:{_LOCAL_ORIGIN_REGEX})|(?:{_extra_regex})" if _extra_regex else _LOCAL_ORIGIN_REGEX
_ALLOWED_ORIGINS = _default_origins + _configured_origins


def _origin_allowed(origin: str) -> bool:
    import re
    return bool(origin) and (origin in _ALLOWED_ORIGINS or re.match(_origin_regex, origin) is not None)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optimizer responses carry full Pareto/evaluated-point lists; compress them (big win on Render's egress).
from fastapi.middleware.gzip import GZipMiddleware


class _SelectiveGZip(GZipMiddleware):
    """GZip everything except Server-Sent-Event streams, which must not be buffered."""

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and "/stream/" in scope.get("path", ""):
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


app.add_middleware(_SelectiveGZip, minimum_size=1024)

@app.middleware("http")
async def add_cors_pna_headers(request, call_next):
    # Private Network Access preflight (public page -> localhost). Only answered for allow-listed origins;
    # previously any origin was echoed back with credentials enabled.
    if request.method == "OPTIONS" and request.headers.get("access-control-request-private-network"):
        origin = request.headers.get("origin", "")
        if _origin_allowed(origin):
            from fastapi.responses import Response
            res = Response(status_code=204)
            res.headers["Access-Control-Allow-Origin"] = origin
            res.headers["Access-Control-Allow-Methods"] = "*"
            res.headers["Access-Control-Allow-Headers"] = "*"
            res.headers["Access-Control-Allow-Credentials"] = "true"
            res.headers["Access-Control-Allow-Private-Network"] = "true"
            res.headers["Vary"] = "Origin"
            return res

    res = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true" and _origin_allowed(request.headers.get("origin", "")):
        res.headers["Access-Control-Allow-Private-Network"] = "true"
    return res

# API v1 Router Registration
app.include_router(health.router, prefix="/api/v1")
app.include_router(health.router) # Root /health convenience

@app.head("/health")
@app.head("/api/v1/health")
def head_health():
    return {"status": "HEALTHY"}

app.include_router(wells.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(simulation.router, prefix="/api/v1")
app.include_router(optimization.router, prefix="/api/v1")
app.include_router(what_if.router, prefix="/api/v1")
app.include_router(predictions.router, prefix="/api/v1")
app.include_router(risks.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")
app.include_router(benchmarks.router, prefix="/api/v1")
app.include_router(provenance.router, prefix="/api/v1")
app.include_router(models.router, prefix="/api/v1")
app.include_router(copilot.router, prefix="/api/v1")
app.include_router(field_data.router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "message": "Welcome to PETRO-TWIN API — SIH 2026 (PS26120)",
        "docs_url": "/docs",
        "api_v1": "/api/v1",
        "provenance_disclaimer": "Simulated demonstration data. Calibrated for Baghewala heavy oil reservoir."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, app_dir=str(_backend_dir))
