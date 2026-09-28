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
  const viscosityCp = well?.telemetry?.current_viscosity_cp || 1200;
  // Submerged weight of API 76 taper rod string in oil (~950m depth): ~7,200 lbs
  const submergedWeightLbs = 7200;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono text-slate-100 flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-cyan-400" />
              SUCKER ROD PUMP (SRP) LIFT & ANTI-FLOAT OPTIMIZER
            </h1>
            <ProvenanceBadge tier={result?.provenance || 'SIMULATED'} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fast-loop lifting optimization, VFD downstroke kinematic profile shaping, and Gibbs wave rod-floating prevention for{' '}
            <strong className="text-slate-200 font-mono">{selectedWellId}</strong>.
          </p>
        </div>

        <button
          onClick={handleRunSRP}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-mono text-xs font-bold rounded-lg shadow-lg shadow-cyan-950/50 transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>OPTIMIZING LIFT DYNAMICS...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>OPTIMIZE SRP FAST LOOP</span>
            </>
          )}
        </button>
      </div>

      <DomainShiftWarning />

      {/* Floating Alert Banner if floating occurs */}
      {isFloating ? (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-600/80 shadow-lg shadow-rose-950/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold font-mono uppercase text-rose-200">
              CRITICAL: SUCKER ROD FLOATING DETECTED (M_float = {currentFloatMargin.toFixed(3)} &lt; 1.000)
            </h3>
            <p className="text-xs text-rose-300">
              Viscous drag force ({viscousDragLbs.toFixed(0)} lbs) exceeds submerged rod string weight ({submergedWeightLbs} lbs).
              The polished rod clamp is departing from the carrier bar on downstroke, risking catastrophic rod buckle and fatigue failure.
            </p>
            <div className="pt-1 flex items-center gap-2">
              <span className="text-xs font-mono text-rose-300 font-semibold">Immediate Fix:</span>
              <button
                onClick={() => {
                  setVfdRatio(0.70);
                  setSpm(3.5);
                }}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-slate-950 text-xs font-mono font-bold transition-all"
              >
                APPLY VFD DOWNSTROKE SHAPING (0.70x Ratio, 3.5 SPM)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-2 text-emerald-300 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>PUMPING FEASIBLE & SAFE:</strong> Float Margin Index is {currentFloatMargin.toFixed(3)} (Safety limit ≥ 1.000). Rod string sinks cleanly through heavy crude.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Float Margin Index (M_float)"
          value={currentFloatMargin.toFixed(3)}
          unit="Limit: ≥ 1.000"
          delta={isFloating ? 'ROD FLOATING DETECTED' : 'CLEAR DOWNSTROKE SINK'}
          danger={isFloating}
          warning={!isFloating && currentFloatMargin < 1.25}
          deltaPositive={!isFloating}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Peak Polished Rod Load (PPRL)"
          value={`${Math.round(pprlLbs).toLocaleString()} lbs`}
          unit={`API Max: ${maxPprlLimit.toLocaleString()} lbs`}
          delta={`${((pprlLbs / maxPprlLimit) * 100).toFixed(1)}% Structural Loading`}
          danger={pprlLbs > maxPprlLimit}
          deltaPositive={pprlLbs <= maxPprlLimit}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Goodman Stress Ratio"
          value={goodmanRatio.toFixed(2)}
          unit="API 11B Limit: ≤ 0.80"
          delta="Grade D Sucker Rod Steel"
          danger={goodmanRatio > 0.80}
          deltaPositive={goodmanRatio <= 0.80}
          provenance="SIMULATED"
        />

        <MetricCard
          title="Downstroke Velocity (VFD)"
          value={`${maxDownstrokeVelocityFps.toFixed(2)} ft/s`}
          unit={`Ratio: ${vfdRatio.toFixed(2)}x`}
          delta={vfdRatio < 1.0 ? 'VFD Downstroke Softened' : 'Standard Sinusoidal'}
          deltaPositive={true}
          provenance="SIMULATED"
        />
      </div>

      {/* Main Grid: Controls + VFD Crank Kinematics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Artificial Lift Parameters
          </h2>

          <div className="space-y-4 text-xs font-mono">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Pumping Speed (SPM):</span>
                <span className="text-cyan-400 font-bold">{spm.toFixed(1)} SPM</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="8.0"
                step="0.1"
                value={spm}
                onChange={(e) => setSpm(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>1.5 SPM (Slow)</span>
                <span>8.0 SPM (High Drag Risk)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Stroke Length:</span>
                <span className="text-cyan-400 font-bold">{strokeLength} Inches</span>
              </div>
              <input
                type="range"
                min="64"
                max="120"
                step="2"
                value={strokeLength}
                onChange={(e) => setStrokeLength(parseInt(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>64" Stroke</span>
                <span>120" Stroke (C-456 Unit)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>VFD Downstroke Shaping (α_down):</span>
                <span className="text-emerald-400 font-bold">{vfdRatio.toFixed(2)}x Speed</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="1.00"
                step="0.05"
                value={vfdRatio}
                onChange={(e) => setVfdRatio(parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>0.50x (Ultra Soft Descent)</span>
                <span>1.00x (Uniform AC Speed)</span>
              </div>
            </div>
          </div>

          {/* Sucker Rod Hardware Info */}
          <div className="p-3 bg-industrial-950/80 rounded-lg border border-industrial-800 space-y-2 text-xs font-mono">
            <span className="text-[11px] font-bold text-slate-300 block uppercase">
              Baghewala Rod String & Unit Spec
            </span>
            <div className="space-y-1 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Rod Taper:</span>
                <span className="text-slate-200">API 76 (1", 7/8", 3/4")</span>
              </div>
              <div className="flex justify-between">
                <span>Surface Unit:</span>
                <span className="text-slate-200">C-456-256-100 (Conventional)</span>
              </div>
              <div className="flex justify-between">
                <span>Gearbox Torque Rating:</span>
                <span className="text-slate-200">456,000 in-lbs (API 11E)</span>
              </div>
              <div className="flex justify-between">
                <span>Pump Bore:</span>
                <span className="text-slate-200">2.25 inch (RHAM)</span>
              </div>
            </div>
          </div>
        </div>

        {/* VFD Velocity Kinematics SVG */}
        <div className="lg:col-span-2 glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              VFD Velocity Kinematics vs Crank Angle (0° to 360°)
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Upstroke (0°-180°) / Downstroke (180°-360°)</span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 500 240" className="w-full h-60 bg-industrial-950/60 rounded-lg border border-industrial-800">
              {/* Grid Lines */}
              <line x1="50" y1="50" x2="470" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="50" y1="120" x2="470" y2="120" stroke="#475569" strokeWidth="1.5" />
              <line x1="50" y1="190" x2="470" y2="190" stroke="#1e293b" strokeDasharray="3 3" />

              <line x1="260" y1="30" x2="260" y2="210" stroke="#334155" strokeDasharray="3 3" />

              {/* Labels */}
              <text x="150" y="45" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                UPSTROKE (Lifting Fluid)
              </text>
              <text x="370" y="45" fill={isFloating ? '#f43f5e' : '#10b981'} fontSize="10" fontFamily="monospace" textAnchor="middle">
                DOWNSTROKE (Rod Descent)
              </text>

              {/* Base Sinusoidal curve (Unmodified VFD ratio = 1.0) */}
              <path
                d="M 50 120 Q 155 40 260 120 Q 365 200 470 120"
                fill="none"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* VFD Modified Velocity Curve */}
              {/* Upstroke maintains normal velocity; Downstroke amplitude is scaled by vfdRatio */}
              <path
                d={`M 50 120 Q 155 40 260 120 Q 365 ${120 + 80 * vfdRatio} 470 120`}
                fill="none"
                stroke={isFloating ? '#f43f5e' : '#22d3ee'}
                strokeWidth="2.5"
              />

              {/* Zero line marker */}
              <text x="40" y="123" fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="end">
                0 ft/s
              </text>
              <text x="40" y="55" fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="end">
                +V_max
              </text>
              <text x="40" y="195" fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="end">
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

          <div className="p-3 bg-industrial-900 rounded-lg border border-industrial-800 text-xs text-slate-400 font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Zap className="w-4 h-4 text-cyan-400" />
              Electric Motor Load: <strong>32.4 HP (Motor Rating: 50 HP NEMA D)</strong>
            </span>
            <button
              onClick={() => onNavigate && onNavigate('digital-twin')}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
            >
              Verify Dynacard Shape in Digital Twin <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
