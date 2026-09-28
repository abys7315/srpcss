#!/usr/bin/env python3
"""
Phase 1 Physics Verification Plotter — Petro-Twin (SIH 2026, PS26120).

Plots the complete physical cycle response:
1. Reservoir Temperature (heating during CSS soak -> cooling during production)
2. Fluid Viscosity (exponential drop from ~4,500 cP to < 100 cP -> rising back up)
3. Float Margin Index (safe initially -> drops below 1.0 triggering rod float as well cools)

Saves verification plot to benchmarks/results/phase1_physics_verification.png
"""

import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Add backend directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "backend"))

from twin.cycle import CSSCycleSimulator, CycleConfig

def generate_verification_plot():
    print("Running CSSCycleSimulator for Phase 1 verification...")
    cfg = CycleConfig(
        well_id="BGW-VERIFY-01",
        steam_volume_tonnes=3000.0,
        injection_duration_days=15.0,
        soak_duration_days=6.0,
        production_duration_days=90.0,
        spm=5.0, # Fixed uncompensated SPM demonstrating float onset as cooling occurs
        economic_cutoff_oil_rate_bpd=5.0
    )
    sim = CSSCycleSimulator(cfg)
    result = sim.run_simulation()

    days = [pt.day for pt in result.daily_history]
    temps = [pt.temperature_c for pt in result.daily_history]
    viscs = [pt.viscosity_cp for pt in result.daily_history]
    margins = [pt.float_margin_index for pt in result.daily_history]
    floats = [pt.is_rod_floating for pt in result.daily_history]

    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(10, 11), sharex=True)
    plt.subplots_adjust(hspace=0.25)

    # 1. Temperature Curve
    ax1.plot(days, temps, color='#e63946', lw=2.5, label='Reservoir Temperature (C)')
    ax1.axhline(47.0, color='gray', linestyle='--', label='Initial Reservoir Temp (47 C)')
    ax1.set_ylabel('Temperature (C)', fontsize=11, fontweight='bold')
    ax1.set_title('Petro-Twin Phase 1 Physics: Heating -> Cooling -> Viscosity Swing -> Rod Float Onset', fontsize=13, fontweight='bold')
    ax1.grid(True, linestyle=':', alpha=0.6)
    ax1.legend(loc='upper right')

    # 2. Viscosity Curve (Log Scale)
    ax2.semilogy(days, viscs, color='#457b9d', lw=2.5, label='Effective Crude Viscosity (cP)')
    ax2.set_ylabel('Viscosity (cP) [log]', fontsize=11, fontweight='bold')
    ax2.grid(True, linestyle=':', alpha=0.6)
    ax2.legend(loc='upper left')

    # 3. Float Margin Index
    ax3.plot(days, margins, color='#2a9d8f', lw=2.5, label='Float Margin Index (M_float)')
    ax3.axhline(1.0, color='#d90429', linestyle='--', lw=2.0, label='Float Threshold (M_float = 1.0)')
    ax3.fill_between(days, 0, 1.0, color='#d90429', alpha=0.2, label='Active Rod Float Zone')
    
    # Highlight float onset day
    float_days = [d for d, f in zip(days, floats) if f]
    if float_days:
        onset_day = float_days[0]
        ax3.axvline(onset_day, color='#d90429', linestyle=':', lw=2, label=f'Float Onset (Day {onset_day})')
        ax3.scatter([onset_day], [margins[days.index(onset_day)]], color='#d90429', s=80, zorder=5)

    ax3.set_ylabel('Float Margin Index', fontsize=11, fontweight='bold')
    ax3.set_xlabel('Production Phase Day', fontsize=11, fontweight='bold')
    ax3.set_ylim(0, max(margins) * 1.05 if max(margins) < 15 else 12.0)
    ax3.grid(True, linestyle=':', alpha=0.6)
    ax3.legend(loc='upper right')

    # Watermark provenance
    fig.text(0.5, 0.01, 'PROVENANCE: SIMULATED (Marx-Langenheim CSS + Gibbs Wave SRP). Deployment requires OIL field calibration.',
             ha='center', fontsize=9, style='italic', color='#555555')

    out_dir = root_dir / "benchmarks" / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "phase1_physics_verification.png"
    plt.savefig(out_file, dpi=180, bbox_inches='tight')
    plt.close()

    print(f"[SUCCESS] Verification plot generated at: {out_file}")
    print(f"Total Float Events Recorded: {result.total_float_events_count}")
    if float_days:
        print(f"Rod Float Onset occurred at Day: {float_days[0]} as temperature declined below threshold!")

if __name__ == "__main__":
    generate_verification_plot()
