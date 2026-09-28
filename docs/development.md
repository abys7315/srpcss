# Team Development Guide & Git Workflow — SIH 26120

## 1. Two-Person Modular Ownership

To maximize parallel development velocity during hackathon delivery without Git merge conflicts, the codebase is partitioned between two primary owners:

### Developer 1 — Digital Twin, AI & Optimization
Primary Module Ownership:
```text
backend/twin/
backend/ml/
backend/optimizer/
backend/constraints/
backend/economics/
backend/tests/physics/
backend/tests/ml/
backend/tests/optimization/
```

### Developer 2 — Product, API, Frontend & Validation
Primary Module Ownership:
```text
frontend/
backend/app/api/
backend/app/schemas/
backend/app/services/
benchmarks/
docs/
scripts/
backend/tests/api/
backend/tests/integration/
```

---

## 2. Git Branching Strategy

```text
main (Production / Stable Releases)
  ▲
  │ Pull Request (release tags)
develop (Integration Branch)
  ▲
  ├── Pull Request ── abhay/digital-twin
  ├── Pull Request ── abhay/ml
  ├── Pull Request ── abhay/optimizer
  ├── Pull Request ── teammate/frontend
  ├── Pull Request ── teammate/api
  └── Pull Request ── teammate/benchmark
```

### Branch Naming Conventions
- Developer 1: `abhay/<feature-description>` (e.g. `abhay/css-thermal-model`, `abhay/srp-rod-floating`)
- Developer 2: `teammate/<feature-description>` (e.g. `teammate/command-center-ui`, `teammate/api-endpoints`)
- Fixes: `fix/<issue-name>`

---

## 3. Core Development Rules

1. **Never directly push to `main`**: All code enters `main` exclusively from `develop` via validated release PRs.
2. **Pull latest `develop` before starting work**: Run `git pull origin develop` to ensure fresh base branches.
3. **Use isolated feature branches**: One branch per distinct feature or module.
4. **Make atomic, readable commits**: Use conventional commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
5. **Open Pull Requests into `develop`**: Self-review your diff and ensure automated tests pass before requesting teammate review.
6. **Never commit raw generated datasets or binary weights**:
   - `data/raw/*`, `data/processed/*`, `data/simulated/*`, and `models/*.pkl` are strictly gitignored.
   - Maintain data references in `data/DATA_MANIFEST.md`.
7. **Respect Module Boundaries**:
   - Do not edit files outside your assigned domain without prior sync with your teammate.
   - Interface contracts (`backend/app/schemas/` and `docs/api_contract.md`) serve as the boundary contract.
8. **Preserve API Contract Compatibility**:
   - If an endpoint or schema change is required, both developers must review and update `docs/api_contract.md` simultaneously.

---

## 4. Local Verification Checklist

Before pushing any commit:
1. Format & Lint:
   ```bash
   make lint
   ```
2. Run backend tests:
   ```bash
   make test-backend
   ```
3. Run frontend tests:
   ```bash
   make test-frontend
   ```
4. Check Git status for unintended untracked files:
   ```bash
   git status
   ```
