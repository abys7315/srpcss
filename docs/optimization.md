# Optimization Framework — SIH 26120

## 1. Multi-Objective Formulation
Optimizing CSS and SRP operations in heavy oil wells involves trade-offs between thermal investment and production revenue:
1. **Objective 1 (Maximize Economics)**:
   $$\max f_1(\mathbf{x}) = \text{Net Benefit} = \text{Revenue}(\text{Oil Produced}) - \text{Cost}(\text{Steam}) - \text{Cost}(\text{Electricity}) - \text{Cost}(\text{Workover})$$
2. **Objective 2 (Minimize Thermal Inefficiency)**:
   $$\min f_2(\mathbf{x}) = \text{Steam-to-Oil Ratio (SOR)} = \frac{\text{Cumulative Steam Injected (tonnes)}}{\text{Cumulative Oil Produced (tonnes)}}$$
3. **Objective 3 (Minimize Mechanical Equipment Risk)**:
   $$\min f_3(\mathbf{x}) = \text{Stress Intensity \& Floating Risk Index}$$

---

## 2. Decision Variables $\mathbf{x}$

### 2.1 CSS Variables
- $V_{\text{steam}}$: Steam mass injected per cycle ($1,000 - 6,000$ metric tonnes).
- $P_{\text{inj}}$: Bottom-hole injection pressure ($1,200 - 2,100$ psi).
- $t_{\text{inj}}$: Steam injection duration ($10 - 30$ days).
- $t_{\text{soak}}$: Soaking period duration ($3 - 14$ days).
- $t_{\text{cutoff}}$: Production phase economic cutoff condition.

### 2.2 SRP Variables
- $N_{\text{spm}}$: Pumping speed ($1.5 - 7.0$ strokes per minute).
- $S$: Stroke length ($64 - 144$ inches).
- $\mathbf{v}_{\text{vfd}}(t)$: VFD motion profile (asymmetric downstroke speed to mitigate rod floating).
- $P_{\text{pip\_target}}$: Target pump intake pressure.

---

## 3. Optimization Modes
1. **CSS Only**: Optimizes steam volume, rate, and soak duration assuming standard pump settings.
2. **SRP Only**: Optimizes speed and stroke length for an existing thermal well state.
3. **Joint Co-Optimization**: Simultaneously optimizes the steam injection schedule and dynamic pumping profile across multi-cycle horizons.

---

## 4. Algorithmic Approach
- **Constrained Multi-Objective Coarse-to-Fine Grid Search + Pareto Optimization**:
  - **Stage 1 (Coarse Search)**: Discretizes the 8-dimensional decision space across valid operating ranges to capture global trade-offs.
  - **Stage 2 (Fine Search Refinement)**: Explores local perturbations around the top non-dominated Pareto candidates to optimize lifting efficiency while strictly obeying the float margin limit.
  - **Pareto Extraction**: Computes non-dominated fronts balancing Net Economic Benefit ($f_1$), Steam-to-Oil Ratio ($f_2$), Energy Intensity ($f_3$), and Equipment Risk ($f_4$).
- **Strict Infeasibility Rejection**: Hard constraint gating executes *before* Pareto ranking. Any candidate violating formation fracture pressure (>125 bar), rod floating limit ($M_{\text{float}} < 1.0$), Goodman fatigue limit ($R_{\text{Goodman}} > 0.85$), or gearbox torque (>456,000 in-lbs) is strictly rejected and never enters candidate ranking.

