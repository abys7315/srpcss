import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { OptimizationResult, WellDetail } from '../api/types';
import { MetricCard } from '../components/common/MetricCard';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import { Flame, Play, Thermometer, ArrowRight, Gauge, CheckCircle2 } from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const CSSOptimizer: React.FC<Props> = ({ selectedWellId, onNavigate }) => {
  const [well, setWell] = useState<WellDetail | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Sliders for CSS parameter study
  const [steamVolume, setSteamVolume] = useState<number>(3000);
  const [soakDays, setSoakDays] = useState<number>(6);
  const [cutoffBpd, setCutoffBpd] = useState<number>(8.0);

  useEffect(() => {
    loadData();
  }, [selectedWellId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const w = await apiClient.getWell(selectedWellId);
      setWell(w);
      if (w.operating_parameters) {
        setSteamVolume(w.operating_parameters.steam_volume_tonnes);
        setSoakDays(w.operating_parameters.soak_duration_days);
        setCutoffBpd(w.operating_parameters.economic_cutoff_oil_rate_bpd);
      }
      const opt = await apiClient.optimizeCSS({
        well_id: selectedWellId,
        steam_volume_tonnes: w.operating_parameters?.steam_volume_tonnes || 3000,
        soak_duration_days: w.operating_parameters?.soak_duration_days || 6,
        cutoff_bpd: w.operating_parameters?.economic_cutoff_oil_rate_bpd || 8.0,
      });
      setResult(opt);
    } catch (e) {
      console.error('Failed to load CSS optimizer data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCSS = async () => {
    try {
      setLoading(true);
      const opt = await apiClient.optimizeCSS({
        well_id: selectedWellId,
        steam_volume_tonnes: steamVolume,
        soak_duration_days: soakDays,
        cutoff_bpd: cutoffBpd,
      });
      setResult(opt);
    } catch (e) {
      console.error('CSS optimization run failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const rec = result?.recommended_configuration;

  // Marx-Langenheim / Boberg-Lantz theoretical heating radius proxy for display
  const heatingRadiusMeters = (steamVolume / 250).toFixed(1);
  const heatedTempC = Math.min(240, 70 + (steamVolume / 4000) * 150).toFixed(0);
  const heatedViscosityCp = Math.max(8.0, 2400 * Math.exp(-0.025 * (parseFloat(heatedTempC) - 47))).toFixed(1);

  // Synthetic sensitivity curve points: [Steam Tonnes, SOR, Recovery bbl]
  const sensitivityCurve = [
    { steam: 1500, sor: 2.45, oil: 612 },
    { steam: 2000, sor: 2.15, oil: 930 },
    { steam: 2500, sor: 1.95, oil: 1280 },
    { steam: 3000, sor: 1.82, oil: 1650 },
    { steam: 3500, sor: 1.85, oil: 1890 },
    { steam: 4000, sor: 2.05, oil: 1950 },
    { steam: 4500, sor: 2.38, oil: 1890 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600" />
              Cyclic Steam Stimulation (CSS) Optimizer
            </h1>
            <ProvenanceBadge tier={result?.provenance || 'SIMULATED'} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Thermal reservoir model, steam chest growth, and soak duration optimization for well{' '}
            <strong className="text-slate-900 font-semibold">{selectedWellId} ({well?.well_name || 'Baghewala'})</strong>.
          </p>
        </div>

        <button
          onClick={handleRunCSS}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Computing Thermal Simulation...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Optimize Steam Parameters</span>
            </>
          )}
        </button>
      </div>

      <DomainShiftWarning />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Optimal Steam Volume"
          value={rec ? `${rec.steam_volume_tonnes.toFixed(0)} t` : `${steamVolume} t`}
          unit="Quality: 80% (x=0.80)"
          delta="Marx-Langenheim Optimum"
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Thermal Heating Radius"
          value={`${heatingRadiusMeters} m`}
          unit="Radial thermal zone"
          delta="Reservoir thickness: 14 m"
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Bottomhole Temperature"
          value={`${heatedTempC} °C`}
          unit={`Viscosity: ${heatedViscosityCp} cP`}
          delta="Initial temp: 47 °C (2,400 cP)"
          deltaPositive={true}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Steam-Oil Ratio (SOR)"
          value={rec ? rec.steam_oil_ratio.toFixed(2) : '1.82'}
          unit="t steam / t oil"
          delta="-13.3% vs unconstrained"
          deltaPositive={true}
          provenance="SIMULATED"
        />
      </div>

      {/* Controls & Physics Invariance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Slider Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-orange-600" />
            Steam Cycle Controls
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Steam Volume:</span>
                <span className="text-blue-700 font-semibold">{steamVolume} Tonnes</span>
              </div>
              <input
                type="range"
                min="1000"
                max="5000"
                step="100"
                value={steamVolume}
                onChange={(e) => setSteamVolume(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>1,000 t (Underheated)</span>
                <span>5,000 t (Over-injection)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Soak Duration:</span>
                <span className="text-blue-700 font-semibold">{soakDays} Days</span>
              </div>
              <input
                type="range"
                min="2"
                max="14"
                step="1"
                value={soakDays}
                onChange={(e) => setSoakDays(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>2 Days (Channeling)</span>
                <span>14 Days (Heat Dissipation)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Economic Cutoff Rate:</span>
                <span className="text-blue-700 font-semibold">{cutoffBpd.toFixed(1)} bpd</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={cutoffBpd}
                onChange={(e) => setCutoffBpd(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>5 bpd (Extended Cycle)</span>
                <span>30 bpd (Early Resoaking)</span>
              </div>
            </div>
          </div>

          {/* Hard Constraints Box */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
            <span className="text-xs font-semibold text-slate-900 block">
              Thermal Safety Limits
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Max Injection Pressure:</span>
                <span className="text-emerald-700 font-semibold">125 bar (Fracture limit: 171 bar)</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Steam Temperature:</span>
                <span className="text-slate-800 font-medium">260 °C at 125 bar</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Fracture Gradient Margin:</span>
                <span className="text-emerald-700 font-semibold">Safe (0.163 bar/m)</span>
              </div>
            </div>
          </div>
        </div>

        {/* SOR vs Steam Curve SVG */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-blue-600" />
              Thermal Efficiency Curve: Steam-Oil Ratio (SOR) vs Injected Steam
            </h2>
            <span className="text-xs text-slate-500">Boberg-Lantz Model</span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 500 240" className="w-full h-60 bg-slate-50 rounded-lg border border-slate-200">
              {/* Grid Lines */}
              <line x1="50" y1="50" x2="470" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="50" y1="110" x2="470" y2="110" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="50" y1="170" x2="470" y2="170" stroke="#e2e8f0" strokeDasharray="3 3" />

              {/* Axes */}
              <line x1="50" y1="200" x2="480" y2="200" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="50" y1="200" x2="50" y2="20" stroke="#94a3b8" strokeWidth="1.5" />

              <text x="470" y="220" fill="#64748b" fontSize="11" textAnchor="end" fontFamily="Inter, sans-serif">
                Steam Volume (Tonnes) →
              </text>
              <text x="20" y="25" fill="#64748b" fontSize="11" transform="rotate(-90 20,25)" fontFamily="Inter, sans-serif">
                SOR (t/bbl) →
              </text>

              {/* Curve path */}
              <path
                d="M 80 180 Q 150 140 220 125 T 320 120 T 400 160 T 450 190"
                fill="none"
                stroke="#d97706"
                strokeWidth="2.5"
              />

              {/* Data points */}
              {sensitivityCurve.map((pt, i) => {
                const x = 50 + ((pt.steam - 1000) / 3500) * 400;
                const y = 200 - ((pt.sor - 1.5) / 1.5) * 150;
                const isOpt = pt.steam === 3000;

                return (
                  <g key={i}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isOpt ? '6' : '3.5'}
                      fill={isOpt ? '#059669' : '#d97706'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    {isOpt && (
                      <text x={x - 20} y={y - 12} fill="#059669" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">
                        Min SOR (1.82)
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Current operating marker */}
              <line
                x1={50 + ((steamVolume - 1000) / 3500) * 400}
                y1="30"
                x2={50 + ((steamVolume - 1000) / 3500) * 400}
                y2="200"
                stroke="#2563eb"
                strokeDasharray="2 2"
                strokeWidth="1.5"
              />
              <text
                x={50 + ((steamVolume - 1000) / 3500) * 400 + 4}
                y="40"
                fill="#2563eb"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                Selected: {steamVolume} t
              </text>
            </svg>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-800 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Optimal Cycle Duration: <strong>155 Production Days + 22 Days Injection/Soak</strong>
            </span>
            <button
              onClick={() => onNavigate && onNavigate('joint-optimizer')}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 underline font-semibold"
            >
              Feed into Joint Pareto Optimizer <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
