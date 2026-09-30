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
  ProvenanceManifest,
  MulticyclePlan
} from './types';

// Support VITE_API_URL, VITE_API_BASE_URL, relative /api/v1 (Vite dev proxy), and direct fallbacks
const resolveApiUrl = (rawUrl?: string): string => {
  if (!rawUrl) return '/api/v1';
  const trimmed = rawUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
};

const rawEnvUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
const PRIMARY_BASE_URL = rawEnvUrl ? resolveApiUrl(rawEnvUrl) : '/api/v1';
const DIRECT_BACKEND_URL = 'http://127.0.0.1:8000/api/v1';

const api = axios.create({
  baseURL: PRIMARY_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000,
});

// Automatic failover to direct backend URL if proxy encounters network error
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      (!error.response || error.code === 'ERR_NETWORK' || error.response?.status === 502 || error.response?.status === 504) &&
      !originalRequest._retry &&
      api.defaults.baseURL !== DIRECT_BACKEND_URL
    ) {
      originalRequest._retry = true;
      originalRequest.baseURL = DIRECT_BACKEND_URL;
      api.defaults.baseURL = DIRECT_BACKEND_URL;
      console.warn(`[API Proxy Failover] Retrying request directly against ${DIRECT_BACKEND_URL}`);
      return api(originalRequest);
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  // Health & Connection Status
  checkConnection: async (): Promise<{ connected: boolean; version?: string; service?: string }> => {
    // 1. Try through the active base URL (e.g. Vite dev proxy /api/v1 or configured env)
    try {
      const res = await api.get('/health', { timeout: 3000 });
      if (res.data?.status === 'HEALTHY' || res.status === 200) {
        return {
          connected: true,
          version: res.data?.version || '1.0.0',
          service: res.data?.service || 'PETRO-TWIN Backend'
        };
      }
    } catch {
      // 2. Try direct fallback targets if proxy fails
      const fallbackTargets = [
        'http://127.0.0.1:8000/api/v1',
        'http://localhost:8000/api/v1'
      ];
      for (const target of fallbackTargets) {
        try {
          const directRes = await axios.get(`${target}/health`, { timeout: 2500 });
          if (directRes.data?.status === 'HEALTHY' || directRes.status === 200) {
            api.defaults.baseURL = target;
            return {
              connected: true,
              version: directRes.data?.version || '1.0.0',
              service: directRes.data?.service || 'PETRO-TWIN Backend'
            };
          }
        } catch {
          // Continue to next fallback
        }
      }
    }
    return { connected: false };
  },

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

  // Governance & Approvals
  approveRecommendation: async (recId: string, params: { well_id: string; decision_reason?: string; approved_by?: string; approved_setpoint?: any }) => {
    const res = await api.post<APIResponse<any>>(`/recommendations/${recId}/approve`, params);
    return res.data.data;
  },

  rejectRecommendation: async (recId: string, params: { well_id: string; decision_reason: string; approved_by?: string }) => {
    const res = await api.post<APIResponse<any>>(`/recommendations/${recId}/reject`, params);
    return res.data.data;
  },

  updateSetpoint: async (wellId: string, params: { spm: number; stroke_length_inch: number; vfd_downstroke_ratio: number; steam_volume_tonnes: number; soak_duration_days: number; applied_by?: string }) => {
    const res = await api.post<APIResponse<any>>(`/wells/${wellId}/setpoint`, params);
    return res.data.data;
  },

  getWellAudit: async (wellId: string) => {
    const res = await api.get<APIResponse<any>>(`/wells/${wellId}/audit`);
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

  // Models Registry
  getModels: async (): Promise<any> => {
    const res = await api.get<APIResponse<any>>('/models');
    return res.data.data;
  },

  optimizeMulticycle: async (params: { well_id: string; n_cycles?: number; srp_policy?: string; base_configuration?: any }): Promise<MulticyclePlan> => {
    const res = await api.post<APIResponse<MulticyclePlan>>('/optimize/multicycle', params);
    return res.data.data;
  },

  // Copilot (server-side LLM proxy)
  copilot: async (params: { well_id: string; query: string; provider?: string; day?: number }): Promise<{
    answer: string; provider: string; model: string; latency_ms: number; context: Record<string, unknown>;
  }> => {
    const res = await api.post('/copilot', params, { timeout: 45000 });
    return res.data;
  },

  // System Readiness
  getSystemReadiness: async (): Promise<Record<string, string>> => {
    const res = await api.get<Record<string, string>>('/system/readiness');
    return res.data;
  },
};


