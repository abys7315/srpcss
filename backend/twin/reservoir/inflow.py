"""
Reservoir Inflow Performance Relationship (IPR) Under Thermal Drive.

Computes temperature-dependent mobility-adjusted productivity index (PI)
and Vogel inflow for Baghewala heavy oil wells under low reservoir pressure.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
import numpy as np

@dataclass
class ReservoirParameters:
    initial_pressure_bar: float = 65.0      # Baghewala depleted pressure ~65 bar [ASSUMED]
    reference_temp_celsius: float = 47.0    # Initial reservoir temp [C]
    reference_pi_m3_d_bar: float = 0.08     # Cold dead oil productivity index [m3/d/bar]
    permeability_md: float = 250.0          # Average permeability
    skin_factor: float = 2.0                # Mechanical skin factor
    drainage_radius_m: float = 150.0
    wellbore_radius_m: float = 0.108
    provenance: str = "ASSUMED"

@dataclass
class ReservoirState:
    current_pressure_bar: float
    current_temperature_c: float
    oil_viscosity_cp: float
    mobility_ratio: float                   # (k/mu) / (k/mu)_ref
    productivity_index_m3_d_bar: float
    q_max_oil_m3_d: float                   # Maximum open-flow capacity at pwf=0
    provenance: str = "SIMULATED"

class ThermalInflowModel:
    """Computes Vogel and Darcy inflow rates scaled by thermal viscosity reduction."""

    def __init__(self, params: ReservoirParameters = None, ref_viscosity_cp: float = 4500.0):
        self.params = params or ReservoirParameters()
        self.ref_viscosity_cp = ref_viscosity_cp

    def evaluate_reservoir_state(
        self,
        current_temp_c: float,
        current_viscosity_cp: float,
        reservoir_pressure_bar: float = None
    ) -> ReservoirState:
        """
        Calculates temperature-adjusted productivity index:
        J(T) = J_ref * (mu_ref / mu(T))
        """
        p_res = reservoir_pressure_bar if reservoir_pressure_bar is not None else self.params.initial_pressure_bar
        p_res = max(5.0, float(p_res))
        
        visc = max(current_viscosity_cp, 1.0)
        mobility_ratio = self.ref_viscosity_cp / visc
        
        # Thermal PI in m3/day/bar:
        j_thermal = self.params.reference_pi_m3_d_bar * mobility_ratio
        
        # Vogel q_max: q_max = J * P_res / 1.8
        q_max = (j_thermal * p_res) / 1.8

        return ReservoirState(
            current_pressure_bar=round(p_res, 2),
            current_temperature_c=round(current_temp_c, 2),
            oil_viscosity_cp=round(visc, 2),
            mobility_ratio=round(mobility_ratio, 2),
            productivity_index_m3_d_bar=round(j_thermal, 4),
            q_max_oil_m3_d=round(q_max, 2),
            provenance="SIMULATED"
        )

    def compute_oil_rate_vogel(
        self,
        res_state: ReservoirState,
        bottomhole_flowing_pressure_bar: float
    ) -> float:
        """
        Vogel Inflow equation:
        q_o = q_max * [ 1 - 0.2*(pwf/Pr) - 0.8*(pwf/Pr)^2 ]
        """
        pwf = np.clip(bottomhole_flowing_pressure_bar, 0.0, res_state.current_pressure_bar)
        ratio = pwf / res_state.current_pressure_bar
        vogel_term = max(0.0, 1.0 - 0.2 * ratio - 0.8 * (ratio ** 2))
        return float(res_state.q_max_oil_m3_d * vogel_term)

    def compute_pwf_from_target_rate(
        self,
        res_state: ReservoirState,
        target_oil_rate_m3_d: float
    ) -> float:
        """
        Inverts Vogel equation to find required pwf for a given target oil rate.
        If target exceeds q_max, pwf is 0 (maximum drawdown).
        """
        if target_oil_rate_m3_d >= res_state.q_max_oil_m3_d:
            return 1.0 # Minimum 1 bar
            
        fraction = target_oil_rate_m3_d / max(res_state.q_max_oil_m3_d, 1e-4)
        # 0.8 * r^2 + 0.2 * r - (1 - fraction) = 0
        # r = [-0.2 + sqrt(0.04 - 4*0.8*(-(1-fraction)))] / (2*0.8)
        disc = 0.04 + 3.2 * (1.0 - fraction)
        ratio = (-0.2 + np.sqrt(max(0.0, disc))) / 1.6
        return float(np.clip(ratio * res_state.current_pressure_bar, 1.0, res_state.current_pressure_bar))
