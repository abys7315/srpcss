"""
Petro-Twin Core Configuration Manager.
Loads canonical YAML configuration files and provides unified access across the digital twin.
Single source of truth for Baghewala reservoir, fluid, CSS, SRP, economics, and safety limits.
"""

from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
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

@dataclass
class FluidConfig:
    api_gravity: float = 18.0
    specific_gravity: float = 0.9465
    dead_oil_density_kg_m3: float = 946.5
    dead_oil_viscosity_47c_cp: float = 2400.0
    dead_oil_viscosity_52c_cp: float = 1200.0
    dead_oil_viscosity_150c_cp: float = 42.0
    formation_volume_factor_bo: float = 1.05
    andrade_a: float = 0.0001556
    andrade_b: float = 4850.0

@dataclass
class CSSConfig:
    default_steam_volume_tonnes: float = 3000.0
    default_injection_duration_days: float = 15.0
    default_injection_pressure_bar: float = 125.0
    default_steam_temp_c: float = 260.0
    default_steam_quality_wellhead: float = 0.80
    wellbore_heat_loss_quality_drop: float = 0.08
    default_soak_days: float = 6.0
    default_production_cutoff_oil_rate_bpd: float = 8.0
    latent_heat_steam_j_kg: float = 1650000.0
    water_specific_heat_j_kg_k: float = 4200.0
    oil_specific_heat_j_kg_k: float = 2100.0

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
    max_allowable_injection_pressure_bar: float = 125.0
    min_bottomhole_temperature_c: float = 47.0
    min_allowable_spm: float = 1.5
    max_allowable_spm: float = 7.5
    min_stroke_length_inch: float = 64.0
    max_stroke_length_inch: float = 144.0
    min_rod_float_margin_index: float = 1.000
    max_goodman_stress_ratio: float = 0.85
    max_gearbox_torque_in_lbs: float = 456000.0
    min_pump_intake_pressure_bar: float = 3.0

import dataclasses

def _filter_dataclass(cls, d: dict):
    if not isinstance(d, dict):
        return cls()
    valid_keys = {f.name for f in dataclasses.fields(cls)}
    return cls(**{k: v for k, v in d.items() if k in valid_keys})

class ConfigManager:
    """Manages application configuration, parsing configs/field.yaml as canonical source."""
    
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

        self.field = _filter_dataclass(FieldConfig, raw.get("field", {}))
        
        res_raw = raw.get("reservoir", {})
        self.reservoir = ReservoirConfig(
            depth_m=res_raw.get("depth_m", 1050.0),
            initial_pressure_bar=res_raw.get("initial_pressure_bar", 65.0),
            initial_temperature_c=res_raw.get("initial_temperature_c", 47.0),
            net_pay_thickness_m=res_raw.get("net_pay_thickness_m", 14.0),
            porosity=res_raw.get("porosity", 0.28),
            permeability_md=res_raw.get("permeability_md", 250.0),
            drainage_area_acres=res_raw.get("drainage_area_acres", 40.0),
            skin_factor=res_raw.get("skin_factor", 1.5),
            rock_volumetric_heat_capacity_j_m3_k=res_raw.get("rock_volumetric_heat_capacity_j_m3_k", 2.3e6),
            overburden_conductivity_w_m_k=res_raw.get("overburden_conductivity_w_m_k", 1.8),
            overburden_volumetric_heat_capacity_j_m3_k=res_raw.get("overburden_volumetric_heat_capacity_j_m3_k", 2.2e6)
        )

        fluid_raw = raw.get("fluid", {})
        andrade = fluid_raw.get("andrade_viscosity", {})
        self.fluid = FluidConfig(
            api_gravity=fluid_raw.get("api_gravity", 18.0),
            specific_gravity=fluid_raw.get("specific_gravity", 0.9465),
            dead_oil_density_kg_m3=fluid_raw.get("dead_oil_density_kg_m3", 946.5),
            dead_oil_viscosity_47c_cp=fluid_raw.get("dead_oil_viscosity_47c_cp", 2400.0),
            dead_oil_viscosity_52c_cp=fluid_raw.get("dead_oil_viscosity_52c_cp", 1200.0),
            dead_oil_viscosity_150c_cp=fluid_raw.get("dead_oil_viscosity_150c_cp", 42.0),
            formation_volume_factor_bo=fluid_raw.get("formation_volume_factor_bo", 1.05),
            andrade_a=andrade.get("a", 0.0001556),
            andrade_b=andrade.get("b", 4850.0)
        )

        css_raw = raw.get("css", {})
        self.css = CSSConfig(
            default_steam_volume_tonnes=css_raw.get("default_steam_volume_tonnes", 3000.0),
            default_injection_duration_days=css_raw.get("default_injection_duration_days", 15.0),
            default_injection_pressure_bar=css_raw.get("default_injection_pressure_bar", 125.0),
            default_steam_temp_c=css_raw.get("default_steam_temp_c", 260.0),
            default_steam_quality_wellhead=css_raw.get("default_steam_quality_wellhead", 0.80),
            wellbore_heat_loss_quality_drop=css_raw.get("wellbore_heat_loss_quality_drop", 0.08),
            default_soak_days=css_raw.get("default_soak_days", 6.0),
            default_production_cutoff_oil_rate_bpd=css_raw.get("default_production_cutoff_oil_rate_bpd", 8.0)
        )

        srp_raw = raw.get("srp", {})
        self.srp = SRPConfig(
            pump_depth_m=srp_raw.get("pump_depth_m", 980.0),
            tubing_od_inch=srp_raw.get("tubing_od_inch", 3.5),
            tubing_id_inch=srp_raw.get("tubing_id_inch", 2.992),
            casing_od_inch=srp_raw.get("casing_od_inch", 7.0),
            casing_id_inch=srp_raw.get("casing_id_inch", 6.184),
            avg_rod_od_inch=srp_raw.get("avg_rod_od_inch", 0.8125),
            rod_density_kg_m3=srp_raw.get("rod_density_kg_m3", 7850.0),
            youngs_modulus_gpa=srp_raw.get("youngs_modulus_gpa", 200.0),
            steel_speed_of_sound_m_s=srp_raw.get("steel_speed_of_sound_m_s", 5000.0),
            standard_stroke_length_inch=srp_raw.get("standard_stroke_length_inch", 100.0),
            standard_spm=srp_raw.get("standard_spm", 4.5),
            standard_vfd_downstroke_ratio=srp_raw.get("standard_vfd_downstroke_ratio", 1.0),
            pump_bore_inch=srp_raw.get("pump_bore_inch", 2.25),
            gearbox_rating_in_lbs=srp_raw.get("gearbox_rating_in_lbs", 456000.0),
            motor_rating_kw=srp_raw.get("motor_rating_kw", 45.0),
            submerged_rod_weight_lbs=srp_raw.get("submerged_rod_weight_lbs", 5800.0)
        )

        econ_raw = raw.get("economics", {})
        self.economics = EconomicsConfig(
            crude_oil_benchmark_usd_bbl=econ_raw.get("crude_oil_benchmark_usd_bbl", 75.0),
            heavy_oil_discount_usd_bbl=econ_raw.get("heavy_oil_discount_usd_bbl", 18.0),
            effective_oil_price_usd_bbl=econ_raw.get("effective_oil_price_usd_bbl", 57.0),
            steam_generation_cost_per_tonne_usd=econ_raw.get("steam_generation_cost_per_tonne_usd", 28.50),
            electricity_cost_per_kwh_usd=econ_raw.get("electricity_cost_per_kwh_usd", 0.11),
            water_disposal_cost_per_bbl_usd=econ_raw.get("water_disposal_cost_per_bbl_usd", 1.20),
            routine_wellhead_opex_per_day_usd=econ_raw.get("routine_wellhead_opex_per_day_usd", 85.0),
            srp_workover_cost_per_incident_usd=econ_raw.get("srp_workover_cost_per_incident_usd", 35000.0),
            target_sor_mass_ratio=econ_raw.get("target_sor_mass_ratio", 3.5),
            sor_penalty_per_unit_excess_usd=econ_raw.get("sor_penalty_per_unit_excess_usd", 12000.0)
        )

        safe_raw = raw.get("safety_limits", {})
        self.safety_limits = SafetyLimitsConfig(
            max_allowable_injection_pressure_bar=safe_raw.get("max_allowable_injection_pressure_bar", 125.0),
            min_bottomhole_temperature_c=safe_raw.get("min_bottomhole_temperature_c", 47.0),
            min_allowable_spm=safe_raw.get("min_allowable_spm", 1.5),
            max_allowable_spm=safe_raw.get("max_allowable_spm", 7.5),
            min_stroke_length_inch=safe_raw.get("min_stroke_length_inch", 64.0),
            max_stroke_length_inch=safe_raw.get("max_stroke_length_inch", 144.0),
            min_rod_float_margin_index=safe_raw.get("min_rod_float_margin_index", 1.000),
            max_goodman_stress_ratio=safe_raw.get("max_goodman_stress_ratio", 0.85),
            max_gearbox_torque_in_lbs=safe_raw.get("max_gearbox_torque_in_lbs", 456000.0),
            min_pump_intake_pressure_bar=safe_raw.get("min_pump_intake_pressure_bar", 3.0)
        )

# Global singleton
canonical_config = ConfigManager()
