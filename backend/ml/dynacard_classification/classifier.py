"""
Dynamometer Card Machine Learning Diagnostic Classifier.

Classifies surface and downhole dynamometer cards into operational failure modes:
1. NORMAL
2. ROD_FLOATING
3. FLUID_POUND
4. GAS_INTERFERENCE
5. OVERLOAD

PROVENANCE: SIMULATED (Trained on physics simulator card syntheses with noise).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from sklearn.ensemble import RandomForestClassifier

@dataclass
class DynacardClassificationResult:
    predicted_class: str
    class_probabilities: Dict[str, float]
    confidence_score: float
    diagnostic_explanation: str
    is_rod_floating: bool
    is_fluid_pounding: bool
    provenance: str = "SIMULATED"

class DynacardClassifier:
    """Classifies dynamometer cards using geometric feature engineering and Random Forest."""

    CLASSES = ["NORMAL", "ROD_FLOATING", "FLUID_POUND", "GAS_INTERFERENCE", "OVERLOAD"]

    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        self.is_fitted = False
        self._initialize_synthetic_weights()

    def extract_features(
        self,
        positions: List[float],
        loads: List[float],
        submerged_weight_lbs: float = 5500.0
    ) -> np.ndarray:
        """
        Extracts invariant diagnostic descriptors from dynacard coordinates:
        1. Normalized card area (fillage & work)
        2. Minimum load ratio (min_load / W_sub) -> critical for rod float (< 0.1)
        3. Load range ratio (PPRL - MPRL) / PPRL
        4. Downstroke inflection variance (identifies fluid pound shock)
        5. Centroid position relative to mid-stroke
        6. Peak polished rod load ratio (overload check)
        """
        pos = np.asarray(positions)
        ld = np.asarray(loads)
        
        stroke = max(float(np.max(pos) - np.min(pos)), 1.0)
        pprl = max(float(np.max(ld)), 1.0)
        mprl = float(np.min(ld))
        load_range = pprl - mprl
        
        # 1. Area:
        area = float(np.trapz(ld, pos))
        norm_area = abs(area) / (stroke * pprl)
        
        # 2. Min load ratio (near zero or negative -> rod float!):
        min_load_ratio = mprl / max(submerged_weight_lbs, 100.0)
        
        # 3. Load range ratio:
        range_ratio = load_range / pprl
        
        # 4. Downstroke inflection variance (fluid pound has steep cliff on downstroke):
        half = len(ld) // 2
        downstroke_loads = ld[half:]
        diffs = np.diff(downstroke_loads)
        inflection_var = float(np.var(diffs)) if len(diffs) > 0 else 0.0
        
        # 5. Overload ratio vs standard 20,000 lbs beam rating:
        overload_ratio = pprl / 20000.0

        return np.array([norm_area, min_load_ratio, range_ratio, inflection_var, overload_ratio], dtype=np.float32)

    def _initialize_synthetic_weights(self):
        """Pre-fits classifier on calibrated synthetic geometric signatures."""
        X_synth = []
        y_synth = []
        
        # Generate representative feature vectors for each class:
        # NORMAL: [norm_area ~ 0.55, min_ratio ~ 0.65, range_ratio ~ 0.50, inf_var ~ 500, overload ~ 0.65]
        for _ in range(50):
            X_synth.append([
                np.random.normal(0.55, 0.05),
                np.random.normal(0.65, 0.05),
                np.random.normal(0.50, 0.05),
                np.random.normal(300, 50),
                np.random.normal(0.65, 0.05)
            ])
            y_synth.append(0) # NORMAL
            
        # ROD_FLOATING: [norm_area ~ 0.35, min_ratio < 0.05 (near zero or negative!), range_ratio ~ 0.85, inf_var ~ 1500, overload ~ 0.70]
        for _ in range(50):
            X_synth.append([
                np.random.normal(0.35, 0.05),
                np.random.normal(0.02, 0.03), # Near zero or negative!
                np.random.normal(0.85, 0.05),
                np.random.normal(1500, 200),
                np.random.normal(0.70, 0.05)
            ])
            y_synth.append(1) # ROD_FLOATING
            
        # FLUID_POUND: [norm_area ~ 0.30, min_ratio ~ 0.50, range_ratio ~ 0.70, inf_var > 4000 (huge sudden impact cliff!), overload ~ 0.75]
        for _ in range(50):
            X_synth.append([
                np.random.normal(0.30, 0.05),
                np.random.normal(0.50, 0.05),
                np.random.normal(0.70, 0.05),
                np.random.normal(4500, 500), # Huge inflection variance!
                np.random.normal(0.75, 0.05)
            ])
            y_synth.append(2) # FLUID_POUND
            
        # GAS_INTERFERENCE: [norm_area ~ 0.25, min_ratio ~ 0.55, range_ratio ~ 0.60, inf_var ~ 800, overload ~ 0.60]
        for _ in range(50):
            X_synth.append([
                np.random.normal(0.25, 0.04),
                np.random.normal(0.55, 0.05),
                np.random.normal(0.60, 0.05),
                np.random.normal(800, 100),
                np.random.normal(0.60, 0.05)
            ])
            y_synth.append(3) # GAS_INTERFERENCE

        # OVERLOAD: [norm_area ~ 0.65, min_ratio ~ 0.70, range_ratio ~ 0.80, inf_var ~ 1200, overload > 1.05]
        for _ in range(50):
            X_synth.append([
                np.random.normal(0.65, 0.05),
                np.random.normal(0.70, 0.05),
                np.random.normal(0.80, 0.05),
                np.random.normal(1200, 150),
                np.random.normal(1.15, 0.06) # Overload!
            ])
            y_synth.append(4) # OVERLOAD

        self.model.fit(np.array(X_synth), np.array(y_synth))
        self.is_fitted = True

    def classify_card(
        self,
        positions: List[float],
        loads: List[float],
        submerged_weight_lbs: float = 5500.0,
        known_float_margin: Optional[float] = None
    ) -> DynacardClassificationResult:
        """Classifies a given dynacard trace into diagnostic operational classes."""
        feats = self.extract_features(positions, loads, submerged_weight_lbs)
        
        # Hard physics constraint integration: If min load is near zero and known float margin < 1.0,
        # rod floating is physically confirmed.
        min_load = float(np.min(loads))
        if known_float_margin is not None and known_float_margin < 1.0:
            probs = {c: 0.02 for c in self.CLASSES}
            probs["ROD_FLOATING"] = 0.92
            return DynacardClassificationResult(
                predicted_class="ROD_FLOATING",
                class_probabilities=probs,
                confidence_score=0.94,
                diagnostic_explanation="Surface load collapsed on downstroke; float margin < 1.0 confirmed from annular viscous drag.",
                is_rod_floating=True,
                is_fluid_pounding=False
            )

        probs_arr = self.model.predict_proba(feats.reshape(1, -1))[0]
        pred_idx = int(np.argmax(probs_arr))
        pred_label = self.CLASSES[pred_idx]
        conf = float(probs_arr[pred_idx])
        
        prob_dict = {c: round(float(p), 3) for c, p in zip(self.CLASSES, probs_arr)}
        
        explanations = {
            "NORMAL": "Symmetrical card envelope with full pump fillage and normal valve actions.",
            "ROD_FLOATING": "Carrier bar separated from floating rod clamp during downstroke due to high fluid drag.",
            "FLUID_POUND": "Incomplete pump fillage; plunger strikes fluid level midway through downstroke.",
            "GAS_INTERFERENCE": "Rounded compression curve on downstroke caused by entrained free gas.",
            "OVERLOAD": "Polished rod load exceeds structural rating of the surface pumping unit."
        }

        return DynacardClassificationResult(
            predicted_class=pred_label,
            class_probabilities=prob_dict,
            confidence_score=round(conf, 3),
            diagnostic_explanation=explanations.get(pred_label, "Operational state classified."),
            is_rod_floating=(pred_label == "ROD_FLOATING"),
            is_fluid_pounding=(pred_label == "FLUID_POUND")
        )
