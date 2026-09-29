import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { OptimizationResult, WellDetail } from '../api/types';
import { MetricCard } from '../components/common/MetricCard';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { DomainShiftWarning } from '../components/common/DomainShiftWarning';
import {
  ArrowUpDown,
  Play,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const SRPOptimizer: React.FC<Props> = ({ selectedWellId, onNavigate }) => {
  const [well, setWell] = useState<WellDetail | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // SRP Fast Loop Sliders
  const [spm, setSpm] = useState<number>(4.5);
  const [strokeLength, setStrokeLength] = useState<number>(100);
  const [vfdRatio, setVfdRatio] = useState<number>(1.0);

  useEffect(() => {
    loadData();
  }, [selectedWellId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const w = await apiClient.getWell(selectedWellId);
      setWell(w);
      if (w.operating_parameters) {
        setSpm(w.operating_parameters.spm);
        setStrokeLength(w.operating_parameters.stroke_length_inch);
        setVfdRatio(w.operating_parameters.vfd_downstroke_ratio);
      }
      const opt = await apiClient.optimizeSRP({
        well_id: selectedWellId,
        spm: w.operating_parameters?.spm || 4.5,
        stroke_length_inch: w.operating_parameters?.stroke_length_inch || 100,
        vfd_downstroke_ratio: w.operating_parameters?.vfd_downstroke_ratio || 1.0,
      });
      setResult(opt);
    } catch (e) {
      console.error('Failed to load SRP optimizer data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSRP = async () => {
    try {
      setLoading(true);
      const opt = await apiClient.optimizeSRP({
        well_id: selectedWellId,
        spm,
        stroke_length_inch: strokeLength,
        vfd_downstroke_ratio: vfdRatio,
      });
      setResult(opt);
    } catch (e) {
      console.error('SRP optimization failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Physics calculations for the UI display
  const viscosityCp = well?.telemetry?.current_viscosity_cp || 2400.0;
  // Submerged weight of API 76 taper rod string in oil (~980m pump depth): ~5,800 lbs
  const submergedWeightLbs = 5800.0;
  // Drag force ~ mu * v_down: v_down is proportional to (strokeLength * spm / vfdRatio)
  const effectiveDownstrokeSpm = spm / vfdRatio;
  const maxDownstrokeVelocityFps = (strokeLength / 12) * Math.PI * (effectiveDownstrokeSpm / 60);
  const viscousDragLbs = (viscosityCp / 1000) * maxDownstrokeVelocityFps * 3200;
  const currentFloatMargin = submergedWeightLbs / Math.max(viscousDragLbs, 1.0);
  const isFloating = currentFloatMargin < 1.0;

  // Peak Polished Rod Load (PPRL) proxy
  const fluidLoadLbs = 6800;
  const rodWeightLbs = 8600;
  const accelerationFactor = (strokeLength * Math.pow(spm, 2)) / 70500;
  const pprlLbs = (rodWeightLbs + fluidLoadLbs) * (1 + accelerationFactor);
  const maxPprlLimit = 28000;

  // Goodman stress ratio proxy
  const minLoadLbs = rodWeightLbs * (1 - accelerationFactor) - viscousDragLbs;
  const rodAreaSqIn = 0.785; // 1-inch top rod
  const maxStressPsi = pprlLbs / rodAreaSqIn;
  const minStressPsi = Math.max(0, minLoadLbs) / rodAreaSqIn;
  const goodmanRatio = (maxStressPsi - 0.5625 * minStressPsi) / 38000; // API Spec 11B Grade D rod

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-blue-600" />
              Sucker Rod Pump (SRP) Optimizer
            </h1>
            <ProvenanceBadge tier={result?.provenance || 'SIMULATED'} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lifting kinematics, variable frequency drive downstroke profile, and rod float prevention for well{' '}
            <strong className="text-slate-900 font-semibold">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={handleRunSRP}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Optimizing Lift Dynamics...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Optimize Pumping Parameters</span>
            </>
          )}
        </button>
      </div>

      <DomainShiftWarning />

      {/* Floating Alert Banner if floating occurs */}
      {isFloating ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 shadow-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-rose-800">
              Sucker Rod Float Warning (Margin Index = {currentFloatMargin.toFixed(3)} &lt; 1.000)
            </h3>
            <p className="text-xs text-rose-700 leading-relaxed">
              Viscous drag force ({viscousDragLbs.toFixed(0)} lbs) exceeds submerged rod string weight ({submergedWeightLbs} lbs).
              The polished rod clamp risks departing from the carrier bar on downstroke, risking rod buckle and fatigue failure.
            </p>
            <div className="pt-1 flex items-center gap-2">
              <span className="text-xs text-rose-800 font-medium">Recommended:</span>
              <button
                onClick={() => {
                  setVfdRatio(0.70);
                  setSpm(3.5);
                }}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-all shadow-xs"
              >
                Apply VFD Downstroke Shaping (0.70x, 3.5 SPM)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Pumping Feasible & Safe:</strong> Float margin index is {currentFloatMargin.toFixed(3)} (safety limit ≥ 1.000). Rod string sinks cleanly through heavy crude.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Float Margin Index"
          value={currentFloatMargin.toFixed(3)}
          unit="Limit ≥ 1.000"
          delta={isFloating ? 'Rod floating detected' : 'Clear downstroke sink'}
          danger={isFloating}
          warning={!isFloating && currentFloatMargin < 1.25}
          deltaPositive={!isFloating}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Peak Polished Rod Load"
          value={`${Math.round(pprlLbs).toLocaleString()} lbs`}
          unit={`API Max: ${maxPprlLimit.toLocaleString()} lbs`}
          delta={`${((pprlLbs / maxPprlLimit) * 100).toFixed(1)}% Structural loading`}
          danger={pprlLbs > maxPprlLimit}
          deltaPositive={pprlLbs <= maxPprlLimit}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Goodman Stress Ratio"
          value={goodmanRatio.toFixed(2)}
          unit="API 11B Limit ≤ 0.85"
          delta="Grade D Sucker Rod Steel"
          danger={goodmanRatio > 0.85}
          deltaPositive={goodmanRatio <= 0.85}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Downstroke Velocity"
          value={`${maxDownstrokeVelocityFps.toFixed(2)} ft/s`}
          unit={`VFD Ratio: ${vfdRatio.toFixed(2)}x`}
          delta={vfdRatio < 1.0 ? 'VFD Downstroke Softened' : 'Standard Sinusoidal'}
          deltaPositive={true}
          provenance="SIMULATED"
        />
      </div>

      {/* Main Grid: Controls + VFD Crank Kinematics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-blue-600" />
            Artificial Lift Parameters
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Pumping Speed (SPM):</span>
                <span className="text-blue-700 font-semibold">{spm.toFixed(1)} SPM</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="8.0"
                step="0.1"
                value={spm}
                onChange={(e) => setSpm(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>1.5 SPM (Slow)</span>
                <span>8.0 SPM (High Drag Risk)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Stroke Length:</span>
                <span className="text-blue-700 font-semibold">{strokeLength} Inches</span>
              </div>
              <input
                type="range"
                min="64"
                max="120"
                step="2"
                value={strokeLength}
                onChange={(e) => setStrokeLength(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>64" Stroke</span>
                <span>120" Stroke (C-456 Unit)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>VFD Downstroke Ratio (α_down):</span>
                <span className="text-emerald-700 font-semibold">{vfdRatio.toFixed(2)}x Speed</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="1.00"
                step="0.05"
                value={vfdRatio}
                onChange={(e) => setVfdRatio(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0.50x (Soft Descent)</span>
                <span>1.00x (Uniform Speed)</span>
              </div>
            </div>
          </div>

          {/* Sucker Rod Hardware Info */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
            <span className="text-xs font-semibold text-slate-900 block">
              Baghewala Rod String & Unit Spec
            </span>
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Rod Taper:</span>
                <span className="text-slate-900 font-medium">API 76 (1", 7/8", 3/4")</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Surface Unit:</span>
                <span className="text-slate-900 font-medium">C-456-256-100 (Conventional)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gearbox Torque:</span>
                <span className="text-slate-900 font-medium">456,000 in-lbs (API 11E)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pump Bore:</span>
                <span className="text-slate-900 font-medium">2.25 inch (RHAM)</span>
              </div>
            </div>
          </div>
        </div>

        {/* VFD Velocity Kinematics SVG */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600" />
              VFD Velocity Kinematics vs Crank Angle (0° to 360°)
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Upstroke (0°-180°) / Downstroke (180°-360°)</span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 500 240" className="w-full h-60 bg-slate-50 rounded-lg border border-slate-200">
              {/* Grid Lines */}
              <line x1="50" y1="50" x2="470" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="50" y1="120" x2="470" y2="120" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="50" y1="190" x2="470" y2="190" stroke="#e2e8f0" strokeDasharray="3 3" />

              <line x1="260" y1="30" x2="260" y2="210" stroke="#cbd5e1" strokeDasharray="3 3" />

              {/* Labels */}
              <text x="150" y="45" fill="#2563eb" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                UPSTROKE (Lifting Fluid)
              </text>
              <text x="370" y="45" fill={isFloating ? '#dc2626' : '#059669'} fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                DOWNSTROKE (Rod Descent)
              </text>

              {/* Base Sinusoidal curve (Unmodified VFD ratio = 1.0) */}
              <path
                d="M 50 120 Q 155 40 260 120 Q 365 200 470 120"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* VFD Modified Velocity Curve */}
              {/* Upstroke maintains normal velocity; Downstroke amplitude is scaled by vfdRatio */}
              <path
                d={`M 50 120 Q 155 40 260 120 Q 365 ${120 + 80 * vfdRatio} 470 120`}
                fill="none"
                stroke={isFloating ? '#dc2626' : '#2563eb'}
                strokeWidth="2.5"
              />

              {/* Zero line marker */}
              <text x="40" y="123" fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
                0 ft/s
              </text>
              <text x="40" y="55" fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
                +V_max
              </text>
              <text x="40" y="195" fill="#64748b" fontSize="9" fontFamily="monospace" textAnchor="end">
                -V_max
              </text>

              {/* Floating Danger Threshold Line on Downstroke */}
              {/* Rod terminal sinking velocity is ~2.8 ft/s */}
              <line x1="260" y1={120 + 80 * 0.85} x2="470" y2={120 + 80 * 0.85} stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1.5" />
              <text x="465" y={120 + 80 * 0.85 - 5} fill="#ef4444" fontSize="8" fontFamily="monospace" textAnchor="end">
                Rod Terminal Sinking Velocity Limit (Float Danger)
              </text>
            </svg>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-800 font-medium">
              <Zap className="w-4 h-4 text-amber-600" />
              Electric Motor Load: <strong>32.4 HP (Motor Rating: 50 HP NEMA D)</strong>
            </span>
            <button
              onClick={() => onNavigate && onNavigate('digital-twin')}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 underline font-semibold"
            >
              Verify Dynacard Shape in Digital Twin <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
