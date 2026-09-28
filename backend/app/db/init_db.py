"""
Database Initialization and Seeding.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

import json
import os
from pathlib import Path
from .database import engine, Base, SessionLocal
from .models import WellModel

def init_db():
    """Initializes tables and seeds initial wells if database is empty."""
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        count = db.query(WellModel).count()
        if count == 0:
            seed_wells(db)
    finally:
        db.close()

def seed_wells(db):
    """Loads well data from field_simulation_history.json or default seed."""
    sim_path = Path("data/simulated/field_simulation_history.json")
    if not sim_path.exists():
        # Look relative to parent directories
        for p in [Path("../data/simulated/field_simulation_history.json"), Path("../../data/simulated/field_simulation_history.json")]:
            if p.exists():
                sim_path = p
                break

    if sim_path.exists():
        with open(sim_path, "r") as f:
            data = json.load(f)
            
        for well_id, well_dict in data.items():
            meta = well_dict.get("well_metadata", {})
            summary = well_dict.get("cycle_summary", {})
            daily = well_dict.get("daily_timeseries", [])
            latest_day = daily[-1] if daily else {}

            # Map status:
            float_margin = float(latest_day.get("float_margin_index", 1.85))
            stress = float(latest_day.get("goodman_stress_ratio", 0.62))
            
            if float_margin < 1.0 or stress > 1.0:
                st = "INFEASIBLE"
            elif float_margin < 1.25 or stress > 0.85:
                st = "NEAR_LIMIT"
            else:
                st = "FEASIBLE"

            well = WellModel(
                well_id=well_id,
                well_name=meta.get("well_name", f"Baghewala Well {well_id[-2:]}"),
                field_name=meta.get("field_name", "Baghewala"),
                formation="Jodhpur Sandstone",
                crude_api=float(meta.get("api_gravity", 18.0)),
                depth_m=float(meta.get("reservoir_depth_m", 1020.0)),
                casing_od_inch=float(meta.get("casing_od_inch", 7.0)),
                tubing_od_inch=float(meta.get("tubing_od_inch", 3.5)),
                pump_depth_m=float(meta.get("pump_depth_m", 950.0)),
                rod_string_description="API Grade D Taper 76",
                surface_unit_description="API C-456-256-100 Conventional Beam Unit",
                current_cycle_number=int(meta.get("active_cycle", 1)),
                cycle_phase="PRODUCTION",
                status=st,
                latest_temperature_c=float(latest_day.get("temperature_c", 65.0)),
                latest_viscosity_cp=float(latest_day.get("oil_viscosity_cp", 1200.0)),
                latest_oil_rate_bpd=float(latest_day.get("oil_rate_bpd", 28.5)),
                latest_water_cut_pct=float(latest_day.get("water_cut_pct", 72.0)),
                latest_float_margin=round(float_margin, 3),
                latest_goodman_stress=round(stress, 3),
                latest_dynacard_label=latest_day.get("diagnostic_label", "NORMAL"),
                steam_volume_tonnes=float(summary.get("total_steam_tonnes", 3000.0)),
                injection_pressure_bar=125.0,
                steam_temp_celsius=260.0,
                soak_duration_days=6.0,
                spm=4.5,
                stroke_length_inch=100.0,
                vfd_downstroke_ratio=1.0,
                economic_cutoff_oil_rate_bpd=7.0,
                provenance="SIMULATED"
            )
            db.add(well)
        db.commit()
    else:
        # Fallback 10 default wells
        for i in range(1, 11):
            well_id = f"BGW-{i:02d}"
            well = WellModel(
                well_id=well_id,
                well_name=f"Baghewala Well {i:02d}",
                field_name="Baghewala",
                formation="Jodhpur Sandstone",
                crude_api=17.5 + (i * 0.15),
                depth_m=1020.0 + (i * 5.0),
                casing_od_inch=7.0,
                tubing_od_inch=3.5,
                pump_depth_m=950.0,
                current_cycle_number=(i % 3) + 1,
                status="FEASIBLE" if i != 4 else "NEAR_LIMIT",
                latest_temperature_c=75.0,
                latest_viscosity_cp=450.0,
                latest_oil_rate_bpd=35.0,
                latest_water_cut_pct=60.0,
                latest_float_margin=1.75,
                latest_goodman_stress=0.65,
                latest_dynacard_label="NORMAL",
                provenance="SIMULATED"
            )
            db.add(well)
        db.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized.")
