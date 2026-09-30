"""
Sucker Rod Floating & Impact Shock Detection Engine.

Provides an explicit, testable physical criterion for rod floating in heavy oil:
Floating occurs when the downstroke velocity imposed by the surface pumping unit
exceeds the terminal gravity-fall velocity of the submerged rod string through
ultra-viscous fluid in the tubing-rod annulus.

Calculates:
- buoyant_rod_weight_lbs
- drag_force_lbs
- inertial_force_lbs
- downward_net_force_lbs
- terminal_sinking_velocity_m_s
- float_margin_index
- safety_envelope: "SAFE" (>= 1.25), "WARNING" (1.00 <= M < 1.25), "UNSAFE" (< 1.00)

PROVENANCE: SIMULATED (Coupled Stokes-Couette annular viscous flow & kinematics).
"""

from dataclasses import dataclass
from typing import Optional, Any
import numpy as np

from core.config import canonical_config as _C

MIN_VFD_RATIO = 0.5


@dataclass(frozen=True)
class VFDKinematics:
    """Polished-rod kinematics for a VFD speed profile at fixed SPM.

    Cycle period T = 60/SPM. With downstroke speed ratio r (r < 1 slows the downstroke):
      downstroke duration  t_d = T / (2 r)
      upstroke duration    t_u = T (1 - 1/(2 r))       (requires r > 0.5)
    Each half-stroke is treated as a half-sine of its own duration, so
      v_down = (S/2) omega r,          a_down = (S/2) omega^2 r^2
      v_up   = (S/2) omega / (2 - 1/r), a_up   = (S/2) omega^2 / (2 - 1/r)^2
    r = 1 recovers the symmetric sinusoidal case.
    """
    ratio: float
    t_up_s: float
    t_down_s: float
    v_up_m_s: float
    v_down_m_s: float
    k_up: float          # v_up / v_sym
    k_down: float        # v_down / v_sym
    accel_up_g: float    # peak a/g on upstroke
    accel_down_g: float  # peak a/g on downstroke


def vfd_kinematics(spm: float, stroke_length_inch: float, vfd_downstroke_ratio: float = 1.0) -> VFDKinematics:
    r = float(vfd_downstroke_ratio)
    if r <= MIN_VFD_RATIO:
        raise ValueError(f"vfd_downstroke_ratio must be > {MIN_VFD_RATIO} (got {r}); upstroke time would be <= 0")
    spm = max(float(spm), 1e-6)
    period = 60.0 / spm
    omega = 2.0 * np.pi * spm / 60.0
    half_s_m = stroke_length_inch * 0.0254 / 2.0
    k_down = r
    k_up = 1.0 / (2.0 - 1.0 / r)
    # a/g with S in inches: (S_in/2) * omega^2 / 386.4
    a_sym_g = (stroke_length_inch / 2.0) * omega ** 2 / 386.4
    return VFDKinematics(
        ratio=r,
        t_up_s=period * (1.0 - 1.0 / (2.0 * r)),
        t_down_s=period / (2.0 * r),
        v_up_m_s=half_s_m * omega * k_up,
        v_down_m_s=half_s_m * omega * k_down,
        k_up=k_up,
        k_down=k_down,
        accel_up_g=a_sym_g * k_up ** 2,
        accel_down_g=a_sym_g * k_down ** 2,
    )


@dataclass
class FloatAnalysisResult:
    float_margin_index: float           # M_float in [0, inf). M_float < 1.0 means FLOATING!
    is_rod_floating: bool               # True if M_float < 1.0
    terminal_fall_velocity_m_s: float   # Maximum free-fall velocity of rods through fluid
    imposed_downstroke_velocity_m_s: float # Kinematic downstroke velocity from surface unit
    net_downward_force_lbs: float       # W_submerged - F_drag - F_inertia (negative when floating)
    viscous_drag_force_lbs: float       # Annular fluid shear drag on downstroke
    impact_shock_factor: float          # Multiplier on dynamic tension when carrier bar slams rods
    float_risk_level: str               # "SAFE", "NEAR_LIMIT", "HIGH_RISK", "CRITICAL_FLOATING"
    pump_unsetting_precursor_score: float # [0.0, 1.0] failure precursor rating
    recommended_action: str
    buoyant_rod_weight_lbs: float = 5800.0
    drag_force_lbs: float = 0.0
    inertial_force_lbs: float = 0.0
    downward_net_force_lbs: float = 5800.0
    terminal_sinking_velocity_m_s: float = 0.5
    safety_envelope: str = "SAFE"       # "SAFE", "WARNING", "UNSAFE"
    provenance: str = "SIMULATED"


class RodFloatDetector:
    """
    Evaluates rod floating onset, impact shock severity, and mechanical failure risks.
    Couples directly with Wellbore1DModel for depth-resolved viscous shear drag.
    """

    def __init__(
        self,
        pump_depth_m: float = _C.srp.pump_depth_m,
        tubing_id_inch: float = _C.srp.tubing_id_inch,
        avg_rod_od_inch: float = _C.srp.avg_rod_od_inch,
        submerged_weight_lbs: float = _C.srp.submerged_rod_weight_lbs,
        float_threshold_margin: float = _C.safety_limits.min_rod_float_margin_index,
        coupling_drag_factor: Optional[float] = None
    ):
        self.pump_depth_m = pump_depth_m
        self.tubing_id_m = tubing_id_inch * 0.0254
        self.rod_od_m = avg_rod_od_inch * 0.0254
        self.submerged_weight_lbs = submerged_weight_lbs
        self.submerged_weight_n = submerged_weight_lbs * 4.44822 # lbf to Newtons
        self.float_threshold_margin = float_threshold_margin

        # Annular clearance: delta = (D_t - d_r) / 2
        # Rod couplings/guides reduce local clearance; lumped as one multiplier (configs/field.yaml).
        self.coupling_drag_factor = float(coupling_drag_factor if coupling_drag_factor is not None else _C.srp.coupling_drag_factor)
        self.annular_clearance_m = max(1e-4, (self.tubing_id_m - self.rod_od_m) / 2.0)
        # Total cylindrical surface area of rods: A_surf = pi * d_r * L
        self.rod_surface_area_m2 = np.pi * self.rod_od_m * self.pump_depth_m

    def compute_imposed_downstroke_velocity(
        self,
        spm: float,
        stroke_length_inch: float,
        vfd_downstroke_ratio: float = 1.0
    ) -> float:
        """Peak polished-rod downstroke velocity v_down = (S/2) * omega * r (see vfd_kinematics)."""
        return vfd_kinematics(spm, stroke_length_inch, vfd_downstroke_ratio).v_down_m_s

    def compute_terminal_fall_velocity(self, viscosity_cp: float) -> float:
        """
        Terminal falling velocity of rod string through viscous fluid:
        At terminal velocity, Submerged Weight = Viscous Drag * coupling_factor
        """
        # Convert viscosity from cP to Pa.s: 1 cP = 1e-3 Pa.s
        mu_pa_s = max(1e-4, viscosity_cp * 1e-3)
        effective_drag_area = self.rod_surface_area_m2 * self.coupling_drag_factor
        v_term = (self.submerged_weight_n * self.annular_clearance_m) / (mu_pa_s * effective_drag_area)
        return float(v_term)

    def evaluate_float_margin(
        self,
        spm: float,
        stroke_length_inch: float,
        viscosity_cp: float,
        fluid_pound_severity: float = 0.0,
        vfd_downstroke_ratio: float = 1.0,
        wellbore_profile: Optional[Any] = None,
        drag_force_lbs: Optional[float] = None,
        terminal_velocity_m_s: Optional[float] = None
    ) -> FloatAnalysisResult:
        """
        Calculates the Float Margin Index:
        M_float = v_terminal / v_imposed
        
        If M_float < 1.0:
            Imposed velocity > free-fall velocity -> Rod Floating!
        """
        v_imposed = self.compute_imposed_downstroke_velocity(spm, stroke_length_inch, vfd_downstroke_ratio)
        
        if terminal_velocity_m_s is not None and terminal_velocity_m_s > 0.0:
            v_terminal = float(terminal_velocity_m_s)
        else:
            v_terminal = self.compute_terminal_fall_velocity(viscosity_cp)

        # Continuous float margin index:
        m_float = v_terminal / max(v_imposed, 1e-6)

        # Viscous drag force on downstroke:
        if drag_force_lbs is not None and drag_force_lbs > 0.0:
            f_drag_lbs = float(drag_force_lbs)
        else:
            mu_pa_s = max(1e-4, viscosity_cp * 1e-3)
            f_drag_n = mu_pa_s * (v_imposed / self.annular_clearance_m) * self.rod_surface_area_m2 * self.coupling_drag_factor
            f_drag_lbs = f_drag_n / 4.44822

        # Downstroke kinematic acceleration factor (a/g), with VFD-stretched downstroke:
        accel_factor = vfd_kinematics(spm, stroke_length_inch, vfd_downstroke_ratio).accel_down_g
        inertial_force_lbs = self.submerged_weight_lbs * accel_factor * 0.5 # Effective downward inertial force

        net_down_lbs = self.submerged_weight_lbs - f_drag_lbs - inertial_force_lbs
        is_floating = bool(m_float < self.float_threshold_margin)

        # Impact shock factor: When floating occurs, carrier bar falls ahead of clamp
        # and impacts it at bottom turnaround. Impact factor scales with floating severity.
        if is_floating:
            severity = (1.0 - m_float)
            impact_factor = 1.0 + 1.8 * severity + 0.5 * fluid_pound_severity
        else:
            impact_factor = 1.0 + 0.3 * fluid_pound_severity

        # Safety envelope: SAFE, WARNING, UNSAFE
        if m_float >= 1.25:
            safety_envelope = "SAFE"
            risk_level = "SAFE"
            action = "Operating within safe mechanical envelope."
        elif m_float >= self.float_threshold_margin:
            safety_envelope = "WARNING"
            risk_level = "NEAR_LIMIT"
            action = "Approaching float boundary. Monitor reservoir cooling and viscosity closely."
        else:
            safety_envelope = "UNSAFE"
            if m_float < 0.70:
                risk_level = "CRITICAL_FLOATING"
                action = "Immediate SPM reduction required; engage slow downstroke VFD profile."
            else:
                risk_level = "HIGH_RISK"
                action = "Reduce SPM or stroke length to eliminate active rod float."

        # Pump unsetting precursor score [0, 1]:
        precursor = np.clip(
            (max(0.0, 1.2 - m_float) * 0.6) + (fluid_pound_severity * 0.4),
            0.0, 1.0
        )

        return FloatAnalysisResult(
            float_margin_index=round(float(m_float), 3),
            is_rod_floating=is_floating,
            terminal_fall_velocity_m_s=round(float(v_terminal), 4),
            imposed_downstroke_velocity_m_s=round(float(v_imposed), 4),
            net_downward_force_lbs=round(float(net_down_lbs), 1),
            viscous_drag_force_lbs=round(float(f_drag_lbs), 1),
            impact_shock_factor=round(float(impact_factor), 2),
            float_risk_level=risk_level,
            pump_unsetting_precursor_score=round(float(precursor), 3),
            recommended_action=action,
            buoyant_rod_weight_lbs=round(float(self.submerged_weight_lbs), 1),
            drag_force_lbs=round(float(f_drag_lbs), 1),
            inertial_force_lbs=round(float(inertial_force_lbs), 1),
            downward_net_force_lbs=round(float(net_down_lbs), 1),
            terminal_sinking_velocity_m_s=round(float(v_terminal), 4),
            safety_envelope=safety_envelope,
            provenance="SIMULATED"
        )
