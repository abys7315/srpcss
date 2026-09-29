"""
Canonical Model for: Production Phase Fluid Ascent Thermal Gradient (Fluid Cooling).
Calculates heavy crude cooling as produced fluids travel up the tubing string from bottomhole to surface.

PROVENANCE: ASSUMED (Empirical heat transfer model calibrated to Baghewala geothermal gradient).
"""

from dataclasses import dataclass
import numpy as np

@dataclass
class WellboreTempProfile:
    surface_temp_c: float
    bottomhole_temp_c: float
    geothermal_surface_temp_c: float = 32.0
    geothermal_gradient_c_per_100m: float = 2.8

class WellboreTemperatureModel:
    """Calculates fluid temperature change as produced heavy crude travels up to the surface."""

    def compute_surface_fluid_temp(
        self,
        bottomhole_temp_c: float,
        liquid_rate_m3_d: float,
        depth_m: float = 1050.0,
        surface_ambient_c: float = 32.0
    ) -> float:
        """
        At high production rates, fluid reaches surface hotter.
        At low rates, fluid loses heat to geothermal formation and approaches surface ambient (~32-35C).
        Note: Reservoir initial temp is 47.0C; near-surface ground datum is 35.0C.
        """
        near_surface_datum_c = 35.0
        res_delta = max(0.0, bottomhole_temp_c - near_surface_datum_c)
        retention_fraction = min(0.85, 0.35 + 0.50 * (liquid_rate_m3_d / 30.0))
        surface_temp = surface_ambient_c + res_delta * retention_fraction
        return round(float(surface_temp), 1)
