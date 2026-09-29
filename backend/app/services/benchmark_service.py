"""
Benchmark Service — Baseline Comparisons, Ablation, and Economic Sensitivity.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

import json
from pathlib import Path
from ..schemas.benchmark import (
    BenchmarkSummaryResponse,
    BaselineComparisonDTO,
    AblationItemDTO,
    SensitivityCurvePointDTO
)
from ..schemas.common import ProvenanceEnum

class BenchmarkService:
    def get_benchmark_summary(self) -> BenchmarkSummaryResponse:
        report_path = Path("benchmarks/results/benchmark_report.json")
        if not report_path.exists():
            for p in [Path("../benchmarks/results/benchmark_report.json"), Path("../../benchmarks/results/benchmark_report.json")]:
                if p.exists():
                    report_path = p
                    break

        if report_path.exists():
            with open(report_path, "r") as f:
                data = json.load(f)

            b_data = data.get("baseline_vs_optimized", {})
            b_net = float(b_data.get("baseline_mean_net_benefit_usd", 0.0))
            o_net = float(b_data.get("optimized_mean_net_benefit_usd", 0.0))
            calc_net_gain = ((o_net - b_net) / max(1.0, abs(b_net))) * 100.0 if b_net else 0.0
            net_gain_pct = round(float(b_data.get("net_benefit_gain_pct", calc_net_gain)), 1)

            b_sor = float(b_data.get("baseline_mean_sor", 0.0))
            o_sor = float(b_data.get("optimized_mean_sor", 0.0))
            calc_sor_red = ((b_sor - o_sor) / max(0.01, b_sor)) * 100.0 if b_sor else 0.0
            sor_red_pct = round(float(b_data.get("sor_reduction_pct", calc_sor_red)), 1)

            b_floats = float(b_data.get("baseline_float_events_count", 0))
            o_floats = float(b_data.get("optimized_float_events_count", 0))
            float_red_pct = -100.0 if b_floats > 0 and o_floats == 0 else (((o_floats - b_floats) / max(1.0, b_floats)) * 100.0)

            base_comp = [
                BaselineComparisonDTO(
                    metric="Net Economic Benefit",
                    baseline_value=b_net,
                    optimized_value=o_net,
                    unit="USD",
                    improvement_pct=net_gain_pct,
                    direction="INCREASE_IS_BETTER"
                ),
                BaselineComparisonDTO(
                    metric="Steam-to-Oil Ratio (SOR)",
                    baseline_value=b_sor,
                    optimized_value=o_sor,
                    unit="t/t",
                    improvement_pct=sor_red_pct,
                    direction="DECREASE_IS_BETTER"
                ),
                BaselineComparisonDTO(
                    metric="Rod Floating Incidents",
                    baseline_value=b_floats,
                    optimized_value=o_floats,
                    unit="events",
                    improvement_pct=round(float_red_pct, 1),
                    direction="DECREASE_IS_BETTER"
                )
            ]

            ablation_dict = data.get("ablation_study", {})
            ablation = []
            for name, item in ablation_dict.items():
                ablation.append(AblationItemDTO(
                    architecture=name.replace("_", " "),
                    net_benefit_usd=float(item.get("net_benefit_usd", 0.0)),
                    steam_oil_ratio=float(item.get("sor", 0.0)),
                    total_float_events=int(item.get("total_float_events", 0 if item.get("float_margin", 1.0) >= 1.0 else 2)),
                    computation_time_s=float(item.get("computation_time_s", 0.0)),
                    is_safe=bool(item.get("float_margin", 1.0) >= 1.0),
                    notes=item.get("description", "")
                ))

            # Dynamic crude oil price sensitivity curve points
            sens_dict = data.get("sensitivity_analysis", {}).get("crude_oil_price_usd_bbl", {})
            oil_sens = []
            for k, val in sens_dict.items():
                if isinstance(val, dict):
                    mult = float(val.get("multiplier", k.replace("$", "").replace("/bbl", "").strip()))
                    nb = float(val.get("net_benefit_usd", 0.0))
                    rec_bbl = float(val.get("oil_recovery_bbl", 0.0))
                    sor_val = float(val.get("sor", 0.0))
                else:
                    mult = float(k.replace("$", "").replace("/bbl", "").strip())
                    nb = float(val)
                    rec_bbl = float(ablation_dict.get("Joint_Co_Optimization", {}).get("oil_bbl", 0.0))
                    sor_val = float(ablation_dict.get("Joint_Co_Optimization", {}).get("sor", 0.0))
                oil_sens.append(SensitivityCurvePointDTO(
                    multiplier=mult,
                    net_benefit_usd=nb,
                    oil_recovery_bbl=rec_bbl,
                    sor=sor_val
                ))

            # Dynamic steam cost sensitivity curve points
            steam_dict = data.get("sensitivity_analysis", {}).get("steam_cost_usd_tonne", {})
            steam_sens = []
            for k, val in steam_dict.items():
                if isinstance(val, dict):
                    mult = float(val.get("multiplier", k.replace("$", "").replace("/tonne", "").strip()))
                    nb = float(val.get("net_benefit_usd", 0.0))
                    rec_bbl = float(val.get("oil_recovery_bbl", 0.0))
                    sor_val = float(val.get("sor", 0.0))
                else:
                    mult = float(k.replace("$", "").replace("/tonne", "").strip())
                    nb = float(val)
                    rec_bbl = float(ablation_dict.get("Joint_Co_Optimization", {}).get("oil_bbl", 0.0))
                    sor_val = float(ablation_dict.get("Joint_Co_Optimization", {}).get("sor", 0.0))
                steam_sens.append(SensitivityCurvePointDTO(
                    multiplier=mult,
                    net_benefit_usd=nb,
                    oil_recovery_bbl=rec_bbl,
                    sor=sor_val
                ))

            gain_pct = float(b_data.get("net_benefit_gain_pct", 0.0))
            sor_red_pct = float(b_data.get("sor_reduction_pct", 0.0))
            floats_elim = max(0, int(b_data.get("baseline_float_events_count", 0)) - int(b_data.get("optimized_float_events_count", 0)))

            return BenchmarkSummaryResponse(
                benchmark_name=data.get("benchmark_title", "Baghewala Benchmark"),
                execution_timestamp=data.get("timestamp", "2026-09-28T12:50:00Z"),
                baseline_vs_optimized=base_comp,
                ablation_study=ablation,
                oil_price_sensitivity=oil_sens,
                steam_cost_sensitivity=steam_sens,
                overall_net_benefit_gain_pct=gain_pct,
                overall_sor_reduction_pct=sor_red_pct,
                float_events_eliminated=floats_elim,
                provenance=ProvenanceEnum.SIMULATED
            )
        else:
            return BenchmarkSummaryResponse(
                benchmark_name="Benchmark Unavailable (Run scripts/run_benchmark.py)",
                execution_timestamp="UNAVAILABLE",
                baseline_vs_optimized=[],
                ablation_study=[],
                oil_price_sensitivity=[],
                steam_cost_sensitivity=[],
                overall_net_benefit_gain_pct=0.0,
                overall_sor_reduction_pct=0.0,
                float_events_eliminated=0,
                provenance=ProvenanceEnum.SIMULATED
            )

