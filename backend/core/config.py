"""
Petro-Twin Core Configuration Manager.

Loads configs/field.yaml and exposes it as typed dataclasses. This is the single source of truth
for reservoir, fluid, CSS, SRP, economics and safety limits. Physics modules take their defaults
from `canonical_config`; derived quantities (Andrade A/B, fracture-limited injection pressure,
OOIP) are computed here rather than stored as independent literals.
"""

from pathlib import Path
from typing import Dict, Any
from dataclasses import dataclass
import dataclasses
import math
import yaml

ROOT_DIR = Path(__file__).resolve().parent.parent.parent


@dataclass
class FieldConfig:
    name: str = "Baghewala"
    basin: str = "Bikaner-Nagaur Basin"
    formation: str = "Jodhpur Sandstone"
    provenance: str = "SIMULATED_AND_ASSUMED"


@dataclass
class ReservoirConfig:
    depth_m: float = 1050.0
    initial_pressure_bar: float = 65.0
    initial_temperature_c: float = 47.0
    net_pay_thickness_m: float = 14.0
    porosity: float = 0.28
    permeability_md: float = 250.0
    drainage_area_acres: float = 40.0
    skin_factor: float = 1.5
    rock_volumetric_heat_capacity_j_m3_k: float = 2.3e6
    overburden_conductivity_w_m_k: float = 1.8
    overburden_volumetric_heat_capacity_j_m3_k: float = 2.2e6
    fracture_gradient_bar_per_m: float = 0.163
    initial_water_saturation: float = 0.30
    residual_oil_saturation_heated: float = 0.20
    # Single documented calibration scalar on the lumped heated-zone heat-loss rate (docs/physics.md).
    thermal_loss_calibration: float = 2.6

    @property
    def drainage_area_m2(self) -> float:
        return self.drainage_area_acres * 4046.8564


@dataclass
class FluidConfig:
    api_gravity: float = 18.0
    specific_gravity: float = 0.9465
    dead_oil_density_kg_m3: float = 946.5
    # Andrade anchors: the only viscosity inputs. A and B are derived from these two points.
    dead_oil_viscosity_47c_cp: float = 2400.0
    dead_oil_viscosity_150c_cp: float = 42.0
    formation_volume_factor_bo: float = 1.05

    @property
    def andrade_b(self) -> float:
        """B [K] = ln(mu1/mu2) / (1/T1 - 1/T2) for anchors at 47 and 150 degC."""
        t1, t2 = 47.0 + 273.15, 150.0 + 273.15
        return math.log(self.dead_oil_viscosity_47c_cp / self.dead_oil_viscosity_150c_cp) / (1.0 / t1 - 1.0 / t2)

    @property
    def andrade_a(self) -> float:
        """A [cP] from the 47 degC anchor."""
        return self.dead_oil_viscosity_47c_cp / math.exp(self.andrade_b / (47.0 + 273.15))


@dataclass
class CSSConfig:
    default_steam_volume_tonnes: float = 3000.0
    default_injection_duration_days: float = 15.0
    default_injection_pressure_bar: float = 125.0   # bottomhole; sets Tsat via IAPWS-IF97
    default_steam_quality_wellhead: float = 0.80
    default_soak_days: float = 6.0
    default_production_cutoff_oil_rate_bpd: float = 8.0
    water_specific_heat_j_kg_k: float = 4200.0
    oil_specific_heat_j_kg_k: float = 2100.0
    fracture_safety_factor: float = 0.9


@dataclass
class SRPConfig:
    pump_depth_m: float = 980.0
    tubing_od_inch: float = 3.5
    tubing_id_inch: float = 2.992
    casing_od_inch: float = 7.0
    casing_id_inch: float = 6.184
    avg_rod_od_inch: float = 0.8125
    rod_density_kg_m3: float = 7850.0
    youngs_modulus_gpa: float = 200.0
    steel_speed_of_sound_m_s: float = 5000.0
    standard_stroke_length_inch: float = 100.0
    standard_spm: float = 4.5
    standard_vfd_downstroke_ratio: float = 1.0
    pump_bore_inch: float = 2.25
    gearbox_rating_in_lbs: float = 456000.0
    motor_rating_kw: float = 45.0
    submerged_rod_weight_lbs: float = 5800.0
    # Effective drag multiplier for rod couplings/guides in the lumped terminal-velocity model
    # (twin/srp/float_detection.py, v = W d / (mu A_rod * factor)).
    coupling_drag_factor: float = 4.5
    # Coupling form factor applied in the depth-resolved Couette drag (twin/wellbore/wellbore_1d.py).
    distributed_coupling_factor: float = 1.15


@dataclass
class EconomicsConfig:
    crude_oil_benchmark_usd_bbl: float = 75.0
    heavy_oil_discount_usd_bbl: float = 18.0
    effective_oil_price_usd_bbl: float = 57.0
    steam_generation_cost_per_tonne_usd: float = 28.50
    electricity_cost_per_kwh_usd: float = 0.11
    water_disposal_cost_per_bbl_usd: float = 1.20
    routine_wellhead_opex_per_day_usd: float = 85.0
    srp_workover_cost_per_incident_usd: float = 35000.0
    target_sor_mass_ratio: float = 3.5
    sor_penalty_per_unit_excess_usd: float = 12000.0


@dataclass
class SafetyLimitsConfig:
    # Derived at load time: fracture_gradient * depth * fracture_safety_factor.
    max_allowable_injection_pressure_bar: float = 154.0
    min_bottomhole_temperature_c: float = 47.0
    max_steam_temp_c: float = 350.0   # ASSUMED thermal-service casing/packer rating
    min_allowable_spm: float = 1.5
    max_allowable_spm: float = 7.5
    min_stroke_length_inch: float = 64.0
    max_stroke_length_inch: float = 144.0
    min_rod_float_margin_index: float = 1.000
    max_goodman_stress_ratio: float = 0.85
    max_gearbox_torque_in_lbs: float = 456000.0
    min_pump_intake_pressure_bar: float = 3.0


def _filter_dataclass(cls, d: Any):
    if not isinstance(d, dict):
        return cls()
    types = {f.name: f.type for f in dataclasses.fields(cls)}
    out = {}
    for k, v in d.items():
        if k not in types:
            continue
        # PyYAML (YAML 1.1) reads values such as 2.2e6 as strings; coerce numeric fields.
        if types[k] in (float, "float") and isinstance(v, str):
            v = float(v)
        out[k] = v
    return cls(**out)


class ConfigManager:
    """Parses configs/field.yaml as the canonical source (singleton)."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConfigManager, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        yaml_path = ROOT_DIR / "configs" / "field.yaml"
        raw: Dict[str, Any] = {}
        if yaml_path.exists():
            try:
                with open(yaml_path, "r", encoding="utf-8") as f:
                    raw = yaml.safe_load(f) or {}
            except Exception:
                raw = {}

        self.field = _filter_dataclass(FieldConfig, raw.get("field"))
        self.reservoir = _filter_dataclass(ReservoirConfig, raw.get("reservoir"))
        self.fluid = _filter_dataclass(FluidConfig, raw.get("fluid"))
        self.css = _filter_dataclass(CSSConfig, raw.get("css"))
        self.srp = _filter_dataclass(SRPConfig, raw.get("srp"))
        self.economics = _filter_dataclass(EconomicsConfig, raw.get("economics"))
        self.safety_limits = _filter_dataclass(SafetyLimitsConfig, raw.get("safety_limits"))
        self.safety_limits.max_allowable_injection_pressure_bar = round(self.fracture_limited_injection_pressure_bar, 1)

    @property
    def fracture_limited_injection_pressure_bar(self) -> float:
        r = self.reservoir
        return r.fracture_gradient_bar_per_m * r.depth_m * self.css.fracture_safety_factor

    @property
    def ooip_m3(self) -> float:
        """Stock-tank OOIP of the drainage area: A * h * phi * (1 - Sw) / Bo."""
        r = self.reservoir
        return r.drainage_area_m2 * r.net_pay_thickness_m * r.porosity * (1.0 - r.initial_water_saturation) / self.fluid.formation_volume_factor_bo


canonical_config = ConfigManager()
