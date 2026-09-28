"""
Fluid Properties Manager & Asphaltene Deposition Risk.

Evaluates combined thermodynamic state of heavy crude, computing:
- Dynamic and kinematic viscosity
- In-situ fluid density
- Asphaltene deposition / plugging risk indicator score

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
from typing import Dict, Any
from .viscosity import AndradeViscosityModel, BaghewalaViscosityParameters
from .density import FluidDensityModel, DensityParameters

@dataclass
class FluidState:
    temperature_c: float
    viscosity_cp: float
    oil_density_kg_m3: float
    mixture_density_kg_m3: float
    asphaltene_risk_score: float  # [0.0, 1.0] where 1.0 is severe risk
    asphaltene_risk_level: str    # "LOW", "MODERATE", "HIGH", "CRITICAL"
    provenance: str = "ASSUMED"

class FluidPropertiesManager:
    """Combines viscosity and density calculations and computes asphaltene deposition risk."""

    def __init__(
        self,
        visc_params: BaghewalaViscosityParameters = None,
        density_params: DensityParameters = None
    ):
        self.visc_model = AndradeViscosityModel(visc_params)
        self.density_model = FluidDensityModel(density_params)

    def evaluate_state(self, temp_celsius: float, water_cut: float = 0.5) -> FluidState:
        """
        Evaluate full fluid state at specified temperature and water cut fraction.
        """
        visc_cp = float(self.visc_model.compute_viscosity_cp(temp_celsius))
        rho_oil = float(self.density_model.compute_oil_density(temp_celsius))
        rho_mix = float(self.density_model.compute_emulsion_density(temp_celsius, water_cut))

        # Asphaltene risk heuristic: High risk at low temperatures (< 55 C) combined with high viscosity (> 3000 cP)
        # where flocculation and wax/asphaltene co-precipitation severely plug pump valves.
        if temp_celsius < 45.0:
            risk_score = 0.85 + 0.15 * min(visc_cp / 15000.0, 1.0)
            risk_level = "CRITICAL"
        elif temp_celsius < 55.0:
            risk_score = 0.60 + 0.25 * min(visc_cp / 8000.0, 1.0)
            risk_level = "HIGH"
        elif temp_celsius < 80.0:
            risk_score = 0.30 + 0.30 * min(visc_cp / 3000.0, 1.0)
            risk_level = "MODERATE"
        else:
            risk_score = max(0.05, 0.20 * (120.0 - temp_celsius) / 40.0)
            risk_level = "LOW"

        return FluidState(
            temperature_c=temp_celsius,
            viscosity_cp=visc_cp,
            oil_density_kg_m3=rho_oil,
            mixture_density_kg_m3=rho_mix,
            asphaltene_risk_score=round(risk_score, 3),
            asphaltene_risk_level=risk_level,
            provenance="ASSUMED"
        )
