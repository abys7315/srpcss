# Experiments Benchmark Suite — SIH 26120

This directory stores reproducible experiment run configurations and protocols for:
1. Multi-cycle CSS recovery optimization (Cycles 1 through 5).
2. Joint CSS + SRP co-optimization vs sequential decoupled optimization.
3. VFD motion profile optimization for rod-float avoidance.

Execution:
```bash
python scripts/run_benchmark.py --suite experiments
```
All outputs are recorded with provenance and uncertainty intervals.
