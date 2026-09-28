"""
Fluid Density Calculations for Heavy Oil and Multiphase Mixtures.

Calculates temperature-dependent density for Baghewala crude (17-19 API),
formation water, and steam condensate.

PROVENANCE: ASSUMED (standard petroleum engineering equations).
"""

from dataclasses import dataclass
import numpy as np

@dataclass(frozen=True)
class DensityParameters:
    api_gravity: float = 18.0          # Typical Baghewala crude API [ASSUMED]
    thermal_expansion_coeff: float = 0.00068 # 1/K for heavy crude [ASSUMED]
    water_density_sc_kg_m3: float = 1015.0   # Formation brine density [ASSUMED]
    water_thermal_expansion: float = 0.00045 # 1/K for water
    provenance: str = "ASSUMED"

class FluidDensityModel:
    """Computes oil, water, and emulsion density under downhole and surface conditions."""

    def __init__(self, params: DensityParameters = None):
        self.params = params or DensityParameters()
        # Specific gravity at standard conditions 60F (15.56C)
        self.sg_sc = 141.5 / (131.5 + self.params.api_gravity)
        self.oil_density_sc_kg_m3 = self.sg_sc * 999.0

    def compute_oil_density(self, temp_celsius: float | np.ndarray) -> float | np.ndarray:
        """
        Calculate oil density in kg/m3 at temperature T.
        Formula: rho(T) = rho_sc / (1 + beta * (T - 15.56))
        """
        delta_t = np.maximum(temp_celsius - 15.56, -10.0)
        return self.oil_density_sc_kg_m3 / (1.0 + self.params.thermal_expansion_coeff * delta_t)

    def compute_water_density(self, temp_celsius: float | np.ndarray) -> float | np.ndarray:
        """Calculate brine/water density in kg/m3 at temperature T."""
        delta_t = np.maximum(temp_celsius - 15.56, -10.0)
        return self.params.water_density_sc_kg_m3 / (1.0 + self.params.water_thermal_expansion * delta_t)

    def compute_emulsion_density(
        self, temp_celsius: float, water_cut_fraction: float
    ) -> float:
        """
        Calculate multiphase emulsion density in kg/m3.
        rho_emulsion = fw * rho_water + (1 - fw) * rho_oil
        """
        rho_o = self.compute_oil_density(temp_celsius)
        rho_w = self.compute_water_density(temp_celsius)
        return float(water_cut_fraction * rho_w + (1.0 - water_cut_fraction) * rho_o)
