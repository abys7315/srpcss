import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { WhatIfScenario } from '../api/types';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import {
  Sliders,
  Play,
  CheckCircle2,
  AlertTriangle,
  Star,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const WhatIfSimulator: React.FC<Props> = ({ selectedWellId, onNavigate }) => {
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([]);
  const [recommendedId, setRecommendedId] = useState<string>('scenario_rec');
  const [summaryInsight, setSummaryInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    runSimulation();
  }, [selectedWellId]);

  const runSimulation = async () => {
    try {
      setLoading(true);
      const res = await apiClient.runWhatIf({
        well_id: selectedWellId,
      });
      setScenarios(res.scenarios || []);
      setRecommendedId(res.recommended_scenario_id || 'scenario_rec');
      setSummaryInsight(res.summary_insight || '');
    } catch (e) {
      console.error('Failed to run What-If scenarios:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              5-COLUMN WHAT-IF ENGINEERING SANDBOX
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simultaneous multi-scenario evaluation: Current baseline vs. operational variants vs. Pareto optimal solution for{' '}
            <strong className="text-slate-200 font-mono">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-mono text-xs font-bold rounded-lg shadow-lg shadow-cyan-950/50 transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>EVALUATING 5 SCENARIOS...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>RE-SIMULATE ALL SCENARIOS</span>
            </>
          )}
        </button>
      </div>

      <DomainShiftWarning />

      {/* Summary Insight Callout */}
      {summaryInsight && (
        <div className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 flex items-start gap-2.5 text-xs text-cyan-200 font-mono">
          <Star className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 fill-cyan-400" />
          <p className="leading-relaxed">
            <strong>Engineering Insight:</strong> {summaryInsight}
          </p>
        </div>
      )}

      {/* 5-Column Side-by-Side Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {scenarios.map((sc) => {
          const isRec = sc.scenario_id === recommendedId || sc.is_recommended;
          const isFloatViolator = sc.min_float_margin_index < 1.0;

          return (
            <div
              key={sc.scenario_id}
              className={`rounded-xl border transition-all flex flex-col justify-between ${
                isRec
                  ? 'bg-industrial-900/90 border-emerald-500/80 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/50'
                  : isFloatViolator
                  ? 'bg-industrial-950/80 border-rose-800/80'
                  : 'bg-industrial-950/60 border-industrial-800 hover:border-industrial-700'
              } p-4 space-y-4`}
            >
              {/* Header */}
              <div className="space-y-1.5 pb-3 border-b border-industrial-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                    {sc.scenario_id.toUpperCase()}
                  </span>
                  {isRec && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700 flex items-center gap-1 font-mono">
                      <Star className="w-2.5 h-2.5 fill-emerald-400" /> OPTIMAL
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-bold font-mono text-slate-100 leading-snug">{sc.label}</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed min-h-[2.5rem]">{sc.description}</p>
                <div className="pt-1">
                  <StatusBadge status={sc.status} />
                </div>
              </div>

              {/* Operating Parameters */}
              <div className="space-y-2 text-[11px] font-mono">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Inputs</span>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Steam:</span>
                  <span className="font-bold">{sc.steam_volume_tonnes.toFixed(0)} t</span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Soak Period:</span>
                  <span>{sc.soak_days} days</span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Speed (SPM):</span>
                  <span className="font-bold">{sc.spm.toFixed(1)} SPM</span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Stroke Length:</span>
                  <span>{sc.stroke_length_inch}"</span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">VFD α_down:</span>
                  <span className={sc.vfd_downstroke_ratio < 1.0 ? 'text-cyan-400 font-bold' : ''}>
                    {sc.vfd_downstroke_ratio.toFixed(2)}x
                  </span>
                </div>
              </div>

              {/* Resulting Simulated KPIs */}
              <div className="space-y-2 text-[11px] font-mono pt-3 border-t border-industrial-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Simulated KPIs</span>

                <div className="flex justify-between">
                  <span className="text-slate-400">Net Benefit:</span>
                  <span className={`font-bold ${isRec ? 'text-emerald-400' : 'text-slate-200'}`}>
                    ${Math.round(sc.net_benefit_usd).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Cumulative Oil:</span>
                  <span>{Math.round(sc.cumulative_oil_bbl).toLocaleString()} bbl</span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">SOR:</span>
                  <span className={isRec ? 'text-emerald-400 font-bold' : ''}>{sc.steam_oil_ratio.toFixed(2)} t/bbl</span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Energy Int.:</span>
                  <span>{sc.energy_intensity_kwh_per_bbl.toFixed(1)} kWh/bbl</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Float Margin:</span>
                  <span
                    className={`font-bold px-1 rounded text-[10px] ${
                      sc.min_float_margin_index < 1.0
                        ? 'bg-rose-950 text-rose-300 border border-rose-700'
                        : 'text-emerald-400'
                    }`}
                  >
                    {sc.min_float_margin_index.toFixed(3)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Failure Risk:</span>
                  <span className={sc.failure_risk_probability > 0.35 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                    {(sc.failure_risk_probability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Violations / Warnings */}
              <div className="min-h-[4rem] text-[10px] font-mono space-y-1">
                {sc.violations && sc.violations.length > 0 ? (
                  sc.violations.map((v, i) => (
                    <div key={i} className="text-rose-400 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{v}</span>
                    </div>
                  ))
                ) : sc.near_limit_warnings && sc.near_limit_warnings.length > 0 ? (
                  sc.near_limit_warnings.map((w, i) => (
                    <div key={i} className="text-amber-400 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>All constraints satisfied</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  alert(`Activated ${sc.label} setpoint on ${selectedWellId}!`);
                  if (onNavigate) onNavigate('digital-twin');
                }}
                disabled={sc.status === 'INFEASIBLE'}
                className={`w-full py-1.5 px-2 rounded text-xs font-mono font-bold transition-all ${
                  isRec
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
                    : sc.status === 'INFEASIBLE'
                    ? 'bg-industrial-900 text-slate-600 cursor-not-allowed border border-industrial-800'
                    : 'bg-industrial-800 hover:bg-industrial-700 text-slate-200'
                }`}
              >
                {sc.status === 'INFEASIBLE' ? 'INFEASIBLE (LOCKED)' : isRec ? 'APPLY OPTIMAL' : 'APPLY SCENARIO'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
