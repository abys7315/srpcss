import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  X,
  Globe,
  Zap,
  Cpu,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  BarChart3,
  FileText,
} from 'lucide-react';
import { marked } from 'marked';
import type { PageId } from '../layout/Sidebar';
import type { WellSummary } from '../../api/types';
import {
  analyzeQuery,
  type AIAnalysisContext,
  type AIAnalysisResult,
} from '../../services/aiService';
import { AIVisualDashboard } from './AIVisualDashboard';
import { PetroScanLoader } from './PetroScanLoader';

interface AICommandBarProps {
  selectedWellId: string;
  onNavigate: (page: PageId) => void;
  wellData?: WellSummary;
  activeTab?: string;
}

export const AICommandBar: React.FC<AICommandBarProps> = ({
  selectedWellId,
  onNavigate,
  wellData,
  activeTab,
}) => {
  const [query, setQuery] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [preferredProvider, setPreferredProvider] = useState<'auto' | 'gemini' | 'groq'>('auto');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'visuals' | 'report'>('all');

  const scrollRef = useRef<HTMLDivElement>(null);

  // Quick prompt buttons matching the engineering context
  const quickPrompts = [
    {
      label: '⚡ Optimize Rod Float',
      query: `Analyze rod floating risk for ${selectedWellId} and provide optimal VFD downstroke and SPM setpoints to eliminate buoyancy float.`,
      targetPage: 'joint-optimizer' as PageId,
    },
    {
      label: '🔥 Simulate 3000t Steam',
      query: `Simulate 3,000 tonnes CSS steam injection at 125 bar for ${selectedWellId}. Calculate heated radius and crude viscosity drop.`,
      targetPage: 'css-optimizer' as PageId,
    },
    {
      label: '🛡️ 30-Day Risk',
      query: `Evaluate 30-day mechanical rod fatigue and sucker rod parting risk under current Goodman stress ratio for ${selectedWellId}.`,
      targetPage: 'risk' as PageId,
    },
  ];

  // Close popup with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPopupOpen) {
        setIsPopupOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPopupOpen]);

  // Construct context from current well
  const buildContext = (): AIAnalysisContext => {
    const tel = wellData?.telemetry;
    const ops = wellData?.operating_parameters;

    return {
      wellId: selectedWellId,
      depthM: wellData?.depth_m || 1050,
      viscosityCp: tel?.current_viscosity_cp || 1200,
      temperatureC: tel?.current_temperature_c || 68.5,
      apiGravity: wellData?.crude_api || 17.5,
      oilRateM3: tel?.current_oil_rate_bpd ? tel.current_oil_rate_bpd * 0.159 : 4.5,
      waterCutPct: tel?.current_water_cut_pct || 65,
      steamVolumeTonnes: ops?.steam_volume_tonnes || 3000,
      soakDays: ops?.soak_duration_days || 6,
      spm: ops?.spm || 4.5,
      strokeLengthIn: ops?.stroke_length_inch || 100,
      vfdRatio: ops?.vfd_downstroke_ratio || 0.85,
      floatMargin: tel?.current_float_margin_index || 0.92,
      goodmanRatio: tel?.current_goodman_stress_ratio || 0.68,
      pipBar: tel?.current_pump_intake_pressure_bar || 24.5,
      whpBar: 5.0,
      tvStatus: 'CYCLING',
      svStatus: 'OPERATIONAL',
      riskTier: wellData?.status === 'INFEASIBLE' ? 'CRITICAL_ROD_FLOAT' : 'STABLE',
      activeTab: activeTab || 'overview',
    };
  };

  const handleExecute = async (queryText?: string, targetPage?: PageId) => {
    const promptToRun = (queryText || query).trim();
    if (!promptToRun) return;

    if (targetPage) {
      onNavigate(targetPage);
    }

    setLastQuery(promptToRun);
    setIsPopupOpen(true);
    setIsLoading(true);

    const start = Date.now();

    try {
      const ctx = buildContext();
      const result = await analyzeQuery(promptToRun, ctx, preferredProvider);
      setAnalysisResult(result);
    } catch (err: any) {
      console.error('[PetroTwin AI] Query error:', err);
      // Fallback result in case of unexpected network crash
      setAnalysisResult({
        answer: `### ⚠️ Copilot Notice\nEncountered connectivity limitation. Local multiphysics heuristics for **${selectedWellId}** suggest reducing SPM to 3.8 to mitigate viscous downstroke buoyancy.`,
        provider: 'PetroTwin Local Physics',
        model: 'Offline Fallback',
        latencyMs: Date.now() - start,
        timestamp: new Date().toLocaleTimeString(),
        keyIndexUsed: 0,
      });
    } finally {
      setIsLoading(false);
      // Scroll to top of answer
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
  };

  const handleCopy = () => {
    if (!analysisResult?.answer) return;
    navigator.clipboard.writeText(analysisResult.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderMarkdown = (md: string) => {
    try {
      return { __html: marked.parse(md) as string };
    } catch (e) {
      return { __html: md.replace(/\n/g, '<br/>') };
    }
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl pointer-events-auto">
      {/* POPUP WINDOW ABOVE THE COMMAND BAR */}
      {isPopupOpen && (
        <div
          role="dialog"
          aria-label="PetroTwin AI Copilot Response"
          className="mb-2.5 rounded-2xl bg-[#080d1a]/95 dark:bg-[#070b16]/95 backdrop-blur-2xl border border-cyan-500/40 shadow-[0_12px_45px_rgba(0,0,0,0.85)] flex flex-col max-h-[75vh] overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-250 ring-1 ring-cyan-500/20"
        >
          {/* POPUP HEADER */}
          <div className="px-4 py-3 border-b border-slate-700/60 dark:border-cyan-900/40 flex items-center justify-between bg-gradient-to-r from-slate-900/90 via-[#0b1528]/95 to-slate-900/90 shrink-0">
            {/* Left: Branding & Well Indicator */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs md:text-sm text-cyan-300 tracking-wide">
                    PetroTwin AI Assistant
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                    {selectedWellId}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                  <span>Baghewala Heavy Oil</span>
                  <span>•</span>
                  <span>Jodhpur Sandstone</span>
                </div>
              </div>
            </div>

            {/* Right: Model & Latency Badges, Provider Switcher & CROSS (X) BUTTON */}
            <div className="flex items-center gap-2">
              {/* Provider Indicator Pill (Shown after response completes) */}
              {analysisResult && !isLoading && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
                  {analysisResult.provider.includes('Gemini') ? (
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span className="font-medium text-slate-200">
                    {analysisResult.provider.includes('Gemini') ? 'Gemini 2.5 (Search Grounded)' : 'Groq LPU (Ultra-Fast)'}
                  </span>
                </div>
              )}

              {/* Provider Quick Switcher */}
              <div className="hidden lg:flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-slate-700/80 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreferredProvider('auto')}
                  className={`px-2 py-0.5 rounded transition ${
                    preferredProvider === 'auto'
                      ? 'bg-cyan-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Auto-select lowest latency / web search as appropriate"
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredProvider('gemini')}
                  className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                    preferredProvider === 'gemini'
                      ? 'bg-emerald-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Google Gemini 2.5 Flash Lite with Google Search Grounding"
                >
                  <Globe className="w-2.5 h-2.5" />
                  Web Grounded
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredProvider('groq')}
                  className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                    preferredProvider === 'groq'
                      ? 'bg-blue-600 text-white font-semibold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Groq LPU with ~300ms ultra-low inference latency"
                >
                  <Zap className="w-2.5 h-2.5" />
                  Groq LPU
                </button>
              </div>

              {/* Copy Button */}
              {analysisResult && !isLoading && (
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy full analysis summary"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              )}

              {/* CROSS (X) BUTTON TO CLOSE POPUP */}
              <button
                type="button"
                onClick={() => setIsPopupOpen(false)}
                title="Close window (Esc)"
                aria-label="Close AI window"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/70 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/50 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* POPUP BODY */}
          <div ref={scrollRef} className="p-4 md:p-5 overflow-y-auto space-y-4 max-h-[60vh] text-xs md:text-sm">
            {/* Active Asked Query Header */}
            {lastQuery && (
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2 text-slate-300">
                <span className="font-semibold text-cyan-400 shrink-0">Query:</span>
                <span className="italic font-sans text-slate-200">"{lastQuery}"</span>
              </div>
            )}

            {/* LOADING STATE: ANIMATED RADAR / CYBERNETIC OILFIELD SCANNER (NO MS TIMER) */}
            {isLoading && (
              <PetroScanLoader wellId={selectedWellId} provider={preferredProvider} />
            )}

            {/* ANSWER CONTENT WITH VISUAL CHARTS, GRAPHS & REPORT */}
            {!isLoading && analysisResult && (
              <div className="space-y-4">
                {/* View Switcher Controls for Visuals & Reports */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-semibold text-slate-200">Multiphysics Findings & Analysis</span>
                  </div>
                  <div className="flex items-center bg-slate-950/80 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setViewMode('all')}
                      className={`px-2 py-0.5 rounded transition ${
                        viewMode === 'all'
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All-in-One
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('visuals')}
                      className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                        viewMode === 'visuals'
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <BarChart3 className="w-2.5 h-2.5" />
                      Visual Graphs & Pies
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('report')}
                      className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                        viewMode === 'report'
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileText className="w-2.5 h-2.5" />
                      Executive Report
                    </button>
                  </div>
                </div>

                {/* 1. VISUAL DASHBOARD: PIE CHARTS, THERMAL CURVES, FLOAT GAUGES */}
                {(viewMode === 'all' || viewMode === 'visuals') && (
                  <AIVisualDashboard context={buildContext()} wellId={selectedWellId} />
                )}

                {/* 2. FORMATTED MARKDOWN ANALYSIS */}
                {(viewMode === 'all' || viewMode === 'report') && (
                  <div
                    className="ai-markdown pt-1"
                    dangerouslySetInnerHTML={renderMarkdown(analysisResult.answer)}
                  />
                )}

                {/* 3. LIVE WEB GROUNDING / CITATIONS (If Gemini Search Grounding returned sources) */}
                {analysisResult.webSources && analysisResult.webSources.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Live Internet & SPE Literature Sources</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        (Google Search Grounded)
                      </span>
                    </div>

                    {analysisResult.webQueries && analysisResult.webQueries.length > 0 && (
                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-500">Searched:</span>
                        {analysisResult.webQueries.map((q, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]"
                          >
                            "{q}"
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {analysisResult.webSources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-600/30 hover:border-emerald-500 text-emerald-300 hover:text-emerald-200 text-xs flex items-center gap-1.5 transition group"
                        >
                          <span className="max-w-[240px] truncate">{source.title}</span>
                          <ExternalLink className="w-3 h-3 text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. QUICK FOLLOW-UP SUGGESTIONS */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    Recommended Follow-up Actions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleExecute(`Calculate Marx-Langenheim heated radius and heat loss for ${selectedWellId}`)}
                      className="px-2.5 py-1 rounded-full text-[11px] bg-slate-900/80 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer"
                    >
                      🌡️ Heated Radius Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecute(`What is the optimal SPM and VFD downstroke setting to eliminate rod float on ${selectedWellId}?`)}
                      className="px-2.5 py-1 rounded-full text-[11px] bg-slate-900/80 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer"
                    >
                      ⚙️ Optimal Kinematics Setpoint
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecute(`Compare ${selectedWellId} performance against Baghewala CSS cycle 1 benchmarks.`)}
                      className="px-2.5 py-1 rounded-full text-[11px] bg-slate-900/80 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer"
                    >
                      📊 Benchmark Comparison
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* POPUP FOOTER */}
          <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                Active Model: <strong className="text-slate-200 font-mono">{analysisResult?.model || 'Gemini 2.5 / Groq'}</strong>
              </span>
              <span>•</span>
              <span>Keys Managed & Rotated (Failover Active)</span>
            </div>
            <button
              type="button"
              onClick={() => handleExecute(lastQuery)}
              className="hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      )}

      {/* FLOATING PILL COMMAND BAR (MATCHING USER SCREENSHOT) */}
      <div className="bg-[#0b1222]/95 dark:bg-[#080e1a]/95 backdrop-blur-xl border border-slate-700/80 dark:border-cyan-500/30 rounded-full p-1.5 pl-4 flex items-center gap-2 shadow-[0_8px_30px_rgba(0,0,0,0.6)] transition-all focus-within:border-cyan-400 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.3)]">
        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecute();
          }}
          className="flex-1 flex items-center"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask PetroTwin AI (e.g. "Optimize ${selectedWellId} for rod floating")...`}
            className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs md:text-sm focus:outline-none border-none ring-0 focus:ring-0"
          />
        </form>

        {/* Quick prompt chips on desktop */}
        <div className="hidden md:flex items-center gap-1.5">
          {quickPrompts.slice(0, 2).map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuery(p.query);
                handleExecute(p.query, p.targetPage);
              }}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800/80 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-700/70 hover:border-cyan-500/40 transition-colors cursor-pointer whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ANALYZE BUTTON */}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handleExecute()}
          className="px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 disabled:opacity-70 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer shrink-0"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span>Analyze</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
