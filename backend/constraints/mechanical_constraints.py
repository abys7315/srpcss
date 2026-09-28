"""
Downhole Sucker Rod Mechanical & Floating Safety Constraints.

PROVENANCE: ASSUMED (API RP 11L & Heavy Oil Annular Mechanics).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional

@dataclass
class MechanicalConstraintConfig:
    min_float_margin_index: float = 1.0        # Hard safety constraint: M_float < 1.0 is INFEASIBLE
    warning_float_margin_index: float = 1.25   # Near-limit boundary
    max_goodman_stress_ratio: float = 1.0      # Modified Goodman fatigue limit
    warning_goodman_stress_ratio: float = 0.85

def validate_mechanical_safety(
    float_margin_index: float,
    goodman_stress_ratio: float,
    cfg: MechanicalConstraintConfig = None
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Validates downhole rod string integrity against floating and cyclic fatigue.
    """
    c = cfg or MechanicalConstraintConfig()
    violations = []
    warnings = []

    # 1. Rod Floating (Hard Constraint)
    if float_margin_index < c.min_float_margin_index:
        violations.append({
            "parameter": "float_margin_index",
            "current_value": float_margin_index,
            "limit": c.min_float_margin_index,
            "severity": "CRITICAL",
            "message": f"Active rod floating detected (Float Margin Index {float_margin_index:.3f} < 1.0). Downstroke viscous drag exceeds submerged rod string weight."
        })
    elif float_margin_index < c.warning_float_margin_index:
        warnings.append(f"Float Margin Index at {float_margin_index:.3f} is near the rod floating boundary (< 1.25).")

    # 2. Goodman Stress Ratio
    if goodman_stress_ratio > c.max_goodman_stress_ratio:
        violations.append({
            "parameter": "goodman_stress_ratio",
            "current_value": goodman_stress_ratio,
            "limit": c.max_goodman_stress_ratio,
            "severity": "CRITICAL",
            "message": f"Modified Goodman stress ratio ({goodman_stress_ratio:.3f}) exceeds 1.0 (endurance fatigue limit exceeded)."
        })
    elif goodman_stress_ratio > c.warning_goodman_stress_ratio:
        warnings.append(f"Rod string stress is at {goodman_stress_ratio*100:.1f}% of allowable Goodman fatigue limit.")

    return violations, warnings
