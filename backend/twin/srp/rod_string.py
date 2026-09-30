"""
Sucker Rod String Specifications and Stress Calculations.

Models tapered sucker rod strings (API Grade D / Ultra-High-Strength)
and calculates Modified Goodman Diagram fatigue ratios.

PROVENANCE: ASSUMED (API Spec 11B / RP 11L standard petroleum artificial lift equations).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import numpy as np

from core.config import canonical_config

@dataclass
class RodSection:
    diameter_inch: float
    length_m: float
    weight_lbs_per_ft: float
    cross_section_area_sq_in: float

@dataclass
class RodStressReport:
    peak_rod_stress_psi: float
    min_rod_stress_psi: float
    allowable_stress_psi: float
    goodman_stress_ratio: float      # peak_stress / allowable_stress (<= 0.85 is safe)
    is_stress_safe: bool
    top_rod_diameter_inch: float
    alternating_stress_psi: float = 0.0
    mean_stress_psi: float = 0.0
    fatigue_method: str = "Goodman-inspired fatigue screening"
    provenance: str = "SIMULATED"

class RodStringModel:
    """Manages tapered sucker rod string geometry, weight, and Goodman stress limits."""

    def __init__(
        self,
        pump_depth_m: float = canonical_config.srp.pump_depth_m,
        grade: str = "Grade D",
        ultimate_tensile_strength_psi: float = 115000.0,
        service_factor: float = 0.85 # Sour / corrosive service factor
    ):
        self.pump_depth_m = pump_depth_m
        self.grade = grade
        self.uts_psi = ultimate_tensile_strength_psi
        self.service_factor = service_factor
        
        # Standard API 76 Tapered Rod Design (7/8" top, 3/4" bottom) for ~1000m wells:
        # Section 1 (top): 7/8" (0.875")
        # Section 2 (bottom): 3/4" (0.750")
        l1 = pump_depth_m * 0.45
        l2 = pump_depth_m * 0.55
        self.sections = [
            RodSection(
                diameter_inch=0.875,
                length_m=l1,
                weight_lbs_per_ft=2.22,
                cross_section_area_sq_in=0.601
            ),
            RodSection(
                diameter_inch=0.750,
                length_m=l2,
                weight_lbs_per_ft=1.63,
                cross_section_area_sq_in=0.442
            )
        ]
        
        # Total dry weight:
        # Convert m to ft: 1 m = 3.28084 ft
        w1_lbs = l1 * 3.28084 * 2.22
        w2_lbs = l2 * 3.28084 * 1.63
        self.total_weight_air_lbs = w1_lbs + w2_lbs
        self.top_section_area_sq_in = self.sections[0].cross_section_area_sq_in

    def compute_submerged_weight_lbs(self, fluid_density_kg_m3: float) -> float:
        """
        Calculate submerged rod string weight accounting for buoyancy:
        W_sub = W_air * (1 - rho_fluid / rho_steel)
        where rho_steel = 7850 kg/m3
        """
        buoyancy_factor = 1.0 - (fluid_density_kg_m3 / 7850.0)
        return float(self.total_weight_air_lbs * max(0.5, buoyancy_factor))

    def evaluate_goodman_stress(
        self,
        peak_polished_rod_load_lbs: float,
        min_polished_rod_load_lbs: float,
        canonical_goodman_limit: Optional[float] = None
    ) -> RodStressReport:
        """
        Goodman-inspired fatigue screening for sucker rods.
        
        Calculates alternating and mean stresses:
        sigma_a = (sigma_max - sigma_min) / 2
        sigma_m = (sigma_max + sigma_min) / 2
        
        For tensile min stress (sigma_min >= 0):
          sigma_all = (UTS / 1.75 + 0.5625 * sigma_min) * S_f
        For compressive min stress (sigma_min < 0):
          sigma_all = (UTS / 1.75) * S_f
          
        Stress ratio evaluates peak-to-allowable and alternating fatigue amplitude.
        """
        limit = canonical_goodman_limit if canonical_goodman_limit is not None else float(
            canonical_config.safety_limits.max_goodman_stress_ratio
        )
        area = max(self.top_section_area_sq_in, 0.01)
        sigma_peak = peak_polished_rod_load_lbs / area
        sigma_min_actual = min_polished_rod_load_lbs / area
        
        sigma_a = (sigma_peak - sigma_min_actual) / 2.0
        sigma_m = (sigma_peak + sigma_min_actual) / 2.0
        
        # Base endurance limit under zero mean stress
        endurance_limit = (self.uts_psi / 1.75) * self.service_factor
        
        # Modified Goodman allowable tensile stress
        if sigma_min_actual >= 0:
            sigma_allowable = (self.uts_psi / 1.75 + 0.5625 * sigma_min_actual) * self.service_factor
        else:
            sigma_allowable = endurance_limit
            
        stress_ratio_peak = sigma_peak / max(sigma_allowable, 1.0)
        stress_ratio_alt = sigma_a / max(endurance_limit, 1.0) if endurance_limit > 0 else 0.0
        stress_ratio = max(stress_ratio_peak, stress_ratio_alt)
        
        if peak_polished_rod_load_lbs <= 0.0 and min_polished_rod_load_lbs <= 0.0:
            stress_ratio = 0.0
            
        return RodStressReport(
            peak_rod_stress_psi=round(sigma_peak, 1),
            min_rod_stress_psi=round(sigma_min_actual, 1),
            allowable_stress_psi=round(sigma_allowable, 1),
            goodman_stress_ratio=round(stress_ratio, 3),
            is_stress_safe=(stress_ratio <= limit),
            top_rod_diameter_inch=self.sections[0].diameter_inch,
            alternating_stress_psi=round(sigma_a, 1),
            mean_stress_psi=round(sigma_m, 1),
            fatigue_method="Goodman-inspired fatigue screening",
            provenance="SIMULATED"
        )
