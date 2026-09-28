"""
Standalone CSS Thermal Cycle Optimizer (Slow Loop).

Optimizes steam volume, soak duration, and production cutoff
assuming fixed conventional pumping schedule.

PROVENANCE: SIMULATED.
"""

from typing import Dict, Any, Optional
from .joint_optimizer import JointOptimizer, OptimizationRunResult

class CSSOptimizer:
    """Slow loop optimizer for CSS parameters alone."""

    def __init__(self, joint_optimizer: Optional[JointOptimizer] = None):
        self.joint_opt = joint_optimizer or JointOptimizer()

    def optimize_css_cycle(
        self,
        well_id: str,
        current_cfg: Dict[str, Any],
        fixed_spm: float = 4.5
    ) -> OptimizationRunResult:
        """Optimizes CSS while holding SRP parameters fixed."""
        cfg = dict(current_cfg)
        cfg["spm"] = fixed_spm
        cfg["vfd_downstroke_ratio"] = 1.0 # No dynamic VFD
        res = self.joint_opt.optimize_well(well_id=well_id, current_cfg=cfg)
        res.optimization_mode = "CSS_ONLY"
        return res
