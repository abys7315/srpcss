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
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Command Center
            </h1>
            <ProvenanceBadge tier="SIMULATED" size="sm" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time monitoring and artificial lift operations across 10 Baghewala Field production wells.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('joint-optimizer')}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition flex items-center gap-2 shadow-xs"
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
          icon={<Flame className="w-4 h-4 text-orange-600" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Avg Steam-Oil Ratio"
          value="3.18"
          unit="t/t"
          subtitle="Target < 3.50"
          delta="-0.42 t/t"
          deltaPositive={true}
          icon={<Gauge className="w-4 h-4 text-blue-600" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Rod Floating Wells"
          value={floatingWells.length}
          unit="Wells"
          subtitle="M_float < 1.0"
          danger={floatingWells.length > 0}
          icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Near Limit Wells"
          value={nearLimitWells.length}
          unit="Wells"
          subtitle="1.0 ≤ M_float < 1.25"
          warning={nearLimitWells.length > 0}
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          provenance="SIMULATED"
        />
        <MetricCard
          title="Surface Units Safe"
          value="10 / 10"
          unit="Units"
          subtitle="API C-456 Beam Torque < 100%"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
          provenance="ASSUMED"
        />
      </div>

      {/* 10-Well Fleet Telemetry Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Fleet Overview & Telemetry Matrix
            </h3>
            <span className="text-xs text-slate-500">
              Live status, fluid viscosity, float margin index, and diagnostic dynacard classifications
            </span>
          </div>
          <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
            Click row to select well
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-medium">
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
            <tbody className="divide-y divide-slate-100">
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
                        ? 'bg-blue-50/60 text-slate-900 border-l-2 border-blue-600'
                        : 'hover:bg-slate-50/80 text-slate-700'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold flex items-center gap-1.5 text-slate-900">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                      {w.well_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      Cycle {w.current_cycle_number}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {w.telemetry?.current_oil_rate_bpd.toFixed(1)} bpd
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {w.telemetry?.current_water_cut_pct.toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3 text-orange-700 font-medium">
                      {w.telemetry?.current_temperature_c.toFixed(1)}°C
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">
                      {w.telemetry?.current_viscosity_cp.toFixed(0)} cP
                    </td>
                    <td className={`py-2.5 px-3 font-bold ${
                      isFloat ? 'text-rose-600 animate-pulse' : isNear ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {floatMargin.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        w.telemetry?.latest_dynacard_label === 'ROD_FLOATING'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : w.telemetry?.latest_dynacard_label === 'FLUID_POUND'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {w.telemetry?.latest_dynacard_label || 'NORMAL'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-blue-700 font-semibold">
                      {w.operating_parameters?.spm.toFixed(1)} SPM
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWell(w.well_id);
                          onNavigate('digital-twin');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
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
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-semibold text-slate-900">
                {selectedWell.well_id} Wellbore Configuration
              </h4>
              <ProvenanceBadge tier={selectedWell.provenance} size="sm" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Reservoir Depth:</span>
                <span className="text-slate-800 font-medium">{selectedWell.depth_m} m TVD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pump Intake Depth:</span>
                <span className="text-slate-800 font-medium">{selectedWell.operating_parameters ? '980 m' : '1000 m'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Casing / Tubing:</span>
                <span className="text-slate-800 font-medium">7.0" Casing / 3.5" Tubing</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rod String Taper:</span>
                <span className="text-slate-800 font-medium">API 76 (1.00", 0.875", 0.750")</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pumping Unit:</span>
                <span className="text-slate-800 font-medium">API C-456-256-100 Beam</span>
              </div>
            </div>
          </div>

          {/* Card 2: Current Operating Parameters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-semibold text-slate-900">
                Current Operational Schedule
              </h4>
              <StatusBadge status={selectedWell.status} />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Steam Injected:</span>
                <span className="text-orange-700 font-semibold">{selectedWell.operating_parameters?.steam_volume_tonnes.toLocaleString()} t</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Soak Duration:</span>
                <span className="text-slate-800 font-medium">{selectedWell.operating_parameters?.soak_duration_days} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pumping Speed:</span>
                <span className="text-blue-700 font-semibold">{selectedWell.operating_parameters?.spm.toFixed(1)} SPM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VFD Downstroke Ratio:</span>
                <span className="text-slate-800 font-medium">{selectedWell.operating_parameters?.vfd_downstroke_ratio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Economic Cutoff:</span>
                <span className="text-slate-800 font-medium">{selectedWell.operating_parameters?.economic_cutoff_oil_rate_bpd} BPD</span>
              </div>
            </div>
          </div>

          {/* Card 3: 30-Day Failure Risk Assessment */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-semibold text-slate-900">
                30-Day Failure Risk Attribution
              </h4>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                riskData?.risk_tier === 'CRITICAL'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {riskData?.risk_tier || 'Low'} Risk
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 font-medium">Failure Probability:</span>
              <span className="text-xl font-bold text-rose-600">
                {((riskData?.overall_failure_probability_30d || 0.08) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              {riskData?.factor_attributions.slice(0, 3).map((f, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-500">{f.factor_name}:</span>
                  <span className="text-blue-700 font-semibold">{f.contribution_pct}%</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-200">
              <button
                onClick={() => onNavigate('joint-optimizer')}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition shadow-xs"
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
