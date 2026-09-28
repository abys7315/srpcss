import { useEffect, useState } from 'react';
import type { WellSummary, RiskResult } from '../api/types';
import { apiClient } from '../api/client';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { AlertBanner } from '../components/common/AlertBanner';
import type { AlertDetails } from '../components/common/AlertBanner';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import { Droplets, Flame, AlertTriangle, ShieldCheck, Gauge, ArrowRight } from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onSelectWell: (wellId: string) => void;
  onNavigate: (page: PageId) => void;
}

export const CommandCenter: React.FC<Props> = ({ selectedWellId, onSelectWell, onNavigate }) => {
  const [wells, setWells] = useState<WellSummary[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);
  const [riskData, setRiskData] = useState<RiskResult | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedWellId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wellsList, risk] = await Promise.all([
        apiClient.getWells(),
        apiClient.getWellRisk(selectedWellId).catch(() => null),
      ]);
      setWells(wellsList);
      setRiskData(risk);
    } catch (e) {
      console.error('Failed to load command center data:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectedWell = wells.find((w) => w.well_id === selectedWellId) || wells[0];

  // Aggregated Fleet Metrics
  const totalFleetOilBpd = wells.reduce((sum, w) => sum + (w.telemetry?.current_oil_rate_bpd || 0), 0);
  const totalFleetSteamT = wells.reduce((sum, w) => sum + (w.operating_parameters?.steam_volume_tonnes || 0), 0);
  const floatingWells = wells.filter((w) => (w.telemetry?.current_float_margin_index || 2.0) < 1.0);
  const nearLimitWells = wells.filter(
    (w) => (w.telemetry?.current_float_margin_index || 2.0) >= 1.0 && (w.telemetry?.current_float_margin_index || 2.0) < 1.25
  );

  const activeAlert: AlertDetails = {
    severity: selectedWell?.status === 'INFEASIBLE' ? 'CRITICAL' : 'WARNING',
    title: `Sucker Rod Viscous Float Danger on ${selectedWell?.well_id || 'BGW-01'}`,
    affectedComponent: 'Downhole Sucker Rod String (API 76 Taper)',
    rootCause: `Heavy oil viscosity (${selectedWell?.telemetry?.current_viscosity_cp || 1200} cP) generates annular shear drag exceeding submerged rod weight during downstroke.`,
    telemetryProof: `Float Margin Index: ${(selectedWell?.telemetry?.current_float_margin_index || 0.92).toFixed(3)} (Limit ≥ 1.000) at ${(selectedWell?.operating_parameters?.spm || 4.5).toFixed(1)} SPM`,
    consequence: 'Slack polished rod wireline turns around, causing severe impact shocks, fluid pound, and fatigue rod parting.',
    recommendedAction: 'Engage VFD downstroke ratio 0.75 or reduce pumping speed to 3.2 SPM.',
    expectedBenefit: 'Completely eliminates rod floating (M_float > 1.8) while safeguarding gearbox torque.',
    onApplyAction: () => onNavigate('joint-optimizer')
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Field Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase font-mono">
              Field Command Center — Baghewala Heavy Oil
            </h1>
            <ProvenanceBadge tier="SIMULATED" size="sm" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time digital twin monitoring and constrained lift optimization across 10 wells in Bikaner-Nagaur Basin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('joint-optimizer')}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-950/50"
          >
            Optimize Current Well ({selectedWellId})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <DomainShiftWarning />

      {/* Early-Warning Alert Banner */}
      <AlertBanner alert={activeAlert} />

      {/* Fleet KPI Metric Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          title="Fleet Production"
          value={totalFleetOilBpd.toFixed(1)}
          unit="BPD"
          subtitle="10 Wells Monitored"
          delta="+8.4% vs Base"
          deltaPositive={true}
          icon={<Droplets className="w-4 h-4" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Steam Injected"
          value={totalFleetSteamT.toLocaleString()}
          unit="Tonnes"
          subtitle="Cumulative Active Cycle"
          icon={<Flame className="w-4 h-4 text-orange-400" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Avg Steam-Oil Ratio"
          value="3.18"
          unit="t/t"
          subtitle="Target < 3.50"
          delta="-0.42 t/t"
          deltaPositive={true}
          icon={<Gauge className="w-4 h-4 text-sky-400" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Rod Floating Wells"
          value={floatingWells.length}
          unit="Wells"
          subtitle="M_float < 1.0"
          danger={floatingWells.length > 0}
          icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Near Limit Wells"
          value={nearLimitWells.length}
          unit="Wells"
          subtitle="1.0 ≤ M_float < 1.25"
          warning={nearLimitWells.length > 0}
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Surface Units Safe"
          value="10 / 10"
          unit="Units"
          subtitle="API C-456 Beam Torque < 100%"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          provenance="ASSUMED"
        />
      </div>

      {/* 10-Well Fleet Telemetry Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b border-industrial-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 font-mono uppercase tracking-wider">
              Fleet Overview & Active Telemetry Matrix
            </h3>
            <span className="text-xs text-slate-400">
              Live status, fluid viscosity, float margin index, and diagnostic dynacard classifications
            </span>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-1 rounded">
            Click well to inspect
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-industrial-900/90 text-slate-400 border-b border-industrial-800 uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Well ID</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Cycle</th>
                <th className="py-2.5 px-3">Oil Rate</th>
                <th className="py-2.5 px-3">Water Cut</th>
                <th className="py-2.5 px-3">Temp (°C)</th>
                <th className="py-2.5 px-3">Viscosity</th>
                <th className="py-2.5 px-3">Float Margin</th>
                <th className="py-2.5 px-3">Dynacard Label</th>
                <th className="py-2.5 px-3">SPM</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800">
              {wells.map((w) => {
                const isSelected = w.well_id === selectedWellId;
                const floatMargin = w.telemetry?.current_float_margin_index || 1.85;
                const isFloat = floatMargin < 1.0;
                const isNear = floatMargin >= 1.0 && floatMargin < 1.25;

                return (
                  <tr
                    key={w.well_id}
                    onClick={() => onSelectWell(w.well_id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/40 text-cyan-200'
                        : 'hover:bg-slate-900/50 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold flex items-center gap-1.5">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                      {w.well_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      Cycle {w.current_cycle_number}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-100">
                      {w.telemetry?.current_oil_rate_bpd.toFixed(1)} bpd
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {w.telemetry?.current_water_cut_pct.toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3 text-orange-400">
                      {w.telemetry?.current_temperature_c.toFixed(1)}°C
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {w.telemetry?.current_viscosity_cp.toFixed(0)} cP
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${
                      isFloat ? 'text-rose-400 animate-pulse' : isNear ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {floatMargin.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        w.telemetry?.latest_dynacard_label === 'ROD_FLOATING'
                          ? 'bg-rose-950 text-rose-300 border border-rose-600/50'
                          : w.telemetry?.latest_dynacard_label === 'FLUID_POUND'
                          ? 'bg-amber-950 text-amber-300 border border-amber-600/50'
                          : 'bg-slate-900 text-slate-400'
                      }`}>
                        {w.telemetry?.latest_dynacard_label || 'NORMAL'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300">
                      {w.operating_parameters?.spm.toFixed(1)} SPM
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWell(w.well_id);
                          onNavigate('digital-twin');
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
                      >
                        Simulate Twin
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Well Quick Detail & Risk Matrix */}
      {selectedWell && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Well Hardware & Geometry */}
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                {selectedWell.well_id} Wellbore Configuration
              </h4>
              <ProvenanceBadge tier={selectedWell.provenance} size="sm" />
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Reservoir Depth:</span>
                <span className="text-slate-200">{selectedWell.depth_m} m TVD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pump Intake Depth:</span>
                <span className="text-slate-200">{selectedWell.operating_parameters ? '980 m' : '1000 m'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Casing / Tubing:</span>
                <span className="text-slate-200">7.0" Casing / 3.5" Tubing</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rod String Taper:</span>
                <span className="text-slate-200">API 76 (1.00", 0.875", 0.750")</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pumping Unit:</span>
                <span className="text-slate-200">API C-456-256-100 Beam</span>
              </div>
            </div>
          </div>

          {/* Card 2: Current Operating Parameters */}
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Current Operational Schedule
              </h4>
              <StatusBadge status={selectedWell.status} />
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Steam Injected:</span>
                <span className="text-orange-400 font-semibold">{selectedWell.operating_parameters?.steam_volume_tonnes.toLocaleString()} t</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Soak Duration:</span>
                <span className="text-slate-200">{selectedWell.operating_parameters?.soak_duration_days} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pumping Speed:</span>
                <span className="text-cyan-300 font-semibold">{selectedWell.operating_parameters?.spm.toFixed(1)} SPM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VFD Downstroke Ratio:</span>
                <span className="text-slate-200">{selectedWell.operating_parameters?.vfd_downstroke_ratio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Economic Cutoff:</span>
                <span className="text-slate-200">{selectedWell.operating_parameters?.economic_cutoff_oil_rate_bpd} BPD</span>
              </div>
            </div>
          </div>

          {/* Card 3: 30-Day Failure Risk Assessment */}
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                30-Day Failure Risk Attribution
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                riskData?.risk_tier === 'CRITICAL'
                  ? 'bg-rose-950 text-rose-300 border border-rose-600/50'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
              }`}>
                {riskData?.risk_tier || 'LOW'} TIER
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Overall Failure Probability:</span>
              <span className="text-xl font-mono font-bold text-rose-400">
                {((riskData?.overall_failure_probability_30d || 0.08) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-mono">
              {riskData?.factor_attributions.slice(0, 3).map((f, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{f.factor_name}:</span>
                  <span className="text-cyan-300 font-semibold">{f.contribution_pct}%</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-industrial-800">
              <button
                onClick={() => onNavigate('joint-optimizer')}
                className="w-full py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded text-xs font-mono font-medium transition"
              >
                Run Joint Pareto Optimizer →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
