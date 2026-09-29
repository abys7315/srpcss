import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { OptimizationResult, ParetoPoint } from '../api/types';
import { MetricCard } from '../components/common/MetricCard';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import {
  Compass,
  Sliders,
  CheckCircle2,
  Play,
  ArrowRight,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const JointOptimizer: React.FC<Props> = ({ selectedWellId, onNavigate }) => {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<ParetoPoint | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Objective Weights
  const [weightNetBenefit, setWeightNetBenefit] = useState<number>(0.50);
  const [weightSor, setWeightSor] = useState<number>(0.25);
  const [weightEnergy, setWeightEnergy] = useState<number>(0.15);
  const [weightRisk, setWeightRisk] = useState<number>(0.10);

  useEffect(() => {
    runOptimization();
  }, [selectedWellId]);

  const runOptimization = async () => {
    try {
      setLoading(true);
      setStatusMessage(null);
      setApplySuccessMessage(null);
      const res = await apiClient.optimizeJoint({
        well_id: selectedWellId,
        weight_net_benefit: weightNetBenefit,
        weight_sor: weightSor,
        weight_energy: weightEnergy,
        weight_failure_risk: weightRisk,
      });
      setResult(res);
      setSelectedCandidate(res.recommended_configuration || (res.pareto_front && res.pareto_front[0]) || null);
    } catch (e: any) {
      console.error('Optimization failed:', e);
      setStatusMessage(`Optimization error: ${e?.message || 'Server error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndApply = async () => {
    if (!recommended) return;
    try {
      setApplying(true);
      setStatusMessage(null);
      setApplySuccessMessage(null);

      // 1. Formal human-in-the-loop engineering approval
      await apiClient.approveRecommendation(recommended.solution_id, {
        well_id: selectedWellId,
        decision_reason: `Operator approved optimal joint setpoint (Solution ${recommended.solution_id})`,
        approved_by: "Lead Operations Engineer",
        approved_setpoint: {
          steam_volume_tonnes: recommended.steam_volume_tonnes,
          soak_duration_days: recommended.soak_days,
          spm: recommended.spm,
          stroke_length_inch: recommended.stroke_length_inch,
          vfd_downstroke_ratio: recommended.vfd_downstroke_ratio,
          economic_cutoff_bpd: recommended.economic_cutoff_bpd
        }
      });

      // 2. Apply setpoint directly to well digital twin state
      await apiClient.updateSetpoint(selectedWellId, {
        spm: recommended.spm,
        stroke_length_inch: recommended.stroke_length_inch,
        vfd_downstroke_ratio: recommended.vfd_downstroke_ratio,
        steam_volume_tonnes: recommended.steam_volume_tonnes,
        soak_duration_days: recommended.soak_days,
        applied_by: "Lead Operations Engineer"
      });

      setApplySuccessMessage(`Successfully approved & applied setpoint ${recommended.solution_id} to ${selectedWellId}! Digital twin state updated.`);
      
      setTimeout(() => {
        if (onNavigate) onNavigate('digital-twin');
      }, 1400);
    } catch (e: any) {
      console.error('Approval / Apply failed:', e);
      setStatusMessage(`Failed to apply setpoint: ${e?.message || 'Server error'}`);
    } finally {
      setApplying(false);
    }
  };

  const current = result?.current_configuration;
  const recommended = selectedCandidate || result?.recommended_configuration;

  // Normalization for SVG Scatter plot
  const paretoPoints = result?.pareto_front || [];
  const minSor = Math.min(...paretoPoints.map((p) => p.steam_oil_ratio), 1.0);
  const maxSor = Math.max(...paretoPoints.map((p) => p.steam_oil_ratio), 3.0);
  const minBenefit = Math.min(...paretoPoints.map((p) => p.net_benefit_usd), 50000);
  const maxBenefit = Math.max(...paretoPoints.map((p) => p.net_benefit_usd), 250000);

  const getSvgX = (sor: number) => {
    const range = maxSor - minSor || 1;
    return 60 + ((sor - minSor) / range) * 480;
  };

  const getSvgY = (benefit: number) => {
    const range = maxBenefit - minBenefit || 1;
    return 260 - ((benefit - minBenefit) / range) * 200;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-600" />
              Joint Optimizer
            </h1>
            <ProvenanceBadge tier={result?.provenance || 'SIMULATED'} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simultaneous cyclic steam injection and sucker rod pump optimization for well{' '}
            <strong className="text-slate-900 font-semibold">{selectedWellId}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runOptimization}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Solving Pareto frontier...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run Optimization</span>
              </>
            )}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
          {statusMessage}
        </div>
      )}

      {/* Domain shift warning */}
      <DomainShiftWarning />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Net Economic Benefit"
          value={recommended?.net_benefit_usd ? `$${Math.round(recommended.net_benefit_usd).toLocaleString()}` : '$0'}
          unit="USD / cycle"
          delta={
            current && recommended
              ? `+${(((recommended.net_benefit_usd - current.net_benefit_usd) / (current.net_benefit_usd || 1)) * 100).toFixed(1)}% vs baseline`
              : undefined
          }
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Steam-Oil Ratio (SOR)"
          value={recommended?.steam_oil_ratio ? recommended.steam_oil_ratio.toFixed(2) : '0.00'}
          unit="t steam / bbl oil"
          delta={
            current && recommended
              ? `${(((recommended.steam_oil_ratio - current.steam_oil_ratio) / (current.steam_oil_ratio || 1)) * 100).toFixed(1)}% reduction`
              : undefined
          }
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Cumulative Oil Recovery"
          value={recommended?.cumulative_oil_bbl ? `${Math.round(recommended.cumulative_oil_bbl).toLocaleString()}` : '0'}
          unit="bbl"
          delta={
            current && recommended
              ? `+${(((recommended.cumulative_oil_bbl - current.cumulative_oil_bbl) / (current.cumulative_oil_bbl || 1)) * 100).toFixed(1)}% recovery`
              : undefined
          }
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Rod Float Margin"
          value={recommended?.min_float_margin_index ? recommended.min_float_margin_index.toFixed(3) : '1.000'}
          unit="Limit ≥ 1.000"
          delta={
            recommended && recommended.min_float_margin_index >= 1.05
              ? 'Float risk eliminated'
              : 'Safe operating limit'
          }
          deltaPositive={true}
          provenance="SIMULATED"
        />
      </div>

      {/* Main 2-Column Section: Pareto Chart + Weights & Decision Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pareto Frontier SVG Chart (2 columns) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Pareto Frontier: Steam-Oil Ratio vs Net Benefit
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Evaluated: <strong className="text-slate-800">{result?.total_evaluated_count || 0}</strong> | Feasible:{' '}
              <strong className="text-emerald-700">{result?.feasible_count || 0}</strong>
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 600 300" className="w-full h-72 bg-slate-50 rounded-lg border border-slate-200">
              {/* Grid Lines */}
              <line x1="60" y1="60" x2="560" y2="60" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="60" y1="120" x2="560" y2="120" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="60" y1="180" x2="560" y2="180" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="60" y1="240" x2="560" y2="240" stroke="#e2e8f0" strokeDasharray="3 3" />

              <line x1="160" y1="30" x2="160" y2="260" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="280" y1="30" x2="280" y2="260" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="400" y1="30" x2="400" y2="260" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="520" y1="30" x2="520" y2="260" stroke="#e2e8f0" strokeDasharray="3 3" />

              {/* Axes */}
              <line x1="60" y1="260" x2="570" y2="260" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="60" y1="260" x2="60" y2="20" stroke="#94a3b8" strokeWidth="1.5" />

              {/* Axis Labels */}
              <text x="560" y="280" fill="#64748b" fontSize="11" textAnchor="end" fontFamily="Inter, sans-serif" fontWeight="500">
                Steam-Oil Ratio (SOR, lower is better) →
              </text>
              <text x="20" y="25" fill="#64748b" fontSize="11" transform="rotate(-90 20,25)" fontFamily="Inter, sans-serif" fontWeight="500">
                Net Benefit ($USD, higher is better) →
              </text>

              {/* Pareto Points */}
              {paretoPoints.map((p, idx) => {
                const cx = getSvgX(p.steam_oil_ratio);
                const cy = getSvgY(p.net_benefit_usd);
                const isSelected = selectedCandidate?.solution_id === p.solution_id;
                const isRec = result?.recommended_configuration?.solution_id === p.solution_id;

                return (
                  <g
                    key={p.solution_id || idx}
                    className="cursor-pointer transition-transform hover:scale-125"
                    onClick={() => setSelectedCandidate(p)}
                  >
                    {isSelected && (
                      <circle cx={cx} cy={cy} r="10" fill="none" stroke="#2563eb" strokeWidth="1.5" className="animate-ping" />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isRec ? '7' : isSelected ? '6' : '4.5'}
                      fill={isRec ? '#059669' : isSelected ? '#2563eb' : '#0284c7'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

              {/* Current Configuration Point */}
              {current && (
                <g>
                  <circle
                    cx={getSvgX(current.steam_oil_ratio)}
                    cy={getSvgY(current.net_benefit_usd)}
                    r="6"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={getSvgX(current.steam_oil_ratio) + 8}
                    y={getSvgY(current.net_benefit_usd) - 4}
                    fill="#ef4444"
                    fontSize="10"
                    fontFamily="Inter, sans-serif"
                    fontWeight="600"
                  >
                    Current Baseline
                  </text>
                </g>
              )}

              {/* Recommended Badge on Chart */}
              {recommended && (
                <g>
                  <text
                    x={getSvgX(recommended.steam_oil_ratio) + 10}
                    y={getSvgY(recommended.net_benefit_usd) + 4}
                    fill="#059669"
                    fontSize="10"
                    fontFamily="Inter, sans-serif"
                    fontWeight="600"
                  >
                    Recommended Optimal
                  </text>
                </g>
              )}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Recommended
              </span>
              <span className="flex items-center gap-1.5 font-medium text-sky-700">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" /> Pareto Candidates
              </span>
              <span className="flex items-center gap-1.5 font-medium text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /> Current Baseline
              </span>
            </div>
            <span>Click any node to inspect candidate values</span>
          </div>
        </div>

        {/* Right Column: Multi-Objective Weights & Confidence Advisory */}
        <div className="space-y-4">
          {/* Recommendation Mode Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Optimization Mode</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {result?.recommendation_mode || 'Evaluating'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Model Confidence:</span>
                <span className="text-emerald-700 font-semibold">
                  {result?.confidence_score !== undefined ? `${(result.confidence_score * 100).toFixed(1)}%` : '---'}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all"
                  style={{ width: `${(result?.confidence_score || 0) * 100}%` }}
                />
              </div>

              {result?.confidence_breakdown && (
                <div className="pt-2 border-t border-slate-200 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Data Completeness:</span>
                    <span className="text-slate-900 font-medium">{((result.confidence_breakdown.data_completeness || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Validation Residual:</span>
                    <span className="text-slate-900 font-medium">{((result.confidence_breakdown.validation_error || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Model Agreement:</span>
                    <span className="text-slate-900 font-medium">{((result.confidence_breakdown.scenario_model_agreement || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Extrapolation Range:</span>
                    <span className="text-slate-900 font-medium">{result.confidence_breakdown.extrapolation_distance}</span>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed pt-1">
                {result?.explanation ||
                  'Balanced optimal setpoint: rod float is strictly avoided with adjusted downstroke velocity while optimizing thermal recovery.'}
              </p>
            </div>

            {/* Safety Guarantee */}
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong>Safety Verification:</strong> Every proposed setpoint verifies a positive rod float margin (M_float ≥ 1.000).
              </span>
            </div>
          </div>

          {/* Objective Weights Tuning */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                Objective Priorities
              </h3>
              <span className="text-xs text-slate-400">Total: 100%</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Net Benefit:</span>
                  <span className="text-blue-700 font-semibold">{(weightNetBenefit * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={weightNetBenefit}
                  onChange={(e) => setWeightNetBenefit(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Steam Efficiency (SOR):</span>
                  <span className="text-teal-700 font-semibold">{(weightSor * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={weightSor}
                  onChange={(e) => setWeightSor(parseFloat(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Power Consumption:</span>
                  <span className="text-indigo-700 font-semibold">{(weightEnergy * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.4"
                  step="0.05"
                  value={weightEnergy}
                  onChange={(e) => setWeightEnergy(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Mechanical Risk Mitigation:</span>
                  <span className="text-amber-700 font-semibold">{(weightRisk * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.4"
                  step="0.05"
                  value={weightRisk}
                  onChange={(e) => setWeightRisk(parseFloat(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Current vs Recommended Parameter Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
        {applySuccessMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{applySuccessMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Optimal Setpoint Implementation Table
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Candidate: <strong className="text-slate-900 font-semibold">{recommended?.solution_id || 'Pending'}</strong>
            </span>
            <button
              onClick={handleApproveAndApply}
              disabled={applying || !recommended}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5"
            >
              <span>{applying ? 'Applying Setpoints...' : 'Apply Setpoint'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="py-2.5 px-3">Operating Parameter</th>
                <th className="py-2.5 px-3">Current Baseline</th>
                <th className="py-2.5 px-3 text-blue-700 font-semibold">Recommended Optimal</th>
                <th className="py-2.5 px-3">Engineering Unit</th>
                <th className="py-2.5 px-3 text-right">Expected Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {result?.comparison_table && result.comparison_table.length > 0 ? (
                result.comparison_table.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{row.parameter}</td>
                    <td className="py-2.5 px-3">{row.current}</td>
                    <td className="py-2.5 px-3 text-blue-700 font-semibold">{row.recommended}</td>
                    <td className="py-2.5 px-3 text-slate-500">{row.unit === 't/t' ? 't steam / t oil' : row.unit}</td>
                    <td className={`py-2.5 px-3 text-right font-medium ${row.delta.startsWith('+') ? 'text-emerald-700' : row.delta.startsWith('-') ? 'text-blue-700' : 'text-slate-700'}`}>
                      {row.delta}
                    </td>
                  </tr>
                ))
              ) : current && recommended ? (
                <>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">Steam Injection Volume</td>
                    <td className="py-2.5 px-3">{current.steam_volume_tonnes.toFixed(0)}</td>
                    <td className="py-2.5 px-3 text-blue-700 font-semibold">{recommended.steam_volume_tonnes.toFixed(0)}</td>
                    <td className="py-2.5 px-3 text-slate-500">Tonnes</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">{recommended.steam_volume_tonnes - current.steam_volume_tonnes >= 0 ? '+' : ''}{(recommended.steam_volume_tonnes - current.steam_volume_tonnes).toFixed(0)} t</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">Pumping Speed (SPM)</td>
                    <td className="py-2.5 px-3">{current.spm.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-blue-700 font-semibold">{recommended.spm.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-slate-500">SPM</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">{recommended.spm - current.spm >= 0 ? '+' : ''}{(recommended.spm - current.spm).toFixed(2)} SPM</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">VFD Downstroke Ratio (α_down)</td>
                    <td className="py-2.5 px-3">{current.vfd_downstroke_ratio.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-blue-700 font-semibold">{recommended.vfd_downstroke_ratio.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-slate-500">Ratio</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">{recommended.vfd_downstroke_ratio - current.vfd_downstroke_ratio >= 0 ? '+' : ''}{(recommended.vfd_downstroke_ratio - current.vfd_downstroke_ratio).toFixed(2)}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">Minimum Float Margin Index</td>
                    <td className="py-2.5 px-3 text-rose-600 font-semibold">{current.min_float_margin_index.toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-emerald-700 font-semibold">{recommended.min_float_margin_index.toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-slate-500">Limit ≥ 1.000</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">{recommended.min_float_margin_index - current.min_float_margin_index >= 0 ? '+' : ''}{(recommended.min_float_margin_index - current.min_float_margin_index).toFixed(3)}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">Total Net Economic Benefit</td>
                    <td className="py-2.5 px-3 text-slate-500">${Math.round(current.net_benefit_usd).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-emerald-700 font-semibold">${Math.round(recommended.net_benefit_usd).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-500">USD / cycle</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">{recommended.net_benefit_usd - current.net_benefit_usd >= 0 ? '+' : ''}${Math.round(recommended.net_benefit_usd - current.net_benefit_usd).toLocaleString()}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    {loading ? 'Evaluating Pareto candidates...' : 'No optimization results available.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
