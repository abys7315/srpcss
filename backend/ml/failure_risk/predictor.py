"""
Equipment Failure and Pump Unsetting Risk Predictor.

Estimates 30-day failure probability (rod parting, pump unsetting, gearbox overload)
and attributes risk to physical contributing factors (SHAP / feature contribution equivalent).

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
import numpy as np

@dataclass
class FailureRiskAssessment:
    overall_failure_probability: float  # [0.0, 1.0]
    risk_level: str                     # "LOW", "MODERATE", "HIGH", "CRITICAL"
    pump_unsetting_risk: float          # Specific risk of mechanical pump unseating
    rod_fatigue_parting_risk: float     # Specific risk of cyclic fatigue parting
    gearbox_failure_risk: float         # Specific risk of gearbox mechanical damage
    top_contributing_factors: List[Dict[str, Any]] # Ranked list of drivers with percentage weights
    recommended_mitigation: str
    provenance: str = "SIMULATED"

class FailureRiskPredictor:
    """Evaluates equipment damage risk combining mechanical stresses and thermal factors."""

    def evaluate_risk(
        self,
        float_margin_index: float,
        goodman_stress_ratio: float,
        fluid_pound_severity: float,
        gearbox_load_pct: float,
        asphaltene_risk_score: float,
        cumulative_float_events: int = 0
    ) -> FailureRiskAssessment:
        """
        Computes failure probability and attributes contributing factors.
        """
        # Component hazard scores [0, 1]:
        # 1. Float hazard (impact loading & slack wireline shocks):
        if float_margin_index < 0.70:
            h_float = 0.90
        elif float_margin_index < 1.0:
            h_float = 0.65 + 0.25 * (1.0 - float_margin_index) / 0.30
        elif float_margin_index < 1.30:
            h_float = 0.25 + 0.35 * (1.30 - float_margin_index) / 0.30
        else:
            h_float = 0.05
            
        # 2. Goodman fatigue hazard:
        if goodman_stress_ratio > 1.0:
            h_stress = 0.95
        elif goodman_stress_ratio > 0.85:
            h_stress = 0.50 + 0.40 * (goodman_stress_ratio - 0.85) / 0.15
        else:
            h_stress = 0.10 * (goodman_stress_ratio / 0.85)
            
        # 3. Fluid pound shock hazard:
        h_pound = float(np.clip(fluid_pound_severity * 0.85, 0.0, 0.90))
        
        # 4. Gearbox overload hazard:
        if gearbox_load_pct > 100.0:
            h_gearbox = 0.90
        elif gearbox_load_pct > 80.0:
            h_gearbox = 0.30 + 0.50 * (gearbox_load_pct - 80.0) / 20.0
        else:
            h_gearbox = 0.08
            
        # 5. Asphaltene deposition / sticking hazard:
        h_asphaltene = float(asphaltene_risk_score * 0.70)

        # Weighted combined failure probability:
        weights = {
            "Rod Floating & Impact Shock": (h_float, 0.35),
            "Rod Goodman Cyclic Stress": (h_stress, 0.25),
            "Fluid Pound Shock": (h_pound, 0.15),
            "Gearbox Cyclic Torque": (h_gearbox, 0.15),
            "Asphaltene Valve Deposition": (h_asphaltene, 0.10),
        }
        
        # Non-linear logistic risk combination with single-hazard promotion:
        raw_score = sum(val * w for val, w in weights.values())
        prob = 1.0 - np.exp(-2.2 * raw_score)
        
        # If any single mechanical component is in extreme failure territory (e.g. active rod float):
        max_single_hazard = max(val for val, _ in weights.values())
        if max_single_hazard >= 0.85:
            prob = max(prob, 0.55)
            
        prob = float(np.clip(prob, 0.02, 0.98))

        # Risk level categorization:
        if prob >= 0.70:
            risk_level = "CRITICAL"
            action = "Immediate SPM reduction and VFD deceleration profile engagement to avert mechanical failure."
        elif prob >= 0.45:
            risk_level = "HIGH"
            action = "Reduce pumping speed or evaluate steam re-stimulation in What-If Simulator."
        elif prob >= 0.25:
            risk_level = "MODERATE"
            action = "Maintain close monitoring of fluid level and rod downstroke load."
        else:
            risk_level = "LOW"
            action = "Operating within reliable mechanical fatigue boundaries."

        # Compute percentage contribution of each factor:
        total_driver_score = sum(val * w for val, w in weights.values())
        factors = []
        for name, (val, w) in weights.items():
            contrib_pct = (val * w) / max(total_driver_score, 1e-4) * 100.0
            factors.append({
                "factor_name": name,
                "contribution_pct": round(contrib_pct, 1),
                "hazard_score": round(val, 2),
                "status": "CRITICAL" if val > 0.7 else ("WARNING" if val > 0.35 else "NORMAL")
            })
        factors.sort(key=lambda x: x["contribution_pct"], reverse=True)

        return FailureRiskAssessment(
            overall_failure_probability=round(prob, 3),
            risk_level=risk_level,
            pump_unsetting_risk=round(float(max(h_float * 0.8, h_pound * 0.7)), 3),
            rod_fatigue_parting_risk=round(float(max(h_stress * 0.9, h_float * 0.75)), 3),
            gearbox_failure_risk=round(float(h_gearbox), 3),
            top_contributing_factors=factors,
            recommended_mitigation=action,
            provenance="SIMULATED"
        )
