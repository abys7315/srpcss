"""
Standalone SRP Artificial Lift Optimizer (Fast Loop / Rolling Horizon).

Optimizes SPM, stroke length, and VFD downstroke ratio
to maximize production while strictly avoiding rod floating.

PROVENANCE: SIMULATED.
"""

from typing import Dict, Any, Optional
from .joint_optimizer import JointOptimizer, OptimizationRunResult

class SRPOptimizer:
    """Fast loop rolling horizon optimizer for SRP parameters alone."""

    def __init__(self, joint_optimizer: Optional[JointOptimizer] = None):
        self.joint_opt = joint_optimizer or JointOptimizer()

    def optimize_srp_schedule(
        self,
        well_id: str,
        current_cfg: Dict[str, Any],
        fixed_steam_tonnes: float = 3000.0,
        cooling_anomaly_day: Optional[int] = None
    ) -> OptimizationRunResult:
        """Optimizes SRP lifting parameters given fixed thermal conditions."""
        cfg = dict(current_cfg)
        cfg["steam_volume_tonnes"] = fixed_steam_tonnes
        return self.joint_opt.optimize_well(
            well_id=well_id,
            current_cfg=cfg,
            mode="SRP_ONLY",
            cooling_anomaly_day=cooling_anomaly_day
        )
