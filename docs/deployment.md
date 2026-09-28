# Deployment Architecture — SIH 26120

## 1. Overview
The SIH 26120 system is designed for flexible deployment across edge field computers, private enterprise clouds (e.g. ONGC/OIL data centers), or standard Dockerized Linux servers.

---

## 2. Containerized Deployment (Docker Compose)
The reference deployment runs three containerized services:
1. `database`: PostgreSQL 15 database persisting well states, historical cycles, and operator feedback logs.
2. `backend`: FastAPI Python application exposing the Digital Twin engine, optimization algorithms, and REST APIs on port 8000.
3. `frontend`: High-performance React + Vite production build served via Nginx on port 3000.

### Starting Production Containers:
```bash
docker-compose -f docker-compose.yml up --build -d
```

---

## 3. Production Environment Variables
Configure the following in `.env`:
- `ENVIRONMENT=production`
- `DEBUG=False`
- `DATABASE_URL=postgresql://sih_user:<secure_password>@database:5432/sih_baghewala_db`
- `SECRET_KEY=<cryptographic_token>`
- `CORS_ORIGINS=["https://digitaltwin.oilindia.in"]`

---

## 4. Health Checks & Monitoring
- **Liveness & Readiness**:
  - `GET /health`: Returns service availability for DB, Digital Twin, and Optimizer.
- **Logging**:
  - Standard JSON structured logs output to stdout, captured by FluentBit/Logstash or Docker logging drivers.
