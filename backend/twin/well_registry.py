"""
Per-well property variants for the 10 synthetic Baghewala wells (BGW-01..BGW-10).

Each property is the canonical value from configs/field.yaml plus a deterministic, documented
perturbation u_k(i) = ((i * a_k) mod 11) / 10 - 0.5  in [-0.5, 0.5]  (a = 3, 5, 7, 9):
  depth          +/- 20 m          (pump seat 70 m above TVD)
  reservoir p    +/- 5 bar
  net pay        +/- 1.5 m
  cold PI        x (1 +/- 0.2)     (lumps permeability-thickness and skin differences)
Unknown well ids get the canonical values. PROVENANCE: SIMULATED (synthetic spread, not field data).
"""

from dataclasses import dataclass
from functools import lru_cache
import re

from core.config import canonical_config as _C


@dataclass(frozen=True)
class WellProperties:
    well_tvd_m: float
    pump_depth_m: float
    reservoir_pressure_bar: float
    net_pay_m: float
    pi_multiplier: float


def _u(i: int, a: int) -> float:
    return ((i * a) % 11) / 10.0 - 0.5


@lru_cache(maxsize=64)
def well_properties(well_id: str) -> WellProperties:
    base = WellProperties(
        well_tvd_m=_C.reservoir.depth_m,
        pump_depth_m=_C.srp.pump_depth_m,
        reservoir_pressure_bar=_C.reservoir.initial_pressure_bar,
        net_pay_m=_C.reservoir.net_pay_thickness_m,
        pi_multiplier=1.0,
    )
    m = re.fullmatch(r"BGW-(\d{2})", well_id or "")
    if not m:
        return base
    i = int(m.group(1))
    depth = base.well_tvd_m + 40.0 * _u(i, 3)
    return WellProperties(
        well_tvd_m=round(depth, 1),
        pump_depth_m=round(depth - (base.well_tvd_m - base.pump_depth_m), 1),
        reservoir_pressure_bar=round(base.reservoir_pressure_bar + 10.0 * _u(i, 5), 2),
        net_pay_m=round(base.net_pay_m + 3.0 * _u(i, 7), 2),
        pi_multiplier=round(1.0 + 0.4 * _u(i, 9), 3),
    )
