"""
Downhole Sucker Rod Mechanical & Floating Safety Constraints.

MODEL: Modified Goodman-inspired fatigue screening approximation.
PROVENANCE: ASSUMED (Engineering screening based on API RP 11L & Heavy Oil Annular Mechanics).

DISCLAIMER:
This is an engineering screening approximation for candidate filtering and constraint gating.
It does NOT represent a field-certified API fatigue life prediction or certified metallurgical fatigue validation.
Stress assumptions:
  sigma_a = (sigma_max - sigma_min) / 2
  sigma_m = (sigma_max + sigma_min) / 2
Canonical parameters:
  Hard limit: max_goodman_stress_ratio = 0.85 (canonical_config)
  Warning threshold: warning_goodman_stress_ratio = 0.75
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional

try:
    from core.config import canonical_config
except ImportError:
    from ..core.config import canonical_config

@dataclass
class MechanicalConstraintConfig:
    min_float_margin_index: float = canonical_config.safety_limits.min_rod_float_margin_index        # Hard safety constraint: M_float < 1.0 is INFEASIBLE
    warning_float_margin_index: float = 1.25   # Near-limit boundary
    max_goodman_stress_ratio: float = canonical_config.safety_limits.max_goodman_stress_ratio      # Canonical: 0.85 (Goodman-inspired fatigue screening limit)
    warning_goodman_stress_ratio: float = 0.75 # Near-limit warning boundary (< 0.85 hard limit)

def validate_mechanical_safety(
    float_margin_index: float,
    goodman_stress_ratio: float,
    cfg: MechanicalConstraintConfig = None
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Validates downhole rod string integrity against floating and cyclic fatigue
    using a Modified Goodman-inspired fatigue screening approximation.
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
            "message": f"Active rod floating detected (Float Margin Index {float_margin_index:.3f} < {c.min_float_margin_index:.3f}). Downstroke viscous drag exceeds submerged rod string weight."
        })
    elif float_margin_index < c.warning_float_margin_index:
        warnings.append(f"Float Margin Index at {float_margin_index:.3f} is near the rod floating boundary (< {c.warning_float_margin_index:.2f}).")

    # 2. Goodman Stress Ratio
    if goodman_stress_ratio > c.max_goodman_stress_ratio:
        violations.append({
            "parameter": "goodman_stress_ratio",
            "current_value": goodman_stress_ratio,
            "limit": c.max_goodman_stress_ratio,
            "severity": "CRITICAL",
            "message": f"Modified Goodman stress ratio ({goodman_stress_ratio:.3f}) exceeds {c.max_goodman_stress_ratio:.2f} (endurance fatigue limit exceeded)."
        })
    elif goodman_stress_ratio > c.warning_goodman_stress_ratio:
        warnings.append(f"Rod string stress is at {goodman_stress_ratio*100:.1f}% of allowable Goodman fatigue limit ({c.max_goodman_stress_ratio:.2f}).")

    return violations, warnings
