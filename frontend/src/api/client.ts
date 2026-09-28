import axios from 'axios';
import type {
  APIResponse,
  WellSummary,
  WellDetail,
  SimulationResult,
  OptimizationResult,
  WhatIfScenario,
  RiskResult,
  RecalibrationResult,
  BenchmarkData,
  ProvenanceManifest
} from './types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = {
  // Health
  getHealth: async () => {
    const res = await api.get('/health');
    return res.data;
  },

  // Wells
  getWells: async (): Promise<WellSummary[]> => {
    const res = await api.get<APIResponse<WellSummary[]>>('/wells');
    return res.data.data;
  },

  getWell: async (wellId: string): Promise<WellDetail> => {
    const res = await api.get<APIResponse<WellDetail>>(`/wells/${wellId}`);
    return res.data.data;
  },

  // Simulation
  simulateCycle: async (params: any): Promise<SimulationResult> => {
    const res = await api.post<APIResponse<SimulationResult>>('/simulate', params);
    return res.data.data;
  },

  // Optimization
  optimizeJoint: async (params: any): Promise<OptimizationResult> => {
    const res = await api.post<APIResponse<OptimizationResult>>('/optimize/joint', params);
    return res.data.data;
  },

  optimizeCSS: async (params: any): Promise<OptimizationResult> => {
    const res = await api.post<APIResponse<OptimizationResult>>('/optimize/css', params);
    return res.data.data;
  },

  optimizeSRP: async (params: any): Promise<OptimizationResult> => {
    const res = await api.post<APIResponse<OptimizationResult>>('/optimize/srp', params);
    return res.data.data;
  },

  // What-If
  runWhatIf: async (params: any): Promise<{ scenarios: WhatIfScenario[]; recommended_scenario_id: string; summary_insight: string }> => {
    const res = await api.post<APIResponse<{ scenarios: WhatIfScenario[]; recommended_scenario_id: string; summary_insight: string }>>('/what-if', params);
    return res.data.data;
  },

  // Predictions & ML
  forecastProduction: async (params: any) => {
    const res = await api.post<APIResponse<any>>('/predictions/forecast', params);
    return res.data.data;
  },

  classifyDynacard: async (params: any) => {
    const res = await api.post<APIResponse<any>>('/predictions/classify-dynacard', params);
    return res.data.data;
  },

  detectAnomalies: async (params: any) => {
    const res = await api.post<APIResponse<any>>('/predictions/detect-anomalies', params);
    return res.data.data;
  },

  // Risk
  getWellRisk: async (wellId: string): Promise<RiskResult> => {
    const res = await api.get<APIResponse<RiskResult>>(`/risks/${wellId}`);
    return res.data.data;
  },

  evaluateRisk: async (params: any): Promise<RiskResult> => {
    const res = await api.post<APIResponse<RiskResult>>('/risks/evaluate', params);
    return res.data.data;
  },

  // Feedback & Recalibration
  submitFeedback: async (params: any) => {
    const res = await api.post<APIResponse<any>>('/feedback', params);
    return res.data.data;
  },

  recalibrateModel: async (params: any): Promise<RecalibrationResult> => {
    const res = await api.post<APIResponse<RecalibrationResult>>('/recalibrate', params);
    return res.data.data;
  },

  // Benchmarks
  getBenchmarks: async (): Promise<BenchmarkData> => {
    const res = await api.get<APIResponse<BenchmarkData>>('/benchmarks');
    return res.data.data;
  },

  // Provenance
  getProvenance: async (): Promise<ProvenanceManifest> => {
    const res = await api.get<APIResponse<ProvenanceManifest>>('/provenance');
    return res.data.data;
  },
};
