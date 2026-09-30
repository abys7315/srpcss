"""
Viscosity Model for Baghewala Extra-Heavy Crude Oil.

Equation:
mu(T) = A * exp(B / T_kelvin) (Andrade / Arrhenius relationship)

Calibrated for Baghewala Field Jodhpur Sandstone extra-heavy crude (17-19 API).
At reservoir temperature (~46-48 C), dead oil viscosity is in the multi-thousand cP range.
Above 80 C, thermal stimulation causes exponential viscosity drop.

PROVENANCE: ASSUMED (calibrated to published literature for Rajasthan heavy crudes).
"""

from dataclasses import dataclass
import math
import numpy as np

from core.config import canonical_config as _CFG


@dataclass(frozen=True)
class BaghewalaViscosityParameters:
    """Andrade parameters, derived from the configs/field.yaml anchors
    mu(47 C) = 2400 cP and mu(150 C) = 42 cP  ->  B ~ 5320 K, A from the 47 C anchor."""
    A: float = _CFG.fluid.andrade_a   # Pre-exponential factor [cP]
    B: float = _CFG.fluid.andrade_b   # Activation temperature [K]
    min_viscosity_cp: float = 1.0     # Physical floor at extreme temperatures
    max_viscosity_cp: float = 100000.0 # Physical ceiling at freezing/cold states
    provenance: str = "ASSUMED"

class AndradeViscosityModel:
    """Computes temperature-dependent dynamic viscosity for extra-heavy crude."""

    def __init__(self, params: BaghewalaViscosityParameters = None):
        self.params = params or BaghewalaViscosityParameters()

    def compute_viscosity_cp(self, temp_celsius: float | np.ndarray) -> float | np.ndarray:
        """
        Calculate dynamic viscosity in centipoise (cP) at a given temperature in Celsius.
        
        Args:
            temp_celsius: Temperature in degrees Celsius (scalar or array)
            
        Returns:
            Viscosity in centipoise (cP)
        """
        if isinstance(temp_celsius, (int, float)):
            temp_k = max(float(temp_celsius) + 273.15, 200.0) # Guard against absolute zero
            raw_visc = self.params.A * math.exp(self.params.B / temp_k)
            return float(min(max(raw_visc, self.params.min_viscosity_cp), self.params.max_viscosity_cp))

        temp_k = np.maximum(temp_celsius + 273.15, 200.0) # Guard against absolute zero
        raw_visc = self.params.A * np.exp(self.params.B / temp_k)
        return np.clip(raw_visc, self.params.min_viscosity_cp, self.params.max_viscosity_cp)

    def compute_kinematic_viscosity_cst(self, temp_celsius: float, density_kg_m3: float) -> float:
        """Calculate kinematic viscosity in centistokes (cSt = mm2/s)."""
        mu_cp = self.compute_viscosity_cp(temp_celsius)
        # 1 cP = 1 mPa.s = 1e-3 Pa.s
        # 1 cSt = 1e-6 m2/s = (1e-3 Pa.s / (kg/m3)) * 1e6 = 1000 * mu_cp / rho
        return (1000.0 * mu_cp) / density_kg_m3

    def compute_viscosity_derivative(self, temp_celsius: float) -> float:
        """Calculate d(mu)/dT in cP/K. Negative value indicating thinning on heating."""
        temp_k = temp_celsius + 273.15
        mu = self.compute_viscosity_cp(temp_celsius)
        return -mu * self.params.B / (temp_k ** 2)
