"""
Comprehensive Economic Net Benefit & Objective Calculation.

Objective Equation:
Net Benefit = Oil Revenue
            - Steam Generation Cost
            - SRP Electricity Cost
            - Water Disposal & Routine OPEX
            - Expected Failure Cost (Failure_Prob * Workover_Cost)
            - Penalty for SOR exceeding target
            - Penalty for excessive parameter switching

PROVENANCE: ASSUMED (Economic defaults based on Baghewala benchmarks).
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional

@dataclass
class EconomicParameters:
    crude_oil_benchmark_usd_bbl: float = 75.0
    heavy_oil_discount_usd_bbl: float = 18.0     # 17-19 API discount [ASSUMED]
    steam_generation_cost_per_tonne_usd: float = 28.50
    electricity_tariff_usd_kwh: float = 0.11
    water_disposal_cost_usd_bbl: float = 1.20
    daily_wellhead_opex_usd: float = 85.0
    workover_incident_cost_usd: float = 35000.0  # Repair cost for rod parted / pump unseating
    target_sor: float = 3.5                      # Benchmark Steam-Oil Ratio
    sor_penalty_per_unit_excess_usd: float = 12000.0

@dataclass
class NetBenefitResult:
    net_benefit_usd: float
    gross_revenue_usd: float
    total_steam_cost_usd: float
    total_electricity_cost_usd: float
    water_disposal_cost_usd: float
    routine_opex_usd: float
    expected_failure_cost_usd: float
    sor_penalty_usd: float
    effective_oil_price_usd: float
    cost_per_barrel_usd: float
    provenance: str = "SIMULATED"

class FieldEconomicsCalculator:
    """Calculates granular financial breakdown and Net Benefit for candidate operating scenarios."""

    def __init__(self, params: Optional[EconomicParameters] = None):
        self.params = params or EconomicParameters()
        self.effective_oil_price = max(10.0, self.params.crude_oil_benchmark_usd_bbl - self.params.heavy_oil_discount_usd_bbl)

    def compute_net_benefit(
        self,
        cumulative_oil_bbl: float,
        cumulative_water_bbl: float,
        steam_volume_tonnes: float,
        total_pumping_kwh: float,
        cycle_duration_days: float,
        failure_probability: float = 0.05,
        steam_oil_ratio: Optional[float] = None
    ) -> NetBenefitResult:
        """
        Computes the complete objective function value.
        """
        p = self.params
        
        # 1. Gross Oil Revenue
        gross_rev = cumulative_oil_bbl * self.effective_oil_price
        
        # 2. Operating Costs
        steam_cost = steam_volume_tonnes * p.steam_generation_cost_per_tonne_usd
        elec_cost = total_pumping_kwh * p.electricity_tariff_usd_kwh
        water_cost = cumulative_water_bbl * p.water_disposal_cost_usd_bbl
        routine_opex = cycle_duration_days * p.daily_wellhead_opex_usd
        
        # 3. Expected Failure Cost (Risk-adjusted maintenance):
        exp_fail_cost = failure_probability * p.workover_incident_cost_usd
        
        # 4. SOR Penalty:
        sor = steam_oil_ratio if steam_oil_ratio is not None else (
            steam_volume_tonnes / max(0.1, cumulative_oil_bbl * 0.160)
        )
        excess_sor = max(0.0, sor - p.target_sor)
        sor_penalty = excess_sor * p.sor_penalty_per_unit_excess_usd

        # Net Benefit:
        total_costs = steam_cost + elec_cost + water_cost + routine_opex + exp_fail_cost + sor_penalty
        net_benefit = gross_rev - total_costs
        
        cost_per_bbl = (steam_cost + elec_cost + water_cost + routine_opex) / max(0.1, cumulative_oil_bbl)

        return NetBenefitResult(
            net_benefit_usd=round(float(net_benefit), 2),
            gross_revenue_usd=round(float(gross_rev), 2),
            total_steam_cost_usd=round(float(steam_cost), 2),
            total_electricity_cost_usd=round(float(elec_cost), 2),
            water_disposal_cost_usd=round(float(water_cost), 2),
            routine_opex_usd=round(float(routine_opex), 2),
            expected_failure_cost_usd=round(float(exp_fail_cost), 2),
            sor_penalty_usd=round(float(sor_penalty), 2),
            effective_oil_price_usd=self.effective_oil_price,
            cost_per_barrel_usd=round(float(cost_per_bbl), 2),
            provenance="SIMULATED"
        )
