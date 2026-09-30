"""
Adaptive daily SRP controller.

Each simulated production day, choose the pumping speed that maximises liquid lifted subject to:
  M_float  >= M_target            (rod float margin, closed-form bound)
  fillage  >= min_fillage         (fluid-pound limit)
  Goodman  <= max_goodman
  torque   <= torque_fraction * gearbox rating
  PIP      >= min PIP
  |dSPM|   <= max_delta_spm_per_day for increases (safety-driven decreases are applied at once)

Float bound (VFD kinematics from twin/srp/float_detection.vfd_kinematics):
  v_down = pi * S * SPM * k_down / 60,  M_float = v_term / v_down
  => SPM_max,float = 60 * v_term / (pi * S * k_down * M_target)

Liquid lifted = min(eta_vol * displacement(SPM), inflow potential) is non-decreasing in SPM, so the
best speed is the smallest SPM that reaches the inflow potential, capped by the constraint bounds.
Load-dependent limits (Goodman, torque, PIP) are checked at that point and, when violated, the
largest feasible SPM is found by bisection.

PROVENANCE: SIMULATED control policy (not a field-validated controller).
"""

from dataclasses import dataclass, field
from typing import Callable, Dict, Optional
import math

from core.config import canonical_config as _C
from twin.srp.float_detection import vfd_kinematics


@dataclass
class SRPControlPolicy:
    m_target: float = 1.15
    min_fillage: float = 0.85
    max_goodman: float = 0.81
    torque_fraction: float = 0.95
    max_delta_spm_per_day: float = 0.3
    min_spm: float = _C.safety_limits.min_allowable_spm
    max_spm: float = _C.safety_limits.max_allowable_spm
    min_pip_bar: float = _C.safety_limits.min_pump_intake_pressure_bar
    gearbox_rating_in_lbs: float = _C.srp.gearbox_rating_in_lbs
    volumetric_efficiency: float = 0.95


@dataclass
class SRPDecision:
    spm: float
    binding: str                       # which limit set the speed
    bounds: Dict[str, float] = field(default_factory=dict)


# evaluate(spm) -> {"goodman": float, "torque_in_lbs": float, "pip_bar": float}
Evaluator = Callable[[float], Dict[str, float]]


class AdaptiveSRPController:
    def __init__(self, policy: Optional[SRPControlPolicy] = None,
                 stroke_length_inch: float = _C.srp.standard_stroke_length_inch,
                 vfd_downstroke_ratio: float = 1.0):
        self.policy = policy or SRPControlPolicy()
        self.stroke_in = float(stroke_length_inch)
        self.vfd = float(vfd_downstroke_ratio)
        self.k_down = vfd_kinematics(1.0, self.stroke_in, self.vfd).k_down

    def float_bound_spm(self, v_term_m_s: float) -> float:
        s_m = self.stroke_in * 0.0254
        return 60.0 * max(v_term_m_s, 0.0) / (math.pi * s_m * self.k_down * self.policy.m_target)

    def inflow_spm(self, potential_liquid_m3_d: float, disp_m3_d_per_spm: float) -> float:
        """Smallest SPM whose effective displacement reaches the inflow potential."""
        return potential_liquid_m3_d / max(self.policy.volumetric_efficiency * disp_m3_d_per_spm, 1e-9)

    def fillage_bound_spm(self, potential_liquid_m3_d: float, disp_m3_d_per_spm: float) -> float:
        return potential_liquid_m3_d / max(self.policy.min_fillage * disp_m3_d_per_spm, 1e-9)

    def _ok(self, ev: Dict[str, float]) -> bool:
        p = self.policy
        return (ev["goodman"] <= p.max_goodman
                and ev["torque_in_lbs"] <= p.torque_fraction * p.gearbox_rating_in_lbs
                and ev["pip_bar"] >= p.min_pip_bar)

    def decide(self, prev_spm: float, v_term_m_s: float, potential_liquid_m3_d: float,
               disp_m3_d_per_spm: float, evaluate: Evaluator) -> SRPDecision:
        p = self.policy
        bounds = {
            "float": self.float_bound_spm(v_term_m_s),
            "fillage": self.fillage_bound_spm(potential_liquid_m3_d, disp_m3_d_per_spm),
            "inflow": self.inflow_spm(potential_liquid_m3_d, disp_m3_d_per_spm),
            "max_spm": p.max_spm,
        }
        safety_cap = min(bounds["float"], bounds["fillage"], bounds["max_spm"])
        binding = min(bounds, key=bounds.get)
        target = bounds[binding]
        if target > prev_spm + p.max_delta_spm_per_day:
            target, binding = prev_spm + p.max_delta_spm_per_day, "ramp"
        if target < p.min_spm:
            binding = f"min_spm ({binding} bound below minimum speed)"
            target = p.min_spm

        if not self._ok(evaluate(target)):
            lo, hi = p.min_spm, target
            if not self._ok(evaluate(lo)):
                return SRPDecision(spm=lo, binding="min_spm (load limits violated)", bounds=bounds)
            for _ in range(10):
                mid = 0.5 * (lo + hi)
                if self._ok(evaluate(mid)):
                    lo = mid
                else:
                    hi = mid
                if hi - lo < 0.02:
                    break
            target, binding = lo, "load (Goodman/torque/PIP)"
        return SRPDecision(spm=round(target, 3), binding=binding, bounds={k: round(v, 3) for k, v in bounds.items()})
