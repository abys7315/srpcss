#!/usr/bin/env python3
"""
CLI Runner for Digital Twin Forward Simulation — SIH 26120.

Allows engineers to execute simulation cycles directly from the command line.
"""

import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "backend"))

def run_simulation(well_id: str, steam_tonnes: float, spm: float):
    """
    Run forward simulation pipeline.
    
    TODO (Developer 1 & 2):
    1. Load well configuration from database or json repository.
    2. Instantiate CSSThermalModel and compute heated zone and thermal dissipation.
    3. Instantiate Walther viscosity model and calculate temperature-dependent profile.
    4. Solve Gibbs wave equation for SRP mechanical loads and float margin.
    5. Evaluate constraint engine and output JSON summary.
    """
    print(f"--- SIH 26120 Simulation Runner ---")
    print(f"Well ID: {well_id}")
    print(f"Injected Steam: {steam_tonnes} tonnes")
    print(f"Pumping Speed: {spm} SPM")
    print("Status: Simulating pipeline placeholder...")
    
    # Placeholder warning
    print("\n[NOTE] Digital Twin physics pipeline under active implementation by Developer 1.")
    print("Refer to docs/physics.md and backend/twin/ for architecture specs.\n")

def main():
    parser = argparse.ArgumentParser(description="Run Digital Twin forward simulation")
    parser.add_argument("--well-id", type=str, default="BGW-01", help="Target Well ID")
    parser.add_argument("--steam", type=float, default=3000.0, help="Steam volume in metric tonnes")
    parser.add_argument("--spm", type=float, default=4.5, help="Pumping speed (SPM)")
    args = parser.parse_args()

    run_simulation(args.well_id, args.steam, args.spm)

if __name__ == "__main__":
    main()
