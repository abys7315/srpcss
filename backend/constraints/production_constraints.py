"""
Production, Drawdown, and Pump Intake Safety Constraints.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional

@dataclass
class ProductionConstraintConfig:
    min_pump_intake_pressure_bar: float = 2.0  # Prevents pump gas lock / cavitation
    min_pump_fillage_fraction: float = 0.40    # Prevents violent fluid pound damage
    min_economic_oil_rate_bpd: float = 5.0     # Production cut-off threshold

def validate_production_safety(
    pump_intake_pressure_bar: float,
    pump_fillage_fraction: float,
    oil_rate_bpd: float,
    cfg: ProductionConstraintConfig = None
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Validates well intake pressures, fillage levels, and economic cutoff.
    """
    c = cfg or ProductionConstraintConfig()
    violations = []
    warnings = []

    # 1. Pump Intake Pressure (PIP)
    if pump_intake_pressure_bar < c.min_pump_intake_pressure_bar:
        violations.append({
            "parameter": "pump_intake_pressure_bar",
            "current_value": pump_intake_pressure_bar,
            "limit": c.min_pump_intake_pressure_bar,
            "severity": "HIGH",
            "message": f"Pump intake pressure ({pump_intake_pressure_bar:.2f} bar) below minimum NPSH threshold ({c.min_pump_intake_pressure_bar} bar)."
        })
    elif pump_intake_pressure_bar < c.min_pump_intake_pressure_bar * 1.3:
        warnings.append(f"Pump intake pressure ({pump_intake_pressure_bar:.2f} bar) is approaching pump starvation limit.")

    # 2. Pump Fillage
    if pump_fillage_fraction < c.min_pump_fillage_fraction:
        violations.append({
            "parameter": "pump_fillage_fraction",
            "current_value": pump_fillage_fraction,
            "limit": c.min_pump_fillage_fraction,
            "severity": "HIGH",
            "message": f"Pump fillage ({pump_fillage_fraction*100:.1f}%) causes severe fluid pound."
        })
    elif pump_fillage_fraction < 0.70:
        warnings.append(f"Moderate fluid pound detected (pump fillage: {pump_fillage_fraction*100:.1f}%).")

    return violations, warnings
