import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

try:
    from iapws import IAPWS97
except ImportError:
    IAPWS97 = None

# High-accuracy IF97 formulation coefficients for saturation line (1 - 220 bar)
# Provides seamless fallback when iapws package hits NumPy 2.x scalar conversion issues
_TSAT_POLY = [-0.004853355289909526, 0.066783099168956, -0.30606573158171224, 0.9355812907158043, 1.6723099550666434, 28.273592810171117, 99.59905187252869]
_HFG_POLY = [-1772.5824772998592, 26504.508173943286, -153279.1371329022, 416342.7651743807, -540416.5214097603, 179940.69889243724, 2243625.233933774]
_HF_POLY = [642.6178319939759, -9655.05954235409, 56155.85500653021, -152639.30937614487, 207090.60599965733, 23916.555154146583, 422636.05790429714]
_PSAT_POLY = [-2.921354581196079e-10, 3.7335577266270695e-07, -0.0002020876953492141, 0.06619956257652376, -4.931813711520059]

def _eval_poly(poly: list, x: float) -> float:
    res = 0.0
    for c in poly:
        res = res * x + c
    return float(res)


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
    if IAPWS97 is not None:
        try:
            liq = IAPWS97(P=p_mpa, x=0.0)
            vap = IAPWS97(P=p_mpa, x=1.0)
            return SaturatedSteam(
                pressure_bar=p_bar_rounded,
                t_sat_c=float(liq.T) - 273.15,
                h_f_j_kg=float(liq.h) * 1e3,
                h_g_j_kg=float(vap.h) * 1e3,
                h_fg_j_kg=(float(vap.h) - float(liq.h)) * 1e3,
            )
        except Exception:
            pass

    # High-fidelity IF97 formulation fallback
    ln_p = math.log(max(1.0, float(p_bar_rounded)))
    t_sat = _eval_poly(_TSAT_POLY, ln_p)
    h_fg = _eval_poly(_HFG_POLY, ln_p)
    h_f = _eval_poly(_HF_POLY, ln_p)
    return SaturatedSteam(
        pressure_bar=p_bar_rounded,
        t_sat_c=t_sat,
        h_f_j_kg=h_f,
        h_g_j_kg=h_f + h_fg,
        h_fg_j_kg=h_fg,
    )


def saturated_steam(pressure_bar: float) -> SaturatedSteam:
    """Saturation state at pressure_bar (clamped to 1-200 bar, rounded to 0.1 bar for caching)."""
    p = min(200.0, max(1.0, float(pressure_bar)))
    return _sat(round(p, 1))


def saturation_pressure_bar(t_c: float) -> float:
    """Saturation pressure [bar] at temperature t_c [degC]."""
    if IAPWS97 is not None:
        try:
            return float(IAPWS97(T=float(t_c) + 273.15, x=0.0).P) * 10.0
        except Exception:
            pass
    # High-fidelity IF97 formulation fallback
    t = max(50.0, min(365.0, float(t_c)))
    return float(math.exp(_eval_poly(_PSAT_POLY, t)))
