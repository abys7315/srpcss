export type ProvenanceTier = 'REAL' | 'PUBLIC_EXTERNAL' | 'SIMULATED' | 'ASSUMED';

export type OperationalStatus = 
  | 'FEASIBLE' 
  | 'NEAR_LIMIT' 
  | 'INFEASIBLE' 
  | 'NO_FEASIBLE_SOLUTION' 
  | 'NO_IMPROVEMENT_FOUND' 
  | 'LOW_CONFIDENCE' 
  | 'HIGH_RISK';

export type RecommendationMode = 
  | 'HIGH' 
  | 'MEDIUM' 
  | 'LOW' 
  | 'VERY_LOW'
  | 'AUTONOMOUS_SETPOINT'
  | 'ENGINEER_ADVISORY'
  | 'PHYSICS_FALLBACK'
  | 'MANUAL_INSPECTION_REQUIRED';

export interface APIResponse<T> {
  success: boolean;
  status: string;
  message: string;
  provenance: ProvenanceTier;
  data: T;
  timestamp: string;
}

export interface WellTelemetry {
  current_day_in_cycle: number;
  current_temperature_c: number;
  current_viscosity_cp: number;
  current_oil_rate_bpd: number;
  current_water_cut_pct: number;
  current_float_margin_index: number;
  current_goodman_stress_ratio: number;
  current_gearbox_load_pct: number;
  current_pump_intake_pressure_bar: number;
  latest_dynacard_label: string;
}

export interface WellOperatingParameters {
  steam_volume_tonnes: number;
  injection_pressure_bar: number;
  steam_temp_celsius: number;
  soak_duration_days: number;
  spm: number;
  stroke_length_inch: number;
  vfd_downstroke_ratio: number;
  economic_cutoff_oil_rate_bpd: number;
}

export interface WellSummary {
  well_id: string;
  well_name: string;
  field_name: string;
  formation: string;
  crude_api: number;
  depth_m: number;
  current_cycle_number: number;
  cycle_phase: string;
  status: OperationalStatus;
  telemetry: WellTelemetry;
  operating_parameters: WellOperatingParameters;
  provenance: ProvenanceTier;
}

export interface WellDetail extends WellSummary {
  casing_od_inch: number;
  tubing_od_inch: number;
  pump_depth_m: number;
  rod_string_description: string;
  surface_unit_description: string;
  max_allowable_injection_pressure_bar: number;
  reservoir_permeability_md: number;
  reservoir_porosity: number;
  asphaltene_content_pct: number;
}

export interface DailyTimeseriesPoint {
  day: number;
  bottomhole_temperature_c: number;
  oil_viscosity_cp: number;
  oil_rate_bpd: number;
  water_rate_bpd: number;
  cumulative_oil_bbl: number;
  float_margin_index: number;
  goodman_stress_ratio: number;
  peak_gearbox_torque_in_lbs: number;
  pump_intake_pressure_bar: number;
  pump_fillage_pct: number;
  reservoir_pressure_bar?: number;
  spm?: number;
  vfd_downstroke_ratio?: number;
  is_rod_floating?: boolean;
  recovery_factor_pct?: number;
  heated_zone_oil_saturation?: number;
  srp_binding_limit?: string;
  cycle_day?: number;
}

export interface PhaseBand { phase: 'INJECTION' | 'SOAK' | 'PRODUCTION' | string; start_day: number; end_day: number }

export interface ThermalSummary {
  steam_saturation_temp_c: number;
  steam_latent_heat_kj_kg: number;
  delivered_steam_quality: number;
  heat_injected_gj: number;
  heated_zone_radius_m: number;
  injection_end_temp_c: number;
  soak_end_temp_c: number;
  ooip_m3: number;
  recovery_factor_pct: number;
  heated_pore_volume_m3: number;
  final_heated_zone_oil_saturation: number;
  fracture_limit_bar: number;
}

export interface WellboreProfilePoint { depth_m: number; temperature_c: number; viscosity_cp: number; pressure_bar: number }

export interface CyclePlanRow {
  cycle_number: number;
  steam_volume_tonnes: number;
  cumulative_oil_bbl: number;
  steam_oil_ratio: number;
  net_benefit_usd: number;
  recovery_factor_pct: number;
  heated_zone_oil_saturation_end: number;
  float_days: number;
  min_float_margin_index: number;
  status: string;
}

export interface MulticyclePlan {
  well_id: string;
  n_cycles: number;
  srp_policy: string;
  optimized: CyclePlanRow[];
  constant_steam: CyclePlanRow[];
  optimized_total_net_benefit_usd: number;
  constant_total_net_benefit_usd: number;
  optimized_total_oil_bbl: number;
  constant_total_oil_bbl: number;
  evaluations: number;
  execution_time_seconds: number;
  method: string;
}

export interface DynacardData {
  surface_position_inch: number[];
  surface_load_lbs: number[];
  downhole_position_inch: number[];
  downhole_load_lbs: number[];
  peak_polished_rod_load_lbs: number;
  min_polished_rod_load_lbs: number;
  load_range_lbs: number;
  stroke_length_inch: number;
  spm: number;
  diagnostic_card_label: string;
  card_area_in_lbs: number;
  peak_gearbox_torque_in_lbs: number;
}

export interface SimulationResult {
  well_id: string;
  cycle_number: number;
  status: OperationalStatus;
  kpis: {
    total_oil_produced_bbl: number;
    total_water_produced_bbl: number;
    total_steam_injected_tonnes: number;
    steam_oil_ratio: number;
    total_electricity_kwh: number;
    electrical_energy_kwh_per_bbl: number;
    net_economic_benefit_usd: number;
    cycle_duration_days: number;
    production_days: number;
    total_float_events_count: number;
    max_goodman_stress_ratio: number;
    min_float_margin_index: number;
    average_pump_fillage_pct: number;
    recovery_factor_pct?: number;
    float_days?: number;
  };
  constraints: {
    status: OperationalStatus;
    is_feasible: boolean;
    violations: Array<{ parameter: string; current_value: any; limit: any; severity: string; message: string }>;
    near_limit_warnings: string[];
    binding_constraints: string[];
    suggested_engineer_action: string;
  };
  dynacards: Record<string, DynacardData>;
  timeseries: DailyTimeseriesPoint[];
  phase_bands?: PhaseBand[];
  thermal?: ThermalSummary;
  wellbore_profile?: WellboreProfilePoint[];
  provenance: ProvenanceTier;
}

export interface ParetoPoint {
  solution_id: string;
  steam_volume_tonnes: number;
  soak_days: number;
  spm: number;
  stroke_length_inch: number;
  vfd_downstroke_ratio: number;
  economic_cutoff_bpd: number;
  cumulative_oil_bbl: number;
  net_benefit_usd: number;
  steam_oil_ratio: number;
  energy_intensity_kwh_per_bbl?: number;
  failure_risk_probability?: number;
  min_float_margin_index: number;
  pareto_rank?: number;
  is_non_dominated?: boolean;
  is_feasible?: boolean;
  status?: OperationalStatus;
  composite_score?: number;
  injection_pressure_bar?: number;
  injection_duration_days?: number;
  srp_policy?: string;
  srp_m_target?: number;
  srp_min_fillage?: number;
  max_spm?: number;
  float_days?: number;
  recovery_factor_pct?: number;
  goodman_stress_ratio?: number;
  peak_gearbox_torque_in_lbs?: number;
  pump_intake_pressure_bar?: number;
  provenance?: ProvenanceTier;
}

export interface OptimizationResult {
  well_id: string;
  optimization_mode: string;
  status: OperationalStatus;
  current_configuration?: ParetoPoint;
  recommended_configuration?: ParetoPoint;
  pareto_front: ParetoPoint[];
  total_evaluated_count: number;
  feasible_count: number;
  infeasible_count: number;
  comparison_table: Array<{ parameter: string; current: string; recommended: string; unit: string; delta: string }>;
  delta_summary: Record<string, any>;
  confidence_score: number;
  recommendation_mode: RecommendationMode;
  confidence_breakdown?: Record<string, any>;
  explanation: string;
  contributing_factors: string[];
  constraints_checked: Array<Record<string, any>>;
  execution_time_seconds: number;
  evaluations?: number;
  seed?: number;
  srp_policy?: string;
  algorithm?: string;
  evaluated_points?: ParetoPoint[];
  pareto_options?: Record<string, ParetoPoint>;
  provenance: ProvenanceTier;
}

export interface WhatIfScenario {
  scenario_id: string;
  label: string;
  description: string;
  steam_volume_tonnes: number;
  soak_days: number;
  spm: number;
  stroke_length_inch: number;
  vfd_downstroke_ratio: number;
  cumulative_oil_bbl: number;
  net_benefit_usd: number;
  steam_oil_ratio: number;
  energy_intensity_kwh_per_bbl: number;
  failure_risk_probability: number;
  min_float_margin_index: number;
  status: OperationalStatus;
  violations: string[];
  near_limit_warnings: string[];
  is_recommended: boolean;
}

export interface RiskFactor {
  factor_name: string;
  contribution_pct: number;
  raw_value: number;
  safe_threshold: number;
  status: string;
}

export interface RiskResult {
  well_id: string;
  overall_failure_probability_30d: number;
  risk_tier: string;
  factor_attributions: RiskFactor[];
  dominant_failure_mode: string;
  suggested_mitigations: string[];
  provenance: ProvenanceTier;
}

export interface RecalibrationResult {
  well_id: string;
  model_name: string;
  previous_model_version: string;
  new_model_version: string;
  sample_points_used: number;
  pre_recalibration_mae_bpd: number;
  post_recalibration_mae_bpd: number;
  mae_reduction_pct: number;
  drift_status_cleared: boolean;
  status: string;
  explanation: string;
  provenance: ProvenanceTier;
}

export interface BenchmarkData {
  benchmark_name: string;
  execution_timestamp: string;
  baseline_vs_optimized: Array<{
    metric: string;
    baseline_value: number;
    optimized_value: number;
    unit: string;
    improvement_pct: number;
    direction: string;
  }>;
  ablation_study: Array<{
    key?: string;
    architecture: string;
    net_benefit_usd: number;
    steam_oil_ratio: number;
    oil_recovery_bbl?: number;
    total_float_events: number;
    computation_time_s: number;
    is_safe: boolean;
    notes: string;
    n_runs?: number;
    net_benefit_std_usd?: number;
    delta_vs_baseline_usd?: number;
    delta_vs_baseline_std_usd?: number;
    oil_std_bbl?: number;
    sor_std?: number;
    float_days?: number;
    float_days_std?: number;
    min_float_margin?: number;
    kwh_per_bbl?: number;
    is_baseline?: boolean;
    is_reference_only?: boolean;
  }>;
  protocol?: Record<string, any>;
  oil_price_sensitivity: Array<{ multiplier: number; net_benefit_usd: number; oil_recovery_bbl: number; sor: number }>;
  steam_cost_sensitivity: Array<{ multiplier: number; net_benefit_usd: number; oil_recovery_bbl: number; sor: number }>;
  overall_net_benefit_gain_pct: number;
  overall_sor_reduction_pct: number;
  float_events_eliminated: number;
  provenance: ProvenanceTier;
}

export interface ProvenanceManifest {
  system_name: string;
  manifest_version: string;
  mandatory_disclaimer: string;
  provenance_distribution: Record<string, number>;
  data_items: Array<{
    name: string;
    provenance_tier: string;
    source_citation: string;
    description: string;
    validation_status: string;
  }>;
}
