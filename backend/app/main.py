"""
PETRO-TWIN — Digital Twin API Application.
Smart India Hackathon 2026 — Problem Statement 26120.
Oil India Limited (Baghewala Field CSS + SRP Optimization).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

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
    health
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

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 Router Registration
app.include_router(health.router, prefix="/api/v1")
app.include_router(health.router) # Root /health convenience
app.include_router(wells.router, prefix="/api/v1")
app.include_router(simulation.router, prefix="/api/v1")
app.include_router(optimization.router, prefix="/api/v1")
app.include_router(what_if.router, prefix="/api/v1")
app.include_router(predictions.router, prefix="/api/v1")
app.include_router(risks.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")
app.include_router(benchmarks.router, prefix="/api/v1")
app.include_router(provenance.router, prefix="/api/v1")

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
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
