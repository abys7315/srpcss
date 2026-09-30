"""Copilot route: server-side keys only, template fallback built from simulated state."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.init_db import init_db

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


def test_copilot_template_fallback_uses_real_state(client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    r = client.post("/api/v1/copilot", json={"well_id": "BGW-01", "query": "status?"})
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "template"
    assert body["answer"].startswith("Template summary (LLM offline)")
    ctx = body["context"]
    assert ctx["well_id"] == "BGW-01"
    # Every number in the summary must come from the context, not a hard-coded fact.
    assert f"{ctx['oil_viscosity_cp']:.0f} cP" in body["answer"]
    for banned in ("SPE 185340", "Bilara", "12,000 cP", "13.8 m"):
        assert banned not in body["answer"]


def test_copilot_unknown_well_404(client):
    assert client.post("/api/v1/copilot", json={"well_id": "NOPE", "query": "x"}).status_code == 404
