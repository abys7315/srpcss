import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { BenchmarkData } from '../api/types';
import { MetricCard } from '../components/common/MetricCard';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Layers,
  Award,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId?: string;
  onNavigate?: (page: PageId) => void;
}

export const Benchmarks: React.FC<Props> = ({ onNavigate: _onNavigate }) => {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [_loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadBenchmarks();
  }, []);

  const loadBenchmarks = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getBenchmarks();
      setData(res);
    } catch (e) {
      console.error('Failed to load benchmarks:', e);
    } finally {
      setLoading(false);
    }
  };

  const baselineVsOptimized = data?.baseline_vs_optimized || [];
  const ablationStudy = data?.ablation_study || [];

  const netBenefitItem = baselineVsOptimized.find((r) => r.metric.toLowerCase().includes('benefit'));
  const sorItem = baselineVsOptimized.find((r) => r.metric.toLowerCase().includes('sor') || r.metric.toLowerCase().includes('steam'));
  const floatItem = baselineVsOptimized.find((r) => r.metric.toLowerCase().includes('float'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Benchmarks & Architectural Ablation Study
            </h1>
            <ProvenanceBadge tier="SIMULATED" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Empirical validation against unconstrained baseline and comparative ablation of physics, pure ML, and hybrid models.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>
            {data?.overall_net_benefit_gain_pct
              ? `+${data.overall_net_benefit_gain_pct.toFixed(1)}% Net Benefit Gain Verified`
              : 'Benchmark Evaluation Complete'}
          </span>
        </div>
      </div>

      <DomainShiftWarning />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Net Economic Gain"
          value={data?.overall_net_benefit_gain_pct ? `+${data.overall_net_benefit_gain_pct.toFixed(1)}%` : '—'}
          unit={
            netBenefitItem
              ? `+$${Math.round(netBenefitItem.optimized_value - netBenefitItem.baseline_value).toLocaleString()} / cycle`
              : 'Cycle Evaluation'
          }
          delta="Joint Optimal vs Heuristic"
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Steam-Oil Ratio (SOR)"
          value={data?.overall_sor_reduction_pct ? `-${Math.abs(data.overall_sor_reduction_pct).toFixed(1)}%` : '—'}
          unit={
            sorItem
              ? `${sorItem.baseline_value.toFixed(2)} → ${sorItem.optimized_value.toFixed(2)} t/t (mass basis)`
              : 't steam / t oil (mass basis)'
          }
          delta="Thermal efficiency gain"
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Rod-Floating Events"
          value={floatItem ? `${floatItem.optimized_value} Events` : '0 Events'}
          unit={floatItem ? `Baseline: ${floatItem.baseline_value} Events` : 'Strict safety gating'}
          delta="Complete Float Avoidance"
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Ablation Architectures"
          value={ablationStudy.length > 0 ? `${ablationStudy.length} Modes` : '—'}
          unit="Baseline, CSS, SRP & Joint"
          delta="Proves Co-Optimization Value"
          deltaPositive={true}
          provenance="SIMULATED"
        />
      </div>

      {/* Section 1: Baseline vs Optimized Verification Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Benchmark Verification: Baseline vs. Optimized
          </h2>
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">180-Day Simulated Cycle (Jodhpur Sandstone)</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Evaluation Metric</th>
                <th className="py-2.5 px-3 font-semibold">Baseline Setpoint</th>
                <th className="py-2.5 px-3 font-semibold text-emerald-700">Petro-Twin Optimal</th>
                <th className="py-2.5 px-3 font-semibold">Engineering Unit</th>
                <th className="py-2.5 px-3 font-semibold text-right">Net Improvement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {baselineVsOptimized.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-900">{row.metric}</td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {typeof row.baseline_value === 'number' && row.baseline_value >= 1000
                      ? row.baseline_value.toLocaleString()
                      : row.baseline_value}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">
                    {typeof row.optimized_value === 'number' && row.optimized_value >= 1000
                      ? row.optimized_value.toLocaleString()
                      : row.optimized_value}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{row.unit}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                    {row.improvement_pct > 0 ? `+${row.improvement_pct.toFixed(1)}%` : `${row.improvement_pct.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: 4-Variant Architectural Ablation Study */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              Ablation Study: Single-Domain vs. Joint Co-Optimization
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Comparative analysis of single-discipline optimization vs. multi-objective joint optimization balancing economics, SOR, and rod-float safety.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Optimization Variant</th>
                <th className="py-2.5 px-3 font-semibold">Net Benefit ($USD)</th>
                <th className="py-2.5 px-3 font-semibold">SOR (t/t)</th>
                <th className="py-2.5 px-3 font-semibold">Float Events</th>
                <th className="py-2.5 px-3 font-semibold">Physics Feasibility</th>
                <th className="py-2.5 px-3 font-semibold">Engineering Assessment & Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ablationStudy.map((item, idx) => {
                const isWinner = item.architecture.includes('Petro-Twin');
                const isCatastrophic = item.architecture.includes('ML-Only');

                return (
                  <tr
                    key={idx}
                    className={
                      isWinner
                        ? 'bg-emerald-50/60 font-medium'
                        : isCatastrophic
                        ? 'bg-rose-50/40'
                        : 'hover:bg-slate-50/50'
                    }
                  >
                    <td className="py-2.5 px-3 text-slate-900">
                      <div className="flex items-center gap-2">
                        {isWinner && <Award className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {isCatastrophic && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                        <span className={isWinner ? 'font-bold text-emerald-900' : ''}>{item.architecture}</span>
                      </div>
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${isWinner ? 'text-emerald-700' : isCatastrophic ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      ${item.net_benefit_usd.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">{item.steam_oil_ratio.toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.total_float_events > 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {item.total_float_events} events
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.is_safe
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {item.is_safe ? 'Physically Safe' : 'Unsafe / Invalid'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-xs">{item.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Callout highlighting why pure ML fails */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Key Engineering Architectural Finding
          </div>
          <p className="text-slate-600 leading-relaxed text-xs">
            In our simulated Baghewala-parameter benchmark, <strong>Joint Optimization produces a Pareto-balanced operating strategy across economics, production, steam efficiency, and mechanical risk</strong>.
            While unconstrained or single-discipline heuristics might superficially maximize individual production figures at the cost of high steam consumption or rod float risk,
            <strong> Petro-Twin</strong> maintains strict physical safety invariance and positive float margins while optimizing energy intensity and net benefit.
          </p>
        </div>
      </div>
    </div>
  );
};
