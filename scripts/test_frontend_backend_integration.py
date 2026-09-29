"""
Comprehensive Frontend-to-Backend Integration Verification Script
Tests all REST endpoints exactly as called by React components via the Vite proxy (:5173).
"""
import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:5173/api/v1"

def request(method: str, path: str, payload: dict = None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            status = resp.status
            body = json.loads(resp.read().decode("utf-8"))
            return status, body, None
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        return e.code, None, err_msg
    except Exception as e:
        return 0, None, str(e)

def run_tests():
    tests = [
        ("GET", "/health", None, "Health Check"),
        ("GET", "/wells", None, "List Wells"),
        ("GET", "/wells/BGW-01", None, "Get Well BGW-01 Detail"),
        ("POST", "/simulate", {
            "well_id": "BGW-01",
            "steam_volume_tonnes": 2500,
            "injection_rate_tpd": 120,
            "soak_duration_days": 14,
            "spm": 4.5,
            "stroke_length_inch": 100,
            "production_days": 60
        }, "Simulate Twin"),
        ("POST", "/optimize/joint", {
            "well_id": "BGW-01",
            "weight_net_benefit": 0.35,
            "weight_sor": 0.25,
            "weight_energy": 0.15,
            "weight_failure_risk": 0.15,
            "weight_oil_recovery": 0.10
        }, "Joint Optimization"),
        ("POST", "/optimize/css", {
            "well_id": "BGW-01",
            "steam_volume_tonnes": 2500,
            "soak_duration_days": 14,
            "cutoff_bpd": 15
        }, "CSS Optimization"),
        ("POST", "/optimize/srp", {
            "well_id": "BGW-01",
            "spm": 4.5,
            "stroke_length_inch": 100,
            "vfd_downstroke_ratio": 1.2
        }, "SRP Optimization"),
        ("POST", "/what-if", {
            "well_id": "BGW-01",
            "parameters": {
                "steam_volume_tonnes": 2800,
                "injection_rate_tpd": 130,
                "soak_days": 12,
                "spm": 4.5,
                "stroke_length_inch": 100,
                "sand_cut_vol_pct": 0.5,
                "oil_price_usd_bbl": 70,
                "steam_cost_usd_tonne": 25
            }
        }, "What-If Sandbox"),
        ("POST", "/predictions/forecast", {
            "well_id": "BGW-01",
            "horizon_days": 60,
            "include_quantiles": True
        }, "Quantile Forecast"),
        ("POST", "/predictions/classify-dynacard", {
            "well_id": "BGW-01",
            "card_type": "Normal"
        }, "Dynacard Classify (Normal)"),
        ("POST", "/predictions/classify-dynacard", {
            "well_id": "BGW-01",
            "card_type": "Fluid Pound"
        }, "Dynacard Classify (Fluid Pound)"),
        ("POST", "/predictions/detect-anomalies", {
            "well_id": "BGW-01"
        }, "Detect Anomalies"),
        ("POST", "/feedback", {
            "well_id": "BGW-01",
            "day_in_cycle": 15,
            "observed_oil_rate_bpd": 42.5,
            "observed_water_cut_pct": 65.0,
            "observed_intake_pressure_bar": 28.0,
            "observed_wh_temp_c": 85.0,
            "operator_id": "OP-SIH-2026",
            "notes": "Automated verification test"
        }, "Feedback Ingestion"),
        ("POST", "/recalibrate", {
            "well_id": "BGW-01",
            "learning_rate": 0.05,
            "epochs": 50
        }, "Model Recalibration"),
        ("GET", "/benchmarks", None, "Comparative Benchmarks"),
        ("GET", "/provenance", None, "Data Provenance Ledger")
    ]

    all_passed = True
    print("=" * 70)
    print("RUNNING FRONTEND-TO-BACKEND INTEGRATION TESTS VIA VITE PROXY (:5173)")
    print("=" * 70)

    for method, path, payload, desc in tests:
        status, body, err = request(method, path, payload)
        if status == 200:
            print(f"  [PASS] {desc:32} | {method:4} {path:30} -> HTTP 200 OK")
        else:
            all_passed = False
            print(f"  [FAIL] {desc:32} | {method:4} {path:30} -> HTTP {status}")
            if err:
                print(f"         Error detail: {err[:200]}")
    
    print("=" * 70)
    if all_passed:
        print("ALL 16 FRONTEND-BACKEND INTEGRATION ENDPOINTS RETURNED HTTP 200 OK!")
        sys.exit(0)
    else:
        print("SOME TESTS FAILED! Check error messages above.")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
