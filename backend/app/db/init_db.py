"""
Database Initialization and Seeding.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

import json
import os
from pathlib import Path
from .database import engine, Base, SessionLocal
from .models import WellModel

from core.config import canonical_config

def init_db(force_reseed: bool = False):
    """Initializes tables and seeds initial wells if database is empty or needs reseeding."""
    Base.metadata.create_all(bind=engine)
    
    # Check and migrate columns if table already exists in SQLite
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "optimization_runs" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("optimization_runs")]
        if "recommendation_mode" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE optimization_runs ADD COLUMN recommendation_mode VARCHAR(32)"))
                conn.commit()

    db = SessionLocal()
    try:
        count = db.query(WellModel).count()
        if count == 0 or force_reseed:
            seed_wells(db)
    finally:
        db.close()

def seed_wells(db):
    """Loads well data from field_simulation_history.json or default seed."""
    _repo_root = Path(__file__).resolve().parent.parent.parent.parent
    sim_path = _repo_root / "data" / "simulated" / "field_simulation_history.json"
    if not sim_path.exists():
        # Fallback look relative to parent directories
        for p in [Path("data/simulated/field_simulation_history.json"), Path("../data/simulated/field_simulation_history.json"), Path("../../data/simulated/field_simulation_history.json")]:
            if p.exists():
                sim_path = p
                break

    base_api = float(canonical_config.fluid.api_gravity) # 18.0
    base_depth = float(canonical_config.reservoir.depth_m) # 1050.0 m
    base_pump_depth = float(canonical_config.srp.pump_depth_m) # 980.0 m
    base_tubing_od = float(canonical_config.srp.tubing_od_inch) # 3.5 in
    base_cutoff = float(canonical_config.css.default_production_cutoff_oil_rate_bpd) # 8.0 bpd

    if sim_path.exists():
        with open(sim_path, "r") as f:
            data = json.load(f)
            
        for well_id, well_dict in data.items():
            meta = well_dict.get("well_metadata", {})
            summary = well_dict.get("cycle_summary", {})
            timeseries = well_dict.get("timeseries", well_dict.get("daily_timeseries", []))
            latest_day = timeseries[-1] if timeseries else {}

            float_margin = float(latest_day.get("float_margin_index", 1.85))
            stress = float(latest_day.get("goodman_stress_ratio", 0.62))
            is_floating = bool(latest_day.get("is_rod_floating", False))
            
            if float_margin < 1.0 or stress > 1.0 or is_floating:
                st = "INFEASIBLE"
            elif float_margin < 1.25 or stress > 0.85:
                st = "NEAR_LIMIT"
            else:
                st = "FEASIBLE"

            oil_rate = float(latest_day.get("oil_rate_bpd", 28.5))
            water_rate = float(latest_day.get("water_rate_bpd", 72.0))
            if "water_cut_pct" in latest_day:
                wc = float(latest_day["water_cut_pct"])
            else:
                total_liq = oil_rate + water_rate
                wc = (water_rate / total_liq * 100.0) if total_liq > 0 else 72.0

            viscosity = float(latest_day.get("viscosity_cp", latest_day.get("oil_viscosity_cp", 1200.0)))
            temp_c = float(latest_day.get("temperature_c", 65.0))
            diag_label = latest_day.get("diagnostic_label", "FLOAT_RISK" if (is_floating or float_margin < 1.0) else "NORMAL")

            well_attrs = {
                "well_id": well_id,
                "well_name": meta.get("well_name", f"Baghewala Well {well_id[-2:]}"),
                "field_name": meta.get("field_name", "Baghewala"),
                "formation": meta.get("formation", "Jodhpur Sandstone").replace(" (Synthetic Profile)", ""),
                "crude_api": float(meta.get("api_gravity", base_api)),
                "depth_m": float(meta.get("reservoir_depth_m", base_depth)),
                "casing_od_inch": float(meta.get("casing_od_inch", 7.0)),
                "tubing_od_inch": float(meta.get("tubing_od_inch", base_tubing_od)),
                "pump_depth_m": float(meta.get("pump_depth_m", base_pump_depth)),
                "rod_string_description": "API Grade D Taper 76",
                "surface_unit_description": "API C-456-256-100 Conventional Beam Unit",
                "current_cycle_number": int(meta.get("active_cycle", 1)),
                "cycle_phase": latest_day.get("cycle_phase", "PRODUCTION"),
                "status": st,
                "latest_temperature_c": round(temp_c, 1),
                "latest_viscosity_cp": round(viscosity, 1),
                "latest_oil_rate_bpd": round(oil_rate, 1),
                "latest_water_cut_pct": round(wc, 1),
                "latest_float_margin": round(float_margin, 3),
                "latest_goodman_stress": round(stress, 3),
                "latest_dynacard_label": diag_label,
                "steam_volume_tonnes": float(summary.get("total_steam_tonnes", 3000.0)),
                "injection_pressure_bar": 125.0,
                "steam_temp_celsius": 260.0,
                "soak_duration_days": 6.0,
                "spm": 4.5,
                "stroke_length_inch": 100.0,
                "vfd_downstroke_ratio": 1.0,
                "economic_cutoff_oil_rate_bpd": base_cutoff,
                "provenance": "SIMULATED"
            }

            existing = db.query(WellModel).filter(WellModel.well_id == well_id).first()
            if existing:
                for k, v in well_attrs.items():
                    setattr(existing, k, v)
            else:
                db.add(WellModel(**well_attrs))
        db.commit()
    else:
        # Fallback 10 synthetic wells derived from canonical Baghewala baseline with explicit documented perturbations:
        for i in range(1, 11):
            well_id = f"BGW-{i:02d}"
            api_variation = round((i - 1) * 0.1 - 0.3, 2)
            depth_variation = float((i - 1) * 5.0 - 15.0)
            pump_variation = float((i - 1) * 3.0 - 10.0)
            fallback_attrs = {
                "well_id": well_id,
                "well_name": f"Baghewala Well {i:02d}",
                "field_name": "Baghewala",
                "formation": "Jodhpur Sandstone",
                "crude_api": round(base_api + api_variation, 2),
                "depth_m": round(base_depth + depth_variation, 1),
                "casing_od_inch": 7.0,
                "tubing_od_inch": base_tubing_od,
                "pump_depth_m": round(base_pump_depth + pump_variation, 1),
                "current_cycle_number": (i % 3) + 1,
                "status": "FEASIBLE" if i != 4 else "NEAR_LIMIT",
                "latest_temperature_c": 65.0,
                "latest_viscosity_cp": 1200.0,
                "latest_oil_rate_bpd": 28.5,
                "latest_water_cut_pct": 72.0,
                "latest_float_margin": 1.75,
                "latest_goodman_stress": 0.62,
                "latest_dynacard_label": "NORMAL",
                "economic_cutoff_oil_rate_bpd": base_cutoff,
                "provenance": "SIMULATED"
            }
            existing = db.query(WellModel).filter(WellModel.well_id == well_id).first()
            if existing:
                for k, v in fallback_attrs.items():
                    setattr(existing, k, v)
            else:
                db.add(WellModel(**fallback_attrs))
        db.commit()

    # Seed historical CSS cycles if empty
    from .models import CSSCycleRecordModel, EquipmentFailureRecordModel
    if db.query(CSSCycleRecordModel).count() == 0:
        for i in range(1, 11):
            w_id = f"BGW-{i:02d}"
            # Cycle 1 for all wells
            db.add(CSSCycleRecordModel(
                well_id=w_id,
                cycle_number=1,
                steam_injected_tonnes=3000.0 + (i * 50.0),
                injection_duration_days=12.0,
                steam_temperature_c=260.0,
                injection_pressure_bar=120.0 + i,
                soak_duration_days=6.0,
                production_duration_days=120.0,
                cumulative_oil_bbl=round(4850.0 - i * 85.0, 1),
                cumulative_water_bbl=round(11200.0 + i * 150.0, 1),
                cysor=round((3000.0 + i * 50.0) / (4850.0 - i * 85.0), 3),
                peak_oil_rate_bpd=round(68.0 - i * 1.2, 1),
                final_oil_rate_bpd=round(7.5 + (i % 2) * 0.5, 1)
            ))
            # Cycle 2 for wells 1 to 5
            if i <= 5:
                db.add(CSSCycleRecordModel(
                    well_id=w_id,
                    cycle_number=2,
                    steam_injected_tonnes=3200.0 + (i * 60.0),
                    injection_duration_days=13.0,
                    steam_temperature_c=262.0,
                    injection_pressure_bar=122.0 + i,
                    soak_duration_days=7.0,
                    production_duration_days=110.0,
                    cumulative_oil_bbl=round(4150.0 - i * 90.0, 1),
                    cumulative_water_bbl=round(12800.0 + i * 180.0, 1),
                    cysor=round((3200.0 + i * 60.0) / (4150.0 - i * 90.0), 3),
                    peak_oil_rate_bpd=round(59.0 - i * 1.5, 1),
                    final_oil_rate_bpd=round(7.2, 1)
                ))
        db.commit()

    # Seed equipment failure history if empty
    if db.query(EquipmentFailureRecordModel).count() == 0:
        failures = [
            ("BGW-04", 1, "SUCKER_ROD", "FATIGUE_PARTING", 2450000, 185.0, 0.96, "High compressive downstroke rod float slap at bottom dead center.", 18500.0, 42.0),
            ("BGW-08", 1, "DOWNHOLE_PUMP", "FLUID_POUND_DAMAGE", 1820000, 142.0, 0.91, "Severe fluid pound impact cracked traveling valve ball cage.", 14200.0, 36.0),
            ("BGW-02", 2, "STUFFING_BOX", "THERMAL_PACKING_WEAR", 3980000, 298.0, 0.74, "High wellhead temperature (88 C) degraded elastomer seals.", 4500.0, 12.0),
            ("BGW-07", 1, "SUCKER_ROD", "CORROSION_FATIGUE", 2150000, 160.0, 0.88, "H2S / CO2 pitting combined with alternating cyclic stress.", 17500.0, 38.0),
            ("BGW-09", 2, "DOWNHOLE_PUMP", "BARREL_SAND_ABRASION", 2850000, 215.0, 0.79, "Fines migration from Jodhpur sandstone eroded plunger clearance.", 15800.0, 40.0),
        ]
        for f in failures:
            db.add(EquipmentFailureRecordModel(
                well_id=f[0],
                cycle_number=f[1],
                component=f[2],
                failure_mode=f[3],
                cycles_to_failure=f[4],
                runtime_days=f[5],
                peak_stress_ratio=f[6],
                root_cause=f[7],
                repair_cost_usd=f[8],
                downtime_hours=f[9]
            ))
        db.commit()

if __name__ == "__main__":
    init_db(force_reseed=True)
    print("Database initialized and reseeded successfully.")

