"""
Petro-Twin Physics Core Package.

Provides transparent, first-principles models for Cyclic Steam Stimulation (CSS)
and Sucker Rod Pump (SRP) artificial lift operations for extra-heavy crude reservoirs (Baghewala Field).
No machine learning dependencies are imported within this package.
"""

from .thermal.css_model import CSSThermalModel, CSSThermalParameters, CSSThermalState
from .fluid.viscosity import AndradeViscosityModel, BaghewalaViscosityParameters
from .fluid.density import FluidDensityModel
from .fluid.fluid_properties import FluidPropertiesManager
from .reservoir.inflow import ThermalInflowModel, ReservoirState
from .srp.dynacard import GibbsDynacardModel, DynacardResult
from .srp.float_detection import RodFloatDetector, FloatAnalysisResult
from .srp.motor import SRPMotorModel, MotorEnergyResult
from .surface.steam_system import SteamGeneratorModel
from .surface.energy import FieldEnergyAccounting
from .cycle import CSSCycleSimulator, CycleConfig, CycleSimulationResult

__all__ = [
    "CSSThermalModel",
    "CSSThermalParameters",
    "CSSThermalState",
    "AndradeViscosityModel",
    "BaghewalaViscosityParameters",
    "FluidDensityModel",
    "FluidPropertiesManager",
    "ThermalInflowModel",
    "ReservoirState",
    "GibbsDynacardModel",
    "DynacardResult",
    "RodFloatDetector",
    "FloatAnalysisResult",
    "SRPMotorModel",
    "MotorEnergyResult",
    "SteamGeneratorModel",
    "FieldEnergyAccounting",
    "CSSCycleSimulator",
    "CycleConfig",
    "CycleSimulationResult",
]
