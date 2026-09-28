"""
Wellbore Temperature Gradient and Fluid Cooling.

PROVENANCE: ASSUMED.
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
        depth_m: float = 1050.0
    ) -> float:
        """
        At high production rates, fluid reaches surface hotter.
        At low rates, fluid loses heat to geothermal formation and approaches ambient (~35-40C).
        """
        res_delta = max(0.0, bottomhole_temp_c - 35.0)
        retention_fraction = min(0.85, 0.35 + 0.50 * (liquid_rate_m3_d / 30.0))
        surface_temp = 32.0 + res_delta * retention_fraction
        return round(float(surface_temp), 1)
