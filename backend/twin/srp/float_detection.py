"""
Sucker Rod Floating & Impact Shock Detection Engine.

Provides an explicit, testable physical criterion for rod floating in heavy oil:
Floating occurs when the downstroke velocity imposed by the surface pumping unit
exceeds the terminal gravity-fall velocity of the submerged rod string through
ultra-viscous fluid in the tubing-rod annulus.

PROVENANCE: ASSUMED (Coupled Stokes-Couette annular viscous flow equations).
"""

from dataclasses import dataclass
import numpy as np

@dataclass
class FloatAnalysisResult:
    float_margin_index: float           # M_float in [0, inf). M_float < 1.0 means FLOATING!
    is_rod_floating: bool               # True if M_float < 1.0
    terminal_fall_velocity_m_s: float   # Maximum free-fall velocity of rods through fluid
    imposed_downstroke_velocity_m_s: float # Kinematic downstroke velocity from surface unit
    net_downward_force_lbs: float       # W_submerged - F_drag (negative when floating)
    viscous_drag_force_lbs: float       # Annular fluid shear drag on downstroke
    impact_shock_factor: float          # Multiplier on dynamic tension when carrier bar slams rods
    float_risk_level: str               # "SAFE", "NEAR_LIMIT", "HIGH_RISK", "CRITICAL_FLOATING"
    pump_unsetting_precursor_score: float # [0.0, 1.0] failure precursor rating
    recommended_action: str
    provenance: str = "SIMULATED"

class RodFloatDetector:
    """
    Evaluates rod floating onset, impact shock severity, and mechanical failure risks.
    """

    def __init__(
        self,
        pump_depth_m: float = 980.0,
        tubing_id_inch: float = 2.992,  # 3.5" 9.3# tubing ID
        avg_rod_od_inch: float = 0.8125, # Weighted average rod OD (7/8" and 3/4")
        submerged_weight_lbs: float = 5800.0,
        float_threshold_margin: float = 1.0
    ):
        self.pump_depth_m = pump_depth_m
        self.tubing_id_m = tubing_id_inch * 0.0254
        self.rod_od_m = avg_rod_od_inch * 0.0254
        self.submerged_weight_lbs = submerged_weight_lbs
        self.submerged_weight_n = submerged_weight_lbs * 4.44822 # lbf to Newtons
        self.float_threshold_margin = float_threshold_margin

        # Annular clearance: delta = (D_t - d_r) / 2
        # Rod couplings every 25-30 ft with smaller clearance increase effective viscous drag
        self.coupling_drag_factor = 4.5
        self.annular_clearance_m = max(1e-4, (self.tubing_id_m - self.rod_od_m) / 2.0)
        # Total cylindrical surface area of rods: A_surf = pi * d_r * L
        self.rod_surface_area_m2 = np.pi * self.rod_od_m * self.pump_depth_m

    def compute_imposed_downstroke_velocity(
        self,
        spm: float,
        stroke_length_inch: float,
        vfd_downstroke_ratio: float = 1.0
    ) -> float:
        """
        Peak downstroke velocity of the walking beam / polish rod:
        v_down = (pi * Stroke * SPM) / 60 * (1 / downstroke_ratio)
        """
        stroke_m = stroke_length_inch * 0.0254
        omega = (2.0 * np.pi * spm) / 60.0
        # Peak sinusoidal velocity: v_max = (Stroke / 2) * omega
        base_v_peak = (stroke_m / 2.0) * omega
        
        # If VFD provides asymmetric stroke, downstroke ratio < 1 slows the downstroke
        ratio = max(0.2, vfd_downstroke_ratio)
        return float(base_v_peak * ratio)

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
        vfd_downstroke_ratio: float = 1.0
    ) -> FloatAnalysisResult:
        """
        Calculates the Float Margin Index:
        M_float = v_terminal / v_imposed
        
        If M_float < 1.0:
            Imposed velocity > free-fall velocity -> Rod Floating!
        """
        v_imposed = self.compute_imposed_downstroke_velocity(spm, stroke_length_inch, vfd_downstroke_ratio)
        v_terminal = self.compute_terminal_fall_velocity(viscosity_cp)
        
        # Continuous float margin index:
        m_float = v_terminal / max(v_imposed, 1e-6)
        
        # Viscous drag force at imposed velocity:
        # F_drag_n = mu * (v_imposed / clearance) * A_surf
        mu_pa_s = max(1e-4, viscosity_cp * 1e-3)
        f_drag_n = mu_pa_s * (v_imposed / self.annular_clearance_m) * self.rod_surface_area_m2 * self.coupling_drag_factor
        f_drag_lbs = f_drag_n / 4.44822
        
        net_down_lbs = self.submerged_weight_lbs - f_drag_lbs
        is_floating = (m_float < self.float_threshold_margin)

        # Impact shock factor: When floating occurs, carrier bar falls ahead of clamp
        # and impacts it at bottom turnaround. Impact factor scales with floating severity.
        if is_floating:
            severity = (1.0 - m_float)
            impact_factor = 1.0 + 1.8 * severity + 0.5 * fluid_pound_severity
        else:
            impact_factor = 1.0 + 0.3 * fluid_pound_severity

        # Categorize risk level:
        if m_float < 0.70:
            risk_level = "CRITICAL_FLOATING"
            action = "Immediate SPM reduction required; engage slow downstroke VFD profile."
        elif m_float < 1.0:
            risk_level = "HIGH_RISK"
            action = "Reduce SPM or stroke length to eliminate active rod float."
        elif m_float < 1.30:
            risk_level = "NEAR_LIMIT"
            action = "Approaching float boundary. Monitor reservoir cooling and viscosity closely."
        else:
            risk_level = "SAFE"
            action = "Operating within normal mechanical envelope."

        # Pump unsetting precursor score [0, 1]:
        # Driven by high impact shock, negative load duration, and severe fluid pound
        precursor = np.clip(
            (max(0.0, 1.2 - m_float) * 0.6) + (fluid_pound_severity * 0.4),
            0.0, 1.0
        )

        return FloatAnalysisResult(
            float_margin_index=round(float(m_float), 3),
            is_rod_floating=bool(is_floating),
            terminal_fall_velocity_m_s=round(float(v_terminal), 4),
            imposed_downstroke_velocity_m_s=round(float(v_imposed), 4),
            net_downward_force_lbs=round(float(net_down_lbs), 1),
            viscous_drag_force_lbs=round(float(f_drag_lbs), 1),
            impact_shock_factor=round(float(impact_factor), 2),
            float_risk_level=risk_level,
            pump_unsetting_precursor_score=round(float(precursor), 3),
            recommended_action=action,
            provenance="SIMULATED"
        )
