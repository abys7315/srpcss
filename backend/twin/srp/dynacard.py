"""
Dynamometer Card Generator & Gibbs Wave Equation Simulation.

Generates realistic surface and downhole dynamometer cards for:
1. Normal full-fillage operations
2. Sucker rod floating in viscous crude (downstroke load collapse & shock)
3. Fluid pound (delayed traveling valve opening with impact drop)
4. Gas interference
5. High viscous fluid drag (elliptical hysteresis)

PROVENANCE: ASSUMED (Gibbs damped wave equation approximation / diagnostic card synthesis).
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
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
        vfd_downstroke_ratio: float = 1.0
    ) -> DynacardResult:
        """
        Synthesizes surface and pump dynacards based on physical load components:
        W_sub, F_o, dynamic acceleration, fluid viscous drag, and pump fillage.
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
        # Drag opposes motion: positive on upstroke, negative on downstroke
        # Drag proportional to viscosity and speed:
        f_drag_nominal = min(6000.0, (viscosity_cp / 500.0) * (spm / 4.0) * 800.0)

        # -------------------------------------------------------------
        # 1. Downhole Pump Dynamometer Card Synthesis
        # -------------------------------------------------------------
        # Downhole stroke with rod stretch / overtravel:
        downhole_pos = s_surf.copy()
        downhole_load = np.zeros(N)
        
        # Upstroke: theta in [0, pi) -> Plunger carries fluid load Fo
        # Downstroke: theta in [pi, 2*pi) -> Traveling valve opens, load drops to 0
        fillage = np.clip(pump_fillage, 0.1, 1.0)
        
        for i, th in enumerate(theta):
            if th < np.pi: # Upstroke
                # Building load to Fo
                up_progress = th / np.pi
                if up_progress < 0.15:
                    # Rod stretch / pickup
                    downhole_load[i] = plunger_fluid_load_lbs * (up_progress / 0.15)
                else:
                    downhole_load[i] = plunger_fluid_load_lbs
            else: # Downstroke
                down_progress = (th - np.pi) / np.pi
                # Fluid pound check:
                # If fillage < 1.0, plunger travels in gas/air until hitting liquid at (1 - fillage)
                if fillage < 0.90:
                    if down_progress < (1.0 - fillage):
                        # Still carrying fluid load because valve hasn't opened yet!
                        downhole_load[i] = plunger_fluid_load_lbs * 0.92
                    elif down_progress < (1.0 - fillage) + 0.08:
                        # Impact shock as plunger hits fluid level!
                        downhole_load[i] = plunger_fluid_load_lbs * 0.10
                    else:
                        downhole_load[i] = 0.0
                else:
                    # Normal immediate valve opening
                    if down_progress < 0.12:
                        downhole_load[i] = plunger_fluid_load_lbs * (1.0 - down_progress / 0.12)
                    else:
                        downhole_load[i] = 0.0

        # -------------------------------------------------------------
        # 2. Surface Dynamometer Card Synthesis
        # -------------------------------------------------------------
        surface_load = np.zeros(N)
        
        # Determine diagnostic label:
        if float_margin_index < 1.0:
            diag_label = "ROD_FLOATING"
        elif pump_fillage < 0.80:
            diag_label = "FLUID_POUND"
        elif viscosity_cp > 5000.0:
            diag_label = "HEAVY_FLUID_DRAG"
        else:
            diag_label = "NORMAL"

        for i, th in enumerate(theta):
            # Dynamic inertia component:
            inertia_load = submerged_rod_weight_lbs * accel_factor * np.cos(th)
            
            if th < np.pi: # Upstroke
                # Carries submerged rod weight + downhole pump load + viscous drag + inertia
                up_drag = f_drag_nominal * np.sin(th)
                surface_load[i] = submerged_rod_weight_lbs + downhole_load[i] + up_drag + inertia_load
            else: # Downstroke
                # Rod floating physics:
                if float_margin_index < 1.0:
                    # Rods cannot keep up with carrier bar. Polished rod tension collapses!
                    down_progress = (th - np.pi) / np.pi
                    if down_progress < 0.75:
                        # Carrier bar drops away: load falls to near zero or compression (-100 to 200 lbs)
                        surface_load[i] = max(-250.0, 300.0 * (1.0 - down_progress / 0.75) - 200.0)
                    else:
                        # Carrier bar reaches bottom turnaround and catches the floating rods:
                        # MASSIVE IMPACT SPIKE!
                        impact_magnitude = submerged_rod_weight_lbs * (1.0 - float_margin_index) * 2.2
                        spike_progress = (down_progress - 0.75) / 0.25
                        surface_load[i] = submerged_rod_weight_lbs * 0.5 + impact_magnitude * np.sin(np.pi * spike_progress)
                else:
                    # Normal downstroke: rods fall with unit, traveling valve open
                    down_drag = f_drag_nominal * np.sin(th - np.pi)
                    surface_load[i] = max(400.0, submerged_rod_weight_lbs - down_drag + inertia_load)

        # Polish rod load extrema:
        pprl = float(np.max(surface_load))
        mprl = float(np.min(surface_load))
        load_range = pprl - mprl
        
        # Work per stroke (area inside surface card loop in in-lbs):
        card_area = float(np.trapz(surface_load, s_surf))
        
        # Peak gearbox torque approximation:
        # Peak net torque = (Load_range / 2) * (Stroke / 2) * Torque_factor
        gearbox_torque = (load_range / 2.0) * (stroke_length_inch / 2.0) * 1.05

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
