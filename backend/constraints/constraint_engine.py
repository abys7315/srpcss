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
    margins: List[Dict[str, Any]] = field(default_factory=list)
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

    @property
    def max_injection_pressure(self) -> float:
        return self.css_cfg.max_injection_pressure_bar

    @property
    def max_goodman_ratio(self) -> float:
        return self.mech_cfg.max_goodman_stress_ratio

    @property
    def max_goodman_stress_ratio(self) -> float:
        return self.mech_cfg.max_goodman_stress_ratio

    @property
    def min_pump_intake_pressure(self) -> float:
        return self.prod_cfg.min_pump_intake_pressure_bar

    @property
    def min_pump_intake_pressure_bar(self) -> float:
        return self.prod_cfg.min_pump_intake_pressure_bar

    @property
    def min_float_margin(self) -> float:
        return self.mech_cfg.min_float_margin_index

    @property
    def min_rod_float_margin_index(self) -> float:
        return self.mech_cfg.min_float_margin_index

    @property
    def max_spm(self) -> float:
        return self.srp_cfg.max_spm

    @property
    def min_spm(self) -> float:
        return self.srp_cfg.min_spm

    @property
    def max_rod_load(self) -> float:
        return self.srp_cfg.max_polished_rod_load_lbs

    @property
    def max_polished_rod_load_lbs(self) -> float:
        return self.srp_cfg.max_polished_rod_load_lbs

    @property
    def max_torque(self) -> float:
        return self.srp_cfg.max_gearbox_torque_in_lbs

    @property
    def max_gearbox_torque(self) -> float:
        return self.srp_cfg.max_gearbox_torque_in_lbs

    @property
    def max_gearbox_torque_in_lbs(self) -> float:
        return self.srp_cfg.max_gearbox_torque_in_lbs

    @property
    def max_motor_power(self) -> float:
        return self.srp_cfg.max_motor_power_kw

    @property
    def max_motor_power_kw(self) -> float:
        return self.srp_cfg.max_motor_power_kw

    def evaluate(self, **kwargs) -> ConstraintEvaluationResult:
        """Convenience evaluation method with default fallback values."""
        if "gearbox_torque_in_lbs" in kwargs:
            kwargs["peak_gearbox_torque_in_lbs"] = kwargs.pop("gearbox_torque_in_lbs")
        if "rod_load_lbs" in kwargs:
            kwargs["peak_polished_rod_load_lbs"] = kwargs.pop("rod_load_lbs")

        defaults = {
            "steam_volume_tonnes": 3000.0,
            "injection_pressure_bar": 110.0,
            "steam_temp_celsius": 260.0,
            "soak_days": 6.0,
            "spm": 4.5,
            "stroke_length_inch": 100.0,
            "peak_polished_rod_load_lbs": 18000.0,
            "peak_gearbox_torque_in_lbs": 250000.0,
            "motor_power_kw": 30.0,
            "float_margin_index": 1.5,
            "goodman_stress_ratio": 0.65,
            "pump_intake_pressure_bar": 15.0,
            "pump_fillage_fraction": 0.85,
            "oil_rate_bpd": 35.0,
            "vfd_downstroke_ratio": 1.0
        }
        defaults.update(kwargs)
        return self.evaluate_candidate(**defaults)

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

        # Compute Explicit Dynamic Constraint Margins (Section 10)
        dynamic_margins: List[Dict[str, Any]] = [
            {
                "metric": "Rod Float Margin",
                "actual_value": round(float_margin_index, 3),
                "limit": round(self.mech_cfg.min_float_margin_index, 3),
                "unit": "ratio",
                "margin_pct": round(((float_margin_index - self.mech_cfg.min_float_margin_index) / max(1e-4, self.mech_cfg.min_float_margin_index)) * 100.0, 1),
                "status": "SAFE" if float_margin_index >= self.mech_cfg.warning_float_margin_index else ("WARNING" if float_margin_index >= self.mech_cfg.min_float_margin_index else "VIOLATED"),
                "reason": f"Float margin {float_margin_index:.3f} >= {self.mech_cfg.min_float_margin_index:.3f} (no downstroke float)" if float_margin_index >= self.mech_cfg.min_float_margin_index else f"REJECTED: float margin = {float_margin_index:.3f} < {self.mech_cfg.min_float_margin_index:.3f}"
            },
            {
                "metric": "Peak Rod Load",
                "actual_value": round(peak_polished_rod_load_lbs, 1),
                "limit": round(self.srp_cfg.max_polished_rod_load_lbs, 1),
                "unit": "lb",
                "margin_pct": round(((self.srp_cfg.max_polished_rod_load_lbs - peak_polished_rod_load_lbs) / max(1.0, self.srp_cfg.max_polished_rod_load_lbs)) * 100.0, 1),
                "status": "SAFE" if peak_polished_rod_load_lbs <= self.srp_cfg.max_polished_rod_load_lbs * 0.85 else ("WARNING" if peak_polished_rod_load_lbs <= self.srp_cfg.max_polished_rod_load_lbs else "VIOLATED"),
                "reason": f"Peak rod load {peak_polished_rod_load_lbs:,.0f} lb <= allowable {self.srp_cfg.max_polished_rod_load_lbs:,.0f} lb" if peak_polished_rod_load_lbs <= self.srp_cfg.max_polished_rod_load_lbs else f"REJECTED: peak rod load {peak_polished_rod_load_lbs:,.0f} lb > allowable {self.srp_cfg.max_polished_rod_load_lbs:,.0f} lb"
            },
            {
                "metric": "Gearbox Torque",
                "actual_value": round(peak_gearbox_torque_in_lbs, 1),
                "limit": round(self.srp_cfg.max_gearbox_torque_in_lbs, 1),
                "unit": "in-lb",
                "margin_pct": round(((self.srp_cfg.max_gearbox_torque_in_lbs - peak_gearbox_torque_in_lbs) / max(1.0, self.srp_cfg.max_gearbox_torque_in_lbs)) * 100.0, 1),
                "status": "SAFE" if peak_gearbox_torque_in_lbs <= self.srp_cfg.max_gearbox_torque_in_lbs * 0.90 else ("WARNING" if peak_gearbox_torque_in_lbs <= self.srp_cfg.max_gearbox_torque_in_lbs else "VIOLATED"),
                "reason": f"Peak torque {peak_gearbox_torque_in_lbs:,.0f} in-lb <= rating {self.srp_cfg.max_gearbox_torque_in_lbs:,.0f} in-lb" if peak_gearbox_torque_in_lbs <= self.srp_cfg.max_gearbox_torque_in_lbs else f"REJECTED: torque {peak_gearbox_torque_in_lbs:,.0f} in-lb > rating {self.srp_cfg.max_gearbox_torque_in_lbs:,.0f} in-lb"
            },
            {
                "metric": "Motor Power",
                "actual_value": round(motor_power_kw, 1),
                "limit": round(self.srp_cfg.max_motor_power_kw, 1),
                "unit": "kW",
                "margin_pct": round(((self.srp_cfg.max_motor_power_kw - motor_power_kw) / max(1.0, self.srp_cfg.max_motor_power_kw)) * 100.0, 1),
                "status": "SAFE" if motor_power_kw <= self.srp_cfg.max_motor_power_kw * 0.90 else ("WARNING" if motor_power_kw <= self.srp_cfg.max_motor_power_kw else "VIOLATED"),
                "reason": f"Motor power {motor_power_kw:.1f} kW <= rating {self.srp_cfg.max_motor_power_kw:.1f} kW" if motor_power_kw <= self.srp_cfg.max_motor_power_kw else f"REJECTED: motor power {motor_power_kw:.1f} kW > rating {self.srp_cfg.max_motor_power_kw:.1f} kW"
            },
            {
                "metric": "Goodman Stress Index",
                "actual_value": round(goodman_stress_ratio, 3),
                "limit": round(self.mech_cfg.max_goodman_stress_ratio, 3),
                "unit": "ratio",
                "margin_pct": round(((self.mech_cfg.max_goodman_stress_ratio - goodman_stress_ratio) / max(1e-4, self.mech_cfg.max_goodman_stress_ratio)) * 100.0, 1),
                "status": "SAFE" if goodman_stress_ratio <= self.mech_cfg.warning_goodman_stress_ratio else ("WARNING" if goodman_stress_ratio <= self.mech_cfg.max_goodman_stress_ratio else "VIOLATED"),
                "reason": f"Goodman stress ratio {goodman_stress_ratio:.3f} <= {self.mech_cfg.max_goodman_stress_ratio:.3f}" if goodman_stress_ratio <= self.mech_cfg.max_goodman_stress_ratio else f"REJECTED: Goodman stress {goodman_stress_ratio:.3f} > limit {self.mech_cfg.max_goodman_stress_ratio:.3f}"
            },
            {
                "metric": "Injection Pressure",
                "actual_value": round(injection_pressure_bar, 1),
                "limit": round(self.css_cfg.max_injection_pressure_bar, 1),
                "unit": "bar",
                "margin_pct": round(((self.css_cfg.max_injection_pressure_bar - injection_pressure_bar) / max(1.0, self.css_cfg.max_injection_pressure_bar)) * 100.0, 1),
                "status": "SAFE" if injection_pressure_bar <= self.css_cfg.max_injection_pressure_bar * 0.92 else ("WARNING" if injection_pressure_bar <= self.css_cfg.max_injection_pressure_bar else "VIOLATED"),
                "reason": f"Injection pressure {injection_pressure_bar:.1f} bar <= fracture limit {self.css_cfg.max_injection_pressure_bar:.1f} bar" if injection_pressure_bar <= self.css_cfg.max_injection_pressure_bar else f"REJECTED: injection pressure {injection_pressure_bar:.1f} bar > fracture limit {self.css_cfg.max_injection_pressure_bar:.1f} bar"
            },
            {
                "metric": "Pump Intake Pressure",
                "actual_value": round(pump_intake_pressure_bar, 1),
                "limit": round(self.prod_cfg.min_pump_intake_pressure_bar, 1),
                "unit": "bar",
                "margin_pct": round(((pump_intake_pressure_bar - self.prod_cfg.min_pump_intake_pressure_bar) / max(1.0, self.prod_cfg.min_pump_intake_pressure_bar)) * 100.0, 1),
                "status": "SAFE" if pump_intake_pressure_bar >= self.prod_cfg.min_pump_intake_pressure_bar * 1.3 else ("WARNING" if pump_intake_pressure_bar >= self.prod_cfg.min_pump_intake_pressure_bar else "VIOLATED"),
                "reason": f"PIP {pump_intake_pressure_bar:.1f} bar >= min cavitation threshold {self.prod_cfg.min_pump_intake_pressure_bar:.1f} bar" if pump_intake_pressure_bar >= self.prod_cfg.min_pump_intake_pressure_bar else f"REJECTED: PIP {pump_intake_pressure_bar:.1f} bar < min threshold {self.prod_cfg.min_pump_intake_pressure_bar:.1f} bar"
            }
        ]

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
            margins=dynamic_margins,
            constraint_version=self.version,
            provenance="SIMULATED"
        )

