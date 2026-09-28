# Baseline Benchmarks — SIH 26120

## Purpose
This directory contains standardized heuristic operating policies currently used in conventional CSS and heavy oil SRP operations.
These heuristic baselines serve as the control group against which the Digital Twin multi-objective optimizer is benchmarked.

## Baseline Policies Included:
1. **Fixed Schedule Policy**:
   - Fixed steam injection (e.g. exactly 3,000 tonnes per cycle).
   - Fixed 7-day soak.
   - Fixed 4.0 SPM continuous pumping regardless of temperature decline.
2. **Heuristic High-Rate Policy**:
   - Higher SPM (6.0 SPM) attempting maximum initial drawdown without viscous drag compensation (often induces rod floating).
3. **Low-Energy Conservative Policy**:
   - Reduced steam volume (1,500 tonnes) with low SPM (2.5 SPM).

The benchmark pipeline computes Net Benefit (USD), Steam-to-Oil Ratio (SOR), and mechanical wear indices relative to these baselines.
