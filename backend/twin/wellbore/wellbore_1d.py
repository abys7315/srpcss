"""
Canonical 1-D Depth-Resolved Wellbore Physics Model — Petro-Twin (SIH 2026, PS26120).

Single Canonical Model: Wellbore1DModel.
Calculates depth-resolved vertical profiles along the wellbore:
z, T(z, t), P(z, t), viscosity(z, t), density(z, t), fluid properties, and rod velocity(z, t).

Implements segment-wise distributed viscous rod drag:
F_drag = ∫ [2π μ(z,t) v_r(z,t) / ln(r_tubing(z) / r_rod(z))] dz

PROVENANCE: SIMULATED (Consolidated 1-D depth-resolved thermohydraulic & viscous shear model).
"""

from dataclasses import dataclass, field
import math
from typing import List, Dict, Any, Optional
import numpy as np

from core.config import canonical_config


from twin.fluid.viscosity import AndradeViscosityModel, BaghewalaViscosityParameters


@dataclass
class WellboreSegment:

    """Discretized depth element along the wellbore."""
    depth_top_m: float
    depth_bottom_m: float
    depth_mid_m: float
    length_m: float
    temperature_c: float
    pressure_bar: float
    viscosity_cp: float
    density_kg_m3: float
    tubing_id_m: float
    rod_od_m: float
    annular_clearance_m: float
    coupling_factor: float
    drag_coefficient_n_s_m: float       # 2 * pi * mu * dz * c_coupling / ln(r_t / r_r)


@dataclass
class WellboreProfile1D:
    """Depth-resolved 1-D thermohydraulic and fluid state profile."""
    depths_m: List[float]
    temperatures_c: List[float]
    pressures_bar: List[float]
    viscosities_cp: List[float]
    densities_kg_m3: List[float]
    segments: List[WellboreSegment]
    surface_temp_c: float
    bottomhole_temp_c: float
    surface_viscosity_cp: float
    bottomhole_viscosity_cp: float
    average_viscosity_cp: float
    total_rod_c_drag: float = 0.0
    provenance: str = "SIMULATED"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "depths_m": [round(z, 1) for z in self.depths_m],
            "temperatures_c": [round(t, 2) for t in self.temperatures_c],
            "pressures_bar": [round(p, 2) for p in self.pressures_bar],
            "viscosities_cp": [round(v, 2) for v in self.viscosities_cp],
            "densities_kg_m3": [round(d, 2) for d in self.densities_kg_m3],
            "surface_temp_c": round(self.surface_temp_c, 2),
            "bottomhole_temp_c": round(self.bottomhole_temp_c, 2),
            "surface_viscosity_cp": round(self.surface_viscosity_cp, 2),
            "bottomhole_viscosity_cp": round(self.bottomhole_viscosity_cp, 2),
            "average_viscosity_cp": round(self.average_viscosity_cp, 2),
            "provenance": self.provenance
        }


@dataclass
class RodDragResult:
    """Distributed segment-wise viscous rod drag calculation result."""
    total_drag_force_lbs: float
    total_drag_force_n: float
    drag_by_depth_lbs: List[float]
    maximum_drag_depth_m: float
    drag_contribution_profile: List[Dict[str, Any]]
    rod_velocity_m_s: float
    is_upstroke: bool
    rod_velocity_profile_m_s: List[float] = field(default_factory=list)
    velocity_model: str = "UNIFORM_APPROXIMATION"
    provenance: str = "SIMULATED"


_GLOBAL_WELLBORE_PROFILE_CACHE: Dict[tuple, WellboreProfile1D] = {}


class Wellbore1DModel:
    """
    Canonical 1-D Depth-Resolved Wellbore Thermohydraulic & Distributed Drag Model.
    
    Discretizes the wellbore into depth intervals (e.g. 0m to 1050m at 50m intervals)
    and computes coupled T(z), P(z), μ(z), ρ(z), and segment-wise rod drag.
    """

    def __init__(
        self,
        well_tvd_m: float = 1050.0,
        pump_depth_m: float = 980.0,
        dz_m: float = 50.0,
        tubing_id_inch: float = 2.992,       # 3.5" 9.3# tubing ID = 2.992"
        surface_ambient_temp_c: float = 32.0, # Baghewala near-surface ground datum
        bottomhole_geothermal_c: float = 47.0, # Reservoir initial temperature
        coupling_drag_factor: float = 1.15    # API rod coupling annular area and form factor adjustment
    ):
        self.well_tvd_m = float(well_tvd_m)
        self.pump_depth_m = float(pump_depth_m)
        self.dz_m = float(dz_m)
        self.tubing_id_m = float(tubing_id_inch) * 0.0254
        self.r_tubing_m = self.tubing_id_m / 2.0
        self.surface_ambient_c = float(surface_ambient_temp_c)
        self.reservoir_temp_c = float(bottomhole_geothermal_c)
        self.coupling_drag_factor = float(coupling_drag_factor)

        # Geothermal gradient (°C / m)
        self.geothermal_gradient = (self.reservoir_temp_c - self.surface_ambient_c) / max(1.0, self.well_tvd_m)

        # Unified canonical Andrade viscosity model
        self.visc_model = AndradeViscosityModel(BaghewalaViscosityParameters())
        self.andrade_a = self.visc_model.params.A
        self.andrade_b = self.visc_model.params.B

        # Rod string geometry: API 76 Taper (Top 45% = 7/8", Bottom 55% = 3/4")
        self.top_section_length_m = self.pump_depth_m * 0.45
        self.d_rod_top_m = 0.875 * 0.0254     # 7/8" = 0.022225 m
        self.d_rod_bottom_m = 0.750 * 0.0254  # 3/4" = 0.01905 m

        # Pre-build depth discretization nodes
        self.depth_nodes = self._build_depth_grid()
        self._profile_cache = _GLOBAL_WELLBORE_PROFILE_CACHE

    def _build_depth_grid(self) -> List[float]:
        """Builds depth grid from 0 to well_tvd_m with exact pump depth inclusion."""
        nodes = list(np.arange(0.0, self.well_tvd_m, self.dz_m))
        if self.pump_depth_m not in nodes and self.pump_depth_m < self.well_tvd_m:
            nodes.append(self.pump_depth_m)
        if self.well_tvd_m not in nodes:
            nodes.append(self.well_tvd_m)
        nodes = sorted(list(set(nodes)))
        return nodes

    def get_rod_diameter_m(self, depth_m: float) -> float:
        """Returns rod string outside diameter at depth z (API 76 taper)."""
        if depth_m > self.pump_depth_m:
            return 0.0 # Below pump
        if depth_m <= self.top_section_length_m:
            return self.d_rod_top_m
        return self.d_rod_bottom_m

    def compute_viscosity_cp(self, temperature_c: float) -> float:
        """Evaluates Andrade oil viscosity at specified temperature."""
        return float(self.visc_model.compute_viscosity_cp(temperature_c))


    def compute_density_kg_m3(self, temperature_c: float, water_cut: float = 0.0) -> float:
        """Evaluates temperature-dependent fluid mixture density."""
        rho_oil_15c = float(canonical_config.fluid.dead_oil_density_kg_m3)
        beta_oil = 0.00072 # Thermal expansion coefficient (1/°C)
        rho_oil = rho_oil_15c * (1.0 - beta_oil * (temperature_c - 15.0))
        rho_water = 1000.0 * (1.0 - 0.0003 * (temperature_c - 20.0))
        wc = min(max(float(water_cut), 0.0), 1.0)
        return float((1.0 - wc) * rho_oil + wc * rho_water)

    def compute_profile(
        self,
        bottomhole_temp_c: float,
        liquid_rate_m3_d: float,
        water_cut: float = 0.0,
        wellhead_pressure_bar: float = 5.0
    ) -> WellboreProfile1D:
        """
        Computes 1-D depth-resolved thermohydraulic profiles along the wellbore.
        
        Models Ramey fluid cooling during upward ascent:
        T(z) = T_geo(z) + (T_bh - T_geo(H)) * exp(-(H - z) / A)
        where A is Ramey's thermal relaxation distance dependent on mass flow rate.
        """
        cache_key = (
            round(bottomhole_temp_c, 1),
            round(liquid_rate_m3_d, 2),
            round(water_cut, 2),
            round(wellhead_pressure_bar, 1)
        )
        if cache_key in self._profile_cache:
            return self._profile_cache[cache_key]

        h_total = self.well_tvd_m
        # Ramey relaxation distance A (m): increases with liquid rate
        # High liquid rate -> less heat loss -> fluid reaches surface hotter
        ramey_a = max(80.0, 180.0 + 420.0 * min(1.0, liquid_rate_m3_d / 25.0))

        temperatures = []
        pressures = []
        viscosities = []
        densities = []
        segments: List[WellboreSegment] = []

        # Hydrostatic integration from wellhead downhole
        p_current_bar = wellhead_pressure_bar

        for i in range(len(self.depth_nodes)):
            z = self.depth_nodes[i]
            t_geo = self.surface_ambient_c + self.geothermal_gradient * z

            # Temperature profile: fluid enters bottomhole at bottomhole_temp_c
            cooling_delta = max(0.0, bottomhole_temp_c - (self.surface_ambient_c + self.geothermal_gradient * h_total))
            t_z = t_geo + cooling_delta * math.exp(-(h_total - z) / ramey_a)
            temperatures.append(float(t_z))

            mu_z = self.compute_viscosity_cp(t_z)
            viscosities.append(float(mu_z))

            rho_z = self.compute_density_kg_m3(t_z, water_cut)
            densities.append(float(rho_z))

            if i == 0:
                pressures.append(float(p_current_bar))
            else:
                dz = z - self.depth_nodes[i - 1]
                avg_rho = (densities[i] + densities[i - 1]) / 2.0
                # Hydrostatic gradient: rho * g * dz / 1e5 (bar)
                dp_hydro_bar = (avg_rho * 9.80665 * dz) / 1e5
                # Frictional pressure drop approximation along tubing:
                dp_fric_bar = 0.0008 * dz * (liquid_rate_m3_d / 20.0) ** 1.75
                p_current_bar += (dp_hydro_bar + dp_fric_bar)
                pressures.append(float(p_current_bar))

                # Build segment between depth_nodes[i-1] and depth_nodes[i]
                z_mid = (self.depth_nodes[i - 1] + z) / 2.0
                t_mid = (temperatures[i - 1] + t_z) / 2.0
                mu_mid = (viscosities[i - 1] + mu_z) / 2.0
                rho_mid = avg_rho

                d_rod = self.get_rod_diameter_m(z_mid)
                r_rod = max(1e-4, d_rod / 2.0)
                clearance = max(1e-4, self.r_tubing_m - r_rod)

                # Annular viscous drag coefficient for this segment:
                # dF = [2π * mu * dz * c_coupling / ln(r_t / r_r)] * v_r
                if d_rod > 0.0:
                    ln_ratio = math.log(self.r_tubing_m / r_rod)
                    # Convert mu from cP to Pa.s: 1 cP = 1e-3 Pa.s
                    mu_pa_s = mu_mid * 1e-3
                    c_drag = (2.0 * math.pi * mu_pa_s * dz * self.coupling_drag_factor) / ln_ratio
                else:
                    c_drag = 0.0

                segments.append(WellboreSegment(
                    depth_top_m=self.depth_nodes[i - 1],
                    depth_bottom_m=z,
                    depth_mid_m=z_mid,
                    length_m=dz,
                    temperature_c=float(t_mid),
                    pressure_bar=float(p_current_bar),
                    viscosity_cp=float(mu_mid),
                    density_kg_m3=float(rho_mid),
                    tubing_id_m=self.tubing_id_m,
                    rod_od_m=d_rod,
                    annular_clearance_m=clearance,
                    coupling_factor=self.coupling_drag_factor,
                    drag_coefficient_n_s_m=float(c_drag)
                ))

        surface_temp = temperatures[0]
        bh_temp = temperatures[-1]
        surface_visc = viscosities[0]
        bh_visc = viscosities[-1]
        avg_visc = float(sum(viscosities) / len(viscosities))
        total_rod_c = sum(
            seg.drag_coefficient_n_s_m
            for seg in segments
            if seg.depth_mid_m <= self.pump_depth_m
        )

        res_profile = WellboreProfile1D(
            depths_m=self.depth_nodes,
            temperatures_c=temperatures,
            pressures_bar=pressures,
            viscosities_cp=viscosities,
            densities_kg_m3=densities,
            segments=segments,
            surface_temp_c=surface_temp,
            bottomhole_temp_c=bh_temp,
            surface_viscosity_cp=surface_visc,
            bottomhole_viscosity_cp=bh_visc,
            average_viscosity_cp=avg_visc,
            total_rod_c_drag=total_rod_c,
            provenance="SIMULATED"
        )
        if len(self._profile_cache) < 2000:
            self._profile_cache[cache_key] = res_profile
        return res_profile

    def compute_rod_velocity_profile(
        self,
        surface_velocity_m_s: float,
        elastic_stretch_ratio: float = 0.15,
        profile: Optional[WellboreProfile1D] = None
    ) -> List[float]:
        """
        Calculates depth-resolved rod velocity profile v(z) [m/s].
        
        Quasi-static elastic approximation:
        Under cyclic reciprocating load, rod elasticity causes elongation during upstroke
        and relaxation during downstroke, creating a depth-dependent velocity gradient:
        v(z) = v_surface * (1.0 - elastic_stretch_ratio * (z / L_pump))
        
        Uniform velocity corresponds to elastic_stretch_ratio = 0.0.
        """
        l_pump = max(1.0, self.pump_depth_m)
        segments = profile.segments if profile is not None else []
        if not segments:
            return [
                float(surface_velocity_m_s * (1.0 - elastic_stretch_ratio * min(1.0, z / l_pump)))
                for z in self.depth_nodes if z <= self.pump_depth_m
            ]
        return [
            float(surface_velocity_m_s * (1.0 - elastic_stretch_ratio * min(1.0, seg.depth_mid_m / l_pump)))
            for seg in segments
        ]

    def compute_rod_drag(
        self,
        profile: WellboreProfile1D,
        rod_velocity_m_s: float,
        is_upstroke: bool = False,
        detailed: bool = False,
        rod_velocity_profile_m_s: Optional[List[float]] = None,
        use_elastic_velocity_profile: bool = False,
        elastic_stretch_ratio: float = 0.15
    ) -> RodDragResult:
        """
        Integrates segment-wise distributed viscous rod drag over the rod string:
        F_drag = ∫ C(z) * v_r(z) dz = ∑ C_i * |v_r(z_i)|

        Exposes:
        - total_drag_force (lbs and N)
        - drag_by_depth (lbs per segment)
        - maximum_drag_depth (depth where drag is greatest — typically near cold surface)
        - drag_contribution_profile
        - rod_velocity_profile_m_s (depth-resolved velocity profile)
        - velocity_model ("UNIFORM_APPROXIMATION", "ELASTIC_QUASI_STATIC", "DEPTH_RESOLVED_PROFILE")
        """
        v_abs_surf = abs(rod_velocity_m_s)
        
        # Determine velocity profile across segments
        if rod_velocity_profile_m_s is not None and len(rod_velocity_profile_m_s) == len(profile.segments):
            vel_profile = [float(v) for v in rod_velocity_profile_m_s]
            velocity_model = "DEPTH_RESOLVED_PROFILE"
        elif use_elastic_velocity_profile and v_abs_surf > 1e-9:
            vel_profile = self.compute_rod_velocity_profile(rod_velocity_m_s, elastic_stretch_ratio, profile)
            velocity_model = "ELASTIC_QUASI_STATIC"
        else:
            vel_profile = [rod_velocity_m_s] * len(profile.segments)
            velocity_model = "UNIFORM_APPROXIMATION"

        # Check if all velocities are zero
        if all(abs(v) < 1e-9 for v in vel_profile):
            return RodDragResult(
                total_drag_force_lbs=0.0,
                total_drag_force_n=0.0,
                drag_by_depth_lbs=[0.0] * len(profile.segments),
                maximum_drag_depth_m=0.0,
                drag_contribution_profile=[],
                rod_velocity_m_s=0.0,
                is_upstroke=is_upstroke,
                rod_velocity_profile_m_s=[0.0] * len(profile.segments),
                velocity_model=velocity_model,
                provenance="SIMULATED"
            )

        # Fast path when velocity is uniform and not detailed
        if velocity_model == "UNIFORM_APPROXIMATION" and not detailed:
            total_c = profile.total_rod_c_drag if profile.total_rod_c_drag > 1e-6 else sum(
                seg.drag_coefficient_n_s_m
                for seg in profile.segments
                if seg.depth_mid_m <= self.pump_depth_m
            )
            total_drag_n = total_c * v_abs_surf
            total_drag_lbs = total_drag_n * 0.224809
            return RodDragResult(
                total_drag_force_lbs=round(float(total_drag_lbs), 2),
                total_drag_force_n=round(float(total_drag_n), 2),
                drag_by_depth_lbs=[],
                maximum_drag_depth_m=profile.segments[0].depth_mid_m if profile.segments else 0.0,
                drag_contribution_profile=[],
                rod_velocity_m_s=round(float(rod_velocity_m_s), 4),
                is_upstroke=is_upstroke,
                rod_velocity_profile_m_s=[round(v, 4) for v in vel_profile],
                velocity_model=velocity_model,
                provenance="SIMULATED"
            )

        # Segment-by-segment integration: F_drag = sum(C_i * |v_i|)
        drag_by_depth_lbs: List[float] = []
        contribution_profile: List[Dict[str, Any]] = []
        total_drag_n = 0.0
        max_drag_seg_lbs = -1.0
        max_drag_depth = 0.0

        for i, seg in enumerate(profile.segments):
            if seg.depth_mid_m > self.pump_depth_m:
                drag_by_depth_lbs.append(0.0)
                continue

            v_seg = abs(vel_profile[i]) if i < len(vel_profile) else v_abs_surf
            f_seg_n = seg.drag_coefficient_n_s_m * v_seg
            f_seg_lbs = f_seg_n * 0.224809
            total_drag_n += f_seg_n
            drag_by_depth_lbs.append(round(f_seg_lbs, 2))

            if f_seg_lbs > max_drag_seg_lbs:
                max_drag_seg_lbs = f_seg_lbs
                max_drag_depth = seg.depth_mid_m

            if detailed:
                contribution_profile.append({
                    "depth_top_m": round(seg.depth_top_m, 1),
                    "depth_bottom_m": round(seg.depth_bottom_m, 1),
                    "depth_mid_m": round(seg.depth_mid_m, 1),
                    "viscosity_cp": round(seg.viscosity_cp, 1),
                    "temperature_c": round(seg.temperature_c, 1),
                    "rod_velocity_m_s": round(v_seg, 4),
                    "segment_drag_lbs": round(f_seg_lbs, 2),
                    "segment_drag_n": round(f_seg_n, 2),
                    "rod_od_inch": round(seg.rod_od_m / 0.0254, 3)
                })

        total_drag_lbs = total_drag_n * 0.224809
        return RodDragResult(
            total_drag_force_lbs=round(float(total_drag_lbs), 2),
            total_drag_force_n=round(float(total_drag_n), 2),
            drag_by_depth_lbs=drag_by_depth_lbs if detailed else [],
            maximum_drag_depth_m=round(float(max_drag_depth), 1),
            drag_contribution_profile=contribution_profile,
            rod_velocity_m_s=round(float(rod_velocity_m_s), 4),
            is_upstroke=is_upstroke,
            rod_velocity_profile_m_s=[round(v, 4) for v in vel_profile],
            velocity_model=velocity_model,
            provenance="SIMULATED"
        )

    def validate_pressure_chain(
        self,
        reservoir_pressure_bar: float,
        flowing_sandface_pwf_bar: float,
        pump_intake_pressure_bar: float,
        wellhead_pressure_bar: float
    ) -> Dict[str, Any]:
        """
        Validates physical directionality and consistency of the wellbore pressure chain:
        P_res >= P_wf >= PIP >= P_wh under production drawdown conditions.
        Under hydrostatic conditions in tubing: deeper pressure > shallower pressure.
        """
        is_drawdown_consistent = (reservoir_pressure_bar >= flowing_sandface_pwf_bar >= pump_intake_pressure_bar)
        is_tubing_gradient_consistent = (flowing_sandface_pwf_bar > wellhead_pressure_bar)
        return {
            "reservoir_pressure_bar": reservoir_pressure_bar,
            "flowing_sandface_pwf_bar": flowing_sandface_pwf_bar,
            "pump_intake_pressure_bar": pump_intake_pressure_bar,
            "wellhead_pressure_bar": wellhead_pressure_bar,
            "is_physically_consistent": is_drawdown_consistent and is_tubing_gradient_consistent,
            "drawdown_bar": round(reservoir_pressure_bar - flowing_sandface_pwf_bar, 2),
            "pip_submergence_bar": round(flowing_sandface_pwf_bar - pump_intake_pressure_bar, 2),
            "provenance": "SIMULATED"
        }

    def compute_terminal_sinking_velocity(
        self,
        profile: WellboreProfile1D,
        submerged_rod_weight_lbs: float
    ) -> float:
        """
        Calculates terminal gravity-fall velocity through the depth-resolved fluid column:
        At terminal velocity, Submerged Weight = Integrated Downward Viscous Drag.
        
        W_sub (N) = ∫ [2π μ(z) v_term / ln(r_t / r_r)] dz
        => v_term = W_sub / ∑ (c_drag_i)
        """
        w_sub_n = submerged_rod_weight_lbs * 4.44822  # lbf to N
        total_c = profile.total_rod_c_drag if profile.total_rod_c_drag > 1e-6 else sum(
            seg.drag_coefficient_n_s_m
            for seg in profile.segments
            if seg.depth_mid_m <= self.pump_depth_m
        )
        if total_c <= 1e-6:
            return 10.0  # Effectively unresisted fall
        v_term = w_sub_n / total_c
        return float(v_term)
