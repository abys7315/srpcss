"""
Saturated-steam properties from IAPWS-IF97 (iapws package).

The bottomhole injection pressure sets the saturation temperature and latent heat, e.g.
Tsat(125 bar) ~ 328 degC, h_fg ~ 1163 kJ/kg; Tsat = 260 degC corresponds to ~47 bar.
"""

from dataclasses import dataclass
from functools import lru_cache

from iapws import IAPWS97


@dataclass(frozen=True)
class SaturatedSteam:
    pressure_bar: float
    t_sat_c: float
    h_f_j_kg: float      # saturated liquid enthalpy
    h_g_j_kg: float      # saturated vapour enthalpy
    h_fg_j_kg: float     # latent heat


@lru_cache(maxsize=512)
def _sat(p_bar_rounded: float) -> SaturatedSteam:
    p_mpa = p_bar_rounded / 10.0
    liq = IAPWS97(P=p_mpa, x=0.0)
    vap = IAPWS97(P=p_mpa, x=1.0)
    return SaturatedSteam(
        pressure_bar=p_bar_rounded,
        t_sat_c=liq.T - 273.15,
        h_f_j_kg=liq.h * 1e3,
        h_g_j_kg=vap.h * 1e3,
        h_fg_j_kg=(vap.h - liq.h) * 1e3,
    )


def saturated_steam(pressure_bar: float) -> SaturatedSteam:
    """Saturation state at pressure_bar (clamped to 1-200 bar, rounded to 0.1 bar for caching)."""
    p = min(200.0, max(1.0, float(pressure_bar)))
    return _sat(round(p, 1))


def saturation_pressure_bar(t_c: float) -> float:
    """Saturation pressure [bar] at temperature t_c [degC]."""
    return IAPWS97(T=float(t_c) + 273.15, x=0.0).P * 10.0
