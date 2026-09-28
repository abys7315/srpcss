# Physics Modeling Reference — Baghewala Heavy Oil Digital Twin

## 1. Domain Physics Overview
Baghewala field (Rajasthan, India) contains extra-heavy crude with:
- API Gravity: 6° to 8° API
- Density: ~1010 to 1030 kg/m³ (heavier than fresh water at ambient conditions)
- Dead Oil Viscosity: >10,000 cP at initial reservoir temperature (~35°C)
- High Pour Point & Asphaltene Content

Primary production without thermal stimulation is negligible. Cyclic Steam Stimulation (CSS) injects high-enthalpy saturated steam to heat the near-wellbore formation, drastically lowering viscosity so that fluid can flow into the wellbore and be lifted to the surface by a Sucker Rod Pump (SRP).

---

## 2. Cyclic Steam Stimulation (CSS) Physics

### 2.1 Marx-Langenheim & Boberg-Lantz Thermal Model
Steam injection delivers thermal energy into the reservoir:
$$Q_{\text{inj}} = \dot{m}_s \cdot \left[ h_w(T_s) + x \cdot L_v(T_s) \right]$$
where $\dot{m}_s$ is steam mass rate, $h_w$ is liquid water enthalpy, $x$ is steam quality ($x \ge 0.8$), and $L_v$ is latent heat of vaporization.

The heated zone radius $r_h(t)$ expands according to the energy balance between injected heat, formation heat storage, and vertical conductive heat losses to overburden and underburden caprock:
$$\frac{dA_h}{dt} = \frac{\dot{H}_{\text{net}}}{M_R \Delta T h_n} - \frac{2 K_{\text{ob}} (T_s - T_R)}{M_R \sqrt{\pi \alpha t}}$$
where $M_R$ is reservoir volumetric heat capacity, $h_n$ is net pay thickness, and $K_{\text{ob}}$ is overburden thermal conductivity.

### 2.2 Viscosity-Temperature Relationship
Viscosity decreases exponentially with temperature. Modeled using the Andrade or Walther ASTM D341 equation:
$$\ln \mu(T) = A + \frac{B}{T + C}$$
or
$$\log_{10} \log_{10} (\nu + 0.7) = A - B \log_{10}(T)$$
For Baghewala crude:
- $T = 35^\circ\text{C} \implies \mu \approx 12,000\text{ cP}$
- $T = 80^\circ\text{C} \implies \mu \approx 350\text{ cP}$
- $T = 180^\circ\text{C} \implies \mu \approx 15\text{ cP}$

---

## 3. Wellbore Hydraulics & Heat Transfer
As fluids travel through tubing and casing:
1. **Tubing-to-Annulus Conduction**:
   $$q_{\text{loss}} = \frac{2\pi k_{\text{ins}} (T_{\text{fluid}} - T_{\text{casing}})}{\ln(r_{\text{ext}} / r_{\text{int}})}$$
2. **Multiphase Pressure Drop**:
   $$\frac{dp}{dz} = \left(\frac{dp}{dz}\right)_{\text{friction}} + \left(\frac{dp}{dz}\right)_{\text{hydrostatic}} + \left(\frac{dp}{dz}\right)_{\text{accel}}$$

---

## 4. Sucker Rod Pump (SRP) Dynamics

### 4.1 Gibbs Wave Equation
The motion and load distribution along the elastic rod string is governed by the 1D damped wave equation:
$$\frac{\partial^2 u}{\partial t^2} = a^2 \frac{\partial^2 u}{\partial x^2} - c \frac{\partial u}{\partial t}$$
where:
- $u(x, t)$ is rod displacement at depth $x$ and time $t$.
- $a = \sqrt{E/\rho}$ is speed of sound in steel (~5,000 m/s).
- $c$ is the viscous damping coefficient, highly dependent on heavy oil viscosity.

### 4.2 Sucker Rod Floating Mechanism
During the downstroke, if viscous drag forces $F_{\text{drag}}$ plus buoyant forces $F_{\text{buoy}}$ exceed the submerged weight of the rods $W_{\text{rod}}$, the rod string floats and fails to drop with the walking beam:
$$F_{\text{net\_down}} = W_{\text{rod}} - F_{\text{buoy}} - F_{\text{drag}}$$
The condition for rod floating risk is:
$$\text{Margin}_{\text{float}} = F_{\text{net\_down}} \le F_{\text{threshold}}$$
Viscous drag along the rod annulus is proportional to viscosity and downstroke velocity:
$$F_{\text{drag}} \propto \mu_{\text{fluid}} \cdot v_{\text{rod}} \cdot \frac{D_{\text{rod}}}{D_{\text{tubing}} - D_{\text{rod}}}$$
In cold heavy oil or unheated wellbores, rod floating results in severe mechanical shock, loose bridle wirelines, and premature rod fatigue.
