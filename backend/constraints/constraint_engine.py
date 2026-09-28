"""
Unified Constraint & Safety Engine — Petro-Twin (SIH 2026, PS26120).

Acts as an impassable gatekeeper between optimization and recommendations.
Enforces hard physical, mechanical, thermal, and economic limits.

STRICT INVARIANCE:
Under no circumstances can an INFEASIBLE operating scenario be marked RECOMMENDED.

PROVENANCE: ASSUMED (Field Engineering Limits).
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Tuple, Optional

from .css_constraints import CSSConstraintConfig, validate_css_parameters
from .srp_constraints import SRPConstraintConfig, validate_srp_parameters
from .mechanical_constraints import MechanicalConstraintConfig, validate_mechanical_safety
from .production_constraints import ProductionConstraintConfig, validate_production_safety

@dataclass
class ConstraintEvaluationResult:
    status: str                         # "FEASIBLE", "NEAR_LIMIT", "INFEASIBLE"
    is_feasible: bool
    violations: List[Dict[str, Any]]
    near_limit_warnings: List[str]
    binding_constraints: List[str]
    suggested_engineer_action: Optional[str]
    constraint_version: str = "v1.2.0-baghewala"
    provenance: str = "SIMULATED"

class ConstraintEngine:
    """Evaluates multi-domain operational points across CSS, SRP, wellbore, and reservoir."""

    def __init__(
        self,
        css_cfg: Optional[CSSConstraintConfig] = None,
        srp_cfg: Optional[SRPConstraintConfig] = None,
        mech_cfg: Optional[MechanicalConstraintConfig] = None,
        prod_cfg: Optional[ProductionConstraintConfig] = None,
        version: str = "v1.2.0-baghewala"
    ):
        self.css_cfg = css_cfg or CSSConstraintConfig()
        self.srp_cfg = srp_cfg or SRPConstraintConfig()
        self.mech_cfg = mech_cfg or MechanicalConstraintConfig()
        self.prod_cfg = prod_cfg or ProductionConstraintConfig()
        self.version = version

    def evaluate_candidate(
        self,
        steam_volume_tonnes: float,
        injection_pressure_bar: float,
        steam_temp_celsius: float,
        soak_days: float,
        spm: float,
        stroke_length_inch: float,
        peak_polished_rod_load_lbs: float,
        peak_gearbox_torque_in_lbs: float,
        motor_power_kw: float,
        float_margin_index: float,
        goodman_stress_ratio: float,
        pump_intake_pressure_bar: float,
        pump_fillage_fraction: float,
        oil_rate_bpd: float,
        vfd_downstroke_ratio: float = 1.0
    ) -> ConstraintEvaluationResult:
        """
        Validates a candidate operating point across all constraint domains.
        """
        all_violations: List[Dict[str, Any]] = []
        all_warnings: List[str] = []

        # 1. CSS Constraints
        v_css, w_css = validate_css_parameters(
            steam_volume_tonnes=steam_volume_tonnes,
            injection_pressure_bar=injection_pressure_bar,
            steam_temp_celsius=steam_temp_celsius,
            soak_days=soak_days,
            cfg=self.css_cfg
        )
        all_violations.extend(v_css)
        all_warnings.extend(w_css)

        # 2. SRP Surface Equipment Constraints
        v_srp, w_srp = validate_srp_parameters(
            spm=spm,
            stroke_length_inch=stroke_length_inch,
            peak_polished_rod_load_lbs=peak_polished_rod_load_lbs,
            peak_gearbox_torque_in_lbs=peak_gearbox_torque_in_lbs,
            motor_power_kw=motor_power_kw,
            vfd_downstroke_ratio=vfd_downstroke_ratio,
            cfg=self.srp_cfg
        )
        all_violations.extend(v_srp)
        all_warnings.extend(w_srp)

        # 3. Downhole Mechanical & Float Constraints
        v_mech, w_mech = validate_mechanical_safety(
            float_margin_index=float_margin_index,
            goodman_stress_ratio=goodman_stress_ratio,
            cfg=self.mech_cfg
        )
        all_violations.extend(v_mech)
        all_warnings.extend(w_mech)

        # 4. Reservoir & Production Constraints
        v_prod, w_prod = validate_production_safety(
            pump_intake_pressure_bar=pump_intake_pressure_bar,
            pump_fillage_fraction=pump_fillage_fraction,
            oil_rate_bpd=oil_rate_bpd,
            cfg=self.prod_cfg
        )
        all_violations.extend(v_prod)
        all_warnings.extend(w_prod)

        # Classification
        binding = [v["parameter"] for v in all_violations]
        
        if len(all_violations) > 0:
            status = "INFEASIBLE"
            is_feasible = False
            # Suggest engineer action based on binding constraints
            if "float_margin_index" in binding:
                action = "Reduce SPM or decrease VFD downstroke speed to eliminate active sucker rod floating."
            elif "injection_pressure_bar" in binding:
                action = "Reduce steam injection rate or injection volume to remain below formation fracture gradient."
            elif "goodman_stress_ratio" in binding or "peak_polished_rod_load_lbs" in binding:
                action = "Reduce stroke length or SPM to lower cyclic rod fatigue."
            else:
                action = f"Review operational limits on binding parameters: {', '.join(binding)}."
        elif len(all_warnings) > 0:
            status = "NEAR_LIMIT"
            is_feasible = True
            action = "Configuration is physically feasible but operating within 10-15% of safety margins."
        else:
            status = "FEASIBLE"
            is_feasible = True
            action = "All parameters comfortably within normal operating envelope."

        return ConstraintEvaluationResult(
            status=status,
            is_feasible=is_feasible,
            violations=all_violations,
            near_limit_warnings=all_warnings,
            binding_constraints=binding,
            suggested_engineer_action=action,
            constraint_version=self.version,
            provenance="SIMULATED"
        )
