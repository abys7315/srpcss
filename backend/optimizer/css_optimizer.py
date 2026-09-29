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
        fixed_spm: float = 3.0
    ) -> OptimizationRunResult:
        """Optimizes CSS thermal parameters while holding SRP parameters strictly fixed at safe conventional rate."""
        cfg = dict(current_cfg)
        cfg["spm"] = fixed_spm
        cfg["vfd_downstroke_ratio"] = 1.0 # Conventional unshaped downstroke
        return self.joint_opt.optimize_well(
            well_id=well_id,
            current_cfg=cfg,
            mode="CSS_ONLY"
        )
