# Safety & Constraint Engineering — SIH 26120

## 1. Safety Architecture
In oilfield operations, equipment failure or well integrity breach incurs catastrophic financial and environmental costs. The **Constraint Engine** acts as an impassable gatekeeper between the optimization engine and the decision support interface.

**Strict Invariance**: Under no circumstances will any candidate operating point violating constraints be marked with status `RECOMMENDED`.

---

## 2. Hard Physical & Mechanical Constraints

### 2.1 Reservoir & Thermal Integrity
1. **Formation Fracture Pressure Limit**:
   $$P_{\text{inj}} < P_{\text{frac}} = \text{Depth} \times G_{\text{frac}} \times (1 - \text{Safety Margin})$$
   Exceeding fracture pressure risks uncontrollable steam breakthrough into thief zones or groundwater aquifers.
2. **Maximum Steam Temperature**:
   $$T_{\text{steam}} \le T_{\text{casing\_rating}} \quad (\text{typically } 300^\circ\text{C})$$
   Thermal casing buckling and seal failure occur if steam temperature exceeds completion specifications.

### 2.2 Sucker Rod String Fatigue & Tension
1. **Modified Goodman Diagram Limit**:
   $$\sigma_{\text{peak}} \le \sigma_{\text{allowable}} = \left( \frac{\sigma_{\text{uts}}}{1.75} + 0.5625 \sigma_{\min} \right) \cdot S_f$$
   where $\sigma_{\text{uts}}$ is rod ultimate tensile strength, $\sigma_{\min}$ is minimum cyclic tension, and $S_f$ is service factor ($S_f \le 0.85$ in corrosive/sour service).
2. **Minimum Rod Tension / Floating Prevention**:
   $$\text{Margin}_{\text{float}} = W_{\text{submerged}} - F_{\text{drag}} - F_{\text{buoyancy}} \ge F_{\text{safe\_threshold}}$$
   If viscous drag in cold/heavy crude exceeds submerged weight, rods float during downstroke, causing slack wireline and destructive impact loads on the walking beam.

### 2.3 Surface Pumping Unit Limits
1. **Gearbox Peak Torque**:
   $$\tau_{\text{peak}} \le \tau_{\text{rated\_gearbox}}$$
2. **Structure Polish Rod Load (PPRL)**:
   $$\text{PPRL} \le \text{Beam Structural Capacity}$$
3. **Prime Mover (Electric Motor) Thermal Loading**:
   $$\text{CLF} \cdot I_{\text{rms}} \le I_{\text{nameplate\_thermal\_rating}}$$

---

## 3. Constraint Evaluation Taxonomy
Every candidate parameter set is evaluated into one of three classifications:
- `FEASIBLE`: All parameters strictly within standard operating bounds (load factor $< 80\%$).
- `NEAR_LIMIT`: All parameters legally feasible, but one or more indicators exceed $80\%$ of allowable rating (e.g. Goodman stress at $87\%$).
- `INFEASIBLE`: One or more hard constraints violated. Rejected immediately.
