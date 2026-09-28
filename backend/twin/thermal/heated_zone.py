"""
Heated Zone Geometry and Thermal Capacity Tracking.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
import numpy as np

@dataclass
class HeatedZoneGeometry:
    radius_m: float
    area_m2: float
    thickness_m: float
    volume_m3: float
    heat_capacity_j_k: float  # Total volumetric heat capacity of the heated cylinder

def calculate_heated_zone_geometry(
    area_m2: float,
    net_pay_thickness_m: float,
    volumetric_heat_capacity_res: float
) -> HeatedZoneGeometry:
    """Calculate cylindrical steam chamber geometry and thermal mass."""
    area = max(float(area_m2), 0.1)
    radius = float(np.sqrt(area / np.pi))
    volume = area * net_pay_thickness_m
    heat_cap = volume * volumetric_heat_capacity_res
    return HeatedZoneGeometry(
        radius_m=radius,
        area_m2=area,
        thickness_m=net_pay_thickness_m,
        volume_m3=volume,
        heat_capacity_j_k=heat_cap
    )
