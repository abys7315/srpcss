"""
Overburden and Underburden Heat Loss Formulations.

Calculates conductive thermal losses from the steam-heated pay zone into the adjacent
caprock and baserock using Marx-Langenheim error-function approximations.

PROVENANCE: ASSUMED (classical thermal EOR equations).
"""

import numpy as np
from scipy.special import erfc

def marx_langenheim_heat_loss_factor(t_dimensionless: float | np.ndarray) -> float | np.ndarray:
    """
    Evaluates the Marx-Langenheim dimensionless heated area function:
    F(t_D) = exp(t_D) * erfc(sqrt(t_D)) + 2*sqrt(t_D/pi) - 1
    
    This function represents the fraction of injected heat retained in the reservoir.
    """
    t_d = np.maximum(t_dimensionless, 1e-8)
    # For large t_D, exp(t_D)*erfc(sqrt(t_D)) approaches 1/sqrt(pi*t_D)
    # Using scipy.special.erfc with numerical stability safeguard:
    sqrt_td = np.sqrt(t_d)
    
    # Stable evaluation:
    with np.errstate(over='ignore'):
        term1 = np.exp(np.minimum(t_d, 50.0)) * erfc(np.minimum(sqrt_td, 7.0))
        # fallback for large t_D
        term1 = np.where(t_d > 50.0, 1.0 / (np.sqrt(np.pi) * sqrt_td), term1)
        
    f_val = term1 + 2.0 * np.sqrt(t_d / np.pi) - 1.0
    return np.maximum(f_val, 0.0)

def compute_dimensionless_time(
    time_seconds: float | np.ndarray,
    k_overburden: float,
    rho_c_overburden: float,
    rho_c_reservoir: float,
    pay_thickness_m: float
) -> float | np.ndarray:
    """
    Compute dimensionless thermal time:
    t_D = 4 * k_ob * (rho_c)_ob * t / [ (rho_c)_res^2 * h^2 ]
    """
    numerator = 4.0 * k_overburden * rho_c_overburden * time_seconds
    denominator = (rho_c_reservoir ** 2) * (pay_thickness_m ** 2)
    return numerator / max(denominator, 1e-6)
