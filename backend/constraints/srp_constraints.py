"""
SRP Pumping Unit & Surface Mechanical Constraints.

PROVENANCE: ASSUMED (API Spec 11E Pumping Units).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional

try:
    from core.config import canonical_config
except ImportError:
    from ..core.config import canonical_config

@dataclass
class SRPConstraintConfig:
    min_spm: float = canonical_config.safety_limits.min_allowable_spm          # Canonical: 1.5
    max_spm: float = canonical_config.safety_limits.max_allowable_spm          # Canonical: 7.5
    min_stroke_length_inch: float = canonical_config.safety_limits.min_stroke_length_inch  # Canonical: 64.0
    max_stroke_length_inch: float = canonical_config.safety_limits.max_stroke_length_inch  # Canonical: 144.0
    max_polished_rod_load_lbs: float = 24000.0     # API Pumping unit structural rating (e.g. C-456-256-100)
    max_gearbox_torque_in_lbs: float = canonical_config.safety_limits.max_gearbox_torque_in_lbs    # Canonical: 456,000.0 in-lbs
    max_motor_power_kw: float = canonical_config.srp.motor_rating_kw               # Canonical: 45.0 kW
    min_vfd_downstroke_ratio: float = 0.25
    max_vfd_downstroke_ratio: float = 1.50

def validate_srp_parameters(
    spm: float,
    stroke_length_inch: float,
    peak_polished_rod_load_lbs: float,
    peak_gearbox_torque_in_lbs: float,
    motor_power_kw: float,
    vfd_downstroke_ratio: float = 1.0,
    cfg: SRPConstraintConfig = None
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Validates SRP operational settings and mechanical loading against surface unit limits.
    """
    c = cfg or SRPConstraintConfig()
    violations = []
    warnings = []

    # 1. SPM Limits
    if spm < c.min_spm or spm > c.max_spm:
        violations.append({
            "parameter": "spm",
            "current_value": spm,
            "limit": f"[{c.min_spm}, {c.max_spm}]",
            "severity": "HIGH",
            "message": f"Pumping speed ({spm} SPM) exceeds allowable mechanical range."
        })
    elif spm > c.max_spm * 0.90:
        warnings.append(f"SPM at {spm:.2f} is within 10% of maximum pumping speed limit.")

    # 2. Polished Rod Load vs Unit Structural Rating
    if peak_polished_rod_load_lbs > c.max_polished_rod_load_lbs:
        violations.append({
            "parameter": "peak_polished_rod_load_lbs",
            "current_value": peak_polished_rod_load_lbs,
            "limit": c.max_polished_rod_load_lbs,
            "severity": "CRITICAL",
            "message": f"Peak polished rod load ({peak_polished_rod_load_lbs:.0f} lbs) exceeds pumping unit structural beam rating ({c.max_polished_rod_load_lbs:.0f} lbs)."
        })
    elif peak_polished_rod_load_lbs > c.max_polished_rod_load_lbs * 0.88:
        warnings.append(f"Peak load ({peak_polished_rod_load_lbs:.0f} lbs) is at {peak_polished_rod_load_lbs/c.max_polished_rod_load_lbs*100:.1f}% of beam structural rating.")

    # 3. Gearbox Peak Torque
    if peak_gearbox_torque_in_lbs > c.max_gearbox_torque_in_lbs:
        violations.append({
            "parameter": "peak_gearbox_torque_in_lbs",
            "current_value": peak_gearbox_torque_in_lbs,
            "limit": c.max_gearbox_torque_in_lbs,
            "severity": "CRITICAL",
            "message": f"Peak gearbox torque ({peak_gearbox_torque_in_lbs:.0f} in-lbs) exceeds API gearbox rating ({c.max_gearbox_torque_in_lbs:.0f} in-lbs)."
        })
    elif peak_gearbox_torque_in_lbs > c.max_gearbox_torque_in_lbs * 0.85:
        warnings.append(f"Gearbox load at {peak_gearbox_torque_in_lbs/c.max_gearbox_torque_in_lbs*100:.1f}% of rated torque.")

    # 4. Motor Thermal Loading
    if motor_power_kw > c.max_motor_power_kw:
        violations.append({
            "parameter": "motor_power_kw",
            "current_value": motor_power_kw,
            "limit": c.max_motor_power_kw,
            "severity": "HIGH",
            "message": f"Motor power consumption ({motor_power_kw:.1f} kW) exceeds motor continuous rating ({c.max_motor_power_kw:.1f} kW)."
        })

    return violations, warnings
