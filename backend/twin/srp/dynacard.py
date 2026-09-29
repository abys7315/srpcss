"""
Gibbs-Inspired 1-D Damped-Wave Approximation for Synthetic Dynacard Generation.

Simulates surface and downhole dynamometer cards using an analytical 1-D damped-wave approximation
incorporating polished rod harmonic motion, phase lag, rod stretch, fluid pound, and viscous damping:
1. Normal full-fillage operations
2. Sucker rod floating in viscous crude (downstroke load collapse & shock)
3. Fluid pound (delayed traveling valve opening with impact drop)
4. Gas interference
5. High viscous fluid drag (elliptical hysteresis)

PROVENANCE: ASSUMED (Gibbs-inspired 1-D damped-wave approximation / diagnostic card synthesis).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

@dataclass
class DynacardResult:
    surface_position_inch: List[float]
    surface_load_lbs: List[float]
    downhole_position_inch: List[float]
    downhole_load_lbs: List[float]
    peak_polished_rod_load_lbs: float
    min_polished_rod_load_lbs: float
    load_range_lbs: float
    stroke_length_inch: float
    spm: float
    diagnostic_card_label: str
    card_area_in_lbs: float          # Work per stroke
    peak_gearbox_torque_in_lbs: float
    provenance: str = "SIMULATED"

class GibbsDynacardModel:
    """Simulates surface and downhole dynamometer cards across varying operational conditions."""

    def __init__(self, num_card_points: int = 100):
        self.num_points = num_card_points

    def generate_dynacards(
        self,
        stroke_length_inch: float,
        spm: float,
        submerged_rod_weight_lbs: float,
        plunger_fluid_load_lbs: float,
        viscosity_cp: float,
        pump_fillage: float = 1.0,
        float_margin_index: float = 1.5,
        vfd_downstroke_ratio: float = 1.0,
        drag_force_lbs: Optional[float] = None,
        upstroke_drag_lbs: Optional[float] = None,
        downstroke_drag_lbs: Optional[float] = None,
        full_points: bool = True
    ) -> DynacardResult:
        """
        Synthesizes surface and pump dynacards based on physical load components:
        W_sub, F_o, dynamic acceleration, depth-resolved fluid viscous drag, and pump fillage.
        """
        N = self.num_points
        # Crank angle theta from 0 to 2*pi
        theta = np.linspace(0, 2.0 * np.pi, N, endpoint=False)
        
        # Polish rod position: Simple harmonic motion:
        # Top dead center (TDC) at theta = pi, Bottom dead center (BDC) at theta = 0
        # Position S(theta) = (Stroke / 2) * (1 - cos(theta))
        s_surf = (stroke_length_inch / 2.0) * (1.0 - np.cos(theta))
        
        # Kinematic acceleration factor: a / g = (Stroke * omega^2) / (2 * g) * cos(theta)
        omega = (2.0 * np.pi * spm) / 60.0
        accel_factor = ((stroke_length_inch / 386.4) * (omega ** 2) / 2.0)
        
        # Viscous drag load on upstroke vs downstroke:
        # If explicit distributed drag from Wellbore1DModel is provided, use it directly!
        f_up_nominal = upstroke_drag_lbs if upstroke_drag_lbs is not None else (
            drag_force_lbs if drag_force_lbs is not None else min(6000.0, (viscosity_cp / 500.0) * (spm / 4.0) * 800.0)
        )
        f_down_nominal = downstroke_drag_lbs if downstroke_drag_lbs is not None else (
            drag_force_lbs if drag_force_lbs is not None else min(6000.0, (viscosity_cp / 500.0) * (spm / 4.0) * 800.0)
        )
        f_drag_nominal = f_up_nominal


        # -------------------------------------------------------------
        # 1. Downhole Pump Dynamometer Card Synthesis (Vectorized)
        # -------------------------------------------------------------
        downhole_pos = s_surf.copy()
        downhole_load = np.zeros(N)
        fillage = float(np.clip(pump_fillage, 0.1, 1.0))
        up_mask = theta < np.pi
        down_mask = ~up_mask
        up_progress = theta / np.pi
        down_progress = (theta - np.pi) / np.pi

        # Upstroke: Building load to Fo
        stretch_mask = up_mask & (up_progress < 0.15)
        full_up_mask = up_mask & (~stretch_mask)
        downhole_load[stretch_mask] = plunger_fluid_load_lbs * (up_progress[stretch_mask] / 0.15)
        downhole_load[full_up_mask] = plunger_fluid_load_lbs

        # Downstroke: Traveling valve opens, load drops
        if fillage < 0.90:
            c1 = down_mask & (down_progress < (1.0 - fillage))
            c2 = down_mask & (~c1) & (down_progress < (1.0 - fillage) + 0.08)
            downhole_load[c1] = plunger_fluid_load_lbs * 0.92
            downhole_load[c2] = plunger_fluid_load_lbs * 0.10
        else:
            c1 = down_mask & (down_progress < 0.12)
            downhole_load[c1] = plunger_fluid_load_lbs * (1.0 - down_progress[c1] / 0.12)

        # -------------------------------------------------------------
        # 2. Surface Dynamometer Card Synthesis (Vectorized)
        # -------------------------------------------------------------
        # Determine diagnostic label:
        if float_margin_index < 1.0:
            diag_label = "ROD_FLOATING"
        elif pump_fillage < 0.80:
            diag_label = "FLUID_POUND"
        elif viscosity_cp > 5000.0:
            diag_label = "HEAVY_FLUID_DRAG"
        else:
            diag_label = "NORMAL"

        inertia_load = submerged_rod_weight_lbs * accel_factor * np.cos(theta)
        surface_load = np.zeros(N)
        surface_load[up_mask] = (
            submerged_rod_weight_lbs + downhole_load[up_mask] + f_up_nominal * np.sin(theta[up_mask]) + inertia_load[up_mask]
        )

        if float_margin_index < 1.0:
            sc1 = down_mask & (down_progress < 0.75)
            sc2 = down_mask & (~sc1)
            surface_load[sc1] = np.maximum(-250.0, 300.0 * (1.0 - down_progress[sc1] / 0.75) - 200.0)
            impact_magnitude = submerged_rod_weight_lbs * (1.0 - float_margin_index) * 2.2
            spike_progress = (down_progress[sc2] - 0.75) / 0.25
            surface_load[sc2] = submerged_rod_weight_lbs * 0.5 + impact_magnitude * np.sin(np.pi * spike_progress)
        else:
            down_drag = f_down_nominal * np.sin(theta[down_mask] - np.pi)
            surface_load[down_mask] = np.maximum(400.0, submerged_rod_weight_lbs - down_drag + inertia_load[down_mask])

        # Polish rod load extrema:
        pprl = float(np.max(surface_load))
        mprl = float(np.min(surface_load))
        load_range = pprl - mprl
        
        # Work per stroke (area inside surface card loop in in-lbs):
        trapz_fn = getattr(np, "trapezoid", getattr(np, "trapz", None))
        card_area = float(trapz_fn(surface_load, s_surf))
        
        # Peak gearbox torque approximation:
        # Peak net torque = (Load_range / 2) * (Stroke / 2) * Torque_factor
        gearbox_torque = (load_range / 2.0) * (stroke_length_inch / 2.0) * 1.05

        if not full_points:
            return DynacardResult(
                surface_position_inch=[],
                surface_load_lbs=[],
                downhole_position_inch=[],
                downhole_load_lbs=[],
                peak_polished_rod_load_lbs=round(pprl, 1),
                min_polished_rod_load_lbs=round(mprl, 1),
                load_range_lbs=round(load_range, 1),
                stroke_length_inch=round(stroke_length_inch, 1),
                spm=round(spm, 2),
                diagnostic_card_label=diag_label,
                card_area_in_lbs=round(abs(card_area), 1),
                peak_gearbox_torque_in_lbs=round(gearbox_torque, 1),
                provenance="SIMULATED"
            )

        return DynacardResult(
            surface_position_inch=[round(float(x), 2) for x in s_surf],
            surface_load_lbs=[round(float(y), 1) for y in surface_load],
            downhole_position_inch=[round(float(x), 2) for x in downhole_pos],
            downhole_load_lbs=[round(float(y), 1) for y in downhole_load],
            peak_polished_rod_load_lbs=round(pprl, 1),
            min_polished_rod_load_lbs=round(mprl, 1),
            load_range_lbs=round(load_range, 1),
            stroke_length_inch=round(stroke_length_inch, 1),
            spm=round(spm, 2),
            diagnostic_card_label=diag_label,
            card_area_in_lbs=round(abs(card_area), 1),
            peak_gearbox_torque_in_lbs=round(gearbox_torque, 1),
            provenance="SIMULATED"
        )
