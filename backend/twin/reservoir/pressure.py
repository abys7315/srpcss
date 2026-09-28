"""
Reservoir Pressure Depletion and Steam Chamber Re-pressurization.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
import numpy as np

@dataclass
class ReservoirPressureParameters:
    initial_pressure_bar: float = 65.0
    pressure_depletion_per_1000m3_oil: float = 0.85 # Bar drop per 1,000 m3 oil produced
    steam_repressurization_factor: float = 0.008   # Bar increase per tonne steam injected
    min_reservoir_pressure_bar: float = 12.0       # Depleted floor
    provenance: str = "ASSUMED"

class ReservoirPressureModel:
    """Tracks average reservoir pressure across multiple CSS cycles and within cycles."""

    def __init__(self, params: ReservoirPressureParameters = None):
        self.params = params or ReservoirPressureParameters()

    def compute_cycle_initial_pressure(
        self,
        cumulative_oil_produced_m3: float,
        steam_injected_tonnes: float
    ) -> float:
        """
        Computes starting reservoir pressure for the current cycle:
        P_res = P_init - depletion + steam_charge
        """
        depletion = (cumulative_oil_produced_m3 / 1000.0) * self.params.pressure_depletion_per_1000m3_oil
        recharge = steam_injected_tonnes * self.params.steam_repressurization_factor
        p = self.params.initial_pressure_bar - depletion + recharge
        return float(np.clip(p, self.params.min_reservoir_pressure_bar, 140.0))
