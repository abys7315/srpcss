"""
CSS Hard Physical & Safety Constraints.

PROVENANCE: ASSUMED (API / Field Engineering Standards).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple

try:
    from core.config import canonical_config
except ImportError:
    from ..core.config import canonical_config

@dataclass
class CSSConstraintConfig:
    max_injection_pressure_bar: float = canonical_config.safety_limits.max_allowable_injection_pressure_bar  # Canonical: 125.0 bar
    min_steam_volume_tonnes: float = 800.0
    max_steam_volume_tonnes: float = 5500.0
    max_steam_temp_celsius: float = canonical_config.safety_limits.max_steam_temp_c  # thermal casing/packer rating (ASSUMED)
    min_soak_days: float = 3.0
    max_soak_days: float = 21.0

def validate_css_parameters(
    steam_volume_tonnes: float,
    injection_pressure_bar: float,
    steam_temp_celsius: float,
    soak_days: float,
    cfg: CSSConstraintConfig = None
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Returns (violations, near_limit_warnings).
    """
    c = cfg or CSSConstraintConfig()
    violations = []
    warnings = []

    # 1. Injection Pressure vs Fracture Limit
    if injection_pressure_bar > c.max_injection_pressure_bar:
        violations.append({
            "parameter": "injection_pressure_bar",
            "current_value": injection_pressure_bar,
            "limit": c.max_injection_pressure_bar,
            "severity": "CRITICAL",
            "message": f"Injection pressure ({injection_pressure_bar} bar) exceeds maximum formation fracture limit ({c.max_injection_pressure_bar} bar)."
        })
    elif injection_pressure_bar > c.max_injection_pressure_bar * 0.92:
        warnings.append(f"Injection pressure at {injection_pressure_bar:.1f} bar is within 8% of fracture limit.")

    # 2. Steam Volume
    if steam_volume_tonnes < c.min_steam_volume_tonnes or steam_volume_tonnes > c.max_steam_volume_tonnes:
        violations.append({
            "parameter": "steam_volume_tonnes",
            "current_value": steam_volume_tonnes,
            "limit": f"[{c.min_steam_volume_tonnes}, {c.max_steam_volume_tonnes}]",
            "severity": "HIGH",
            "message": f"Steam volume ({steam_volume_tonnes} t) outside operational boundaries."
        })

    # 3. Steam Temperature vs Casing Rating
    if steam_temp_celsius > c.max_steam_temp_celsius:
        violations.append({
            "parameter": "steam_temp_celsius",
            "current_value": steam_temp_celsius,
            "limit": c.max_steam_temp_celsius,
            "severity": "CRITICAL",
            "message": f"Steam temperature ({steam_temp_celsius} C) exceeds casing thermal packing rating ({c.max_steam_temp_celsius} C)."
        })

    # 4. Soak Days
    if soak_days < c.min_soak_days or soak_days > c.max_soak_days:
        violations.append({
            "parameter": "soak_days",
            "current_value": soak_days,
            "limit": f"[{c.min_soak_days}, {c.max_soak_days}]",
            "severity": "MODERATE",
            "message": f"Soak duration ({soak_days} days) outside physical bounds."
        })

    return violations, warnings
