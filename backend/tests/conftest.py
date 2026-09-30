"""
Pytest configuration for SIH 26120 tests.
Ensures backend directory is always in sys.path.
"""

import sys
from pathlib import Path

import numpy as np
import pytest

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


def plant_oil_rates(well_id: str, kappa_true: float, days, noise: float = 0.03, seed: int = 7):
    """
    Observations from an independent 'plant': the same simulator run with a thermal kappa the twin does
    NOT use by default, plus multiplicative Gaussian noise. Returns {day: oil_rate_bpd}.
    A twin that is calibrated honestly should recover kappa_true; one that only echoes its own output would not.
    """
    from twin.calibration import _simulate
    days = list(days)
    sim = _simulate({"well_id": well_id}, kappa_true, max(days))
    rng = np.random.default_rng(seed)
    return {int(d): float(sim[int(d)] * (1.0 + rng.normal(0.0, noise))) for d in days}


@pytest.fixture
def post_plant_feedback():
    """Posts plant observations through POST /feedback (the operator path) and returns them."""
    def _post(client, well_id="BGW-01", kappa_true=1.8, days=range(5, 65, 5), noise=0.03, seed=7):
        obs = plant_oil_rates(well_id, kappa_true, days, noise, seed)
        for d, q in obs.items():
            res = client.post("/api/v1/feedback", json={
                "well_id": well_id, "day": d, "observed_oil_rate_bpd": round(q, 2),
                "observed_temperature_c": 75.0, "observed_float_events": 0,
                "observed_dynacard_label": "NORMAL", "operator_notes": "plant observation (test)",
            })
            assert res.status_code == 200, res.text
        return obs
    return _post
