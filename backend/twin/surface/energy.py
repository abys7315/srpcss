"""
Field Energy Accounting and Key Performance Indicators.

Calculates Steam-to-Oil Ratio (SOR), total specific energy per barrel,
operating cost breakdown, and Net Benefit.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class EnergyKPIs:
    steam_oil_ratio_tonne_tonne: float  # SOR [tonnes steam / tonne oil]
    steam_oil_ratio_bbl_bbl: float      # [cold water equivalent bbl steam / bbl oil]
    electrical_energy_kwh_per_bbl: float
    total_energy_intensity_gj_per_bbl: float
    total_steam_cost_usd: float
    total_electricity_cost_usd: float
    total_operating_cost_usd: float
    gross_revenue_usd: float
    net_benefit_usd: float
    cost_per_barrel_usd: float
    provenance: str = "SIMULATED"

def compute_canonical_sor(steam_mass_tonnes: float, cumulative_oil_bbl: float, oil_tonnes_per_bbl: float = 0.160) -> float:
    """
    Centralized canonical mass-basis Steam-Oil Ratio (SOR) calculation.
    Units: tonnes steam / tonnes oil (t steam / t oil).
    Baghewala 18 API crude ~ 1010 kg/m3 (~0.160 tonnes/bbl).
    """
    oil_tonnes = max(0.1, cumulative_oil_bbl * oil_tonnes_per_bbl)
    return round(float(steam_mass_tonnes / oil_tonnes), 2)

class FieldEnergyAccounting:
    """Combines steam generator fuel energy and SRP pumping electrical energy."""

    def __init__(
        self,
        crude_oil_price_usd_bbl: float = 58.0,
        electricity_tariff_usd_kwh: float = 0.11,
        water_handling_cost_usd_bbl: float = 1.20,
        fixed_daily_opex_usd: float = 85.0
    ):
        self.oil_price_usd = crude_oil_price_usd_bbl
        self.elec_tariff = electricity_tariff_usd_kwh
        self.water_cost_bbl = water_handling_cost_usd_bbl
        self.fixed_daily_opex = fixed_daily_opex_usd

    def compute_cycle_kpis(
        self,
        steam_mass_tonnes: float,
        steam_cost_usd: float,
        cumulative_oil_bbl: float,
        cumulative_water_bbl: float,
        total_pumping_kwh: float,
        cycle_duration_days: float
    ) -> EnergyKPIs:
        """Computes comprehensive energy and financial metrics for a CSS+SRP cycle."""
        # Convert cumulative oil to tonnes:
        # Baghewala 18 API oil density ~1010 kg/m3. 1 bbl = 0.158987 m3 -> ~0.160 tonnes/bbl
        oil_tonnes = max(0.1, cumulative_oil_bbl * 0.160)
        
        # Steam-to-Oil Ratio (SOR):
        # tonnes steam / tonne oil (canonical mass basis)
        sor_wt = compute_canonical_sor(steam_mass_tonnes, cumulative_oil_bbl, 0.160)
        # bbl steam CWE / bbl oil (1 tonne water ~ 6.29 bbl):
        sor_vol = (steam_mass_tonnes * 6.29) / max(0.1, cumulative_oil_bbl)

        # Electricity cost:
        elec_cost_usd = total_pumping_kwh * self.elec_tariff
        
        # Water disposal and fixed opex:
        water_disp_cost = cumulative_water_bbl * self.water_cost_bbl
        fixed_opex = cycle_duration_days * self.fixed_daily_opex
        
        total_opex = steam_cost_usd + elec_cost_usd + water_disp_cost + fixed_opex
        
        # Gross revenue:
        gross_rev = cumulative_oil_bbl * self.oil_price_usd
        net_benefit = gross_rev - total_opex
        
        cost_per_bbl = total_opex / max(0.1, cumulative_oil_bbl)
        elec_per_bbl = total_pumping_kwh / max(0.1, cumulative_oil_bbl)
        
        # Total energy intensity (GJ/bbl):
        # 1 tonne steam ~ 2.65 GJ thermal energy. 1 kWh = 0.0036 GJ.
        total_gj = (steam_mass_tonnes * 2.65) + (total_pumping_kwh * 0.0036)
        gj_per_bbl = total_gj / max(0.1, cumulative_oil_bbl)

        return EnergyKPIs(
            steam_oil_ratio_tonne_tonne=round(float(sor_wt), 2),
            steam_oil_ratio_bbl_bbl=round(float(sor_vol), 2),
            electrical_energy_kwh_per_bbl=round(float(elec_per_bbl), 2),
            total_energy_intensity_gj_per_bbl=round(float(gj_per_bbl), 3),
            total_steam_cost_usd=round(float(steam_cost_usd), 2),
            total_electricity_cost_usd=round(float(elec_cost_usd), 2),
            total_operating_cost_usd=round(float(total_opex), 2),
            gross_revenue_usd=round(float(gross_rev), 2),
            net_benefit_usd=round(float(net_benefit), 2),
            cost_per_barrel_usd=round(float(cost_per_bbl), 2),
            provenance="SIMULATED"
        )
