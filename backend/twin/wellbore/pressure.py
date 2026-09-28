"""
Wellbore Hydraulics and Multiphase Pressure Drop.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass

@dataclass
class WellborePressureProfile:
    wellhead_pressure_bar: float
    bottomhole_pressure_bar: float
    hydrostatic_drop_bar: float
    frictional_drop_bar: float
    provenance: str = "SIMULATED"

class WellboreHydraulicsModel:
    """Computes vertical multiphase flow pressure drop in tubing string."""

    def __init__(self, depth_m: float = 1050.0, tubing_id_m: float = 0.076):
        self.depth_m = depth_m
        self.tubing_id_m = tubing_id_m

    def compute_pressure_profile(
        self,
        liquid_rate_m3_d: float,
        mixture_density_kg_m3: float,
        wellhead_pressure_bar: float
    ) -> WellborePressureProfile:
        hydrostatic = (mixture_density_kg_m3 * 9.81 * self.depth_m) / 1e5
        # Friction drop approximation:
        friction = 0.8 * (liquid_rate_m3_d / 20.0) ** 1.75
        pwf = wellhead_pressure_bar + hydrostatic + friction
        return WellborePressureProfile(
            wellhead_pressure_bar=wellhead_pressure_bar,
            bottomhole_pressure_bar=round(pwf, 2),
            hydrostatic_drop_bar=round(hydrostatic, 2),
            frictional_drop_bar=round(friction, 2),
            provenance="SIMULATED"
        )
