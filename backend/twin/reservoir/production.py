"""
Production Profile and Bottomhole Hydraulics.

Calculates producing bottomhole pressure (pwf), pump intake pressure (PIP),
fluid level above pump, and water cut evolution.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
from typing import Dict, Any
import numpy as np

@dataclass
class ProductionDayRecord:
    day_number: int
    oil_rate_m3_d: float
    oil_rate_bpd: float
    water_rate_m3_d: float
    liquid_rate_m3_d: float
    water_cut_pct: float
    flowing_bottomhole_pressure_bar: float
    pump_intake_pressure_bar: float
    annular_fluid_level_m: float
    provenance: str = "SIMULATED"

class ProductionHydraulicsModel:
    """Manages fluid levels, water cut evolution, and bottomhole drawdown."""

    def __init__(
        self,
        pump_depth_m: float = 980.0,
        well_tvd_m: float = 1050.0,
        casing_id_m: float = 0.157, # 7" 26# casing ID
        tubing_od_m: float = 0.089  # 3.5" tubing OD
    ):
        self.pump_depth_m = pump_depth_m
        self.well_tvd_m = well_tvd_m
        self.casing_id_m = casing_id_m
        self.tubing_od_m = tubing_od_m
        self.annular_area_m2 = (np.pi / 4.0) * (casing_id_m ** 2 - tubing_od_m ** 2)

    def compute_water_cut(self, day: int, total_production_days: int) -> float:
        """
        Water cut evolution in CSS:
        Starts high (> 75%) due to condensed steam backflow, drops to a trough around day 20-30,
        and gradually rises back up as cold formation brine enters.
        """
        t_ratio = float(day) / max(total_production_days, 1.0)
        # U-shaped response:
        base_wc = 0.65
        steam_slug_effect = 0.20 * np.exp(-day / 8.0) # early steam water
        depletion_water_influx = 0.15 * (t_ratio ** 1.5)
        return float(np.clip(base_wc + steam_slug_effect + depletion_water_influx, 0.40, 0.95))

    def evaluate_day(
        self,
        day: int,
        target_oil_rate_m3_d: float,
        water_cut_fraction: float,
        mixture_density_kg_m3: float,
        pwf_bar: float
    ) -> ProductionDayRecord:
        """Computes daily production volumes, pressures, and annular fluid levels."""
        qo_m3 = max(0.0, target_oil_rate_m3_d)
        wc = np.clip(water_cut_fraction, 0.0, 0.99)
        
        # q_liq = q_o / (1 - wc)
        qliq_m3 = qo_m3 / (1.0 - wc)
        qw_m3 = qliq_m3 - qo_m3
        
        # Convert to BPD: 1 m3 = 6.2898 bbl
        qo_bpd = qo_m3 * 6.2898
        
        # Hydrostatic head calculation:
        # Distance from pump to bottom of perforations
        h_perf_to_pump = max(0.0, self.well_tvd_m - self.pump_depth_m) # ~70 m
        delta_p_submergence = (mixture_density_kg_m3 * 9.81 * h_perf_to_pump) / 1e5 # bar
        
        # Pump intake pressure: PIP = pwf - submergence head
        pip_bar = max(1.5, pwf_bar - delta_p_submergence)
        
        # Fluid level above pump in casing annulus (m):
        # h_fluid = (PIP * 1e5) / (rho * g)
        fluid_level_above_pump_m = (pip_bar * 1e5) / max(mixture_density_kg_m3 * 9.81, 1e2)
        fluid_level_from_surface_m = max(0.0, self.pump_depth_m - fluid_level_above_pump_m)

        return ProductionDayRecord(
            day_number=day,
            oil_rate_m3_d=round(qo_m3, 2),
            oil_rate_bpd=round(qo_bpd, 1),
            water_rate_m3_d=round(qw_m3, 2),
            liquid_rate_m3_d=round(qliq_m3, 2),
            water_cut_pct=round(wc * 100.0, 1),
            flowing_bottomhole_pressure_bar=round(pwf_bar, 2),
            pump_intake_pressure_bar=round(pip_bar, 2),
            annular_fluid_level_m=round(fluid_level_from_surface_m, 1),
            provenance="SIMULATED"
        )
