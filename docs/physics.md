# Physics Modeling Reference — Baghewala Heavy Oil Digital Twin

## 1. Domain Physics Overview
Baghewala field (Bikaner-Nagaur Basin, Rajasthan, India) contains heavy crude with:
- Canonical API Gravity: 17° to 19° API (Nominal: 18.0° API)
- Formation Depth: ~950 – 1,150 m TVD
- Initial Reservoir Temperature: 46° to 48°C (Nominal: 47.0°C)
- Initial Reservoir Pressure: ~95 – 105 bar
- Viscosity: Highly temperature-dependent (~1,500 – 3,500 cP at initial reservoir temperature, dropping to <30 cP above 120°C)
- Pour Point: ~27 – 33°C; asphaltene and paraffin deposition risk when fluid cools below 45°C.

Primary production without thermal stimulation is negligible. Cyclic Steam Stimulation (CSS) injects high-enthalpy saturated steam (240–260°C, 110–130 bar) to heat the near-wellbore formation, drastically lowering viscosity so fluid can flow into the wellbore and be lifted to the surface by a Sucker Rod Pump (SRP).

---

## 2. Cyclic Steam Stimulation (CSS) Physics

### 2.1 Marx-Langenheim & Boberg-Lantz Thermal Model
Steam injection delivers thermal energy into the reservoir:
$$Q_{\text{inj}} = \dot{m}_s \cdot \left[ h_w(T_s) + x \cdot L_v(T_s) \right]$$
where $\dot{m}_s$ is steam mass rate, $h_w$ is liquid water enthalpy, $x$ is steam quality ($x \ge 0.8$), and $L_v$ is latent heat of vaporization.

The heated zone radius $r_h(t)$ expands according to the energy balance between injected heat, formation heat storage, and conductive heat losses to overburden and underburden formations (Marx & Langenheim, 1961):
$$\frac{dA_h}{dt} = \frac{\dot{H}_{\text{net}}}{M_R \Delta T h_n} - \frac{2 K_{\text{ob}} (T_s - T_R)}{M_R \sqrt{\pi \alpha t}}$$
where $M_R$ is reservoir volumetric heat capacity, $h_n$ is net pay thickness, and $K_{\text{ob}}$ is overburden thermal conductivity.

During the soak and production cycles, thermal diffusion and fluid withdrawal cooling are tracked via an analytical Boberg-Lantz temperature decay formulation coupled with multi-cycle pressure depletion:
$$P_{\text{res}}^{(k+1)} = P_{\text{res}}^{(k)} - \Delta P_{\text{depletion}} + \Delta P_{\text{steam\_support}}$$

### 2.2 Viscosity-Temperature Relationship
Viscosity decreases exponentially with temperature, modeled using the Walther ASTM D341 equation:
$$\log_{10} \log_{10} (\nu + 0.7) = A - B \log_{10}(T_K)$$
For Baghewala heavy crude:
- $T = 47^\circ\text{C} \implies \mu \approx 2,100\text{ cP}$
- $T = 80^\circ\text{C} \implies \mu \approx 180\text{ cP}$
- $T = 160^\circ\text{C} \implies \mu \approx 18\text{ cP}$

---

## 3. Wellbore Hydraulics & Heat Transfer
As fluids travel through tubing and casing:
1. **Simplified Wellbore Heat Transfer**:
   Tubing-to-formation radial conductive and convective heat transfer determines pump intake temperature:
   $$T_{\text{pip}} = T_{\text{res}} - \Delta T_{\text{lift}}(q_{\text{liquid}}, \mu, \text{depth})$$
2. **Hydrostatic & Friction Pressure Drop**:
   $$\Delta P_{\text{wellbore}} = \rho_{\text{mix}} g h + f \frac{\rho v^2}{2 D_{\text{hyd}}} h$$
   determining Pump Intake Pressure (PIP).

---

## 4. Sucker Rod Pump (SRP) Dynamics

### 4.1 Gibbs-Inspired 1-D Damped Wave Approximation
To generate synthetic surface and downhole dynamometer cards without prohibitive computational overhead during multi-objective optimization, the digital twin implements a **Gibbs-inspired 1-D damped-wave approximation**.

Surface polished rod load $F_{\text{prl}}(t)$ incorporates:
1. Static buoyant rod weight: $W_{\text{submerged}} = W_{\text{air}} (1 - \rho_{\text{fluid}} / \rho_{\text{steel}})$
2. Dynamic inertial acceleration: $F_{\text{accel}}(t) = m_{\text{eff}} \cdot a_{\text{kinematic}}(t)$
3. Phase-lagged wave propagation harmonics: $\Delta \phi \approx \frac{\omega L}{a_{\text{acoustic}}}$
4. Heavy-oil annular viscous damping $c_{\text{visc}}(\mu, v_{\text{rod}})$

Downhole pump loads reflect fluid load transfer, valve opening/closing events, and partial pump fillage (fluid pound).

### 4.2 Sucker Rod Float Detection Model
During the downstroke, viscous drag along the narrow rod-tubing annulus acts upward against gravity. The rod string reaches a terminal falling velocity:
$$v_{\text{terminal}} = \frac{(\rho_{\text{steel}} - \rho_{\text{fluid}}) g \cdot (D_{\text{tubing}}^2 - D_{\text{rod}}^2)}{32 \mu_{\text{fluid}}}$$

The kinematic imposed downward velocity of the walking beam is governed by pumping speed (SPM) and VFD downstroke shaping:
$$v_{\text{imposed}} = \frac{S \cdot \text{SPM} \cdot \pi}{60 \cdot R_{\text{downstroke}}}$$

The **Float Margin Index** is defined dimensionally as:
$$M_{\text{float}} = \frac{v_{\text{terminal}}}{v_{\text{imposed}}}$$

- $M_{\text{float}} \ge 1.0$: Safe operation; rods fall freely under gravity.
- $M_{\text{float}} < 1.0$: **Rod Floating Occurs**; beam falls faster than rods can sink through heavy oil, causing slack bridle lines, severe mechanical shock on the upstroke, and accelerated rod fatigue.

