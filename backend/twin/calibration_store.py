"""
Persistent store for fitted thermal-loss calibration (kappa) per well.

The thermal model has one documented calibration scalar (kappa, docs/physics.md section 3).
`POST /api/v1/calibrate/thermal` fits it to ingested observations and, only if the held-out
error improves, stores the result here. `CSSCycleSimulator` reads it when
`CycleConfig.thermal_loss_calibration` is None, so calibrated wells are simulated with their
fitted kappa everywhere (twin page, optimizer, what-if).

The store is a small JSON file. Set PETRO_CALIBRATION_FILE to relocate it, or to an empty
string to disable stored calibration entirely (scripts/run_benchmark.py does this so that
benchmark numbers never depend on local calibration state).
"""

import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, Optional

_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_PATH = _ROOT / "data" / "processed" / "thermal_calibration.json"
_LOCK = threading.Lock()


def _path() -> Optional[Path]:
    env = os.environ.get("PETRO_CALIBRATION_FILE")
    if env is not None:
        return Path(env) if env.strip() else None
    return _DEFAULT_PATH


def load_all() -> Dict[str, Dict[str, Any]]:
    p = _path()
    if p is None or not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def get_kappa(well_id: str) -> Optional[float]:
    entry = load_all().get(well_id)
    if not entry:
        return None
    try:
        return float(entry["kappa"])
    except (KeyError, TypeError, ValueError):
        return None


def get_calibration_details(well_id: str) -> Optional[Dict[str, Any]]:
    """Returns full metadata for the calibrated kappa if present."""
    entry = load_all().get(well_id)
    if not entry:
        return None
    return dict(entry)


def set_calibration(well_id: str, kappa: float, metadata: Optional[Dict[str, Any]] = None) -> None:
    p = _path()
    if p is None:
        raise RuntimeError("Stored calibration is disabled (PETRO_CALIBRATION_FILE is empty).")
    with _LOCK:
        data = load_all()
        data[well_id] = {"kappa": float(kappa), **(metadata or {})}
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2), encoding="utf-8")
    _invalidate_caches()


def clear_calibration(well_id: Optional[str] = None) -> None:
    p = _path()
    if p is None or not p.exists():
        return
    with _LOCK:
        data = load_all()
        if well_id is None:
            data = {}
        else:
            data.pop(well_id, None)
        p.write_text(json.dumps(data, indent=2), encoding="utf-8")
    _invalidate_caches()


def _invalidate_caches() -> None:
    """Cached optimizer simulations were computed with the previous kappa."""
    try:
        from optimizer.objective import clear_simulation_cache
        clear_simulation_cache()
    except Exception:  # optimizer package not importable in some tooling contexts
        pass
