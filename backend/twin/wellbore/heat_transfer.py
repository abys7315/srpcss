"""
Canonical Model for: Steam Injection Phase Downhole Heat Loss and Delivered Steam Quality.
Calculates radial heat loss from the steam injection tubing string through the annulus to the casing and surrounding geothermal rock.

PROVENANCE: ASSUMED (Ramey-Willhite analytical steam heat transfer formulation).
"""

from dataclasses import dataclass
import numpy as np

@dataclass
class WellboreHeatTransferResult:
    wellhead_temperature_c: float
    sandface_temperature_c: float
    tubing_heat_loss_watts: float
    delivered_steam_quality: float
    casing_thermal_expansion_m: float
    provenance: str = "SIMULATED"

class WellboreHeatTransferModel:
    """Calculates radial heat loss from injection tubing through annulus to casing."""

    def __init__(
        self,
        well_depth_m: float = 1050.0,
        tubing_od_m: float = 0.089,
        casing_id_m: float = 0.157,
        insulation_thermal_conductivity: float = 0.04 # Insulated tubing string
    ):
        self.depth_m = well_depth_m
        self.tubing_od = tubing_od_m
        self.casing_id = casing_id_m
        self.k_ins = insulation_thermal_conductivity

    def evaluate_injection_heat_loss(
        self,
        steam_temp_celsius: float,
        steam_quality_wellhead: float,
        steam_rate_kg_s: float,
        latent_heat_j_kg: float = 1.163e6
    ) -> WellboreHeatTransferResult:
        """Computes tubing heat loss and the resulting sandface steam quality.
        Quality drop = Q_loss / (m_dot * h_fg): condensation supplies the lost heat."""
        # Tubing heat loss rate through the insulated annulus (steady radial conduction):
        delta_t = steam_temp_celsius - 40.0 # geothermal average
        thermal_resistance = np.log(self.casing_id / self.tubing_od) / (2.0 * np.pi * self.k_ins * self.depth_m)
        q_loss_watts = delta_t / max(thermal_resistance, 1e-4)
        delta_q = q_loss_watts / max(steam_rate_kg_s * latent_heat_j_kg, 1.0)
        delivered_quality = float(np.clip(steam_quality_wellhead - delta_q, 0.0, 1.0))

        # Casing thermal expansion: delta_L = L * alpha * delta_T
        # alpha_steel ~ 1.2e-5 1/C
        expansion_m = self.depth_m * 1.2e-5 * (steam_temp_celsius * 0.4)

        return WellboreHeatTransferResult(
            wellhead_temperature_c=steam_temp_celsius,
            sandface_temperature_c=steam_temp_celsius - 4.5,
            tubing_heat_loss_watts=round(float(q_loss_watts), 1),
            delivered_steam_quality=round(delivered_quality, 3),
            casing_thermal_expansion_m=round(float(expansion_m), 4),
            provenance="SIMULATED"
        )
