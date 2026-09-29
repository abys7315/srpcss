@echo off
echo ==============================================================================
echo  PETRO-TWIN — Baghewala Heavy Oil Digital Twin (SIH 2026, PS26120)
echo  Starting FastAPI Backend and Vite Frontend Dev Servers...
echo ==============================================================================

start "PETRO-TWIN Backend (:8000)" cmd /k "python run_backend.py"
start "PETRO-TWIN Frontend (:5173)" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers started!
echo Frontend: http://localhost:5173
echo Backend API Docs: http://localhost:8000/docs
echo Backend Health: http://localhost:8000/api/v1/health
echo.
pause
