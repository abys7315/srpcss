"""
Benchmark service: serves benchmarks/results/benchmark_report.json written by scripts/run_benchmark.py.

Baseline is HEURISTIC_FIXED_SCHEDULE for all 10 wells; each row is mean +/- std over
10 wells x 3 cooling scenarios. HEURISTIC_AGGRESSIVE_LIFT is a separately labelled reference row.
Nothing here computes or invents numbers; if the report is missing, empty results are returned.
"""

import json
from pathlib import Path

from ..schemas.benchmark import (
    BenchmarkSummaryResponse,
    BaselineComparisonDTO,
    AblationItemDTO,
    SensitivityCurvePointDTO,
    RodFloatMitigationBenchmarkDTO,
)
from ..schemas.common import ProvenanceEnum

_REPORT = Path(__file__).resolve().parents[3] / "benchmarks" / "results" / "benchmark_report.json"


def _pct(new: float, old: float, lower_is_better: bool = False) -> float:
    if not old:
        return 0.0
    d = (old - new) if lower_is_better else (new - old)
    return round(d / abs(old) * 100.0, 1)


class BenchmarkService:
    def get_benchmark_summary(self) -> BenchmarkSummaryResponse:
        if not _REPORT.exists():
            return BenchmarkSummaryResponse(
                benchmark_name="Benchmark unavailable (run scripts/run_benchmark.py)",
                execution_timestamp="UNAVAILABLE", baseline_vs_optimized=[], ablation_study=[],
                oil_price_sensitivity=[], steam_cost_sensitivity=[], overall_net_benefit_gain_pct=0.0,
                overall_sor_reduction_pct=0.0, float_events_eliminated=0.0, provenance=ProvenanceEnum.SIMULATED)

        data = json.loads(_REPORT.read_text(encoding="utf-8"))
        b = data.get("baseline_vs_optimized", {})
        b_nb, o_nb = float(b.get("baseline_mean_net_benefit_usd", 0.0)), float(b.get("optimized_mean_net_benefit_usd", 0.0))
        b_sor, o_sor = float(b.get("baseline_mean_sor", 0.0)), float(b.get("optimized_mean_sor", 0.0))
        b_fd, o_fd = float(b.get("baseline_float_events_count", 0.0)), float(b.get("optimized_float_events_count", 0.0))

        comparison = [
            BaselineComparisonDTO(metric="Net benefit (mean)", baseline_value=b_nb, optimized_value=o_nb, unit="USD",
                                  improvement_pct=_pct(o_nb, b_nb), direction="INCREASE_IS_BETTER"),
            BaselineComparisonDTO(metric="Steam-oil ratio (mean)", baseline_value=b_sor, optimized_value=o_sor, unit="t/t",
                                  improvement_pct=_pct(o_sor, b_sor, True), direction="DECREASE_IS_BETTER"),
            BaselineComparisonDTO(metric="Float-days (mean)", baseline_value=b_fd, optimized_value=o_fd, unit="d",
                                  improvement_pct=_pct(o_fd, b_fd, True) if b_fd else 0.0, direction="DECREASE_IS_BETTER"),
        ]

        ablation = []
        for key, a in data.get("ablation_study", {}).items():
            ablation.append(AblationItemDTO(
                key=key, architecture=key.replace("_", " "),
                net_benefit_usd=float(a.get("net_benefit_usd", 0.0)), steam_oil_ratio=float(a.get("sor", 0.0)),
                oil_recovery_bbl=float(a.get("oil_bbl", 0.0)), total_float_events=float(a.get("float_days", 0.0)),
                computation_time_s=float(a.get("computation_time_s", 0.0)),
                is_safe=float(a.get("float_margin", 1.0)) >= 1.0 and int(a.get("infeasible_runs", 0)) == 0,
                notes=a.get("description", ""), n_runs=int(a.get("n_runs", 0)),
                net_benefit_std_usd=float(a.get("net_benefit_std_usd", 0.0)),
                delta_vs_baseline_usd=float(a.get("delta_vs_baseline_usd", 0.0)),
                delta_vs_baseline_std_usd=float(a.get("delta_vs_baseline_std_usd", 0.0)),
                oil_std_bbl=float(a.get("oil_std_bbl", 0.0)), sor_std=float(a.get("sor_std", 0.0)),
                float_days=float(a.get("float_days", 0.0)), float_days_std=float(a.get("float_days_std", 0.0)),
                min_float_margin=float(a.get("float_margin", 0.0)), kwh_per_bbl=float(a.get("kwh_per_bbl", 0.0)),
                is_baseline=key == "Baseline_Fixed_Schedule", is_reference_only=key == "Heuristic_Aggressive_Lift",
            ))

        def curve(name: str):
            return [SensitivityCurvePointDTO(multiplier=float(v["multiplier"]), net_benefit_usd=float(v["net_benefit_usd"]),
                                             oil_recovery_bbl=float(v["oil_recovery_bbl"]), sor=float(v["sor"]))
                    for v in data.get("sensitivity_analysis", {}).get(name, {}).values() if isinstance(v, dict)]

        rfm_data = data.get("rod_float_mitigation")
        rfm_dto = RodFloatMitigationBenchmarkDTO(**rfm_data) if rfm_data else RodFloatMitigationBenchmarkDTO()

        return BenchmarkSummaryResponse(
            benchmark_name=data.get("benchmark_title", "Benchmark"),
            execution_timestamp=data.get("timestamp", ""),
            baseline_vs_optimized=comparison, ablation_study=ablation,
            oil_price_sensitivity=curve("crude_oil_price_usd_bbl"), steam_cost_sensitivity=curve("steam_cost_usd_tonne"),
            overall_net_benefit_gain_pct=float(b.get("net_benefit_gain_pct", 0.0)),
            overall_sor_reduction_pct=float(b.get("sor_reduction_pct", 0.0)),
            float_events_eliminated=round(b_fd - o_fd, 2),
            rod_float_mitigation=rfm_dto,
            protocol=data.get("protocol", {}),
            provenance=ProvenanceEnum.SIMULATED)
