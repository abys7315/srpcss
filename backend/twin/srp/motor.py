"""
SRP Prime Mover, VFD, and Electrical Energy Consumption.

Calculates mechanical work, cyclic load factor (CLF), VFD drive efficiency,
and power consumption in kWh/day and kWh/bbl.

PROVENANCE: ASSUMED.
"""

from dataclasses import dataclass
import numpy as np

@dataclass
class MotorEnergyResult:
    hydraulic_power_kw: float
    motor_input_power_kw: float
    daily_electricity_kwh: float
    energy_intensity_kwh_per_bbl: float
    cyclic_load_factor: float
    gearbox_load_pct: float
    motor_thermal_load_pct: float
    provenance: str = "SIMULATED"

class SRPMotorModel:
    """Computes electrical consumption of the prime mover and VFD drive."""

    def __init__(
        self,
        motor_rating_kw: float = 37.0,     # ~50 HP industrial electric motor
        gearbox_torque_rating_in_lbs: float = 320000.0,
        motor_efficiency: float = 0.88,
        gearbox_efficiency: float = 0.92,
        vfd_efficiency: float = 0.96
    ):
        self.motor_rating_kw = motor_rating_kw
        self.gearbox_rating_in_lbs = gearbox_torque_rating_in_lbs
        self.overall_efficiency = motor_efficiency * gearbox_efficiency * vfd_efficiency

    def evaluate_energy(
        self,
        card_work_in_lbs: float,
        spm: float,
        liquid_rate_bpd: float,
        peak_gearbox_torque_in_lbs: float
    ) -> MotorEnergyResult:
        """
        Computes electrical power consumption from dynacard stroke work and pumping speed.
        """
        # Mechanical power at polished rod:
        # Work per stroke [in-lbs] * SPM [strokes/min]
        # 1 HP = 33,000 ft-lbs/min = 396,000 in-lbs/min
        # 1 HP = 0.7457 kW
        work_in_lbs_per_min = card_work_in_lbs * spm
        mech_power_hp = work_in_lbs_per_min / 396000.0
        mech_power_kw = mech_power_hp * 0.7457
        
        # Electrical input power:
        input_kw = max(1.5, mech_power_kw / self.overall_efficiency)
        daily_kwh = input_kw * 24.0
        
        # Energy intensity per barrel:
        if liquid_rate_bpd > 0.1:
            kwh_per_bbl = daily_kwh / liquid_rate_bpd
        else:
            kwh_per_bbl = 0.0

        # Gearbox load percentage:
        gb_pct = (peak_gearbox_torque_in_lbs / self.gearbox_rating_in_lbs) * 100.0
        # Motor thermal load percentage:
        motor_pct = (input_kw / self.motor_rating_kw) * 100.0
        
        # Cyclic load factor (CLF) typical for beam pumping:
        clf = 1.35

        return MotorEnergyResult(
            hydraulic_power_kw=round(float(mech_power_kw), 2),
            motor_input_power_kw=round(float(input_kw), 2),
            daily_electricity_kwh=round(float(daily_kwh), 1),
            energy_intensity_kwh_per_bbl=round(float(kwh_per_bbl), 2),
            cyclic_load_factor=clf,
            gearbox_load_pct=round(float(gb_pct), 1),
            motor_thermal_load_pct=round(float(motor_pct), 1),
            provenance="SIMULATED"
        )
