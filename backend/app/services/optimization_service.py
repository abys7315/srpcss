"""
Optimization Service — Pareto Frontier & Constrained Lift Optimization.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from optimizer.joint_optimizer import JointOptimizer, OptimizationRunResult
from optimizer.css_optimizer import CSSOptimizer
from optimizer.srp_optimizer import SRPOptimizer
from constraints.constraint_engine import ConstraintEngine
from ..db.models import OptimizationLogModel
from ..schemas.optimization import (
    JointOptimizationRequest,
    CSSOptimizationRequest,
    SRPOptimizationRequest,
    OptimizationResponse,
    ParetoSolutionDTO,
    RecommendationComparisonDTO
)
from ..schemas.common import ProvenanceEnum, OperationalStatusEnum, RecommendationModeEnum

class OptimizationService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self.constraints = ConstraintEngine()
        self.joint_opt = JointOptimizer(constraint_engine=self.constraints)
        self.css_opt = CSSOptimizer(joint_optimizer=self.joint_opt)
        self.srp_opt = SRPOptimizer(joint_optimizer=self.joint_opt)

    def optimize_joint(self, req: JointOptimizationRequest) -> OptimizationResponse:
        current_cfg = req.current_configuration or {
            "steam_volume_tonnes": 3000.0,
            "soak_duration_days": 6.0,
            "spm": 4.8,
            "stroke_length_inch": 100.0,
            "vfd_downstroke_ratio": 1.0,
            "economic_cutoff_bpd": 7.0
        }

        w_benefit = req.weight_net_benefit if req.weight_net_benefit is not None else req.weights.weight_net_benefit
        w_oil = req.weight_oil_recovery if req.weight_oil_recovery is not None else (req.weight_energy if req.weight_energy is not None else req.weights.weight_oil_recovery)
        w_sor = req.weight_sor if req.weight_sor is not None else req.weights.weight_sor_minimization
        w_risk = req.weight_failure_risk if req.weight_failure_risk is not None else req.weights.weight_risk_minimization

        res = self.joint_opt.optimize_well(
            well_id=req.well_id,
            current_cfg=current_cfg,
            cycle_number=req.cycle_number,
            weight_net_benefit=w_benefit,
            weight_oil_recovery=w_oil,
            weight_sor_minimization=w_sor,
            weight_risk_minimization=w_risk,
            cooling_anomaly_day=req.cooling_anomaly_day,
            cooling_anomaly_severity_pct=req.cooling_anomaly_severity_pct
        )

        return self._build_response(res)

    def optimize_css(self, req: CSSOptimizationRequest) -> OptimizationResponse:
        current_cfg = req.current_configuration or {
            "steam_volume_tonnes": req.steam_volume_tonnes or 3000.0,
            "soak_duration_days": req.soak_duration_days or 6.0,
            "spm": req.fixed_spm,
            "stroke_length_inch": 100.0,
            "vfd_downstroke_ratio": 1.0,
            "economic_cutoff_bpd": req.cutoff_bpd or 7.0
        }
        if req.steam_volume_tonnes:
            current_cfg["steam_volume_tonnes"] = req.steam_volume_tonnes
        if req.soak_duration_days:
            current_cfg["soak_duration_days"] = req.soak_duration_days
        if req.cutoff_bpd:
            current_cfg["economic_cutoff_bpd"] = req.cutoff_bpd

        res = self.css_opt.optimize_css_cycle(
            well_id=req.well_id,
            current_cfg=current_cfg,
            fixed_spm=req.fixed_spm
        )
        return self._build_response(res)

    def optimize_srp(self, req: SRPOptimizationRequest) -> OptimizationResponse:
        current_cfg = req.current_configuration or {
            "steam_volume_tonnes": req.fixed_steam_tonnes,
            "soak_duration_days": 6.0,
            "spm": req.spm or 5.0,
            "stroke_length_inch": req.stroke_length_inch or 100.0,
            "vfd_downstroke_ratio": req.vfd_downstroke_ratio or 1.0,
            "economic_cutoff_bpd": 7.0
        }
        if req.spm:
            current_cfg["spm"] = req.spm
        if req.stroke_length_inch:
            current_cfg["stroke_length_inch"] = req.stroke_length_inch
        if req.vfd_downstroke_ratio:
            current_cfg["vfd_downstroke_ratio"] = req.vfd_downstroke_ratio

        res = self.srp_opt.optimize_srp_schedule(
            well_id=req.well_id,
            current_cfg=current_cfg,
            fixed_steam_tonnes=req.fixed_steam_tonnes,
            cooling_anomaly_day=req.cooling_anomaly_day
        )
        return self._build_response(res)

    def _build_response(self, res: OptimizationRunResult) -> OptimizationResponse:
        curr_dto = self._map_point(res.current_configuration) if res.current_configuration else None
        rec_dto = self._map_point(res.recommended_configuration) if res.recommended_configuration else None
        front_dto = [self._map_point(p) for p in res.pareto_front]

        comp_dto = [
            RecommendationComparisonDTO(
                parameter=c.parameter_name,
                current=str(c.current_value),
                recommended=str(c.recommended_value),
                unit=c.unit,
                delta=str(c.delta_display)
            )
            for c in res.comparison_table
        ]

        st = OperationalStatusEnum(res.status) if res.status in OperationalStatusEnum._value2member_map_ else OperationalStatusEnum.FEASIBLE
        rmode = RecommendationModeEnum(res.recommendation_mode) if res.recommendation_mode in RecommendationModeEnum._value2member_map_ else RecommendationModeEnum.ENGINEER_ADVISORY

        # Log to DB if session exists
        if self.db and rec_dto:
            log_entry = OptimizationLogModel(
                well_id=res.well_id,
                optimization_mode=res.optimization_mode,
                status=res.status,
                recommended_steam=rec_dto.steam_volume_tonnes,
                recommended_soak=rec_dto.soak_days,
                recommended_spm=rec_dto.spm,
                recommended_vfd=rec_dto.vfd_downstroke_ratio,
                cumulative_oil_bbl=rec_dto.cumulative_oil_bbl,
                net_benefit_usd=rec_dto.net_benefit_usd,
                steam_oil_ratio=rec_dto.steam_oil_ratio,
                confidence_score=res.confidence_score,
                recommendation_mode=res.recommendation_mode
            )
            self.db.add(log_entry)
            self.db.commit()

        # Construct explicit Pareto trade-off options for operator selection
        pareto_options: Dict[str, ParetoSolutionDTO] = {}
        if front_dto:
            # Balanced: recommended configuration (highest composite score)
            pareto_options["balanced"] = rec_dto or front_dto[0]
            # Conservative: maximum float margin, lowest failure risk
            pareto_options["conservative"] = max(front_dto, key=lambda p: (p.min_float_margin_index, -p.failure_risk_probability))
            # Economic: maximum net benefit USD
            pareto_options["economic"] = max(front_dto, key=lambda p: p.net_benefit_usd)
            # Production-focused: maximum cumulative oil production
            pareto_options["production_focused"] = max(front_dto, key=lambda p: p.cumulative_oil_bbl)

        return OptimizationResponse(
            well_id=res.well_id,
            optimization_mode=res.optimization_mode,
            status=st,
            current_configuration=curr_dto,
            recommended_configuration=rec_dto,
            pareto_front=front_dto,
            pareto_options=pareto_options,
            total_evaluated_count=res.total_evaluated_count,
            feasible_count=res.feasible_count,
            infeasible_count=res.infeasible_count,
            comparison_table=comp_dto,
            delta_summary=res.delta_summary,
            confidence_score=res.confidence_score,
            recommendation_mode=rmode,
            confidence_breakdown=getattr(res, "confidence_breakdown", {}),
            explanation=res.explanation,
            contributing_factors=res.contributing_factors,
            constraints_checked=res.constraints_checked,
            execution_time_seconds=res.execution_time_seconds,
            provenance=ProvenanceEnum.SIMULATED
        )

    def _map_point(self, pt) -> ParetoSolutionDTO:
        st = OperationalStatusEnum(pt.status) if pt.status in OperationalStatusEnum._value2member_map_ else OperationalStatusEnum.FEASIBLE
        return ParetoSolutionDTO(
            solution_id=pt.solution_id,
            steam_volume_tonnes=pt.steam_volume_tonnes,
            soak_days=pt.soak_days,
            spm=pt.spm,
            stroke_length_inch=pt.stroke_length_inch,
            vfd_downstroke_ratio=pt.vfd_downstroke_ratio,
            economic_cutoff_bpd=pt.economic_cutoff_bpd,
            injection_pressure_bar=getattr(pt, 'injection_pressure_bar', 125.0),
            injection_duration_days=getattr(pt, 'injection_duration_days', 15.0),
            cumulative_oil_bbl=round(pt.cumulative_oil_bbl, 1),
            net_benefit_usd=round(pt.net_benefit_usd, 2),
            steam_oil_ratio=round(pt.steam_oil_ratio, 2),
            energy_intensity_kwh_per_bbl=round(pt.energy_intensity_kwh_per_bbl, 2),
            failure_risk_probability=round(pt.failure_risk_probability, 3),
            min_float_margin_index=round(pt.min_float_margin_index, 3),
            pareto_rank=pt.pareto_rank,
            is_non_dominated=pt.is_non_dominated,
            status=st,
            composite_score=round(pt.composite_score, 3),
            provenance=ProvenanceEnum.SIMULATED
        )
