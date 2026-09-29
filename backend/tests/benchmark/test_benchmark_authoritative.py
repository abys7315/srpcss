"""
Authoritative Benchmark Verification Test Suite — Petro-Twin (SIH 2026, PS26120).

Verifies the reproducibility, consistency, and integrity of the authoritative
physics-informed simulation benchmark artifacts:
- benchmarks/results/benchmark_report.json
- benchmarks/results/benchmark_report.csv
"""

import json
import pytest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent

pytestmark = pytest.mark.benchmark

def test_authoritative_benchmark_report_exists_and_valid():
    """Verify that authoritative benchmark JSON exists and contains expected sections."""
    json_path = ROOT_DIR / "benchmarks" / "results" / "benchmark_report.json"
    assert json_path.exists(), f"Benchmark report JSON missing at {json_path}"
    
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    assert "baseline_vs_optimized" in data
    assert "ablation_study" in data
    assert "sensitivity_analysis" in data
    assert "provenance" in data
    assert data["provenance"]["provenance_type"] == "SIMULATED"

def test_authoritative_benchmark_metrics_and_formulas():
    """Verify exact benchmark metric relationships and percentage formulas."""
    json_path = ROOT_DIR / "benchmarks" / "results" / "benchmark_report.json"
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    b_data = data["baseline_vs_optimized"]
    b_net = b_data["baseline_mean_net_benefit_usd"]
    o_net = b_data["optimized_mean_net_benefit_usd"]
    gain_pct = b_data["net_benefit_gain_pct"]
    
    # Formula: gain_pct = (joint - baseline) / abs(baseline) * 100
    expected_gain = round((o_net - b_net) / abs(b_net) * 100, 1)
    assert abs(gain_pct - expected_gain) <= 0.1
    
    # Floats: baseline > 0, optimized == 0
    assert b_data["baseline_actual_float_events"] > 0
    assert b_data["optimized_actual_float_events"] == 0

def test_authoritative_benchmark_ablation_and_csv_consistency():
    """Verify ablation study matches CSV output."""
    json_path = ROOT_DIR / "benchmarks" / "results" / "benchmark_report.json"
    csv_path = ROOT_DIR / "benchmarks" / "results" / "benchmark_report.csv"
    
    assert csv_path.exists(), f"Benchmark CSV missing at {csv_path}"
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    ablation = data["ablation_study"]
    assert "Baseline_Historical" in ablation
    assert "CSS_Only_Optimization" in ablation
    assert "SRP_Only_Optimization" in ablation
    assert "Joint_Co_Optimization" in ablation
    
    csv_content = csv_path.read_text(encoding="utf-8")
    assert "Baseline_Historical" in csv_content
    assert "Joint_Co_Optimization" in csv_content
