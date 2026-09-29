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
        bgw1 = db.query(WellModel).filter(WellModel.well_id == "BGW-01").first()
        # Reseed if empty, explicitly requested, or has old unseeded default viscosity of 1200.0
        needs_reseed = (count == 0) or force_reseed or (bgw1 and (bgw1.latest_viscosity_cp == 1200.0 or "Synthetic Profile" in str(bgw1.formation)))
        if needs_reseed:
            db.query(WellModel).delete()
            db.commit()
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

            well = WellModel(
                well_id=well_id,
                well_name=meta.get("well_name", f"Baghewala Well {well_id[-2:]}"),
                field_name=meta.get("field_name", "Baghewala"),
                formation=meta.get("formation", "Jodhpur Sandstone").replace(" (Synthetic Profile)", ""),
                crude_api=float(meta.get("api_gravity", base_api)),
                depth_m=float(meta.get("reservoir_depth_m", base_depth)),
                casing_od_inch=float(meta.get("casing_od_inch", 7.0)),
                tubing_od_inch=float(meta.get("tubing_od_inch", base_tubing_od)),
                pump_depth_m=float(meta.get("pump_depth_m", base_pump_depth)),
                rod_string_description="API Grade D Taper 76",
                surface_unit_description="API C-456-256-100 Conventional Beam Unit",
                current_cycle_number=int(meta.get("active_cycle", 1)),
                cycle_phase=latest_day.get("cycle_phase", "PRODUCTION"),
                status=st,
                latest_temperature_c=round(temp_c, 1),
                latest_viscosity_cp=round(viscosity, 1),
                latest_oil_rate_bpd=round(oil_rate, 1),
                latest_water_cut_pct=round(wc, 1),
                latest_float_margin=round(float_margin, 3),
                latest_goodman_stress=round(stress, 3),
                latest_dynacard_label=diag_label,
                steam_volume_tonnes=float(summary.get("total_steam_tonnes", 3000.0)),
                injection_pressure_bar=125.0,
                steam_temp_celsius=260.0,
                soak_duration_days=6.0,
                spm=4.5,
                stroke_length_inch=100.0,
                vfd_downstroke_ratio=1.0,
                economic_cutoff_oil_rate_bpd=base_cutoff,
                provenance="SIMULATED"
            )
            db.add(well)
        db.commit()
    else:
        # Fallback 10 synthetic wells derived from canonical Baghewala baseline with explicit documented perturbations:
        for i in range(1, 11):
            well_id = f"BGW-{i:02d}"
            api_variation = round((i - 1) * 0.1 - 0.3, 2)
            depth_variation = float((i - 1) * 5.0 - 15.0)
            pump_variation = float((i - 1) * 3.0 - 10.0)
            well = WellModel(
                well_id=well_id,
                well_name=f"Baghewala Well {i:02d}",
                field_name="Baghewala",
                formation="Jodhpur Sandstone",
                crude_api=round(base_api + api_variation, 2),
                depth_m=round(base_depth + depth_variation, 1),
                casing_od_inch=7.0,
                tubing_od_inch=base_tubing_od,
                pump_depth_m=round(base_pump_depth + pump_variation, 1),
                current_cycle_number=(i % 3) + 1,
                status="FEASIBLE" if i != 4 else "NEAR_LIMIT",
                latest_temperature_c=65.0,
                latest_viscosity_cp=1200.0,
                latest_oil_rate_bpd=28.5,
                latest_water_cut_pct=72.0,
                latest_float_margin=1.75,
                latest_goodman_stress=0.62,
                latest_dynacard_label="NORMAL",
                economic_cutoff_oil_rate_bpd=base_cutoff,
                provenance="SIMULATED"
            )
            db.add(well)
        db.commit()

if __name__ == "__main__":
    init_db(force_reseed=True)
    print("Database initialized and reseeded successfully.")
