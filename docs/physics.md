# Physics reference

All numbers below are produced by the code with the inputs in `configs/field.yaml`. The data are
simulated; nothing here is a field measurement. Units are SI/metric unless stated.

## 1. Inputs (configs/field.yaml)

| Quantity | Value | Provenance |
|---|---|---|
| Depth (TVD) / pump seat | 1050 m / 980 m | assumed |
| Initial reservoir pressure / temperature | 65 bar / 47 °C | assumed |
| Net pay, porosity, permeability | 14 m, 0.28, 250 mD | assumed |
| Drainage area | 40 acres (161 874 m²) | assumed |
| Initial water saturation / residual oil (heated) | 0.30 / 0.20 | assumed |
| Oil 18 °API, Bo | 946.5 kg/m³, 1.05 | assumed |
| Fracture gradient | 0.163 bar/m | assumed |

## 2. Steam (IAPWS-IF97)

The bottomhole injection pressure sets the saturation state (`twin/thermal/steam_props.py`,
`iapws.IAPWS97`). Steam temperature is not an independent input.

| p_bh [bar] | T_sat [°C] | h_fg [kJ/kg] |
|---|---|---|
| 47 | 260.1 | 1661 |
| 80 | 295.0 | 1442 |
| 100 | 311.0 | 1318 |
| 125 | 327.8 | 1163 |
| 154 | 344.3 | 973 |

Injection pressure limit = fracture gradient × depth × 0.9 = 0.163 × 1050 × 0.9 = **154 bar**.

Sandface quality: x_bh = x_wh − Q_loss / (ṁ h_fg), with Q_loss from steady radial conduction through
the insulated annulus (`twin/wellbore/heat_transfer.py`). For 3000 t over 15 d at 125 bar,
x_wh = 0.80 gives x_bh ≈ 0.75.

Heat delivered per kg relative to reservoir water: h = (h_f(p) − c_w T_R) + x_bh h_fg(p).
Raising pressure raises T_sat but lowers h_fg, so heat per tonne falls slightly with pressure
(3000 t: 6678 GJ at 60 bar, 6559 GJ at 125 bar, 6457 GJ at 150 bar).

## 3. Heated zone: injection, soak, production

Injection: Marx-Langenheim heated area
A_h = H_o M_R h / (4 k_ob M_ob ΔT) · F(t_D), ΔT = T_sat − T_R. The zone is at T_sat at end of injection.

Soak and production use one lumped energy balance for the heated zone (`CSSThermalModel._decay`):

C dT/dt = −U(t) (T − T_R),  C = M_R h A_h

U(t) = κ [ 2 k_ob A_h / √(π α_ob t) + (q_o ρ_o c_o + q_w ρ_w c_w) ]

The first term is transient conduction to over- and underburden (Boberg-Lantz form); the second is
enthalpy carried out by produced fluids (zero during soak). τ = C/U is therefore set by heated-zone
area, produced-fluid heat-capacity flow and overburden conduction; no fixed decay constants remain.

κ (`reservoir.thermal_loss_calibration` = 2.6) is the single calibration scalar. It lumps lateral
conduction and convective losses the one-zone model omits, and was chosen so the baseline cycle
(3000 t, 124 bar, 7 d soak, 4 SPM) has a day-90 zone temperature of about 80 °C
(κ = 2.0 → 102 °C, 2.7 → 78 °C, 3.0 → 72 °C). It is not history-matched to field data.

A seeded cooling anomaly (scenario input) multiplies U by (1 + 1.2 × severity/100).

## 4. Viscosity (Andrade)

μ(T) = A exp(B/T), anchored at μ(47 °C) = 2400 cP and μ(150 °C) = 42 cP:
B = ln(2400/42) / (1/320.15 − 1/423.15) = 5321 K, A = 1.453 × 10⁻⁴ cP.

| T [°C] | μ [cP] (code output) |
|---|---|
| 47 | 2400 |
| 60 | 1255 |
| 80 | 508 |
| 100 | 226 |
| 120 | 110 |
| 150 | 42 |
| 200 | 11.1 |
| 250 | 3.8 |

`backend/tests/physics/test_physics_consistency.py` checks code, config and this table agree within 5 %.

## 5. Reservoir pressure and material balance

Cycle-initial pressure: p₀ = p_i − 0.85 bar × (prior cumulative oil / 1000 m³) + 0.008 bar/t × steam.
In-cycle: p(t) = p₀ − 0.85 × (cycle cumulative oil / 1000 m³), floor 15 bar.

OOIP (drainage area) = A h φ (1 − S_w) / Bo = 423 000 m³. Recovery factor is
(prior + cycle cumulative oil) / OOIP.

Oil saturation is tracked over the contacted pore volume
V_p(t) = π (r_h + √(4 α_R t))² h φ, where r_h is the Marx-Langenheim steam-zone radius and
√(4 α_R t) is the conductive warm-oil halo grown over the well's cumulative CSS time t
(α_R = k/M_R ≈ 7.8 × 10⁻⁷ m²/s, about 5 m after one 110-day cycle). Newly contacted volume enters
at S_oi. Each day S_o falls by q_o Bo / V_p and gains cold-reservoir influx
J(T_R) (p_res − p_wf) / V_p. Inflow potential is q_max,Vogel × 0.85 × (S_o − S_or)/(S_oi − S_or),
where q_max uses J(T) = J_ref μ_ref/μ(T).

Later cycles produce less only because S_o, contacted volume and pressure carried from earlier
cycles differ; there is no per-cycle decay factor. `optimizer/multicycle.py` chains cycles with this
carried state (cumulative oil, contacted pore volume, S_o, elapsed time).

The SOR penalty in the net-benefit objective is capped at 10 t/t excess over the target so that a
near-zero-oil cycle stays finite.

## 6. SRP kinematics with a VFD profile

At fixed SPM (period T = 60/SPM) and downstroke speed ratio r (r < 1 slows the downstroke):

- downstroke duration T/(2r), upstroke duration T(1 − 1/(2r)); requires r > 0.5
- each half-stroke is a half-sine of its own duration:
  v_down = (S/2) ω r, v_up = (S/2) ω / (2 − 1/r),
  a_down = (S/2) ω² r², a_up = (S/2) ω² / (2 − 1/r)²

So v_down = π S SPM r / 60: the ratio **multiplies** the symmetric velocity. Slowing the downstroke
shortens the upstroke, which raises upstroke inertia, peak polished-rod load, gearbox torque and the
Goodman ratio; these all flow from `vfd_kinematics` into the dynacard and stress models.

## 7. Rod float

Terminal sinking velocity from the depth-resolved Couette drag of the rod string:
v_term = W_sub / Σ c_i, c_i = 2π μ(z_i) Δz f_c / ln(r_t/r_r), f_c = 1.15.
Float margin M_float = v_term / v_down; float-day = a production day with M_float < 1.

The lumped screening model (`RodFloatDetector.compute_terminal_fall_velocity`) uses a coupling
multiplier of 4.5 (`srp.coupling_drag_factor`); both factors are assumed and sensitivity-tested.

With these inputs float occurs only at aggressive kinematics (e.g. 7.5 SPM × 144 in, r = 1, late in
the cycle); at 4–5 SPM × 100 in the minimum margin in a 90-day cycle stays above 1.

## 8. Adaptive SRP controller

`optimizer/srp_controller.py`, applied daily when `srp_policy = "adaptive"`:
SPM_max,float = 60 v_term / (π S k_down M_target), k_down = r; fillage, Goodman (≤ 0.81),
torque (≤ 0.95 × 456 000 in-lbf) and PIP limits by bisection; increases limited to 0.3 SPM/day.

## 9. Well-to-well spread

`twin/well_registry.py` gives BGW-01..10 deterministic offsets from the canonical inputs:
depth ± 20 m, reservoir pressure ± 5 bar, net pay ± 1.5 m, cold PI × (1 ± 0.2). These are
synthetic and exist so benchmarks average over distinct wells.

## 10. Limitations

- One-zone thermal model; no steam override, gravity drainage or 2-D conduction.
- Water cut is a prescribed function of production day, not a flow calculation.
- The dynacard is a Gibbs-inspired synthesis, not a wave-equation solution.
- κ, S_or, coupling factors and the cold PI are assumed, not calibrated to Baghewala data.
