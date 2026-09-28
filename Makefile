.PHONY: help install-backend install-frontend install-all test-backend test-frontend test lint format docker-up docker-down generate-data run-sim

help:
	@echo "SIH 26120 — Digital Twin for CSS & SRP Operations (Baghewala Field)"
	@echo "Available make commands:"
	@echo "  make install-backend    - Install Python dependencies"
	@echo "  make install-frontend   - Install NPM dependencies for React"
	@echo "  make install-all        - Install both backend and frontend dependencies"
	@echo "  make test-backend       - Run backend pytest suite"
	@echo "  make test-frontend      - Run frontend test suite"
	@echo "  make test               - Run all test suites"
	@echo "  make lint               - Run flake8 / ruff and eslint"
	@echo "  make format             - Format python (black/ruff) and frontend code"
	@echo "  make dev-backend        - Run FastAPI development server with uvicorn"
	@echo "  make dev-frontend       - Run Vite development server"
	@echo "  make docker-up          - Start backend, frontend, and postgres in Docker"
	@echo "  make docker-down        - Stop all Docker services"
	@echo "  make generate-data      - Run synthetic data generation script"
	@echo "  make run-sim            - Run placeholder simulation pipeline verification"

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

install-all: install-backend install-frontend

test-backend:
	cd backend && pytest tests/ -v

test-frontend:
	cd frontend && npm test

test: test-backend test-frontend

lint:
	cd backend && ruff check . || flake8 .
	cd frontend && npm run lint || true

format:
	cd backend && black . || true
	cd frontend && npm run format || true

dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

docker-up:
	docker-compose up --build -d

docker-down:
	docker-compose down

generate-data:
	python scripts/generate_synthetic_data.py

run-sim:
	python scripts/run_simulation.py
