"""Phase 4: user-supplied telemetry, holdout-gated calibration, and SSE replay."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.init_db import init_db

pytestmark = pytest.mark.integration


@pytest.fixture()
def client():
    init_db()
    with TestClient(app) as test_client:
        yield test_client


def test_ingest_is_labelled_user_supplied_and_streams(client):
    rows = [{"day": day, "oil_rate_bpd": 30 + day, "temperature_c": 70 + day} for day in range(1, 9)]
    response = client.post("/api/v1/telemetry/ingest", json={"well_id": "BGW-01", "source_label": "integration test gauge", "replace_existing": True, "observations": rows})
    assert response.status_code == 200
    assert response.json()["provenance"] == "USER_SUPPLIED"
    assert response.json()["data"]["inserted"] == 8
    assert len(client.get("/api/v1/telemetry/BGW-01").json()["data"]) >= 8
    stream = client.get("/api/v1/stream/BGW-01?speed=200")
    assert stream.status_code == 200
    assert "event: start" in stream.text and "event: done" in stream.text


def test_calibration_rejects_insufficient_observations(client):
    response = client.post("/api/v1/calibrate/thermal", json={"well_id": "BGW-10", "source_label": "no data"})
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "INSUFFICIENT_DATA"
    assert response.json()["data"]["applied"] is False
