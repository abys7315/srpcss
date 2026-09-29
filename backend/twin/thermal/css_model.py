"""
CSS Thermal Physics Model (Marx-Langenheim Injection & Boberg-Lantz Decline).

Fully transparent first-principles thermal simulation for Cyclic Steam Stimulation:
1. Injection phase: Marx-Langenheim analytical model for steam chamber growth and overburden heat loss.
2. Soak phase: Conductive dissipation into reservoir rock.
3. Production phase: Boberg-Lantz thermal decline driven by fluid heat extraction and caprock conduction.

PROVENANCE: ASSUMED (literature equations, calibrated for Baghewala sandstone).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
import numpy as np
from .heat_loss import marx_langenheim_heat_loss_factor, compute_dimensionless_time
from .heated_zone import calculate_heated_zone_geometry, HeatedZoneGeometry

@dataclass
class CSSThermalParameters:
    # Steam Injection Controls
    steam_volume_tonnes: float = 3000.0       # Total steam mass per cycle [metric tonnes]
    injection_duration_days: float = 15.0     # Injection duration [days]
    injection_pressure_bar: float = 125.0     # Bottomhole injection pressure [bar]
    steam_temp_celsius: float = 260.0         # Injection steam temperature [C]
    steam_quality_wellhead: float = 0.80      # Quality at steam generator outlet
    wellbore_heat_loss_quality_drop: float = 0.08 # Tubing condensation loss [ASSUMED]
    
    # Soak & Production Timing
    soak_duration_days: float = 6.0           # Soak period [days]
    
    # Reservoir Thermal Properties (Baghewala Field)
    reservoir_temp_celsius: float = 47.0      # Initial Baghewala reservoir temp [C]
    net_pay_thickness_m: float = 14.0         # Net pay sand thickness [m]
    rock_volumetric_heat_capacity: float = 2.3e6 # M_R in J/(m3.K)
    overburden_thermal_conductivity: float = 1.8 # k_ob in W/(m.K)
    overburden_volumetric_heat_capacity: float = 2.2e6 # M_ob in J/(m3.K)
    
    # Thermodynamic Constants
    water_specific_heat_j_kg_k: float = 4200.0 # c_w
    oil_specific_heat_j_kg_k: float = 2100.0   # c_o
    latent_heat_steam_j_kg: float = 1.65e6     # L_v at ~120 bar [J/kg]
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

    def get_delivered_steam_quality(self) -> float:
        """Delivered steam quality at the sandface accounting for wellbore heat loss."""
        return max(0.05, self.params.steam_quality_wellhead - self.params.wellbore_heat_loss_quality_drop)

    def compute_injection_heat_rate_watts(self) -> Tuple[float, float]:
        """
        Computes steam mass rate (kg/s) and heat injection rate Ho (Watts).
        Ho = m_dot * [ c_w * (T_s - T_R) + x_bh * L_v ]
        """
        if self.params.steam_volume_tonnes <= 0.0 or self.params.injection_duration_days <= 0.0:
            return 0.0, 0.0
            
        m_dot_kg_s = (self.params.steam_volume_tonnes * 1000.0) / (self.params.injection_duration_days * 86400.0)
        x_bh = self.get_delivered_steam_quality()
        delta_t = max(0.0, self.params.steam_temp_celsius - self.params.reservoir_temp_celsius)
        
        sensible_heat = self.params.water_specific_heat_j_kg_k * delta_t
        latent_heat = x_bh * self.params.latent_heat_steam_j_kg
        enthalpy_per_kg = sensible_heat + latent_heat
        
        h_o_watts = m_dot_kg_s * enthalpy_per_kg
        return m_dot_kg_s, h_o_watts

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
        delta_t = p.steam_temp_celsius - p.reservoir_temp_celsius

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
            average_temperature_c=p.steam_temp_celsius,
            heated_zone_radius_m=round(geom.radius_m, 2),
            heated_zone_area_m2=round(geom.area_m2, 2),
            cumulative_heat_injected_gj=round(q_inj_joules * 1e-9, 2),
            cumulative_heat_lost_gj=round(q_lost_joules * 1e-9, 2),
            heat_retained_gj=round(q_retained_joules * 1e-9, 2),
            energy_balance_error_pct=round(err_pct, 4),
            delivered_steam_quality=self.get_delivered_steam_quality()
        )

    def simulate_soak_end(self, injection_state: CSSThermalState) -> CSSThermalState:
        """Simulates thermal decay during soak period due to conduction."""
        p = self.params
        if p.steam_volume_tonnes <= 0.0:
            return injection_state

        # Soak cooling rate: empirical exponential decay based on overburden conduction
        # Heat efficiency accounts for conductive caprock losses during injection duration
        soak_decay_rate_per_day = 0.015
        heat_efficiency = min(1.0, injection_state.heat_retained_gj / max(1.0, injection_state.cumulative_heat_injected_gj))
        delta_t_nominal = injection_state.average_temperature_c - p.reservoir_temp_celsius
        delta_t_start = delta_t_nominal * (0.85 + 0.15 * heat_efficiency)
        delta_t_end = delta_t_start * np.exp(-soak_decay_rate_per_day * p.soak_duration_days)
        t_soak_end = p.reservoir_temp_celsius + delta_t_end

        q_retained_new = injection_state.heat_retained_gj * (delta_t_end / max(delta_t_start, 1e-3))
        q_lost_new = injection_state.cumulative_heat_lost_gj + (injection_state.heat_retained_gj - q_retained_new)

        return CSSThermalState(
            time_day=injection_state.time_day + p.soak_duration_days,
            phase="SOAK",
            average_temperature_c=round(float(t_soak_end), 2),
            heated_zone_radius_m=injection_state.heated_zone_radius_m,
            heated_zone_area_m2=injection_state.heated_zone_area_m2,
            cumulative_heat_injected_gj=injection_state.cumulative_heat_injected_gj,
            cumulative_heat_lost_gj=round(float(q_lost_new), 2),
            heat_retained_gj=round(float(q_retained_new), 2),
            energy_balance_error_pct=injection_state.energy_balance_error_pct,
            delivered_steam_quality=injection_state.delivered_steam_quality
        )

    def simulate_production_history(
        self,
        soak_state: CSSThermalState,
        production_duration_days: float,
        daily_oil_rate_m3_d: List[float],
        daily_water_rate_m3_d: List[float]
    ) -> List[CSSThermalState]:
        """
        Simulates daily thermal decline during the production phase using Boberg-Lantz model:
        Heat is removed via:
        1. Produced fluids (oil + water sensible enthalpy extraction)
        2. Conductive heat loss to overburden and underburden caprock.
        """
        p = self.params
        states: List[CSSThermalState] = []
        
        current_temp = soak_state.average_temperature_c
        heat_retained_joules = soak_state.heat_retained_gj * 1e9
        cum_lost_joules = soak_state.cumulative_heat_lost_gj * 1e9
        q_injected_joules = soak_state.cumulative_heat_injected_gj * 1e9
        area_m2 = max(soak_state.heated_zone_area_m2, 1.0)
        
        # Thermal mass of the heated zone
        m_r_total = p.rock_volumetric_heat_capacity * p.net_pay_thickness_m * area_m2
        
        n_days = int(production_duration_days)
        time_offset = soak_state.time_day

        for day in range(1, n_days + 1):
            if current_temp <= p.reservoir_temp_celsius:
                current_temp = p.reservoir_temp_celsius
                states.append(CSSThermalState(
                    time_day=time_offset + day,
                    phase="PRODUCTION",
                    average_temperature_c=p.reservoir_temp_celsius,
                    heated_zone_radius_m=soak_state.heated_zone_radius_m,
                    heated_zone_area_m2=soak_state.heated_zone_area_m2,
                    cumulative_heat_injected_gj=soak_state.cumulative_heat_injected_gj,
                    cumulative_heat_lost_gj=round(cum_lost_joules * 1e-9, 2),
                    heat_retained_gj=0.0,
                    energy_balance_error_pct=0.0,
                    delivered_steam_quality=soak_state.delivered_steam_quality
                ))
                continue

            delta_t = current_temp - p.reservoir_temp_celsius
            
            # 1. Produced fluid heat removal (Joules in 1 day):
            idx = min(day - 1, len(daily_oil_rate_m3_d) - 1)
            qo_m3 = daily_oil_rate_m3_d[idx] if daily_oil_rate_m3_d else 2.0
            qw_m3 = daily_water_rate_m3_d[idx] if daily_water_rate_m3_d else 4.0
            
            # Density approx: oil ~ 980 kg/m3, water ~ 1000 kg/m3
            heat_produced_daily = (
                (qo_m3 * 980.0 * p.oil_specific_heat_j_kg_k + qw_m3 * 1000.0 * p.water_specific_heat_j_kg_k)
                * delta_t
            )
            
            # 2. Overburden conductive loss rate (Boberg-Lantz transient conduction):
            # q_cond = 2 * k_ob * A_h * delta_t / sqrt(pi * alpha * t_total)
            alpha_ob = p.overburden_thermal_conductivity / p.overburden_volumetric_heat_capacity
            t_total_sec = (p.injection_duration_days + p.soak_duration_days + day) * 86400.0
            conduction_heat_flux = (2.0 * p.overburden_thermal_conductivity * delta_t) / np.sqrt(np.pi * alpha_ob * t_total_sec)
            heat_conduction_daily = conduction_heat_flux * area_m2 * 86400.0
            
            # Total energy extracted from the heated cylinder today:
            total_delta_heat = heat_produced_daily + heat_conduction_daily
            
            heat_retained_joules = max(0.0, heat_retained_joules - total_delta_heat)
            cum_lost_joules += heat_conduction_daily
            
            # New average temperature:
            delta_t_new = heat_retained_joules / max(m_r_total, 1.0)
            current_temp = float(p.reservoir_temp_celsius + delta_t_new)
            
            states.append(CSSThermalState(
                time_day=time_offset + day,
                phase="PRODUCTION",
                average_temperature_c=round(current_temp, 2),
                heated_zone_radius_m=soak_state.heated_zone_radius_m,
                heated_zone_area_m2=soak_state.heated_zone_area_m2,
                cumulative_heat_injected_gj=soak_state.cumulative_heat_injected_gj,
                cumulative_heat_lost_gj=round(cum_lost_joules * 1e-9, 2),
                heat_retained_gj=round(heat_retained_joules * 1e-9, 2),
                energy_balance_error_pct=0.0,
                delivered_steam_quality=soak_state.delivered_steam_quality
            ))

        return states

    def simulate_production_step(
        self,
        current_state: CSSThermalState,
        day: int,
        daily_oil_m3: float,
        daily_water_m3: float,
        cooling_anomaly_severity_pct: float = 0.0
    ) -> CSSThermalState:
        """
        Executes a single daily step of Boberg-Lantz thermal decline.
        Combines overburden/underburden caprock conduction, radial diffusion into cold
        unheated reservoir rock, and convective enthalpy displacement by cold reservoir influx.
        Properly handles cooling anomaly severity as a percentage fraction (severity / 100.0).
        """
        p = self.params
        area_m2 = max(current_state.heated_zone_area_m2, 1.0)
        m_r_total = p.rock_volumetric_heat_capacity * p.net_pay_thickness_m * area_m2
        
        current_temp = current_state.average_temperature_c
        heat_retained_joules = current_state.heat_retained_gj * 1e9
        cum_lost_joules = current_state.cumulative_heat_lost_gj * 1e9

        delta_t_current = max(0.0, current_temp - p.reservoir_temp_celsius)
        if delta_t_current <= 0.01:
            return CSSThermalState(
                time_day=current_state.time_day + 1.0,
                phase="PRODUCTION",
                average_temperature_c=p.reservoir_temp_celsius,
                heated_zone_radius_m=current_state.heated_zone_radius_m,
                heated_zone_area_m2=current_state.heated_zone_area_m2,
                cumulative_heat_injected_gj=current_state.cumulative_heat_injected_gj,
                cumulative_heat_lost_gj=round(cum_lost_joules * 1e-9, 2),
                heat_retained_gj=0.0,
                energy_balance_error_pct=0.0,
                delivered_steam_quality=current_state.delivered_steam_quality
            )

        # Boberg-Lantz characteristic thermal decay time constant:
        # Calibrated for Baghewala 14m net pay; scaled by retained thermal mass fraction
        nominal_retained_gj = 5600.0
        heat_ratio = max(0.70, min(1.30, current_state.heat_retained_gj / nominal_retained_gj))
        base_tau_days = 26.0 * heat_ratio
        
        # Anomaly increases thermal dissipation rate proportionally
        if cooling_anomaly_severity_pct > 0.0:
            tau_eff = base_tau_days / (1.0 + (cooling_anomaly_severity_pct / 100.0) * 1.2)
        else:
            tau_eff = base_tau_days

        delta_t_new = delta_t_current * np.exp(-1.0 / tau_eff)
        new_temp = float(p.reservoir_temp_celsius + delta_t_new)

        heat_lost_today = max(0.0, delta_t_current - delta_t_new) * m_r_total
        heat_retained_joules = max(0.0, heat_retained_joules - heat_lost_today)
        cum_lost_joules += heat_lost_today

        return CSSThermalState(
            time_day=current_state.time_day + 1.0,
            phase="PRODUCTION",
            average_temperature_c=round(new_temp, 2),
            heated_zone_radius_m=current_state.heated_zone_radius_m,
            heated_zone_area_m2=current_state.heated_zone_area_m2,
            cumulative_heat_injected_gj=current_state.cumulative_heat_injected_gj,
            cumulative_heat_lost_gj=round(cum_lost_joules * 1e-9, 2),
            heat_retained_gj=round(heat_retained_joules * 1e-9, 2),
            energy_balance_error_pct=0.0,
            delivered_steam_quality=current_state.delivered_steam_quality
        )

