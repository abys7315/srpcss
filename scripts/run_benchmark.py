#!/usr/bin/env python3
"""
Benchmark and ablation runner (simulated wells only).

Protocol
  Baseline      HEURISTIC_FIXED_SCHEDULE from benchmarks/baseline/standard_cycles.json, all 10 wells.
  Scenarios     no cooling anomaly, 20 % and 35 % heat-loss anomaly from day 35.
  Planning      every optimizer plans on the nominal (no-anomaly) scenario; its plan is then
                evaluated under all three scenarios. Only the adaptive SRP controller reacts to the
                anomaly, because it acts on the simulated daily state.
  Ablation      CSS-only holds SRP at the baseline; SRP-only holds CSS at the baseline.
  Statistics    mean +/- std over 10 wells x 3 scenarios = 30 runs per row.
  Extra row     HEURISTIC_AGGRESSIVE_LIFT, reported separately; it is not the baseline.

Writes benchmarks/results/benchmark_report.json, benchmark_report.csv and summary.md.
Results are simulation outputs on synthetic wells, not field outcomes.
"""

import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

WELLS = [f"BGW-{i:02d}" for i in range(1, 11)]
SCENARIOS = [("none", None, 0.0), ("20pct_day35", 35, 20.0), ("35pct_day35", 35, 35.0)]
PSI_TO_BAR = 1.0 / 14.5038
SEED = 42

ROWS = [
    ("Baseline_Fixed_Schedule", "HEURISTIC_FIXED_SCHEDULE: fixed steam schedule and constant SPM (the baseline)"),
    ("CSS_Only_Optimization", "NSGA-II on CSS variables; SRP held at baseline (fixed SPM)"),
    ("SRP_Only_Optimization", "NSGA-II on fixed SPM, stroke, VFD ratio; CSS held at baseline"),
    ("SRP_Adaptive_Only", "NSGA-II on adaptive-controller parameters; CSS held at baseline"),
    ("Joint_Co_Optimization", "NSGA-II on CSS + fixed SRP variables"),
    ("Joint_Plus_Adaptive", "NSGA-II on CSS + adaptive-controller parameters"),
    ("Heuristic_Aggressive_Lift", "HEURISTIC_AGGRESSIVE_LIFT: reference only, not the baseline"),
]


def _policy_cfg(policy: dict) -> dict:
    css, srp = policy["css_parameters"], policy["srp_parameters"]
    return {
        "steam_volume_tonnes": css["steam_volume_tonnes"],
        "injection_pressure_bar": round(css["injection_pressure_psi"] * PSI_TO_BAR, 1),
        "soak_duration_days": css["soak_duration_days"],
        "production_duration_days": css["production_duration_days"],
        "spm": srp["spm"],
        "stroke_length_inch": srp["stroke_length_inch"],
        "vfd_downstroke_ratio": 1.0,   # vfd_enabled: false
        "srp_policy": "fixed",
    }


def _load_policies():
    data = json.loads((ROOT / "benchmarks" / "baseline" / "standard_cycles.json").read_text(encoding="utf-8"))
    pol = {p["policy_id"]: p for p in data["baseline_policies"]}
    return _policy_cfg(pol["HEURISTIC_FIXED_SCHEDULE"]), _policy_cfg(pol["HEURISTIC_AGGRESSIVE_LIFT"])


def _point_cfg(pt) -> dict:
    return {
        "steam_volume_tonnes": pt.steam_volume_tonnes, "injection_pressure_bar": pt.injection_pressure_bar,
        "injection_duration_days": pt.injection_duration_days, "soak_duration_days": pt.soak_days,
        "economic_cutoff_bpd": pt.economic_cutoff_bpd, "spm": pt.spm if pt.srp_policy == "fixed" else 4.0,
        "stroke_length_inch": pt.stroke_length_inch, "vfd_downstroke_ratio": pt.vfd_downstroke_ratio,
        "srp_policy": pt.srp_policy, "srp_m_target": pt.srp_m_target, "srp_min_fillage": pt.srp_min_fillage,
        "production_duration_days": 90.0,
    }


def _evaluate(ev, well, cfg, scen):
    _, day, sev = scen
    pt = ev.evaluate_candidate(
        candidate_id="EVAL", well_id=well, cycle_number=1,
        steam_volume_tonnes=cfg["steam_volume_tonnes"], soak_days=cfg["soak_duration_days"],
        spm=cfg["spm"], stroke_length_inch=cfg["stroke_length_inch"], vfd_downstroke_ratio=cfg["vfd_downstroke_ratio"],
        injection_pressure_bar=cfg["injection_pressure_bar"],
        injection_duration_days=cfg.get("injection_duration_days", 15.0),
        economic_cutoff_bpd=cfg.get("economic_cutoff_bpd", 8.0),
        production_duration_days=cfg.get("production_duration_days", 90.0),
        cooling_anomaly_day=day, cooling_anomaly_severity_pct=sev,
        srp_policy=cfg["srp_policy"], srp_m_target=cfg.get("srp_m_target", 1.15),
        srp_min_fillage=cfg.get("srp_min_fillage", 0.85),
    )
    return {
        "net_benefit_usd": pt.net_benefit_usd, "oil_bbl": pt.cumulative_oil_bbl, "sor": pt.steam_oil_ratio,
        "float_days": pt.float_days, "min_float_margin": pt.min_float_margin_index,
        "kwh_per_bbl": pt.energy_intensity_kwh_per_bbl, "status": pt.status,
    }


def run_well(well: str) -> dict:
    from optimizer.joint_optimizer import JointOptimizer
    from optimizer.objective import CandidateEvaluator

    base, aggr = _load_policies()
    jo = JointOptimizer()
    ev = CandidateEvaluator()
    plans = {"Baseline_Fixed_Schedule": (base, 0.0), "Heuristic_Aggressive_Lift": (aggr, 0.0)}
    for row, mode, policy in [
        ("CSS_Only_Optimization", "CSS_ONLY", "fixed"),
        ("SRP_Only_Optimization", "SRP_ONLY", "fixed"),
        ("SRP_Adaptive_Only", "SRP_ONLY", "adaptive"),
        ("Joint_Co_Optimization", "JOINT_CSS_SRP", "fixed"),
        ("Joint_Plus_Adaptive", "JOINT_CSS_SRP", "adaptive"),
    ]:
        t0 = time.perf_counter()
        res = jo.optimize_well(well, base, mode=mode, srp_policy=policy, seed=SEED, current_policy="fixed")
        dt = time.perf_counter() - t0
        plan = _point_cfg(res.recommended_configuration) if res.recommended_configuration else base
        plans[row] = (plan, dt)
    out = {}
    for row, (cfg, dt) in plans.items():
        out[row] = {"plan": cfg, "opt_time_s": dt, "runs": [dict(_evaluate(ev, well, cfg, s), scenario=s[0]) for s in SCENARIOS]}
    return {"well": well, "rows": out}


def _ms(values):
    a = np.asarray(values, dtype=float)
    return float(a.mean()), float(a.std(ddof=0))


def main() -> int:
    t_start = time.time()
    with ProcessPoolExecutor(max_workers=min(10, len(WELLS))) as pool:
        per_well = list(pool.map(run_well, WELLS))

    ablation = {}
    base_nb = np.array([r["net_benefit_usd"] for w in per_well for r in w["rows"]["Baseline_Fixed_Schedule"]["runs"]])
    for key, desc in ROWS:
        runs = [r for w in per_well for r in w["rows"][key]["runs"]]
        nb = [r["net_benefit_usd"] for r in runs]
        d_nb = np.array(nb) - base_nb
        ablation[key] = {
            "description": desc,
            "n_runs": len(runs),
            "net_benefit_usd": round(_ms(nb)[0], 0), "net_benefit_std_usd": round(_ms(nb)[1], 0),
            "delta_vs_baseline_usd": round(float(d_nb.mean()), 0), "delta_vs_baseline_std_usd": round(float(d_nb.std()), 0),
            "oil_bbl": round(_ms([r["oil_bbl"] for r in runs])[0], 1), "oil_std_bbl": round(_ms([r["oil_bbl"] for r in runs])[1], 1),
            "sor": round(_ms([r["sor"] for r in runs])[0], 2), "sor_std": round(_ms([r["sor"] for r in runs])[1], 2),
            "float_days": round(_ms([r["float_days"] for r in runs])[0], 2), "float_days_std": round(_ms([r["float_days"] for r in runs])[1], 2),
            "float_margin": round(min(r["min_float_margin"] for r in runs), 3),
            "kwh_per_bbl": round(_ms([r["kwh_per_bbl"] for r in runs])[0], 2),
            "infeasible_runs": sum(1 for r in runs if r["status"] == "INFEASIBLE"),
            "computation_time_s": round(float(np.mean([w["rows"][key]["opt_time_s"] for w in per_well])), 2),
        }

    b, o = ablation["Baseline_Fixed_Schedule"], ablation["Joint_Plus_Adaptive"]
    gain_pct = round((o["net_benefit_usd"] - b["net_benefit_usd"]) / abs(b["net_benefit_usd"]) * 100.0, 1)
    sor_red = round((b["sor"] - o["sor"]) / b["sor"] * 100.0, 1)

    # Price sensitivity on BGW-01, nominal scenario, Joint + adaptive plan.
    from twin.cycle import CSSCycleSimulator, CycleConfig
    from economics.net_benefit import FieldEconomicsCalculator, EconomicParameters
    plan = per_well[0]["rows"]["Joint_Plus_Adaptive"]["plan"]
    sim = CSSCycleSimulator(CycleConfig(
        well_id="BGW-01", steam_volume_tonnes=plan["steam_volume_tonnes"], injection_pressure_bar=plan["injection_pressure_bar"],
        injection_duration_days=plan["injection_duration_days"], soak_duration_days=plan["soak_duration_days"],
        economic_cutoff_oil_rate_bpd=plan["economic_cutoff_bpd"], stroke_length_inch=plan["stroke_length_inch"],
        vfd_downstroke_ratio=plan["vfd_downstroke_ratio"], srp_policy=plan["srp_policy"],
        srp_m_target=plan["srp_m_target"], srp_min_fillage=plan["srp_min_fillage"])).run_simulation()
    days = sim.production_cutoff_day_actual + plan["injection_duration_days"] + plan["soak_duration_days"]

    def nb_with(params):
        return round(FieldEconomicsCalculator(params).compute_net_benefit(
            cumulative_oil_bbl=sim.total_oil_produced_bbl, cumulative_water_bbl=sim.total_water_produced_bbl,
            steam_volume_tonnes=plan["steam_volume_tonnes"], total_pumping_kwh=sim.total_electricity_kwh,
            cycle_duration_days=days, steam_oil_ratio=sim.steam_oil_ratio).net_benefit_usd, 0)

    sens_price = {f"${p}/bbl": {"multiplier": p, "net_benefit_usd": nb_with(EconomicParameters(crude_oil_benchmark_usd_bbl=p, heavy_oil_discount_usd_bbl=0.0)),
                                "oil_recovery_bbl": sim.total_oil_produced_bbl, "sor": sim.steam_oil_ratio} for p in (45.0, 58.0, 75.0, 90.0)}
    sens_steam = {f"${c}/tonne": {"multiplier": c, "net_benefit_usd": nb_with(EconomicParameters(steam_generation_cost_per_tonne_usd=c)),
                                  "oil_recovery_bbl": sim.total_oil_produced_bbl, "sor": sim.steam_oil_ratio} for c in (20.0, 28.5, 35.0, 45.0)}

    report = {
        "benchmark_title": "Simulated benchmark: 10 synthetic wells x 3 cooling scenarios",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "execution_time_seconds": round(time.time() - t_start, 1),
        "protocol": {
            "baseline_policy": "HEURISTIC_FIXED_SCHEDULE (benchmarks/baseline/standard_cycles.json)",
            "wells": WELLS, "scenarios": [s[0] for s in SCENARIOS], "runs_per_row": len(WELLS) * len(SCENARIOS),
            "planning": "Optimizers plan on the nominal scenario; plans are evaluated under all scenarios.",
            "optimizer": "NSGA-II (pymoo), pop 24, 12 generations, seed 42",
            "float_days": "Production days with minimum float margin < 1.0",
        },
        "disclaimer": "Simulation results on synthetic wells. Not measured Baghewala field data.",
        "baseline_vs_optimized": {
            "optimized_row": "Joint_Plus_Adaptive",
            "wells_evaluated": WELLS,
            "baseline_mean_net_benefit_usd": b["net_benefit_usd"], "baseline_std_net_benefit_usd": b["net_benefit_std_usd"],
            "optimized_mean_net_benefit_usd": o["net_benefit_usd"], "optimized_std_net_benefit_usd": o["net_benefit_std_usd"],
            "net_benefit_gain_pct": gain_pct,
            "baseline_mean_sor": b["sor"], "optimized_mean_sor": o["sor"], "sor_reduction_pct": sor_red,
            "baseline_actual_float_events": b["float_days"], "optimized_actual_float_events": o["float_days"],
            "baseline_float_events_count": b["float_days"], "optimized_float_events_count": o["float_days"],
        },
        "ablation_study": ablation,
        "per_well": [{"well": w["well"], "rows": {k: {"plan": v["plan"], "runs": v["runs"]} for k, v in w["rows"].items()}} for w in per_well],
        "sensitivity_analysis": {"crude_oil_price_usd_bbl": sens_price, "steam_cost_usd_tonne": sens_steam},
        "provenance": {"provenance_type": "SIMULATED", "source": "scripts/run_benchmark.py"},
    }

    out = ROOT / "benchmarks" / "results"
    out.mkdir(parents=True, exist_ok=True)
    (out / "benchmark_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    with open(out / "benchmark_report.csv", "w", encoding="utf-8") as f:
        f.write("Configuration,Net_Benefit_USD_mean,Net_Benefit_USD_std,Oil_bbl_mean,SOR_mean,Float_days_mean,Min_Float_Margin,Description\n")
        for k, a in ablation.items():
            f.write(f"{k},{a['net_benefit_usd']},{a['net_benefit_std_usd']},{a['oil_bbl']},{a['sor']},{a['float_days']},{a['float_margin']},\"{a['description']}\"\n")

    lines = [
        "# Benchmark summary",
        "",
        f"Generated by `scripts/run_benchmark.py` on {report['timestamp'][:10]}. Simulated data on synthetic wells; not field results.",
        "",
        "Protocol: 10 wells (BGW-01..10, `twin/well_registry.py`) x 3 scenarios (no anomaly, 20 % and 35 % heat-loss anomaly from day 35) = 30 runs per row.",
        "Baseline is HEURISTIC_FIXED_SCHEDULE (3000 t steam, 124 bar, 7 d soak, 4.0 SPM, 100 in, no VFD).",
        "Optimizers (NSGA-II, pop 24, 12 generations, seed 42) plan on the nominal scenario; plans are then evaluated under every scenario.",
        "Values are mean ± std over the 30 runs. Δ is the paired difference to the baseline in the same well and scenario.",
        "",
        "| Row | Net benefit [USD] | Δ vs baseline [USD] | Oil [bbl] | SOR [t/t] | Float-days | Min M_float | kWh/bbl | Opt. time [s] |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for k, _ in ROWS:
        a = ablation[k]
        lines.append(
            f"| {k.replace('_', ' ')} | {a['net_benefit_usd']:,.0f} ± {a['net_benefit_std_usd']:,.0f} | "
            f"{a['delta_vs_baseline_usd']:+,.0f} ± {a['delta_vs_baseline_std_usd']:,.0f} | {a['oil_bbl']:,.0f} ± {a['oil_std_bbl']:,.0f} | "
            f"{a['sor']:.2f} ± {a['sor_std']:.2f} | {a['float_days']:.1f} ± {a['float_days_std']:.1f} | {a['float_margin']:.3f} | "
            f"{a['kwh_per_bbl']:.2f} | {a['computation_time_s']:.1f} |")
    lines += [
        "",
        "Notes",
        "",
        "- Heuristic aggressive lift is a reference row, not the baseline.",
        "- Net benefit includes steam, power, water, opex, expected failure cost and a capped SOR penalty (`economics/net_benefit.py`).",
        "- Float-days count production days with M_float < 1. With the current physics, float occurs only at aggressive kinematics, so most rows show 0.",
        "- The thermal model has one calibration scalar (docs/physics.md, section 3); none of these numbers are history-matched.",
    ]
    (out / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nCompleted in {report['execution_time_seconds']} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
