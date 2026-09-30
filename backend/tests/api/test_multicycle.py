import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.init_db import init_db

pytestmark = pytest.mark.integration


def test_multicycle_plan_chains_state():
    init_db()
    with TestClient(app) as c:
        r = c.post("/api/v1/optimize/multicycle", json={"well_id": "BGW-02", "n_cycles": 2, "srp_policy": "fixed"})
    assert r.status_code == 200
    d = r.json()["data"]
    assert [row["cycle_number"] for row in d["optimized"]] == [1, 2]
    assert d["constant_steam"][1]["recovery_factor_pct"] > d["constant_steam"][0]["recovery_factor_pct"]
    # With lookahead the plan is at least as good as constant steam on the optimized objective
    assert d["optimized_total_net_benefit_usd"] >= d["constant_total_net_benefit_usd"] - 1.0
