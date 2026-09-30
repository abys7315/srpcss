"""
Integrated CSS + SRP cycle simulation.

Chain (one sample per simulated day in production):
  Steam injection  (IAPWS-IF97 saturation at bottomhole pressure, Marx-Langenheim heated area)
  -> Soak          (lumped heated-zone balance, conduction only)
  -> Production    (lumped balance: conduction + produced-fluid enthalpy; single calibration scalar)
  -> Andrade viscosity -> thermal PI / Vogel inflow, scaled by mobile oil left in the heated zone
  -> 1-D wellbore thermal/hydraulic profile -> distributed rod drag, terminal sinking velocity
  -> SRP: fixed or adaptive daily SPM (optimizer/srp_controller.py), VFD kinematics
  -> float margin, dynacard, Goodman, gearbox torque -> motor energy -> KPIs

Cycle-to-cycle response comes only from carried state (prior cumulative oil, heated pore volume,
heated-zone oil saturation), not from a per-cycle decay factor.

PROVENANCE: SIMULATED.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import numpy as np

from core.config import canonical_config as _C
from .thermal.css_model import CSSThermalModel, CSSThermalParameters, CSSThermalState
from .thermal.steam_props import saturated_steam
from .fluid.fluid_properties import FluidPropertiesManager
from .reservoir.inflow import ThermalInflowModel, ReservoirParameters
from .reservoir.pressure import ReservoirPressureModel, ReservoirPressureParameters
from .reservoir.production import ProductionHydraulicsModel
from .wellbore.wellbore_1d import Wellbore1DModel, WellboreProfile1D
from .wellbore.pressure import WellboreHydraulicsModel
from .wellbore.heat_transfer import WellboreHeatTransferModel
from .srp.rod_string import RodStringModel
from .srp.float_detection import RodFloatDetector, vfd_kinematics
from .srp.pump import DownholePumpModel
from .srp.dynacard import GibbsDynacardModel, DynacardResult
from .srp.motor import SRPMotorModel
from .surface.steam_system import SteamGeneratorModel
from .surface.energy import FieldEnergyAccounting, EnergyKPIs
from .state import DigitalTwinState
from .well_registry import well_properties

BBL_PER_M3 = 6.2898
WELLHEAD_PRESSURE_BAR = 5.0  # ASSUMED / scenario input


@dataclass
class CycleConfig:
    well_id: str = "BGW-01"
    cycle_number: int = 1

    # CSS parameters (defaults: configs/field.yaml)
    steam_volume_tonnes: float = _C.css.default_steam_volume_tonnes
    injection_duration_days: float = _C.css.default_injection_duration_days
    injection_pressure_bar: float = _C.css.default_injection_pressure_bar  # bottomhole
    steam_temp_celsius: Optional[float] = None   # informational only; Tsat(injection_pressure_bar) is used
    steam_quality_wellhead: float = _C.css.default_steam_quality_wellhead
    soak_duration_days: float = _C.css.default_soak_days

    production_duration_days: float = 90.0
    economic_cutoff_oil_rate_bpd: float = _C.css.default_production_cutoff_oil_rate_bpd

    # SRP
    spm: float = _C.srp.standard_spm
    stroke_length_inch: float = _C.srp.standard_stroke_length_inch
    pump_bore_inch: float = _C.srp.pump_bore_inch
    vfd_downstroke_ratio: float = _C.srp.standard_vfd_downstroke_ratio
    srp_policy: str = "fixed"                 # "fixed" | "adaptive"
    srp_m_target: float = 1.15                # adaptive policy parameters
    srp_min_fillage: float = 0.85

    # Geometry / reservoir. None -> per-well value from twin/well_registry.py.
    pump_depth_m: Optional[float] = None
    well_tvd_m: Optional[float] = None
    reservoir_pressure_bar: Optional[float] = None
    net_pay_m: Optional[float] = None
    pi_multiplier: Optional[float] = None

    # Carried multi-cycle state
    cumulative_prior_oil_produced_m3: float = 0.0
    prior_heated_pore_volume_m3: float = 0.0
    prior_heated_zone_oil_saturation: Optional[float] = None
    prior_elapsed_days: float = 0.0          # cumulative CSS time of earlier cycles (halo growth)

    # Seeded cooling anomaly (scenario input)
    cooling_anomaly_day: Optional[int] = None
    cooling_anomaly_severity_pct: float = 0.0

    # Thermal-loss calibration scalar kappa. None -> stored per-well calibration if one exists
    # (twin/calibration_store.py), otherwise the configs/field.yaml default.
    thermal_loss_calibration: Optional[float] = None


@dataclass
class DailyTimeseriesPoint:
    day: int
    cycle_phase: str
    temperature_c: float
    viscosity_cp: float
    oil_rate_bpd: float
    water_rate_bpd: float
    cumulative_oil_bbl: float
    reservoir_pressure_bar: float = 65.0
    flowing_bottomhole_pressure_bar: float = 0.0
    pump_intake_pressure_bar: float = 0.0
    wellhead_pressure_bar: float = WELLHEAD_PRESSURE_BAR
    wellhead_pressure_provenance: str = "ASSUMED / SCENARIO INPUT"
    float_margin_index: float = 1.0
    is_rod_floating: bool = False
    goodman_stress_ratio: float = 0.5
    pump_fillage_pct: float = 80.0
    daily_electricity_kwh: float = 0.0
    asphaltene_risk_score: float = 0.0
    spm: float = 0.0
    vfd_downstroke_ratio: float = 1.0
    stroke_length_inch: float = 100.0
    peak_gearbox_torque_in_lbs: float = 0.0
    recovery_factor_pct: float = 0.0
    heated_zone_oil_saturation: float = 0.0
    srp_binding_limit: str = "fixed"


@dataclass
class CycleSimulationResult:
    well_id: str
    cycle_number: int
    config: CycleConfig
    daily_history: List[DailyTimeseriesPoint]
    kpis: EnergyKPIs
    final_dynacard: DynacardResult
    total_oil_produced_bbl: float
    total_water_produced_bbl: float
    total_steam_tonnes: float
    total_electricity_kwh: float
    steam_oil_ratio: float
    total_float_events_count: int              # float-days: production days with M_float < 1
    max_goodman_stress_ratio: float
    average_pump_fillage_pct: float
    production_cutoff_day_actual: int
    cutoff_triggered: bool
    provenance: str = "SIMULATED"
    states: List[DigitalTwinState] = field(default_factory=list)
    latest_wellbore_profile: Optional[WellboreProfile1D] = None
    # Thermal / steam / material-balance summary
    steam_saturation_temp_c: float = 0.0
    steam_latent_heat_kj_kg: float = 0.0
    delivered_steam_quality: float = 0.0
    heat_injected_gj: float = 0.0
    heated_zone_radius_m: float = 0.0
    injection_end_temp_c: float = 0.0
    soak_end_temp_c: float = 0.0
    ooip_m3: float = 0.0
    recovery_factor_pct: float = 0.0
    heated_pore_volume_m3: float = 0.0
    final_heated_zone_oil_saturation: float = 0.0
    max_daily_asphaltene_risk: float = 0.0
    max_gearbox_torque_in_lbs: float = 0.0
    phase_bands: List[Dict[str, Any]] = field(default_factory=list)
    dynacards: Dict[str, Any] = field(default_factory=dict)   # full-resolution cards at day 10 / day 60


class CSSCycleSimulator:
    """Runs one CSS cycle (injection, soak, production) with SRP lift."""

    def __init__(self, config: CycleConfig = None):
        self.config = config or CycleConfig()
        cfg = self.config
        props = well_properties(cfg.well_id)
        for name in ("pump_depth_m", "well_tvd_m", "reservoir_pressure_bar", "net_pay_m", "pi_multiplier"):
            if getattr(cfg, name) is None:
                setattr(cfg, name, getattr(props, name))
        self.steam = saturated_steam(cfg.injection_pressure_bar)

        # Wellbore heat loss during injection sets sandface quality (condensation = Q_loss / (m h_fg)).
        self.wellbore_heat_transfer = WellboreHeatTransferModel(well_depth_m=cfg.well_tvd_m)
        inj_rate_kg_s = (cfg.steam_volume_tonnes * 1000.0) / max(1.0, cfg.injection_duration_days * 86400.0)
        self.wb_inj = self.wellbore_heat_transfer.evaluate_injection_heat_loss(
            steam_temp_celsius=self.steam.t_sat_c,
            steam_quality_wellhead=cfg.steam_quality_wellhead,
            steam_rate_kg_s=max(inj_rate_kg_s, 1e-6),
            latent_heat_j_kg=self.steam.h_fg_j_kg,
        )
        from .calibration_store import get_kappa
        kappa = cfg.thermal_loss_calibration if cfg.thermal_loss_calibration is not None else get_kappa(cfg.well_id)
        thermal_kwargs = {} if kappa is None else {"thermal_loss_calibration": float(kappa)}
        self.thermal_model = CSSThermalModel(CSSThermalParameters(
            steam_volume_tonnes=cfg.steam_volume_tonnes,
            injection_duration_days=cfg.injection_duration_days,
            injection_pressure_bar=cfg.injection_pressure_bar,
            steam_quality_wellhead=cfg.steam_quality_wellhead,
            delivered_steam_quality=self.wb_inj.delivered_steam_quality,
            soak_duration_days=cfg.soak_duration_days,
            net_pay_thickness_m=cfg.net_pay_m,
            **thermal_kwargs,
        ))

        self.fluid_mgr = FluidPropertiesManager()
        self.res_pressure_model = ReservoirPressureModel(
            ReservoirPressureParameters(initial_pressure_bar=cfg.reservoir_pressure_bar)
        )
        _rp = ReservoirParameters(initial_pressure_bar=cfg.reservoir_pressure_bar)
        _rp.reference_pi_m3_d_bar *= cfg.pi_multiplier
        self.inflow_model = ThermalInflowModel(_rp)

        self.wellbore_1d = Wellbore1DModel(well_tvd_m=cfg.well_tvd_m, pump_depth_m=cfg.pump_depth_m)
        self.wellbore_hydraulics_model = WellboreHydraulicsModel(depth_m=cfg.well_tvd_m)
        self.hydraulics_model = ProductionHydraulicsModel(pump_depth_m=cfg.pump_depth_m, well_tvd_m=cfg.well_tvd_m)

        self.rod_model = RodStringModel(pump_depth_m=cfg.pump_depth_m)
        self.submerged_rod_wt = self.rod_model.compute_submerged_weight_lbs(1010.0)
        self.float_detector = RodFloatDetector(pump_depth_m=cfg.pump_depth_m, submerged_weight_lbs=self.submerged_rod_wt)
        self.pump_model = DownholePumpModel(pump_bore_diameter_inch=cfg.pump_bore_inch)
        self.dynacard_model = GibbsDynacardModel()
        self.motor_model = SRPMotorModel()
        self.steam_model = SteamGeneratorModel()
        self.energy_accounting = FieldEnergyAccounting()

    # ------------------------------------------------------------------ helpers
    def _srp_day(self, spm: float, profile: WellboreProfile1D, liquid_m3: float, pip_bar: float,
                 mix_density: float, detailed: bool = False) -> Dict[str, Any]:
        """Evaluates pump, drag, float margin, dynacard and rod stress at one SPM."""
        cfg = self.config
        kin = vfd_kinematics(spm, cfg.stroke_length_inch, cfg.vfd_downstroke_ratio)
        drag_down = self.wellbore_1d.compute_rod_drag(profile, rod_velocity_m_s=kin.v_down_m_s, is_upstroke=False, detailed=detailed)
        drag_up = self.wellbore_1d.compute_rod_drag(profile, rod_velocity_m_s=kin.v_up_m_s, is_upstroke=True, detailed=detailed)
        v_term = self.wellbore_1d.compute_terminal_sinking_velocity(profile, self.submerged_rod_wt)
        pump_state = self.pump_model.evaluate_pump_operation(
            spm=spm, stroke_length_inch=cfg.stroke_length_inch, inflow_liquid_rate_m3_d=liquid_m3,
            pump_intake_pressure_bar=pip_bar, wellhead_pressure_bar=WELLHEAD_PRESSURE_BAR,
            pump_depth_m=cfg.pump_depth_m, fluid_density_kg_m3=mix_density,
        )
        float_res = self.float_detector.evaluate_float_margin(
            spm=spm, stroke_length_inch=cfg.stroke_length_inch, viscosity_cp=profile.average_viscosity_cp,
            fluid_pound_severity=pump_state.fluid_pound_severity, vfd_downstroke_ratio=cfg.vfd_downstroke_ratio,
            wellbore_profile=profile, drag_force_lbs=drag_down.total_drag_force_lbs, terminal_velocity_m_s=v_term,
        )
        card = self.dynacard_model.generate_dynacards(
            stroke_length_inch=cfg.stroke_length_inch, spm=spm, submerged_rod_weight_lbs=self.submerged_rod_wt,
            plunger_fluid_load_lbs=pump_state.plunger_fluid_load_lbs, viscosity_cp=profile.average_viscosity_cp,
            pump_fillage=pump_state.pump_fillage_fraction, float_margin_index=float_res.float_margin_index,
            vfd_downstroke_ratio=cfg.vfd_downstroke_ratio, drag_force_lbs=drag_down.total_drag_force_lbs,
            upstroke_drag_lbs=drag_up.total_drag_force_lbs, downstroke_drag_lbs=drag_down.total_drag_force_lbs,
            full_points=detailed,
        )
        stress = self.rod_model.evaluate_goodman_stress(
            peak_polished_rod_load_lbs=card.peak_polished_rod_load_lbs,
            min_polished_rod_load_lbs=card.min_polished_rod_load_lbs,
        )
        return {"pump": pump_state, "float": float_res, "card": card, "stress": stress, "v_term": v_term}

    # ------------------------------------------------------------------ main
    def run_simulation(self) -> CycleSimulationResult:
        cfg = self.config
        res_cfg = _C.reservoir
        bo = _C.fluid.formation_volume_factor_bo
        soi = 1.0 - res_cfg.initial_water_saturation
        sor = res_cfg.residual_oil_saturation_heated
        ooip_m3 = _C.ooip_m3

        # 1-2. Injection and soak
        inj_state = self.thermal_model.simulate_injection_end()
        steam_res = self.steam_model.evaluate_generation(
            steam_mass_tonnes=cfg.steam_volume_tonnes, steam_temp_celsius=self.steam.t_sat_c,
            steam_quality=self.wb_inj.delivered_steam_quality,
        )
        soak_state = self.thermal_model.simulate_soak_end(inj_state)

        # Heated-zone material balance: pore volume heated this cycle; saturation carried from prior cycles.
        # Contacted (mobilised) pore volume: steam zone radius r_h plus a conductive warm-oil halo
        # sqrt(4 alpha_R t) grown over the well's cumulative CSS time t. New contacted volume carries S_oi.
        alpha_r = res_cfg.overburden_conductivity_w_m_k / res_cfg.rock_volumetric_heat_capacity_j_m3_k
        r_h = inj_state.heated_zone_radius_m

        def contacted_pv(elapsed_days: float) -> float:
            r = r_h + np.sqrt(4.0 * alpha_r * max(elapsed_days, 0.0) * 86400.0)
            return float(np.pi * r * r * cfg.net_pay_m * res_cfg.porosity)

        t_pre = cfg.prior_elapsed_days + cfg.injection_duration_days + cfg.soak_duration_days
        pv_prior = max(0.0, cfg.prior_heated_pore_volume_m3)
        so_prior = soi if cfg.prior_heated_zone_oil_saturation is None else float(cfg.prior_heated_zone_oil_saturation)
        pv_eff = max(contacted_pv(t_pre), pv_prior, 1.0)
        so_hz = (so_prior * min(pv_prior, pv_eff) + soi * max(0.0, pv_eff - pv_prior)) / pv_eff
        j_cold = self.inflow_model.evaluate_reservoir_state(
            res_cfg.initial_temperature_c, self.fluid_mgr.evaluate_state(res_cfg.initial_temperature_c).viscosity_cp,
            cfg.reservoir_pressure_bar).productivity_index_m3_d_bar

        # Adaptive SRP controller (lazy import: optimizer package imports this module).
        controller = None
        if cfg.srp_policy == "adaptive":
            from optimizer.srp_controller import AdaptiveSRPController, SRPControlPolicy
            controller = AdaptiveSRPController(
                SRPControlPolicy(m_target=cfg.srp_m_target, min_fillage=cfg.srp_min_fillage),
                stroke_length_inch=cfg.stroke_length_inch, vfd_downstroke_ratio=cfg.vfd_downstroke_ratio,
            )
        _, disp_m3_per_spm = self.pump_model.compute_displacement(1.0, cfg.stroke_length_inch)

        timeseries: List[DailyTimeseriesPoint] = []
        states_history: List[DigitalTwinState] = []
        cum_oil_bbl = cum_water_bbl = total_kwh = 0.0
        float_days = 0
        fillage_history: List[float] = []
        max_goodman = max_torque = max_asph = 0.0
        detailed_cards: Dict[str, DynacardResult] = {}

        # 1.3: cycle-initial pressure (depletion by prior cycles + steam support), then in-cycle depletion.
        p_cycle_init = self.res_pressure_model.compute_cycle_initial_pressure(
            cumulative_oil_produced_m3=cfg.cumulative_prior_oil_produced_m3,
            steam_injected_tonnes=cfg.steam_volume_tonnes,
        )
        p_res = p_cycle_init
        dep_per_1000 = self.res_pressure_model.params.pressure_depletion_per_1000m3_oil

        actual_cutoff_day = int(cfg.production_duration_days)
        cutoff_triggered = False
        latest_dynacard = None
        latest_profile = None
        thermal = soak_state
        current_temp = thermal.average_temperature_c
        spm = cfg.spm
        prev_liquid_m3 = None
        n_days = int(cfg.production_duration_days)

        for d in range(1, n_days + 1):
            anomaly = cfg.cooling_anomaly_severity_pct if (cfg.cooling_anomaly_day is not None and d >= cfg.cooling_anomaly_day) else 0.0

            fluid_state = self.fluid_mgr.evaluate_state(current_temp)
            visc_cp = fluid_state.viscosity_cp
            max_asph = max(max_asph, fluid_state.asphaltene_risk_score)
            res_state = self.inflow_model.evaluate_reservoir_state(current_temp, visc_cp, p_res)

            # 1.5: inflow scales with mobile oil left in the heated zone.
            mobile_frac = float(np.clip((so_hz - sor) / max(soi - sor, 1e-6), 0.0, 1.0))
            potential_oil_m3 = res_state.q_max_oil_m3_d * 0.85 * mobile_frac   # 0.85: max practical Vogel drawdown fraction
            water_cut = self.hydraulics_model.compute_water_cut(d, n_days)
            potential_liquid_m3 = potential_oil_m3 / max(1e-4, 1.0 - water_cut)

            binding = "fixed"
            if controller is not None:
                est_liquid = prev_liquid_m3 if prev_liquid_m3 is not None else potential_liquid_m3
                prov_profile = self.wellbore_1d.compute_profile(
                    bottomhole_temp_c=current_temp, liquid_rate_m3_d=max(est_liquid, 0.1),
                    water_cut=water_cut, wellhead_pressure_bar=WELLHEAD_PRESSURE_BAR,
                )
                v_term_est = self.wellbore_1d.compute_terminal_sinking_velocity(prov_profile, self.submerged_rod_wt)

                def _evaluate(s: float) -> Dict[str, float]:
                    disp = disp_m3_per_spm * s
                    liq = min(disp * 0.95, potential_liquid_m3)
                    pwf_s = self.inflow_model.compute_pwf_from_target_rate(res_state, liq * (1.0 - water_cut))
                    hyd = self.hydraulics_model.evaluate_day(d, liq * (1.0 - water_cut), water_cut, fluid_state.mixture_density_kg_m3, pwf_s)
                    r = self._srp_day(s, prov_profile, liq, hyd.pump_intake_pressure_bar, fluid_state.mixture_density_kg_m3)
                    return {"goodman": r["stress"].goodman_stress_ratio,
                            "torque_in_lbs": r["card"].peak_gearbox_torque_in_lbs,
                            "pip_bar": hyd.pump_intake_pressure_bar}

                decision = controller.decide(spm if d > 1 else cfg.spm, v_term_est, potential_liquid_m3, disp_m3_per_spm, _evaluate)
                spm, binding = decision.spm, decision.binding

            disp_bpd, disp_m3 = self.pump_model.compute_displacement(spm, cfg.stroke_length_inch)
            actual_liquid_m3 = min(disp_m3 * 0.95, potential_liquid_m3)
            actual_oil_m3 = actual_liquid_m3 * (1.0 - water_cut)
            actual_water_m3 = actual_liquid_m3 - actual_oil_m3
            actual_liquid_bpd = actual_liquid_m3 * BBL_PER_M3
            actual_oil_bpd = actual_oil_m3 * BBL_PER_M3
            actual_water_bpd = actual_water_m3 * BBL_PER_M3
            prev_liquid_m3 = actual_liquid_m3

            pwf_bar = self.inflow_model.compute_pwf_from_target_rate(res_state, actual_oil_m3)
            day_hyd = self.hydraulics_model.evaluate_day(d, actual_oil_m3, water_cut, fluid_state.mixture_density_kg_m3, pwf_bar)

            detailed = (d in (10, 60) or d >= n_days - 1)
            profile = self.wellbore_1d.compute_profile(
                bottomhole_temp_c=current_temp, liquid_rate_m3_d=actual_liquid_m3,
                water_cut=water_cut, wellhead_pressure_bar=WELLHEAD_PRESSURE_BAR,
            )
            surface_fluid_temp = profile.surface_temp_c
            rod_effective_temp = (current_temp + surface_fluid_temp) / 2.0

            srp = self._srp_day(spm, profile, actual_liquid_m3, day_hyd.pump_intake_pressure_bar,
                                fluid_state.mixture_density_kg_m3, detailed=detailed)
            pump_state, float_res, dynacard, stress_res = srp["pump"], srp["float"], srp["card"], srp["stress"]
            fillage_history.append(pump_state.pump_fillage_fraction * 100.0)
            if float_res.is_rod_floating:
                float_days += 1
            latest_dynacard, latest_profile = dynacard, profile
            if d in (10, 60):
                detailed_cards[f"day_{d}"] = dynacard
            max_goodman = max(max_goodman, stress_res.goodman_stress_ratio)
            max_torque = max(max_torque, dynacard.peak_gearbox_torque_in_lbs)

            motor_res = self.motor_model.evaluate_energy(
                card_work_in_lbs=dynacard.card_area_in_lbs, spm=spm, liquid_rate_bpd=actual_liquid_bpd,
                peak_gearbox_torque_in_lbs=dynacard.peak_gearbox_torque_in_lbs,
            )
            total_kwh += motor_res.daily_electricity_kwh
            cum_oil_bbl += actual_oil_bpd
            cum_water_bbl += actual_water_bpd

            # Material balance update: production withdraws oil; the cold reservoir around the heated
            # zone feeds it through the cold-oil PI, q_in = J(T_R) * (p_res - p_wf) (reservoir-condition volume).
            q_in_m3 = j_cold * max(0.0, p_res - pwf_bar)
            so_hz = float(np.clip(so_hz + (q_in_m3 - actual_oil_m3 * bo) / pv_eff, 0.0, soi))
            pv_new = contacted_pv(t_pre + d)
            if pv_new > pv_eff:
                so_hz = (so_hz * pv_eff + soi * (pv_new - pv_eff)) / pv_new
                pv_eff = pv_new
            cum_oil_m3 = cum_oil_bbl / BBL_PER_M3
            rf_pct = 100.0 * (cfg.cumulative_prior_oil_produced_m3 + cum_oil_m3) / max(ooip_m3, 1.0)

            # In-cycle depletion from the cycle-initial pressure (1.3).
            p_res = max(15.0, p_cycle_init - (cum_oil_m3 / 1000.0) * dep_per_1000)

            timeseries.append(DailyTimeseriesPoint(
                day=d, cycle_phase="PRODUCTION", temperature_c=round(current_temp, 2), viscosity_cp=round(visc_cp, 1),
                oil_rate_bpd=round(actual_oil_bpd, 1), water_rate_bpd=round(actual_water_bpd, 1),
                cumulative_oil_bbl=round(cum_oil_bbl, 1), reservoir_pressure_bar=round(p_res, 2),
                flowing_bottomhole_pressure_bar=round(day_hyd.flowing_bottomhole_pressure_bar, 2),
                pump_intake_pressure_bar=round(day_hyd.pump_intake_pressure_bar, 2),
                float_margin_index=float_res.float_margin_index, is_rod_floating=float_res.is_rod_floating,
                goodman_stress_ratio=stress_res.goodman_stress_ratio,
                pump_fillage_pct=round(pump_state.pump_fillage_fraction * 100.0, 1),
                daily_electricity_kwh=motor_res.daily_electricity_kwh,
                asphaltene_risk_score=fluid_state.asphaltene_risk_score,
                spm=round(spm, 3), vfd_downstroke_ratio=cfg.vfd_downstroke_ratio, stroke_length_inch=cfg.stroke_length_inch,
                peak_gearbox_torque_in_lbs=round(dynacard.peak_gearbox_torque_in_lbs, 1),
                recovery_factor_pct=round(rf_pct, 4), heated_zone_oil_saturation=round(so_hz, 4),
                srp_binding_limit=binding,
            ))

            oil_tonnes = max(0.01, cum_oil_bbl * 0.1504)
            states_history.append(DigitalTwinState(
                well_id=cfg.well_id, cycle_number=cfg.cycle_number, day=d, phase="PRODUCTION",
                reservoir_pressure_bar=round(p_res, 2), reservoir_temperature_c=round(current_temp, 2),
                heated_zone_radius_m=thermal.heated_zone_radius_m, cumulative_heat_retained_gj=thermal.heat_retained_gj,
                wellbore_temperature_c=round(rod_effective_temp, 2), wellhead_temperature_c=round(surface_fluid_temp, 2),
                wellhead_pressure_bar=WELLHEAD_PRESSURE_BAR, wellhead_pressure_provenance="ASSUMED / SCENARIO INPUT",
                pump_intake_pressure_bar=round(day_hyd.pump_intake_pressure_bar, 2),
                pump_intake_temperature_c=round(current_temp, 2), flowing_bottomhole_pressure_bar=round(pwf_bar, 2),
                oil_rate_bpd=round(actual_oil_bpd, 1), water_rate_bpd=round(actual_water_bpd, 1),
                liquid_rate_bpd=round(actual_liquid_bpd, 1), water_cut_pct=round(water_cut * 100.0, 1),
                cumulative_oil_bbl=round(cum_oil_bbl, 1), cumulative_water_bbl=round(cum_water_bbl, 1),
                cumulative_steam_tonnes=cfg.steam_volume_tonnes, oil_viscosity_cp=round(visc_cp, 1),
                mixture_density_kg_m3=round(fluid_state.mixture_density_kg_m3, 1),
                spm=round(spm, 3), stroke_length_inch=cfg.stroke_length_inch, vfd_downstroke_ratio=cfg.vfd_downstroke_ratio,
                pump_fillage_pct=round(pump_state.pump_fillage_fraction * 100.0, 1),
                peak_polished_rod_load_lbs=round(dynacard.peak_polished_rod_load_lbs, 1),
                min_polished_rod_load_lbs=round(dynacard.min_polished_rod_load_lbs, 1),
                peak_gearbox_torque_in_lbs=round(dynacard.peak_gearbox_torque_in_lbs, 1),
                goodman_stress_ratio=round(stress_res.goodman_stress_ratio, 3),
                float_margin_index=round(float_res.float_margin_index, 3), is_rod_floating=float_res.is_rod_floating,
                diagnostic_card_label=dynacard.diagnostic_card_label,
                daily_electricity_kwh=round(motor_res.daily_electricity_kwh, 2), cumulative_electricity_kwh=round(total_kwh, 2),
                steam_oil_ratio=round(cfg.steam_volume_tonnes / oil_tonnes, 2),
                asphaltene_risk_score=round(fluid_state.asphaltene_risk_score, 3),
                failure_risk_probability=round(max(0.01, 1.0 - float_res.float_margin_index if float_res.is_rod_floating else 0.02), 3),
                fluid_pound_severity=round(pump_state.fluid_pound_severity, 3),
                recovery_factor_pct=round(rf_pct, 4), heated_zone_oil_saturation=round(so_hz, 4),
                provenance="SIMULATED",
            ))

            thermal = self.thermal_model.simulate_production_step(
                current_state=thermal, day=d, daily_oil_m3=actual_oil_m3, daily_water_m3=actual_water_m3,
                cooling_anomaly_severity_pct=anomaly,
            )
            current_temp = thermal.average_temperature_c

            if actual_oil_bpd < cfg.economic_cutoff_oil_rate_bpd and d >= 15:
                actual_cutoff_day = d
                cutoff_triggered = True
                break

        kpis = self.energy_accounting.compute_cycle_kpis(
            steam_mass_tonnes=cfg.steam_volume_tonnes, steam_cost_usd=steam_res.steam_generation_cost_usd,
            cumulative_oil_bbl=cum_oil_bbl, cumulative_water_bbl=cum_water_bbl, total_pumping_kwh=total_kwh,
            cycle_duration_days=actual_cutoff_day + cfg.injection_duration_days + cfg.soak_duration_days,
        )
        avg_fillage = float(np.mean(fillage_history)) if fillage_history else 100.0
        final_rf = timeseries[-1].recovery_factor_pct if timeseries else 0.0
        t_inj, t_soak = cfg.injection_duration_days, cfg.soak_duration_days

        return CycleSimulationResult(
            well_id=cfg.well_id, cycle_number=cfg.cycle_number, config=cfg, daily_history=timeseries, kpis=kpis,
            final_dynacard=latest_dynacard or self.dynacard_model.generate_dynacards(100.0, 4.0, 5000.0, 4000.0, 500.0),
            total_oil_produced_bbl=round(cum_oil_bbl, 1), total_water_produced_bbl=round(cum_water_bbl, 1),
            total_steam_tonnes=cfg.steam_volume_tonnes, total_electricity_kwh=round(total_kwh, 1),
            steam_oil_ratio=kpis.steam_oil_ratio_tonne_tonne, total_float_events_count=float_days,
            max_goodman_stress_ratio=round(max_goodman, 3), average_pump_fillage_pct=round(avg_fillage, 1),
            production_cutoff_day_actual=actual_cutoff_day, cutoff_triggered=cutoff_triggered, provenance="SIMULATED",
            states=states_history, latest_wellbore_profile=latest_profile,
            steam_saturation_temp_c=round(self.steam.t_sat_c, 2),
            steam_latent_heat_kj_kg=round(self.steam.h_fg_j_kg / 1e3, 1),
            delivered_steam_quality=round(self.thermal_model.get_delivered_steam_quality(), 3),
            heat_injected_gj=inj_state.cumulative_heat_injected_gj, heated_zone_radius_m=inj_state.heated_zone_radius_m,
            injection_end_temp_c=inj_state.average_temperature_c, soak_end_temp_c=soak_state.average_temperature_c,
            ooip_m3=round(ooip_m3, 1), recovery_factor_pct=round(final_rf, 4), heated_pore_volume_m3=round(pv_eff, 1),
            final_heated_zone_oil_saturation=round(so_hz, 4), max_daily_asphaltene_risk=round(max_asph, 3),
            max_gearbox_torque_in_lbs=round(max_torque, 1),
            dynacards=detailed_cards,
            phase_bands=[
                {"phase": "INJECTION", "start_day": 0.0, "end_day": t_inj},
                {"phase": "SOAK", "start_day": t_inj, "end_day": t_inj + t_soak},
                {"phase": "PRODUCTION", "start_day": t_inj + t_soak, "end_day": t_inj + t_soak + actual_cutoff_day},
            ],
        )
