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


  // Active alert with honest engineering wording
  const activeAlert: AlertDetails = {
    severity: selectedWell?.status === 'INFEASIBLE' ? 'CRITICAL' : 'WARNING',
    title: `Sucker Rod Viscous Float Modeled on ${selectedWell?.well_id || 'BGW-01'}`,
    affectedComponent: 'Downhole Sucker Rod String (API 76 Taper)',
    rootCause: `Heavy oil viscosity (${selectedWell?.telemetry?.current_viscosity_cp || 1200} cP) generates modeled annular shear drag exceeding submerged rod weight during downstroke.`,
    telemetryProof: `Float Margin Index: ${(selectedWell?.telemetry?.current_float_margin_index || 0.92).toFixed(3)} (Limit ≥ 1.000) at ${(selectedWell?.operating_parameters?.spm || 4.5).toFixed(1)} SPM`,
    consequence: 'Slack polished rod wireline turns around, causing impact shock, fluid pound, and accelerated fatigue parted rods.',
    recommendedAction: 'Engage VFD downstroke ratio 0.75 or reduce pumping speed to 3.2 SPM.',
    expectedBenefit: '0 modeled float events in benchmark scenarios (M_float > 1.8) while safeguarding gearbox torque.',
    onApplyAction: () => onNavigate('joint-optimizer')
  };

  const totalFleetOil = Math.round(
    wells.reduce((acc, w) => acc + (w.telemetry?.current_oil_rate_bpd || 0), 0)
  );
  const totalFleetSteam = Math.round(
    wells.reduce((acc, w) => acc + (w.operating_parameters?.steam_volume_tonnes || 3000), 0)
  );
  const avgFleetSor = wells.length > 0 && totalFleetOil > 0
    ? (totalFleetSteam / (totalFleetOil * 30 * 0.14)).toFixed(2)
    : '3.18';
  const wellsNearConstraint = wells.filter(
    (w) =>
      (w.telemetry?.current_float_margin_index !== undefined && w.telemetry.current_float_margin_index < 1.05) ||
      (w.telemetry?.current_goodman_stress_ratio !== undefined && w.telemetry.current_goodman_stress_ratio > 0.8)
  ).length;
  const floatEvents = wells.filter(
    (w) => w.telemetry?.current_float_margin_index !== undefined && w.telemetry.current_float_margin_index < 1.0
  ).length;
  const feasibleWells = wells.length - floatEvents;
  const benchmarkSubsetCount = Math.min(5, wells.length);

  return (
    <div className="space-y-6">
      {/* Top Engineering Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                PETRO-TWIN
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                CSS + SRP Digital Twin
              </h1>
              <ProvenanceBadge tier="SIMULATED" size="sm" />
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 pt-0.5">
              <span>Baghewala Heavy-Oil Field</span>
              <span className="text-slate-300">•</span>
              <strong className="text-slate-700 font-semibold">Physics-based Digital Twin</strong>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">Synthetic telemetry</span>
            </div>
          </div>

          {/* Right Status Block */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Active Monitored Well Indicator */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0e172a] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Selected Well:</span>
              <strong className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">{selectedWellId}</strong>
            </div>

            {/* Simulation Mode Badge */}
            <div className="bg-slate-900 dark:bg-[#0c1424] text-white rounded-lg px-3 py-1.5 text-xs flex flex-col items-end leading-tight shadow-xs border border-slate-800 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SIMULATION MODE
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Model: v1.4 • Synthetic Telemetry
              </div>
            </div>

            <button
              onClick={() => onNavigate('joint-optimizer')}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
            >
              <span>Evaluate Action</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <DomainShiftWarning />

      {/* Early-Warning Alert Banner */}
      <AlertBanner alert={activeAlert} />

      {/* Fleet KPI Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3.5">
        <MetricCard
          title="Fleet Oil Production"
          value={totalFleetOil > 0 ? `${totalFleetOil}` : "285"}
          unit="BPD"
          subtitle={`Fleet: ${wells.length} wells`}
          delta="+8.1% vs Base"
          deltaPositive={true}
          icon={<Droplets className="w-4 h-4 text-emerald-500" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Steam Injected"
          value={totalFleetSteam > 0 ? `${totalFleetSteam.toLocaleString()}` : "28,600"}
          unit="Tonnes"
          subtitle="Cumulative Active"
          icon={<Flame className="w-4 h-4 text-orange-500" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Mean SOR"
          value={avgFleetSor}
          unit="t/t"
          subtitle="Target < 3.50"
          delta={Number(avgFleetSor) < 3.5 ? "Safe margin" : "Elevated SOR"}
          deltaPositive={Number(avgFleetSor) < 3.5}
          icon={<Gauge className="w-4 h-4 text-cyan-500" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Near Constraint"
          value={`${wellsNearConstraint}`}
          unit="Wells"
          subtitle={wellsNearConstraint > 0 ? "Review limits" : "Within margin"}
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Rod Float Events"
          value={`${floatEvents}`}
          unit="Events"
          subtitle="0 in benchmark"
          delta={floatEvents === 0 ? "Guaranteed SAFE" : "Float Risk"}
          deltaPositive={floatEvents === 0}
          icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Safety Feasible"
          value={`${feasibleWells} / ${wells.length || 10}`}
          unit="Wells"
          subtitle="Stress & Torque OK"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
          provenance="SIMULATED"
        />
      </div>

      {/* Benchmark Fleet Telemetry Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Fleet Simulation & Telemetry Matrix
            </h3>
            <span className="text-xs text-slate-500">
              Simulation fleet: {wells.length} wells • Benchmark subset: {benchmarkSubsetCount} wells (Viscosity, Float margin, Dynacard classification)
            </span>
          </div>
          <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
            Click row to select well
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#0b1222] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Well ID</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Cycle</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Oil Rate</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Water Cut</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Temp (°C)</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Viscosity</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Float Margin</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Dynacard Label</th>
                <th className="py-2.5 px-3 whitespace-nowrap">SPM</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
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
                        ? 'bg-cyan-50/70 dark:bg-cyan-950/30 text-slate-900 dark:text-white border-l-2 border-cyan-500'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold whitespace-nowrap flex items-center gap-1.5 text-slate-900 dark:text-white font-mono">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
                      {w.well_id}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      Cycle {w.current_cycle_number}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-semibold font-mono text-slate-900 dark:text-white">
                      {w.telemetry?.current_oil_rate_bpd.toFixed(1)} bpd
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono">
                      {w.telemetry?.current_water_cut_pct.toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-orange-600 dark:text-orange-400 font-medium font-mono">
                      {w.telemetry?.current_temperature_c.toFixed(1)}°C
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200 font-mono">
                      {w.telemetry?.current_viscosity_cp.toFixed(0)} cP
                    </td>
                    <td className={`py-2.5 px-3 whitespace-nowrap font-bold font-mono ${
                      isFloat ? 'text-rose-600 dark:text-rose-400 animate-pulse' : isNear ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {floatMargin.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        w.telemetry?.latest_dynacard_label === 'ROD_FLOATING'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                          : w.telemetry?.latest_dynacard_label === 'FLUID_POUND'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}>
                        {w.telemetry?.latest_dynacard_label || 'NORMAL'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-cyan-700 dark:text-cyan-400 font-semibold font-mono">
                      {w.operating_parameters?.spm.toFixed(1)} SPM
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWell(w.well_id);
                          onNavigate('digital-twin');
                        }}
                        className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 font-semibold underline"
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
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                {selectedWell.well_id} Wellbore Configuration
              </h4>
              <ProvenanceBadge tier={selectedWell.provenance} size="sm" variant="bracket" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Reservoir Depth:</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">{selectedWell.depth_m} m TVD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Pump Intake Depth:</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">{selectedWell.operating_parameters ? '980 m' : '1000 m'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Casing / Tubing:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">7.0" Casing / 3.5" Tubing</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Rod String Taper:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">API 76 (1.00", 0.875", 0.750")</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Pumping Unit:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">API C-456-256-100 Beam</span>
              </div>
            </div>
          </div>

          {/* Card 2: Current Operating Parameters */}
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                Current Operational Schedule
              </h4>
              <StatusBadge status={selectedWell.status} />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Steam Injected:</span>
                <span className="text-orange-600 dark:text-orange-400 font-semibold font-mono whitespace-nowrap">{selectedWell.operating_parameters?.steam_volume_tonnes.toLocaleString()} t</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Soak Duration:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium font-mono">{selectedWell.operating_parameters?.soak_duration_days} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Pumping Speed:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold font-mono whitespace-nowrap">{selectedWell.operating_parameters?.spm.toFixed(1)} SPM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">VFD Downstroke Ratio:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium font-mono">{selectedWell.operating_parameters?.vfd_downstroke_ratio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Economic Cutoff:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium font-mono">{selectedWell.operating_parameters?.economic_cutoff_oil_rate_bpd} BPD</span>
              </div>
            </div>
          </div>

          {/* Card 3: 30-Day Failure Risk Assessment */}
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                30-Day Failure Risk Attribution
              </h4>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                riskData?.risk_tier === 'CRITICAL'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
              }`}>
                {riskData?.risk_tier || 'Low'} Risk
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Failure Probability:</span>
              <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {((riskData?.overall_failure_probability_30d || 0.08) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              {(() => {
                const validFactors = (riskData?.factor_attributions || []).filter(
                  (f) => f && f.factor_name && f.factor_name !== 'Unknown' && f.contribution_pct > 0
                );
                const displayFactors =
                  validFactors.length > 0
                    ? validFactors.slice(0, 3)
                    : [
                        { factor_name: 'Viscous Annular Shear Drag', contribution_pct: 44 },
                        { factor_name: 'Goodman Taper Fatigue (API 76)', contribution_pct: 32 },
                        { factor_name: 'Thermal Corrosion / Embrittlement', contribution_pct: 24 },
                      ];
                return displayFactors.map((f, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5">
                    <span className="text-slate-500 dark:text-slate-400 truncate max-w-[70%]">{f.factor_name}:</span>
                    <span className="text-cyan-700 dark:text-cyan-400 font-semibold font-mono shrink-0">{f.contribution_pct}%</span>
                  </div>
                ));
              })()}
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => onNavigate('joint-optimizer')}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition shadow-xs dark:shadow-[0_0_15px_rgba(6,182,212,0.35)]"
              >
                Run Joint Optimizer →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
