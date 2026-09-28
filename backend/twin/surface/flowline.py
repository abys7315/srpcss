"""
Surface Gathering Flowline Hydraulics and Trace Heating.

Calculates laminar/turbulent pressure drop for viscous crude in surface lines
and heating duty required to avoid cold plugging.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
import numpy as np

@dataclass
class FlowlineResult:
    pressure_drop_bar: float
    surface_viscosity_cp: float
    flow_regime: str                    # "LAMINAR", "TRANSITIONAL", "TURBULENT"
    trace_heating_power_kw: float
    is_line_plugging_risk: bool
    provenance: str = "SIMULATED"

class FlowlineModel:
    """Computes flowline pressure drop and surface heater duty."""

    def __init__(
        self,
        flowline_length_m: float = 300.0,
        flowline_id_inch: float = 3.826, # 4" schedule 40 pipe
        ambient_temp_celsius: float = 32.0,
        min_flowing_temp_celsius: float = 45.0
    ):
        self.length_m = flowline_length_m
        self.diameter_m = flowline_id_inch * 0.0254
        self.area_m2 = (np.pi / 4.0) * (self.diameter_m ** 2)
        self.ambient_temp_c = ambient_temp_celsius
        self.min_flowing_temp_c = min_flowing_temp_celsius

    def evaluate_flowline(
        self,
        liquid_rate_m3_d: float,
        wellhead_fluid_temp_c: float,
        viscosity_model
    ) -> FlowlineResult:
        """Computes flowline pressure drop and electrical heat tracing load."""
        # Temperature drop along surface line:
        avg_temp = max(self.ambient_temp_c, (wellhead_fluid_temp_c + self.ambient_temp_c) / 2.0)
        visc_cp = float(viscosity_model.compute_viscosity_cp(avg_temp))
        visc_pa_s = visc_cp * 1e-3
        
        # Velocity in flowline:
        q_m3_s = max(1e-6, liquid_rate_m3_d / 86400.0)
        velocity_m_s = q_m3_s / self.area_m2
        
        # Reynolds number: Re = rho * v * D / mu
        rho = 1010.0 # kg/m3
        reynolds = (rho * velocity_m_s * self.diameter_m) / max(visc_pa_s, 1e-4)
        
        # Friction factor:
        if reynolds < 2100.0:
            regime = "LAMINAR"
            f = 64.0 / max(reynolds, 1.0)
        else:
            regime = "TURBULENT"
            f = 0.316 / (reynolds ** 0.25)
            
        # Darcy-Weisbach pressure drop: delta_P = f * (L/D) * (rho * v^2 / 2)
        delta_p_pa = f * (self.length_m / self.diameter_m) * (rho * (velocity_m_s ** 2) / 2.0)
        delta_p_bar = delta_p_pa / 1e5

        # Trace heating power required if wellhead temp is below min flowing temp:
        if wellhead_fluid_temp_c < self.min_flowing_temp_c:
            delta_heat = self.min_flowing_temp_c - wellhead_fluid_temp_c
            # Heat required: m_dot * c_p * delta_T
            m_dot = q_m3_s * rho
            heater_kw = (m_dot * 2500.0 * delta_heat) / 1000.0
            plugging_risk = (visc_cp > 8000.0)
        else:
            heater_kw = 0.0
            plugging_risk = False

        return FlowlineResult(
            pressure_drop_bar=round(float(delta_p_bar), 2),
            surface_viscosity_cp=round(float(visc_cp), 1),
            flow_regime=regime,
            trace_heating_power_kw=round(float(heater_kw), 2),
            is_line_plugging_risk=plugging_risk,
            provenance="SIMULATED"
        )
