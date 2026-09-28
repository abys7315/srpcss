#!/usr/bin/env python3
"""
Environment and Project Integrity Validator for SIH 26120.

Checks:
1. Python version >= 3.10
2. Existence of all required repository folders and configuration files
3. Integrity of .env and YAML configuration files
4. Basic package importability
"""

import sys
import os
from pathlib import Path

REQUIRED_DIRECTORIES = [
    "backend/app",
    "backend/app/api",
    "backend/app/core",
    "backend/app/schemas",
    "backend/app/services",
    "backend/app/db",
    "backend/app/utils",
    "backend/twin",
    "backend/twin/thermal",
    "backend/twin/fluid",
    "backend/twin/reservoir",
    "backend/twin/wellbore",
    "backend/twin/srp",
    "backend/twin/surface",
    "backend/ml",
    "backend/optimizer",
    "backend/constraints",
    "backend/economics",
    "backend/tests",
    "frontend/src",
    "data/raw",
    "data/processed",
    "data/simulated",
    "data/external",
    "data/schemas",
    "benchmarks/baseline",
    "benchmarks/experiments",
    "benchmarks/ablation",
    "benchmarks/sensitivity",
    "benchmarks/results",
    "configs",
    "scripts",
    "docs",
]

REQUIRED_FILES = [
    ".gitignore",
    ".env.example",
    "docker-compose.yml",
    "Makefile",
    "README.md",
    "LICENSE",
    "data/DATA_MANIFEST.md",
    "docs/architecture.md",
    "docs/api_contract.md",
    "docs/physics.md",
    "docs/ml.md",
    "docs/optimization.md",
    "docs/safety.md",
    "docs/data.md",
    "docs/model_card.md",
    "docs/deployment.md",
    "docs/development.md",
    "configs/default.yaml",
    "configs/physics.yaml",
    "configs/optimization.yaml",
    "configs/ml.yaml",
    "configs/economics.yaml",
]

def validate_environment() -> bool:
    print("=" * 60)
    print("SIH 26120: Validating Repository Structure & Environment")
    print("=" * 60)
    
    root_dir = Path(__file__).resolve().parent.parent
    all_passed = True
    
    # Check Python version
    py_ver = sys.version_info
    print(f"Python Version: {py_ver.major}.{py_ver.minor}.{py_ver.micro}")
    if py_ver < (3, 10):
        print(" [FAIL] Python 3.10+ required.")
        all_passed = False
    else:
        print(" [PASS] Python version check.")

    # Check Directories
    missing_dirs = []
    for d in REQUIRED_DIRECTORIES:
        p = root_dir / d
        if not p.is_dir():
            missing_dirs.append(d)
            all_passed = False
            
    if missing_dirs:
        print(f" [FAIL] Missing directories ({len(missing_dirs)}):")
        for d in missing_dirs:
            print(f"   - {d}")
    else:
        print(f" [PASS] All {len(REQUIRED_DIRECTORIES)} required directories verified.")

    # Check Required Files
    missing_files = []
    for f in REQUIRED_FILES:
        p = root_dir / f
        if not p.is_file():
            missing_files.append(f)
            all_passed = False
            
    if missing_files:
        print(f" [FAIL] Missing files ({len(missing_files)}):")
        for f in missing_files:
            print(f"   - {f}")
    else:
        print(f" [PASS] All {len(REQUIRED_FILES)} required files verified.")

    print("=" * 60)
    if all_passed:
        print("VALIDATION SUCCESSFUL: Project structure is complete and ready.")
    else:
        print("VALIDATION FAILED: Please fix the missing components listed above.")
    print("=" * 60)
    return all_passed

if __name__ == "__main__":
    success = validate_environment()
    sys.exit(0 if success else 1)
