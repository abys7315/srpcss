/**
 * Copilot client. All LLM calls go through the backend (POST /api/v1/copilot),
 * which holds the provider keys and builds context from the simulated twin state.
 * No API keys exist in the frontend bundle.
 */
import { apiClient } from '../api/client';

export type CopilotProvider = 'auto' | 'gemini' | 'groq';

export interface AIAnalysisResult {
  answer: string;
  provider: string; // gemini | groq | template
  model: string;
  latencyMs: number;
  context: Record<string, unknown>;
  timestamp: string;
}

export async function analyzeQuery(
  query: string,
  wellId: string,
  provider: CopilotProvider = 'auto',
): Promise<AIAnalysisResult> {
  const r = await apiClient.copilot({ well_id: wellId, query: query.trim(), provider });
  return {
    answer: r.answer,
    provider: r.provider,
    model: r.model,
    latencyMs: r.latency_ms,
    context: r.context,
    timestamp: new Date().toLocaleTimeString(),
  };
}
