"""
Downhole Sucker Rod Pump Kinematics and Displacement.

Calculates pump displacement, plunger fluid load (Fo), pump fillage,
volumetric efficiency, and fluid pound severity.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
from typing import Tuple
import numpy as np

from core.config import canonical_config as _C

@dataclass
class PumpState:
    pump_displacement_bpd: float
    pump_displacement_m3_d: float
    pump_fillage_fraction: float         # [0.0, 1.0]
    fluid_pound_severity: float          # [0.0, 1.0] where > 0 means fluid pound occurs
    volumetric_efficiency_pct: float
    plunger_fluid_load_lbs: float        # Fo = Ap * (P_discharge - P_intake)
    effective_liquid_lifted_m3_d: float
    is_fluid_pounding: bool
    is_gas_interfering: bool
    provenance: str = "SIMULATED"

class DownholePumpModel:
    """Simulates downhole positive displacement sucker rod pump mechanics."""

    def __init__(
        self,
        pump_bore_diameter_inch: float = _C.srp.pump_bore_inch,
        slippage_efficiency: float = 0.96
    ):
        self.bore_inch = pump_bore_diameter_inch
        self.plunger_area_sq_in = (np.pi / 4.0) * (pump_bore_diameter_inch ** 2)
        self.slippage_efficiency = slippage_efficiency
        
        # API Constant for pump displacement: 0.1166 * D^2 * S * SPM [bbl/day]
        # (with S in inches, D in inches)
        self.disp_constant_bpd = 0.1166 * (pump_bore_diameter_inch ** 2)

    def compute_displacement(self, spm: float, stroke_length_inch: float) -> Tuple[float, float]:
        """Returns (displacement_bpd, displacement_m3_d)."""
        disp_bpd = self.disp_constant_bpd * stroke_length_inch * spm
        # 1 bbl = 0.158987 m3
        disp_m3 = disp_bpd * 0.158987
        return float(disp_bpd), float(disp_m3)

    def evaluate_pump_operation(
        self,
        spm: float,
        stroke_length_inch: float,
        inflow_liquid_rate_m3_d: float,
        pump_intake_pressure_bar: float,
        wellhead_pressure_bar: float,
        pump_depth_m: float,
        fluid_density_kg_m3: float,
        gas_cut_fraction: float = 0.05,
        viscosity_cp: float = 100.0
    ) -> PumpState:
        """Evaluates pump fillage, fluid pound, and plunger fluid load with viscous valve delay."""
        disp_bpd, disp_m3 = self.compute_displacement(spm, stroke_length_inch)
        
        # Pump fillage fraction based on reservoir inflow vs pump stroke volume:
        if disp_m3 <= 0.0:
            fillage = 0.0
        else:
            fillage = min(1.0, inflow_liquid_rate_m3_d / disp_m3)
            
        # Fluid pound occurs if fillage drops below 85%:
        is_pounding = fillage < 0.85
        pound_severity = max(0.0, (0.85 - fillage) / 0.85) if is_pounding else 0.0
        
        # Viscous valve throttling & ball delay correction (Takacs/Patterson model for heavy crude):
        if viscosity_cp > 0.0 and spm > 0.0:
            eta_visc = 1.0 / (1.0 + 0.035 * ((max(viscosity_cp, 10.0) / 1000.0) ** 0.55) * ((max(0.5, spm) / 5.0) ** 0.7))
        else:
            eta_visc = 1.0

        # Volumetric efficiency:
        vol_eff = fillage * self.slippage_efficiency * eta_visc * 100.0
        effective_lifted_m3 = disp_m3 * (vol_eff / 100.0)

        # Plunger fluid load (Fo):
        # Discharge pressure = hydrostatic head + surface backpressure
        hydrostatic_bar = (fluid_density_kg_m3 * 9.81 * pump_depth_m) / 1e5
        p_discharge_bar = hydrostatic_bar + wellhead_pressure_bar
        delta_p_bar = max(0.0, p_discharge_bar - pump_intake_pressure_bar)
        
        # Convert delta P to psi: 1 bar = 14.5038 psi
        delta_p_psi = delta_p_bar * 14.5038
        fo_lbs = self.plunger_area_sq_in * delta_p_psi

        return PumpState(
            pump_displacement_bpd=round(disp_bpd, 1),
            pump_displacement_m3_d=round(disp_m3, 2),
            pump_fillage_fraction=round(float(fillage), 3),
            fluid_pound_severity=round(float(pound_severity), 3),
            volumetric_efficiency_pct=round(float(vol_eff), 1),
            plunger_fluid_load_lbs=round(float(fo_lbs), 1),
            effective_liquid_lifted_m3_d=round(float(effective_lifted_m3), 2),
            is_fluid_pounding=bool(is_pounding),
            is_gas_interfering=bool(gas_cut_fraction > 0.15 and fillage < 0.9),
            provenance="SIMULATED"
        )
