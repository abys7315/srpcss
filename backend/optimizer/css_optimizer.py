"""
CSS-only optimizer: SRP settings frozen at the current configuration (policy and values).

PROVENANCE: SIMULATED.
"""

from typing import Dict, Any, Optional
from .joint_optimizer import JointOptimizer, OptimizationRunResult


class CSSOptimizer:
    def __init__(self, joint_optimizer: Optional[JointOptimizer] = None):
        self.joint_opt = joint_optimizer or JointOptimizer()

    def optimize_css_cycle(
        self,
        well_id: str,
        current_cfg: Dict[str, Any],
        fixed_spm: Optional[float] = None,
        cooling_anomaly_day: Optional[int] = None,
        cooling_anomaly_severity_pct: float = 0.0,
        seed: int = 42,
    ) -> OptimizationRunResult:
        cfg = dict(current_cfg)
        if fixed_spm is not None:
            cfg["spm"] = fixed_spm
        return self.joint_opt.optimize_well(
            well_id=well_id, current_cfg=cfg, mode="CSS_ONLY",
            cooling_anomaly_day=cooling_anomaly_day, cooling_anomaly_severity_pct=cooling_anomaly_severity_pct,
            seed=seed,
        )
