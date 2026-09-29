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
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  useEffect(() => {
    runSimulation();
  }, [selectedWellId]);

  const runSimulation = async () => {
    try {
      setLoading(true);
      setAppliedMsg(null);
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

  const handleApplyScenario = async (sc: WhatIfScenario) => {
    try {
      await apiClient.updateSetpoint(selectedWellId, {
        spm: sc.spm,
        stroke_length_inch: sc.stroke_length_inch,
        vfd_downstroke_ratio: sc.vfd_downstroke_ratio,
        steam_volume_tonnes: sc.steam_volume_tonnes,
        soak_duration_days: sc.soak_days,
        applied_by: "What-If Sandbox Operator"
      });
      setAppliedMsg(`Scenario '${sc.label}' setpoint applied to ${selectedWellId}! Digital twin updated.`);
      setTimeout(() => {
        if (onNavigate) onNavigate('digital-twin');
      }, 1200);
    } catch (e: any) {
      console.error('Failed to apply scenario:', e);
    }
  };


  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              Scenario Sandbox
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Evaluate operational variations, sensitivity scenarios, and recommended setpoints for well{' '}
            <strong className="text-slate-900 font-semibold">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Evaluating scenarios...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Simulate Scenarios</span>
            </>
          )}
        </button>
      </div>
      {appliedMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{appliedMsg}</span>
        </div>
      )}

      <DomainShiftWarning />

      {/* Summary Insight Callout */}
      {summaryInsight && (
        <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900 shadow-xs">
          <Star className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 fill-blue-600" />
          <p className="leading-relaxed">
            <strong className="text-blue-900 font-semibold">Engineering Assessment:</strong> {summaryInsight}
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
                  ? 'bg-emerald-50/40 border-2 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                  : isFloatViolator
                  ? 'bg-rose-50/30 border border-rose-200 shadow-xs'
                  : 'bg-white border border-slate-200 shadow-xs hover:border-slate-300'
              } p-4 space-y-4`}
            >
              {/* Header */}
              <div className="space-y-1.5 pb-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
                    {sc.scenario_id.toUpperCase()}
                  </span>
                  {isRec && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-emerald-600" /> Optimal
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-semibold text-slate-900 leading-snug">{sc.label}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed min-h-[2.5rem]">{sc.description}</p>
                <div className="pt-1">
                  <StatusBadge status={sc.status} />
                </div>
              </div>

              {/* Operating Parameters */}
              <div className="space-y-2 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Inputs</span>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Steam:</span>
                  <span className="font-semibold text-slate-900">{sc.steam_volume_tonnes.toFixed(0)} t</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Soak Period:</span>
                  <span>{sc.soak_days} days</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Speed:</span>
                  <span className="font-semibold text-slate-900">{sc.spm.toFixed(1)} SPM</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Stroke Length:</span>
                  <span>{sc.stroke_length_inch}"</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">VFD α_down:</span>
                  <span className={sc.vfd_downstroke_ratio < 1.0 ? 'text-blue-700 font-semibold' : ''}>
                    {sc.vfd_downstroke_ratio.toFixed(2)}x
                  </span>
                </div>
              </div>

              {/* Resulting Simulated KPIs */}
              <div className="space-y-2 text-xs pt-3 border-t border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Simulated KPIs</span>

                <div className="flex justify-between">
                  <span className="text-slate-500">Net Benefit:</span>
                  <span className={`font-semibold ${isRec ? 'text-emerald-700' : 'text-slate-900'}`}>
                    ${Math.round(sc.net_benefit_usd).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Cumulative Oil:</span>
                  <span>{Math.round(sc.cumulative_oil_bbl).toLocaleString()} bbl</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">SOR (Mass Basis):</span>
                  <span className={isRec ? 'text-emerald-700 font-bold' : ''}>{sc.steam_oil_ratio.toFixed(2)} t/t</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Energy Int.:</span>
                  <span>{sc.energy_intensity_kwh_per_bbl.toFixed(1)} kWh/bbl</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Float Margin:</span>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                      sc.min_float_margin_index < 1.0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {sc.min_float_margin_index.toFixed(3)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500">Failure Risk:</span>
                  <span className={sc.failure_risk_probability > 0.35 ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                    {(sc.failure_risk_probability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Violations / Warnings */}
              <div className="min-h-[4rem] text-[10px] font-mono space-y-1">
                {sc.violations && sc.violations.length > 0 ? (
                  sc.violations.map((v, i) => (
                    <div key={i} className="text-rose-600 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{v}</span>
                    </div>
                  ))
                ) : sc.near_limit_warnings && sc.near_limit_warnings.length > 0 ? (
                  sc.near_limit_warnings.map((w, i) => (
                    <div key={i} className="text-amber-700 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-emerald-700 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>All constraints satisfied</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleApplyScenario(sc)}
                disabled={sc.status === 'INFEASIBLE'}
                className={`w-full py-2 px-2 rounded-lg text-xs font-mono font-semibold transition-all shadow-xs ${
                  isRec
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : sc.status === 'INFEASIBLE'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
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
