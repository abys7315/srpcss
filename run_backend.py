"""
Root launcher for PETRO-TWIN FastAPI Backend Server.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.

Usage:
    python run_backend.py
"""
import sys
import os
from pathlib import Path

# Add backend directory and repository root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"

for p in [str(BACKEND_DIR), str(ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

if __name__ == "__main__":
    import uvicorn
    print(f"Starting PETRO-TWIN Backend on http://127.0.0.1:8000 ...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, app_dir=str(BACKEND_DIR))
