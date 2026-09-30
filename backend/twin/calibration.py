"""
Calibration of the thermal-loss scalar kappa against observed oil-rate history.

Method
  1. Observations (production day, oil rate) are sorted chronologically and split 70 / 30.
  2. kappa is fitted on the first 70 % only: a coarse grid over KAPPA_BOUNDS, then a bounded
     scalar refinement inside the best grid bracket. Objective: RMSE of simulated vs observed
     oil rate [bbl/d].
  3. The fitted kappa is scored on the final 30 % (a forecast into days the fit never saw) and
     compared with the uncalibrated default kappa on the same points.
  4. The fit is ACCEPTED only if the held-out RMSE improves by at least MIN_IMPROVEMENT_PCT and
     kappa did not land on a search bound. Otherwise the default is kept.

Nothing is reported from the training portion as evidence of improvement.
PROVENANCE: depends on the ingested data; the fit itself is a simulation-based estimate.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
from scipy.optimize import minimize_scalar

from core.config import canonical_config
from .cycle import CSSCycleSimulator, CycleConfig

KAPPA_BOUNDS: Tuple[float, float] = (0.5, 6.0)
KAPPA_GRID: Tuple[float, ...] = (0.6, 1.0, 1.5, 2.0, 2.6, 3.4, 4.5, 5.8)
MIN_OBSERVATIONS = 8
MIN_DISTINCT_DAYS = 6
MIN_IMPROVEMENT_PCT = 10.0
TRAIN_FRACTION = 0.70

# CycleConfig fields a caller may pin while calibrating (everything else keeps its default).
ALLOWED_CYCLE_KEYS = {
    "well_id", "cycle_number", "steam_volume_tonnes", "injection_duration_days", "injection_pressure_bar",
    "soak_duration_days", "spm", "stroke_length_inch", "vfd_downstroke_ratio", "srp_policy",
    "srp_m_target", "srp_min_fillage", "pump_depth_m", "well_tvd_m", "reservoir_pressure_bar",
    "net_pay_m", "pi_multiplier",
}


@dataclass
class CalibrationResult:
    well_id: str
    kappa_default: float
    kappa_fitted: float
    accepted: bool
    status: str                     # ACCEPTED | REJECTED_NO_IMPROVEMENT | REJECTED_AT_BOUND | INSUFFICIENT_DATA
    message: str
    n_observations: int = 0
    n_train: int = 0
    n_holdout: int = 0
    train_rmse_default_bpd: float = 0.0
    train_rmse_fitted_bpd: float = 0.0
    holdout_rmse_default_bpd: float = 0.0
    holdout_rmse_fitted_bpd: float = 0.0
    holdout_improvement_pct: float = 0.0
    evaluations: int = 0
    points: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.__dict__)


def default_kappa() -> float:
    return float(canonical_config.reservoir.thermal_loss_calibration)


def _simulate(cycle_kwargs: Dict[str, Any], kappa: float, max_day: int) -> Dict[int, float]:
    cfg = CycleConfig(
        **{k: v for k, v in cycle_kwargs.items() if k in ALLOWED_CYCLE_KEYS},
        production_duration_days=float(max(90, max_day + 5)),
        economic_cutoff_oil_rate_bpd=0.05,     # do not stop the cycle before the last observation
        thermal_loss_calibration=float(kappa),
    )
    res = CSSCycleSimulator(cfg).run_simulation()
    return {int(pt.day): float(pt.oil_rate_bpd) for pt in res.daily_history}


def _rmse(sim: Dict[int, float], days: Sequence[int], obs: Sequence[float]) -> float:
    pred = np.array([sim.get(int(d), np.nan) for d in days], dtype=float)
    o = np.asarray(obs, dtype=float)
    ok = np.isfinite(pred)
    if not ok.any():
        return float("inf")
    return float(np.sqrt(np.mean((pred[ok] - o[ok]) ** 2)))


def calibrate_thermal_kappa(well_id: str, days: Sequence[int], oil_rate_bpd: Sequence[float],
                            cycle_kwargs: Optional[Dict[str, Any]] = None) -> CalibrationResult:
    kd = default_kappa()
    order = np.argsort(np.asarray(days))
    d = np.asarray(days, dtype=int)[order]
    q = np.asarray(oil_rate_bpd, dtype=float)[order]
    n = len(d)

    if n < MIN_OBSERVATIONS or len(set(d.tolist())) < MIN_DISTINCT_DAYS:
        return CalibrationResult(
            well_id=well_id, kappa_default=kd, kappa_fitted=kd, accepted=False, status="INSUFFICIENT_DATA",
            n_observations=n,
            message=(f"Need at least {MIN_OBSERVATIONS} observations on {MIN_DISTINCT_DAYS} distinct production days "
                     f"(have {n} on {len(set(d.tolist()))}). Nothing was fitted."))

    ck = dict(cycle_kwargs or {})
    ck["well_id"] = well_id
    max_day = int(d.max())
    n_train = max(4, int(np.floor(TRAIN_FRACTION * n)))
    n_train = min(n_train, n - 2)                      # keep at least two held-out points
    d_tr, q_tr, d_ho, q_ho = d[:n_train], q[:n_train], d[n_train:], q[n_train:]

    evals = 0
    cache: Dict[float, Dict[int, float]] = {}

    def sim_at(k: float) -> Dict[int, float]:
        nonlocal evals
        key = round(float(k), 4)
        if key not in cache:
            cache[key] = _simulate(ck, key, max_day)
            evals += 1
        return cache[key]

    def train_loss(k: float) -> float:
        return _rmse(sim_at(k), d_tr, q_tr)

    # Coarse grid, then bounded refinement inside the neighbouring grid points of the best one.
    grid = sorted(set(KAPPA_GRID) | {round(kd, 4)})
    losses = [train_loss(k) for k in grid]
    i = int(np.argmin(losses))
    lo, hi = grid[max(0, i - 1)], grid[min(len(grid) - 1, i + 1)]
    ref = minimize_scalar(train_loss, bounds=(lo, hi), method="bounded", options={"xatol": 0.02, "maxiter": 10})
    k_fit = float(ref.x) if ref.fun <= losses[i] else float(grid[i])
    k_fit = float(np.clip(k_fit, *KAPPA_BOUNDS))

    sim_def, sim_fit = sim_at(kd), sim_at(k_fit)
    tr_def, tr_fit = _rmse(sim_def, d_tr, q_tr), _rmse(sim_fit, d_tr, q_tr)
    ho_def, ho_fit = _rmse(sim_def, d_ho, q_ho), _rmse(sim_fit, d_ho, q_ho)
    improvement = (ho_def - ho_fit) / max(ho_def, 1e-9) * 100.0
    at_bound = (k_fit - KAPPA_BOUNDS[0]) < 0.05 or (KAPPA_BOUNDS[1] - k_fit) < 0.05

    if at_bound:
        status, accepted = "REJECTED_AT_BOUND", False
        msg = (f"Fitted kappa {k_fit:.2f} sits on the search bound {KAPPA_BOUNDS}; the data are not explained by this "
               f"parameter alone. Default kappa {kd:.2f} kept.")
    elif improvement < MIN_IMPROVEMENT_PCT:
        status, accepted = "REJECTED_NO_IMPROVEMENT", False
        msg = (f"Held-out RMSE changed by {improvement:+.1f}% (needs >= {MIN_IMPROVEMENT_PCT:.0f}%). "
               f"Default kappa {kd:.2f} kept.")
    else:
        status, accepted = "ACCEPTED", True
        msg = (f"kappa {kd:.2f} -> {k_fit:.2f}. Held-out RMSE {ho_def:.2f} -> {ho_fit:.2f} bbl/d "
               f"({improvement:.1f}% lower) on {len(d_ho)} days the fit never saw.")

    points = [
        {"day": int(dd), "observed_bpd": float(qq), "default_bpd": sim_def.get(int(dd)), "fitted_bpd": sim_fit.get(int(dd)),
         "split": "train" if j < n_train else "holdout"}
        for j, (dd, qq) in enumerate(zip(d, q))
    ]
    return CalibrationResult(
        well_id=well_id, kappa_default=kd, kappa_fitted=round(k_fit, 4), accepted=accepted, status=status, message=msg,
        n_observations=n, n_train=int(n_train), n_holdout=int(n - n_train),
        train_rmse_default_bpd=round(tr_def, 3), train_rmse_fitted_bpd=round(tr_fit, 3),
        holdout_rmse_default_bpd=round(ho_def, 3), holdout_rmse_fitted_bpd=round(ho_fit, 3),
        holdout_improvement_pct=round(improvement, 1), evaluations=evals, points=points)
