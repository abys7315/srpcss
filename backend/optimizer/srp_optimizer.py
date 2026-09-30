"""
SRP-only optimizer: CSS schedule frozen at the current configuration.

With srp_policy="adaptive" (default) NSGA-II tunes the daily controller's parameters
(M_target, min fillage, stroke, VFD ratio) and optimizer/srp_controller.py sets SPM each day.
With srp_policy="fixed" it tunes a constant SPM, stroke and VFD ratio.

PROVENANCE: SIMULATED.
"""

from typing import Dict, Any, Optional
from .joint_optimizer import JointOptimizer, OptimizationRunResult


class SRPOptimizer:
    def __init__(self, joint_optimizer: Optional[JointOptimizer] = None):
        self.joint_opt = joint_optimizer or JointOptimizer()

    def optimize_srp_schedule(
        self,
        well_id: str,
        current_cfg: Dict[str, Any],
        fixed_steam_tonnes: Optional[float] = None,
        cooling_anomaly_day: Optional[int] = None,
        cooling_anomaly_severity_pct: float = 0.0,
        srp_policy: str = "adaptive",
        seed: int = 42,
    ) -> OptimizationRunResult:
        cfg = dict(current_cfg)
        if fixed_steam_tonnes is not None:
            cfg["steam_volume_tonnes"] = fixed_steam_tonnes
        return self.joint_opt.optimize_well(
            well_id=well_id, current_cfg=cfg, mode="SRP_ONLY",
            cooling_anomaly_day=cooling_anomaly_day, cooling_anomaly_severity_pct=cooling_anomaly_severity_pct,
            srp_policy=srp_policy, seed=seed,
        )
