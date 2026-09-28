"""
Surface Steam Generation and Fuel Consumption (Once-Through Steam Generator - OTSG).

Calculates natural gas fuel required to generate steam, boiler efficiency,
and thermal cost per tonne of steam.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass

@dataclass
class SteamGenerationResult:
    steam_mass_tonnes: float
    fuel_gas_consumed_m3: float
    steam_generation_cost_usd: float
    thermal_energy_injected_gj: float
    co2_emissions_tonnes: float
    boiler_efficiency: float
    cost_per_tonne_usd: float
    provenance: str = "SIMULATED"

class SteamGeneratorModel:
    """Models OTSG thermal boiler efficiency, gas fuel rate, and operating expenditure."""

    def __init__(
        self,
        boiler_efficiency: float = 0.82,
        natural_gas_lhv_mj_m3: float = 38.0, # Lower heating value of natural gas
        gas_price_usd_per_m3: float = 0.32,
        water_treatment_cost_usd_tonne: float = 2.50,
        boiler_maintenance_usd_tonne: float = 1.80
    ):
        self.boiler_efficiency = boiler_efficiency
        self.gas_lhv_mj = natural_gas_lhv_mj_m3
        self.gas_price_usd = gas_price_usd_per_m3
        self.water_cost_tonne = water_treatment_cost_usd_tonne
        self.maint_cost_tonne = boiler_maintenance_usd_tonne

    def evaluate_generation(
        self,
        steam_mass_tonnes: float,
        steam_temp_celsius: float = 260.0,
        feedwater_temp_celsius: float = 25.0,
        steam_quality: float = 0.80
    ) -> SteamGenerationResult:
        """
        Computes fuel required:
        Q_steam = m * [ c_w * (T_s - T_fw) + x * L_v ]
        Fuel_energy = Q_steam / boiler_efficiency
        """
        if steam_mass_tonnes <= 0.0:
            return SteamGenerationResult(
                steam_mass_tonnes=0.0,
                fuel_gas_consumed_m3=0.0,
                steam_generation_cost_usd=0.0,
                thermal_energy_injected_gj=0.0,
                co2_emissions_tonnes=0.0,
                boiler_efficiency=self.boiler_efficiency,
                cost_per_tonne_usd=0.0
            )

        m_kg = steam_mass_tonnes * 1000.0
        delta_t = max(0.0, steam_temp_celsius - feedwater_temp_celsius)
        
        # Enthalpy per kg (J/kg):
        sensible = 4200.0 * delta_t
        latent = steam_quality * 1.65e6
        enthalpy_j_per_kg = sensible + latent
        
        # Total heat required (GJ):
        total_heat_j = m_kg * enthalpy_j_per_kg
        total_heat_gj = total_heat_j * 1e-9
        
        # Fuel energy input (MJ):
        fuel_energy_mj = (total_heat_j * 1e-6) / self.boiler_efficiency
        fuel_gas_m3 = fuel_energy_mj / self.gas_lhv_mj
        
        # Fuel cost + water treatment + boiler maintenance:
        fuel_cost = fuel_gas_m3 * self.gas_price_usd
        water_cost = steam_mass_tonnes * self.water_cost_tonne
        maint_cost = steam_mass_tonnes * self.maint_cost_tonne
        total_cost = fuel_cost + water_cost + maint_cost
        cost_per_tonne = total_cost / max(steam_mass_tonnes, 1e-4)

        # CO2 emissions (~1.9 kg CO2 per m3 natural gas burned):
        co2_tonnes = (fuel_gas_m3 * 1.9) / 1000.0

        return SteamGenerationResult(
            steam_mass_tonnes=round(steam_mass_tonnes, 1),
            fuel_gas_consumed_m3=round(fuel_gas_m3, 1),
            steam_generation_cost_usd=round(total_cost, 2),
            thermal_energy_injected_gj=round(total_heat_gj, 1),
            co2_emissions_tonnes=round(co2_tonnes, 2),
            boiler_efficiency=self.boiler_efficiency,
            cost_per_tonne_usd=round(cost_per_tonne, 2),
            provenance="SIMULATED"
        )
