import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { SimulationResult, WellDetail } from '../api/types';
import { DynacardPlot } from '../components/common/DynacardPlot';
import { WellboreSchematic } from '../components/common/WellboreSchematic';
import { MetricCard } from '../components/common/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { Play, RotateCcw, AlertTriangle, ShieldCheck, Flame, Droplets, Gauge, Zap } from 'lucide-react';

interface Props {
  selectedWellId: string;
}

export const DigitalTwin: React.FC<Props> = ({ selectedWellId }) => {
  const [well, setWell] = useState<WellDetail | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCardPhase, setSelectedCardPhase] = useState<'day_10' | 'day_60' | 'final'>('final');

  // Interactive Simulation Controls
  const [steamVolume, setSteamVolume] = useState<number>(3000);
  const [soakDays, setSoakDays] = useState<number>(6);
  const [spm, setSpm] = useState<number>(4.5);
  const [vfdRatio, setVfdRatio] = useState<number>(1.0);
  const [anomalyDay, setAnomalyDay] = useState<number | null>(null);

  useEffect(() => {
    loadWellAndSimulate();
  }, [selectedWellId]);

  const loadWellAndSimulate = async () => {
    try {
      setLoading(true);
      const w = await apiClient.getWell(selectedWellId);
      setWell(w);
      if (w.operating_parameters) {
        setSteamVolume(w.operating_parameters.steam_volume_tonnes);
        setSoakDays(w.operating_parameters.soak_duration_days);
        setSpm(w.operating_parameters.spm);
        setVfdRatio(w.operating_parameters.vfd_downstroke_ratio);
      }
      await runSim(w.operating_parameters?.steam_volume_tonnes || 3000, w.operating_parameters?.soak_duration_days || 6, w.operating_parameters?.spm || 4.5, w.operating_parameters?.vfd_downstroke_ratio || 1.0, null);
    } catch (e) {
      console.error('Failed to load well:', e);
    } finally {
      setLoading(false);
    }
  };

  const runSim = async (st: number, sk: number, speed: number, vfd: number, anom: number | null) => {
    try {
      setLoading(true);
      const res = await apiClient.simulateCycle({
        well_id: selectedWellId,
        cycle_number: 1,
        steam_volume_tonnes: st,
        injection_duration_days: 14.0,
        injection_pressure_bar: 125.0,
        steam_temp_celsius: 260.0,
        soak_duration_days: sk,
        production_duration_days: 180.0,
        economic_cutoff_oil_rate_bpd: 7.0,
        spm: speed,
        stroke_length_inch: 100.0,
        vfd_downstroke_ratio: vfd,
        cooling_anomaly_day: anom,
        cooling_anomaly_severity_pct: anom ? 35.0 : 0.0
      });
      setSimResult(res);
    } catch (e) {
      console.error('Simulation error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSimulation = () => {
    runSim(steamVolume, soakDays, spm, vfdRatio, anomalyDay);
  };

  const activeDynacard = simResult?.dynacards[selectedCardPhase] || simResult?.dynacards['final'];
  const minFloat = simResult?.kpis.min_float_margin_index || 1.5;
  const isRodFloating = minFloat < 1.0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 uppercase font-mono">
              Digital Twin Simulation Laboratory — {selectedWellId}
            </h1>
            <ProvenanceBadge tier="SIMULATED" size="sm" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            First-principles thermal-inflow-rod dynamics twin coupling Marx-Langenheim heat transfer with Gibbs damped wave equations.
          </p>
        </div>

        {simResult && (
          <div className="flex items-center gap-2">
            <StatusBadge status={simResult.status} />
          </div>
        )}
      </div>

      {/* Main Grid: Control Panel + Schematic + Dynacards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controls Column (4 cols) */}
        <div className="lg:col-span-4 glass-panel rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Operational Setpoint Controls
            </h3>
            <span className="text-[11px] font-mono text-cyan-400">Interactive Inputs</span>
          </div>

          {/* Steam Volume Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Steam Injection:</span>
              <span className="text-orange-400 font-bold">{steamVolume.toLocaleString()} Tonnes</span>
            </div>
            <input
              type="range"
              min="1000"
              max="5000"
              step="100"
              value={steamVolume}
              onChange={(e) => setSteamVolume(Number(e.target.value))}
              className="w-full accent-orange-500 bg-industrial-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1,000 t</span>
              <span>3,000 t (Nominal)</span>
              <span>5,000 t</span>
            </div>
          </div>

          {/* Soak Duration Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Soak Period:</span>
              <span className="text-slate-200 font-bold">{soakDays} Days</span>
            </div>
            <input
              type="range"
              min="3"
              max="14"
              step="1"
              value={soakDays}
              onChange={(e) => setSoakDays(Number(e.target.value))}
              className="w-full accent-cyan-500 bg-industrial-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>3 d (Min)</span>
              <span>6 d</span>
              <span>14 d (Max)</span>
            </div>
          </div>

          {/* Pumping Speed (SPM) Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Pumping Speed:</span>
              <span className={`font-bold ${spm >= 5.0 ? 'text-amber-400' : 'text-cyan-400'}`}>{spm.toFixed(1)} SPM</span>
            </div>
            <input
              type="range"
              min="1.5"
              max="6.5"
              step="0.1"
              value={spm}
              onChange={(e) => setSpm(Number(e.target.value))}
              className="w-full accent-cyan-500 bg-industrial-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1.5 SPM</span>
              <span>4.5 SPM</span>
              <span>6.5 SPM (High Risk)</span>
            </div>
          </div>

          {/* VFD Asymmetric Downstroke Ratio Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">VFD Downstroke Ratio:</span>
              <span className={`font-bold ${vfdRatio < 0.85 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {vfdRatio.toFixed(2)} {vfdRatio < 1.0 ? '(Slow Downstroke)' : '(Symmetric)'}
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.2"
              step="0.05"
              value={vfdRatio}
              onChange={(e) => setVfdRatio(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-industrial-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.50 (Max Slow)</span>
              <span>0.75 (Recommended)</span>
              <span>1.00 (Standard)</span>
            </div>
          </div>

          {/* Seed Cooling Anomaly Checkbox */}
          <div className="pt-2 border-t border-industrial-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-300">
              <input
                type="checkbox"
                checked={anomalyDay !== null}
                onChange={(e) => setAnomalyDay(e.target.checked ? 40 : null)}
                className="rounded accent-rose-500 bg-industrial-900"
              />
              <span>Simulate Unmodeled Heat Leak at Day 40</span>
            </label>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              Tests sudden reservoir thermal loss and verifies dynamic rod floating trigger.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              {loading ? 'Simulating Physics...' : 'Run Simulation'}
            </button>
            <button
              onClick={() => {
                setSteamVolume(3000);
                setSoakDays(6);
                setSpm(4.5);
                setVfdRatio(1.0);
                setAnomalyDay(null);
                runSim(3000, 6, 4.5, 1.0, null);
              }}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-industrial-700"
              title="Reset Controls"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2D Schematic Column (3 cols) */}
        <div className="lg:col-span-3">
          <WellboreSchematic
            depthM={well?.depth_m || 1050}
            pumpDepthM={980}
            temperatureC={simResult ? Math.round(simResult.timeseries[simResult.timeseries.length - 1]?.bottomhole_temperature_c || 65) : 85}
            viscosityCp={simResult ? Math.round(simResult.timeseries[simResult.timeseries.length - 1]?.oil_viscosity_cp || 1200) : 280}
            heatedRadiusM={simResult ? Math.min(22, Math.max(8, steamVolume * 0.005)) : 14.5}
            isFloating={isRodFloating}
          />
        </div>

        {/* Dynacard Player Column (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Dynacard Phase Selector */}
          <div className="flex items-center justify-between glass-panel rounded-lg p-1.5 px-3">
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">Card Stage:</span>
            <div className="flex gap-1">
              {(['day_10', 'day_60', 'final'] as const).map((phase) => (
                <button
                  key={phase}
                  onClick={() => setSelectedCardPhase(phase)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition ${
                    selectedCardPhase === phase
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {phase === 'day_10' ? 'Early (Day 10)' : phase === 'day_60' ? 'Mid (Day 60)' : 'Cutoff / Final'}
                </button>
              ))}
            </div>
          </div>

          <DynacardPlot
            card={activeDynacard}
            title={`${selectedWellId} Dynacard — ${selectedCardPhase.toUpperCase().replace('_', ' ')}`}
          />
        </div>
      </div>

      {/* KPI Metric Cards */}
      {simResult && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard
            title="Total Oil Produced"
            value={simResult.kpis.total_oil_produced_bbl.toLocaleString()}
            unit="BBL"
            icon={<Droplets className="w-4 h-4 text-emerald-400" />}
            provenance="SIMULATED"
          />
          <MetricCard
            title="Steam-Oil Ratio (SOR)"
            value={simResult.kpis.steam_oil_ratio.toFixed(2)}
            unit="t/t"
            subtitle="Industry target < 3.5"
            warning={simResult.kpis.steam_oil_ratio > 3.5}
            icon={<Gauge className="w-4 h-4 text-orange-400" />}
            provenance="SIMULATED"
          />
          <MetricCard
            title="Net Economic Benefit"
            value={`$${simResult.kpis.net_economic_benefit_usd.toLocaleString()}`}
            subtitle="After fuel, power & opex"
            icon={<Flame className="w-4 h-4 text-cyan-400" />}
            provenance="SIMULATED"
          />
          <MetricCard
            title="Min Float Margin"
            value={simResult.kpis.min_float_margin_index.toFixed(3)}
            unit="M_float"
            subtitle="Safe limit ≥ 1.000"
            danger={simResult.kpis.min_float_margin_index < 1.0}
            warning={simResult.kpis.min_float_margin_index >= 1.0 && simResult.kpis.min_float_margin_index < 1.25}
            icon={<AlertTriangle className="w-4 h-4" />}
            provenance="SIMULATED"
          />
          <MetricCard
            title="Max Rod Stress"
            value={`${(simResult.kpis.max_goodman_stress_ratio * 100).toFixed(1)}%`}
            unit="Goodman"
            subtitle="Allowable ≤ 100%"
            warning={simResult.kpis.max_goodman_stress_ratio > 0.85}
            icon={<ShieldCheck className="w-4 h-4 text-sky-400" />}
            provenance="SIMULATED"
          />
          <MetricCard
            title="Electricity Intensity"
            value={simResult.kpis.electrical_energy_kwh_per_bbl.toFixed(2)}
            unit="kWh/bbl"
            icon={<Zap className="w-4 h-4 text-amber-400" />}
            provenance="SIMULATED"
          />
        </div>
      )}

      {/* Constraints Gate Audit */}
      {simResult && (
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider font-mono">
                Hard Physical & Mechanical Safety Gate
              </h3>
              <StatusBadge status={simResult.constraints.status} />
            </div>
            <span className="text-xs font-mono text-slate-400">
              Impassable Gatekeeper: Infeasible states cannot be executed
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {simResult.constraints.violations.length > 0 ? (
              simResult.constraints.violations.map((v, i) => (
                <div key={i} className="p-2 rounded bg-rose-950/40 border border-rose-600/50 text-rose-300 flex items-center justify-between">
                  <span>❌ VIOLATION: {v.message}</span>
                  <span className="font-bold uppercase text-[10px] bg-rose-900 px-2 py-0.5 rounded">
                    {v.severity}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-600/50 text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>All physical and structural safety constraints strictly satisfied.</span>
              </div>
            )}

            {simResult.constraints.near_limit_warnings.map((w, i) => (
              <div key={i} className="p-2 rounded bg-amber-950/40 border border-amber-600/50 text-amber-300">
                ⚠️ WARNING: {w}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
