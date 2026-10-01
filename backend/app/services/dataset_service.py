"""
Dataset Service for External Benchmarks.
Manages ingestion and evaluation of external public datasets:
1. Everitt-Jennings 16-Class SRP Dynamometer Cards (API RP 11L / SPE-24838)
2. Equinor Volve Field Public Production History (730 Days SCADA Telemetry)
3. Petrobras 3W Benchmark (Undesirable Downhole Events)
4. DGH India / Oil India Baghewala Core Lab PVT & Emulsion Data
"""

import json
import csv
import math
from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.db.models import TelemetryObservationModel, WellModel
from core.config import canonical_config

_ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
EXTERNAL_DATA_DIR = _ROOT_DIR / "data" / "external"


class DatasetService:
    def __init__(self):
        self.data_dir = EXTERNAL_DATA_DIR

    def list_datasets(self) -> List[Dict[str, Any]]:
        """Returns catalog of available external datasets and status."""
        datasets = [
            {
                "id": "everitt_jennings",
                "name": "Everitt-Jennings 16-Class SRP Dynacard Benchmark",
                "source": "API RP 11L / SPE-24838 (Everitt, Jennings & Gault)",
                "category": "DYNAMOMETER_CARDS",
                "file": "everitt_jennings_cards.json",
                "records_count": 16,
                "description": "16 industry standard dynacard signatures including fluid pound, gas interference, parted rod, and severe rod float.",
                "is_available": (self.data_dir / "everitt_jennings_cards.json").exists()
            },
            {
                "id": "volve_telemetry",
                "name": "Equinor Volve Field Public SCADA Production Telemetry",
                "source": "Equinor Open Data License (CC-BY 4.0)",
                "category": "FIELD_TELEMETRY",
                "file": "volve_public_telemetry.csv",
                "records_count": 1460,
                "description": "730 days of real SCADA sensor logs (rate, pressures, temperature, water cut) for wells 15/9-F-1C & 15/9-F-11B.",
                "is_available": (self.data_dir / "volve_public_telemetry.csv").exists()
            },
            {
                "id": "petrobras_3w",
                "name": "Petrobras 3W Undesirable Downhole Events Benchmark",
                "source": "Petrobras 3W Open Dataset (CC-BY 4.0), Vargas et al. (2019)",
                "category": "HIGH_FREQUENCY_TRANSIENTS",
                "file": "petrobras_3w_transients.json",
                "records_count": 720,
                "description": "High-frequency (10-second) pressure and temperature transients documenting downhole flow restriction and recovery.",
                "is_available": (self.data_dir / "petrobras_3w_transients.json").exists()
            },
            {
                "id": "baghewala_lab_pvt",
                "name": "DGH / Oil India Baghewala Core Lab PVT & Emulsion Data",
                "source": "Directorate General of Hydrocarbons (DGH) India / Oil India Ltd",
                "category": "LAB_PVT_CALIBRATION",
                "file": "baghewala_lab_pvt.json",
                "records_count": 17,
                "description": "Laboratory viscosity vs temperature and water-in-oil emulsion inversion peak measurements for Jodhpur Sandstone crude.",
                "is_available": (self.data_dir / "baghewala_lab_pvt.json").exists()
            }
        ]
        return datasets

    def get_everitt_jennings_cards(self) -> Dict[str, Any]:
        """Loads all 16 canonical Everitt-Jennings dynacards."""
        p = self.data_dir / "everitt_jennings_cards.json"
        if not p.exists():
            raise FileNotFoundError("Everitt-Jennings dataset not found.")
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_volve_telemetry(self, well_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Reads rows from Equinor Volve telemetry CSV."""
        p = self.data_dir / "volve_public_telemetry.csv"
        if not p.exists():
            raise FileNotFoundError("Volve telemetry dataset not found.")
        rows = []
        with open(p, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                if well_id and r["well_id"] != well_id:
                    continue
                rows.append({
                    "date": r["date"],
                    "well_id": r["well_id"],
                    "oil_rate_bpd": float(r["oil_rate_bpd"]),
                    "water_rate_bpd": float(r["water_rate_bpd"]),
                    "gor_scf_bbl": float(r["gor_scf_bbl"]),
                    "wellhead_pressure_psi": float(r["wellhead_pressure_psi"]),
                    "bottomhole_pressure_psi": float(r["bottomhole_pressure_psi"]),
                    "temperature_c": float(r["temperature_c"]),
                    "water_cut_pct": float(r["water_cut_pct"]),
                    "choke_size_pct": float(r["choke_size_pct"]),
                })
                if len(rows) >= limit:
                    break
        return rows

    def ingest_volve_telemetry(self, db: Session, target_well_id: str, days: int = 90) -> Dict[str, Any]:
        """Ingests real Volve production observations into telemetry_observations for target well."""
        well = db.query(WellModel).filter(WellModel.well_id == target_well_id).first()
        if not well:
            raise ValueError(f"Well {target_well_id} not found in database.")

        records = self.get_volve_telemetry(well_id="15/9-F-1C", limit=days)
        ingested_count = 0
        source_label = "Equinor Volve Public Benchmark (Well 15/9-F-1C)"

        for i, rec in enumerate(records):
            day_num = i + 1
            # Check existing
            existing = db.query(TelemetryObservationModel).filter(
                TelemetryObservationModel.well_id == target_well_id,
                TelemetryObservationModel.cycle_number == well.current_cycle_number,
                TelemetryObservationModel.day == day_num,
                TelemetryObservationModel.source_label == source_label
            ).first()

            # Convert psi to bar for pump intake pressure
            pip_bar = round(rec["bottomhole_pressure_psi"] * 0.0689476, 2)

            if existing:
                existing.oil_rate_bpd = rec["oil_rate_bpd"]
                existing.water_cut_pct = rec["water_cut_pct"]
                existing.temperature_c = rec["temperature_c"]
                existing.pump_intake_pressure_bar = pip_bar
            else:
                db.add(TelemetryObservationModel(
                    well_id=target_well_id,
                    cycle_number=well.current_cycle_number,
                    day=day_num,
                    oil_rate_bpd=rec["oil_rate_bpd"],
                    water_cut_pct=rec["water_cut_pct"],
                    temperature_c=rec["temperature_c"],
                    pump_intake_pressure_bar=pip_bar,
                    source_label=source_label
                ))
            ingested_count += 1

        db.commit()
        return {
            "target_well_id": target_well_id,
            "source_dataset": "Equinor Volve Public Dataset",
            "ingested_observations": ingested_count,
            "cycle_number": well.current_cycle_number,
            "status": "SUCCESS"
        }

    def get_petrobras_3w_transients(self) -> Dict[str, Any]:
        """Loads Petrobras 3W high-frequency sensor transients."""
        p = self.data_dir / "petrobras_3w_transients.json"
        if not p.exists():
            raise FileNotFoundError("Petrobras 3W dataset not found.")
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_baghewala_lab_pvt(self) -> Dict[str, Any]:
        """Loads DGH / Oil India Baghewala lab PVT data."""
        p = self.data_dir / "baghewala_lab_pvt.json"
        if not p.exists():
            raise FileNotFoundError("Baghewala lab PVT dataset not found.")
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)

    def verify_pvt_model_vs_lab(self) -> Dict[str, Any]:
        """Validates Andrade viscosity model against real Baghewala laboratory points."""
        lab_data = self.get_baghewala_lab_pvt()
        andrade = lab_data.get("andrade_parameters", {})
        A = float(andrade.get("A_cp", 0.00346))
        B = float(andrade.get("B_kelvin", 4320.0))

        comparisons = []
        sum_sq_err = 0.0
        max_dev_pct = 0.0

        for pt in lab_data["temperature_viscosity_curve"]:
            t_c = float(pt["temp_c"])
            lab_mu = float(pt["viscosity_cp"])
            # Andrade formula: mu = A * exp(B / (T_c + 273.15))
            pred_mu = A * math.exp(B / (t_c + 273.15))
            diff = pred_mu - lab_mu
            dev_pct = abs(diff) / lab_mu * 100.0
            sum_sq_err += diff ** 2
            if dev_pct > max_dev_pct:
                max_dev_pct = dev_pct

            comparisons.append({
                "temperature_c": t_c,
                "measured_lab_cp": lab_mu,
                "model_predicted_cp": round(pred_mu, 1),
                "residual_cp": round(diff, 1),
                "relative_error_pct": round(dev_pct, 2),
                "regime": pt["regime"]
            })

        rmse = math.sqrt(sum_sq_err / len(comparisons))
        is_verified = rmse < 25.0 and max_dev_pct < 8.0

        return {
            "dataset": "DGH / Oil India Baghewala Laboratory PVT Benchmark",
            "andrade_parameters": {"A_cp": A, "B_kelvin": B},
            "rmse_cp": round(rmse, 2),
            "max_relative_error_pct": round(max_dev_pct, 2),
            "verification_status": "VERIFIED_PHYSICALLY_CONSISTENT" if is_verified else "CALIBRATION_DRIFT",
            "comparisons": comparisons
        }

    verify_andrade_viscosity_fit = verify_pvt_model_vs_lab


dataset_service = DatasetService()
