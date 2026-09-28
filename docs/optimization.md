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
- **Genetic / Evolutionary Algorithm**: NSGA-II (via `pymoo`) generates the non-dominated Pareto front trade-off curve between Net Benefit and SOR.
- **Bayesian Optimization**: (via `Optuna`) used for fast surrogate tuning when evaluating costly physical simulator runs.
- **Infeasibility Rejection**: Any candidate solution violating mechanical or reservoir safety boundaries is discarded or assigned an infinite penalty.
