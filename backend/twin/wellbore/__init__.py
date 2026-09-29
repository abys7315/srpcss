"""
Wellbore Physics Package — Petro-Twin (SIH 2026, PS26120)

Canonical Model Responsibilities:
1. Wellbore1DModel (CANONICAL PRODUCTION MODEL):
   - Coupled 1-D depth-resolved profiles: T(z), P(z), mu(z), rho(z), and distributed rod drag F_drag.
   - Enforces physical pressure chain: P_res >= P_wf >= PIP >= P_wh.
   - Supports depth-resolved rod velocity profile F_drag = int C(z) v(z,t) dz.

2. WellboreHeatTransferModel (CANONICAL INJECTION MODEL):
   - CSS steam injection thermal loss and quality drop calculations down the tubing.

3. WellboreTemperatureModel & WellboreHydraulicsModel:
   - Zero-D lumped fast approximations / helpers for rapid initialization and sanity verification.
"""

from .wellbore_1d import Wellbore1DModel, WellboreProfile1D, WellboreSegment, RodDragResult
from .heat_transfer import WellboreHeatTransferModel, WellboreHeatTransferResult
from .pressure import WellboreHydraulicsModel, WellborePressureProfile
from .temperature import WellboreTemperatureModel, WellboreTempProfile

__all__ = [
    "Wellbore1DModel",
    "WellboreProfile1D",
    "WellboreSegment",
    "RodDragResult",
    "WellboreHeatTransferModel",
    "WellboreHeatTransferResult",
    "WellboreHydraulicsModel",
    "WellborePressureProfile",
    "WellboreTemperatureModel",
    "WellboreTempProfile",
]

