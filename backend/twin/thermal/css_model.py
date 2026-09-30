"""
CSS Thermal Physics Model (Marx-Langenheim Injection & Boberg-Lantz Decline).

Fully transparent first-principles thermal simulation for Cyclic Steam Stimulation:
1. Injection phase: Marx-Langenheim analytical model for steam chamber growth and overburden heat loss.
2. Soak phase: Conductive dissipation into reservoir rock.
3. Production phase: Boberg-Lantz thermal decline driven by fluid heat extraction and caprock conduction.

PROVENANCE: ASSUMED (literature equations, calibrated for Baghewala sandstone).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from .heat_loss import marx_langenheim_heat_loss_factor, compute_dimensionless_time
from .heated_zone import calculate_heated_zone_geometry, HeatedZoneGeometry
from .steam_props import saturated_steam, SaturatedSteam
from core.config import canonical_config as _C

_RHO_OIL = _C.fluid.dead_oil_density_kg_m3
_RHO_WATER = 1000.0


@dataclass
class CSSThermalParameters:
    # Steam injection controls (defaults from configs/field.yaml)
    steam_volume_tonnes: float = _C.css.default_steam_volume_tonnes
    injection_duration_days: float = _C.css.default_injection_duration_days
    injection_pressure_bar: float = _C.css.default_injection_pressure_bar   # bottomhole; sets Tsat, h_fg
    steam_temp_celsius: Optional[float] = None   # derived: Tsat(injection_pressure_bar); input ignored
    steam_quality_wellhead: float = _C.css.default_steam_quality_wellhead
    delivered_steam_quality: Optional[float] = None  # sandface quality from wellbore heat-loss model

    soak_duration_days: float = _C.css.default_soak_days

    # Reservoir thermal properties
    reservoir_temp_celsius: float = _C.reservoir.initial_temperature_c
    net_pay_thickness_m: float = _C.reservoir.net_pay_thickness_m
    rock_volumetric_heat_capacity: float = _C.reservoir.rock_volumetric_heat_capacity_j_m3_k
    overburden_thermal_conductivity: float = _C.reservoir.overburden_conductivity_w_m_k
    overburden_volumetric_heat_capacity: float = _C.reservoir.overburden_volumetric_heat_capacity_j_m3_k
    thermal_loss_calibration: float = _C.reservoir.thermal_loss_calibration

    water_specific_heat_j_kg_k: float = _C.css.water_specific_heat_j_kg_k
    oil_specific_heat_j_kg_k: float = _C.css.oil_specific_heat_j_kg_k
    provenance: str = "ASSUMED"

@dataclass
class CSSThermalState:
    time_day: float
    phase: str                      # "INJECTION", "SOAK", "PRODUCTION"
    average_temperature_c: float
    heated_zone_radius_m: float
    heated_zone_area_m2: float
    cumulative_heat_injected_gj: float
    cumulative_heat_lost_gj: float
    heat_retained_gj: float
    energy_balance_error_pct: float
    delivered_steam_quality: float
    provenance: str = "SIMULATED"

class CSSThermalModel:
    """Simulates the thermal response of a CSS cycle in Baghewala heavy oil reservoir."""

    def __init__(self, params: CSSThermalParameters = None):
        self.params = params or CSSThermalParameters()

    @property
    def steam(self) -> SaturatedSteam:
        """IAPWS-IF97 saturation state at the bottomhole injection pressure."""
        return saturated_steam(self.params.injection_pressure_bar)

    @property
    def steam_temp_c(self) -> float:
        return self.steam.t_sat_c

    def get_delivered_steam_quality(self) -> float:
        """Sandface steam quality (from the wellbore heat-loss model when supplied)."""
        if self.params.delivered_steam_quality is not None:
            return float(np.clip(self.params.delivered_steam_quality, 0.0, 1.0))
        return max(0.05, self.params.steam_quality_wellhead - 0.05)

    def enthalpy_above_reservoir_j_kg(self) -> float:
        """Specific heat delivered per kg steam relative to reservoir-temperature water:
        h = (h_f(P) - h_w(T_R)) + x_bh * h_fg(P)."""
        s = self.steam
        h_w_res = self.params.water_specific_heat_j_kg_k * self.params.reservoir_temp_celsius
        return max(0.0, s.h_f_j_kg - h_w_res) + self.get_delivered_steam_quality() * s.h_fg_j_kg

    def compute_injection_heat_rate_watts(self) -> Tuple[float, float]:
        """Steam mass rate [kg/s] and heat injection rate H_o = m_dot * h [W]."""
        if self.params.steam_volume_tonnes <= 0.0 or self.params.injection_duration_days <= 0.0:
            return 0.0, 0.0
        m_dot_kg_s = (self.params.steam_volume_tonnes * 1000.0) / (self.params.injection_duration_days * 86400.0)
        return m_dot_kg_s, m_dot_kg_s * self.enthalpy_above_reservoir_j_kg()

    def heat_loss_conductance_w_k(self, area_m2: float, elapsed_s: float, fluid_heat_capacity_rate_w_k: float = 0.0) -> float:
        """Lumped heated-zone loss conductance U [W/K] (Boberg-Lantz form):
        U = kappa * [ 2 k_ob A / sqrt(pi alpha_ob t) + (q_o rho_o c_o + q_w rho_w c_w) ]
        First term: transient conduction to over- and underburden. Second: enthalpy carried
        out by produced fluids. kappa = thermal_loss_calibration (one documented scalar)."""
        p = self.params
        alpha_ob = p.overburden_thermal_conductivity / p.overburden_volumetric_heat_capacity
        cond = 2.0 * p.overburden_thermal_conductivity * area_m2 / np.sqrt(np.pi * alpha_ob * max(elapsed_s, 3600.0))
        return p.thermal_loss_calibration * (cond + max(0.0, fluid_heat_capacity_rate_w_k))

    def zone_heat_capacity_j_k(self, area_m2: float) -> float:
        p = self.params
        return p.rock_volumetric_heat_capacity * p.net_pay_thickness_m * max(area_m2, 1.0)

    def time_constant_days(self, area_m2: float, elapsed_s: float, fluid_heat_capacity_rate_w_k: float = 0.0) -> float:
        """tau = C_zone / U, in days."""
        u = self.heat_loss_conductance_w_k(area_m2, elapsed_s, fluid_heat_capacity_rate_w_k)
        return self.zone_heat_capacity_j_k(area_m2) / max(u, 1e-9) / 86400.0

    def simulate_injection_end(self) -> CSSThermalState:
        """Simulates state at the end of the steam injection phase using Marx-Langenheim."""
        p = self.params
        if p.steam_volume_tonnes <= 0.0:
            # Zero steam edge case: no heating
            return CSSThermalState(
                time_day=p.injection_duration_days,
                phase="INJECTION",
                average_temperature_c=p.reservoir_temp_celsius,
                heated_zone_radius_m=0.0,
                heated_zone_area_m2=0.0,
                cumulative_heat_injected_gj=0.0,
                cumulative_heat_lost_gj=0.0,
                heat_retained_gj=0.0,
                energy_balance_error_pct=0.0,
                delivered_steam_quality=self.get_delivered_steam_quality()
            )

        t_inj_sec = p.injection_duration_days * 86400.0
        m_dot, h_o = self.compute_injection_heat_rate_watts()
        delta_t = self.steam_temp_c - p.reservoir_temp_celsius

        # Dimensionless time t_D
        t_d = compute_dimensionless_time(
            t_inj_sec,
            p.overburden_thermal_conductivity,
            p.overburden_volumetric_heat_capacity,
            p.rock_volumetric_heat_capacity,
            p.net_pay_thickness_m
        )

        # Marx-Langenheim heated area:
        # A_h = (H_o * M_R * h_n) / [ 4 * k_ob * M_ob * delta_T ] * F(t_D)
        # Note: (4 * k_ob * M_ob * delta_T) / (M_R * h_n) = (H_o * t_D) / (A_ideal * t_D)
        # Directly: A_h(t) = (H_o * t) / [ M_R * h_n * delta_T ] * (F(t_D) / t_D)
        f_td = marx_langenheim_heat_loss_factor(t_d)
        
        # Scaling constant:
        numerator = h_o * p.rock_volumetric_heat_capacity * p.net_pay_thickness_m
        denominator = 4.0 * p.overburden_thermal_conductivity * p.overburden_volumetric_heat_capacity * max(delta_t, 1.0)
        area_m2 = (numerator / denominator) * f_td
        
        geom = calculate_heated_zone_geometry(area_m2, p.net_pay_thickness_m, p.rock_volumetric_heat_capacity)
        
        # Heat accounting (Joules)
        q_inj_joules = h_o * t_inj_sec
        q_retained_joules = geom.heat_capacity_j_k * delta_t
        # Thermal loss to caprock
        q_lost_joules = max(0.0, q_inj_joules - q_retained_joules)
        
        # Energy balance check:
        q_balance = abs(q_inj_joules - (q_retained_joules + q_lost_joules))
        err_pct = (q_balance / max(q_inj_joules, 1.0)) * 100.0

        return CSSThermalState(
            time_day=p.injection_duration_days,
            phase="INJECTION",
            average_temperature_c=round(self.steam_temp_c, 2),
            heated_zone_radius_m=round(geom.radius_m, 2),
            heated_zone_area_m2=round(geom.area_m2, 2),
            cumulative_heat_injected_gj=round(q_inj_joules * 1e-9, 2),
            cumulative_heat_lost_gj=round(q_lost_joules * 1e-9, 2),
            heat_retained_gj=round(q_retained_joules * 1e-9, 2),
            energy_balance_error_pct=round(err_pct, 4),
            delivered_steam_quality=self.get_delivered_steam_quality()
        )

    def _decay(self, state: CSSThermalState, days: float, elapsed_start_s: float,
               fluid_w_k: float, anomaly_multiplier: float, phase: str) -> CSSThermalState:
        """Integrates the lumped balance C dT/dt = -U(t) (T - T_R) over `days` (sub-daily steps)."""
        p = self.params
        area = max(state.heated_zone_area_m2, 1.0)
        c_zone = self.zone_heat_capacity_j_k(area)
        delta_t = max(0.0, state.average_temperature_c - p.reservoir_temp_celsius)
        n = max(1, int(np.ceil(days)))
        dt_s = days * 86400.0 / n
        for i in range(n):
            t_mid = elapsed_start_s + (i + 0.5) * dt_s
            u = self.heat_loss_conductance_w_k(area, t_mid, fluid_w_k) * anomaly_multiplier
            delta_t *= float(np.exp(-u * dt_s / c_zone))
        retained_new = c_zone * delta_t * 1e-9
        lost_new = state.cumulative_heat_lost_gj + max(0.0, state.heat_retained_gj - retained_new)
        return CSSThermalState(
            time_day=state.time_day + days,
            phase=phase,
            average_temperature_c=round(float(p.reservoir_temp_celsius + delta_t), 2),
            heated_zone_radius_m=state.heated_zone_radius_m,
            heated_zone_area_m2=state.heated_zone_area_m2,
            cumulative_heat_injected_gj=state.cumulative_heat_injected_gj,
            cumulative_heat_lost_gj=round(float(lost_new), 2),
            heat_retained_gj=round(float(retained_new), 2),
            energy_balance_error_pct=state.energy_balance_error_pct,
            delivered_steam_quality=state.delivered_steam_quality,
        )

    def simulate_soak_end(self, injection_state: CSSThermalState) -> CSSThermalState:
        """Soak: well shut in, so only conduction to over/underburden removes heat."""
        p = self.params
        if p.steam_volume_tonnes <= 0.0 or p.soak_duration_days <= 0.0:
            return CSSThermalState(**{**injection_state.__dict__, "phase": "SOAK"})
        return self._decay(injection_state, p.soak_duration_days, p.injection_duration_days * 86400.0,
                           fluid_w_k=0.0, anomaly_multiplier=1.0, phase="SOAK")

    @staticmethod
    def fluid_heat_capacity_rate_w_k(oil_m3_d: float, water_m3_d: float,
                                     c_o: float = _C.css.oil_specific_heat_j_kg_k,
                                     c_w: float = _C.css.water_specific_heat_j_kg_k) -> float:
        """(q_o rho_o c_o + q_w rho_w c_w) in W/K for daily volumes in m3/d."""
        return (max(0.0, oil_m3_d) * _RHO_OIL * c_o + max(0.0, water_m3_d) * _RHO_WATER * c_w) / 86400.0

    def simulate_production_step(
        self,
        current_state: CSSThermalState,
        day: int,
        daily_oil_m3: float,
        daily_water_m3: float,
        cooling_anomaly_severity_pct: float = 0.0
    ) -> CSSThermalState:
        """
        One production day of the lumped heated-zone energy balance.
        tau(t) = C_zone / U(t), with U from overburden conduction and produced-fluid heat flow
        (see heat_loss_conductance_w_k). A seeded cooling anomaly (scenario input) scales U by
        (1 + 1.2 * severity/100).
        """
        p = self.params
        fluid_w_k = self.fluid_heat_capacity_rate_w_k(daily_oil_m3, daily_water_m3,
                                                      p.oil_specific_heat_j_kg_k, p.water_specific_heat_j_kg_k)
        anomaly = 1.0 + 1.2 * max(0.0, cooling_anomaly_severity_pct) / 100.0
        elapsed_s = (p.injection_duration_days + p.soak_duration_days + max(0, day - 1)) * 86400.0
        return self._decay(current_state, 1.0, elapsed_s, fluid_w_k, anomaly, phase="PRODUCTION")

    def simulate_production_history(
        self,
        soak_state: CSSThermalState,
        production_duration_days: float,
        daily_oil_rate_m3_d: List[float],
        daily_water_rate_m3_d: List[float]
    ) -> List[CSSThermalState]:
        """Daily production-phase decline using the same balance as simulate_production_step."""
        states: List[CSSThermalState] = []
        state = soak_state
        for day in range(1, int(production_duration_days) + 1):
            idx = day - 1
            qo = daily_oil_rate_m3_d[min(idx, len(daily_oil_rate_m3_d) - 1)] if daily_oil_rate_m3_d else 0.0
            qw = daily_water_rate_m3_d[min(idx, len(daily_water_rate_m3_d) - 1)] if daily_water_rate_m3_d else 0.0
            state = self.simulate_production_step(state, day, qo, qw)
            states.append(state)
        return states
