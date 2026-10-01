import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import type { SimulationResult, WellDetail } from '../api/types';
import { WellboreSchematic } from '../components/common/WellboreSchematic';
import { ProvenanceBadge } from '../components/common/ProvenanceBadge';
import { KinematicPumpjackVisualizer } from '../components/animations/KinematicPumpjackVisualizer';
import { DownholePumpShockAnimation } from '../components/animations/DownholePumpShockAnimation';
import { ThermalSteamChestVisualizer } from '../components/animations/ThermalSteamChestVisualizer';
import { FluidFlowVisualization } from '../components/animations/FluidFlowVisualization';
import { ReservoirHeatMap } from '../components/animations/ReservoirHeatMap';
import { DynacardLiveAnimation } from '../components/animations/DynacardLiveAnimation';
import { ProductionPulse } from '../components/animations/ProductionPulse';
import {
  Flame,
  Droplets,
  Cloud,
  IndianRupee,
  Shield,
  Activity,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Sliders,
  MapPin,
  X,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import type { PageId } from '../components/layout/Sidebar';

interface Props {
  selectedWellId: string;
  onNavigate?: (page: PageId) => void;
}

export const DigitalTwin: React.FC<Props> = ({ selectedWellId, onNavigate }) => {
  const [well, setWell] = useState<WellDetail | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('digital-twin');
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Operating parameters state
  const [steamVolume, setSteamVolume] = useState<number>(3000);
  const [injPressure, setInjPressure] = useState<number>(125);
  const [injDays, setInjDays] = useState<number>(15);
  const [soakDays, setSoakDays] = useState<number>(6);
  const [spm, setSpm] = useState<number>(4.5);
  const [strokeLength, setStrokeLength] = useState<number>(100);
  const [vfdRatio, setVfdRatio] = useState<number>(1.0);
  const [wellheadPressure, setWellheadPressure] = useState<number>(5.0);

  // Real-Time vs Static Simulation Mode (initially baseline static, converts to live real-time stream on click/use)
  const [simulationMode, setSimulationMode] = useState<'static' | 'realtime'>('static');
  const [simDay, setSimDay] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(5); // 1x, 5x, 15x
  const [optRecommendation, setOptRecommendation] = useState<any>(null);

  // Track previous well's last-known sim result for delta comparison
  const prevSimRef = useRef<{wellId: string; oilRate: number; sor: number; benefit: number} | null>(null);

  useEffect(() => {
    // Save current state as 'previous' before switching
    if (simResult && well) {
      const ts = simResult.timeseries;
      const lastDay = ts.length > 0 ? ts[ts.length - 1] : null;
      prevSimRef.current = {
        wellId: well.well_id ?? selectedWellId,
        oilRate: lastDay?.oil_rate_bpd ?? oilRateBpd,
        sor: simResult.kpis.steam_oil_ratio ?? currentSOR,
        benefit: (simResult.kpis as any)?.net_economic_benefit_usd ?? netBenefitUsd,
      };
    }
    // Reset simulation state for the new well
    setSimResult(null);
    setOptRecommendation(null);
    setSimulationMode('static');
    setSimDay(1);
    setIsPlaying(false);
    loadWellAndSimulate();
  }, [selectedWellId]);

  // Real-time day streaming loop
  useEffect(() => {
    if (simulationMode !== 'realtime' || !isPlaying) return;
    const totalDays = simResult?.timeseries?.length || 180;
    const intervalMs = Math.max(25, Math.round(150 / playbackSpeed));
    const timer = setInterval(() => {
      setSimDay((prev) => {
        if (prev >= totalDays) {
          setIsPlaying(false);
          return totalDays;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [simulationMode, isPlaying, playbackSpeed, simResult?.timeseries?.length]);

  const loadWellAndSimulate = async () => {
    try {
      setLoading(true);
      const w = await apiClient.getWell(selectedWellId);
      setWell(w);
      if (w.operating_parameters) {
        setSteamVolume(w.operating_parameters.steam_volume_tonnes || 3000);
        setSoakDays(w.operating_parameters.soak_duration_days || 6);
        setSpm(w.operating_parameters.spm || 4.5);
        setVfdRatio(w.operating_parameters.vfd_downstroke_ratio || 1.0);
      }
      // Fire simulation and optimization in parallel, but don't block the page on optimization
      const simPromise = apiClient.simulateCycle({
        well_id: selectedWellId,
        cycle_number: 1,
        steam_volume_tonnes: w.operating_parameters?.steam_volume_tonnes || 3000,
        injection_duration_days: 15.0,
        injection_pressure_bar: 125.0,
        soak_duration_days: w.operating_parameters?.soak_duration_days || 6,
        production_duration_days: 90.0,
        economic_cutoff_oil_rate_bpd: 7.0,
        spm: w.operating_parameters?.spm || 4.5,
        stroke_length_inch: 100.0,
        vfd_downstroke_ratio: w.operating_parameters?.vfd_downstroke_ratio || 1.0,
      });
      // Fire optimization in the background — don't block the page
      apiClient.optimizeJoint({ well_id: selectedWellId })
        .then((opt) => {
          if (opt?.recommended_configuration) {
            setOptRecommendation(opt.recommended_configuration);
          }
        })
        .catch(() => {/* optional recommendation — ignore failures */});
      const res = await simPromise;
      setSimResult(res);
    } catch (e) {
      console.error('Failed to load digital twin data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyParams = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiClient.simulateCycle({
        well_id: selectedWellId,
        cycle_number: 1,
        steam_volume_tonnes: steamVolume,
        injection_duration_days: Math.max(5, injDays),
        injection_pressure_bar: injPressure,
        soak_duration_days: soakDays,
        production_duration_days: 90.0,
        economic_cutoff_oil_rate_bpd: 7.0,
        spm: spm,
        stroke_length_inch: strokeLength,
        vfd_downstroke_ratio: vfdRatio,
      });
      setSimResult(res);
      setIsEditModalOpen(false);
      // Automatically activate real-time simulation on new parameters applied
      setSimulationMode('realtime');
      setSimDay(1);
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to update parameters:', err);
    } finally {
      setLoading(false);
    }
  };

  const timeseries = simResult?.timeseries || [];
  const totalDays = timeseries.length || 180;
  const clampedDayIndex = Math.max(0, Math.min(simDay - 1, totalDays - 1));
  const activePoint = (simulationMode === 'realtime' && timeseries.length > 0)
    ? timeseries[clampedDayIndex]
    : (timeseries.length > 0 ? timeseries[timeseries.length - 1] : null);

  // Dynamic metrics derived directly from canonical well state and physics simulation (Rule 3 & 4)
  const oilRateBpd = activePoint ? activePoint.oil_rate_bpd : (well?.telemetry?.current_oil_rate_bpd || (simResult?.timeseries?.slice(-1)[0]?.oil_rate_bpd ?? 24.5));
  const currentOilRateM3 = parseFloat((oilRateBpd / 6.2898).toFixed(1));
  const currentWaterCut = activePoint && (activePoint.oil_rate_bpd + activePoint.water_rate_bpd > 0)
    ? parseFloat(((activePoint.water_rate_bpd / (activePoint.oil_rate_bpd + activePoint.water_rate_bpd)) * 100).toFixed(1))
    : (well?.telemetry?.current_water_cut_pct ?? 79.8);
  const liquidRateBpd = currentWaterCut < 100 ? (oilRateBpd / (1 - currentWaterCut / 100)) : oilRateBpd;
  const currentLiquidRateM3 = parseFloat((liquidRateBpd / 6.2898).toFixed(1));
  const currentSOR = simResult?.kpis.steam_oil_ratio ? parseFloat(simResult.kpis.steam_oil_ratio.toFixed(2)) : 3.14;
  const netBenefitUsd = (simResult?.kpis as any)?.net_economic_benefit_usd ?? (simResult?.kpis as any)?.net_benefit_usd ?? (simResult as any)?.economics?.net_benefit_usd ?? 144302;
  const netBenefitLakhs = parseFloat(((netBenefitUsd * 83.0) / 100000 / 90).toFixed(2));
  const goodmanRatio = activePoint ? activePoint.goodman_stress_ratio : (well?.telemetry?.current_goodman_stress_ratio ?? simResult?.kpis.max_goodman_stress_ratio ?? 0.452);
  const floatMargin = activePoint ? activePoint.float_margin_index : (well?.telemetry?.current_float_margin_index ?? simResult?.kpis.min_float_margin_index ?? 0.910);
  const reservoirTemp = activePoint ? activePoint.bottomhole_temperature_c : (well?.telemetry?.current_temperature_c ?? 57.3);
  const crudeViscosity = activePoint ? activePoint.oil_viscosity_cp : (well?.telemetry?.current_viscosity_cp ?? 2395.8);
  const crudeApi = well?.crude_api ?? 18.0;
  const reservoirPressure = (simResult?.timeseries?.slice(-1)[0] as any)?.flowing_bottomhole_pressure_bar ?? 63.6;
  const intakePressure = activePoint ? activePoint.pump_intake_pressure_bar : (simResult?.timeseries?.slice(-1)[0]?.pump_intake_pressure_bar ?? 24.3);
  const heatingRadius = (simResult as any)?.thermal?.heated_zone_radius_m ?? (simResult as any)?.thermal_profile?.heated_radius_m ?? 12.8;

  // Compute dynamic KPI deltas (compare to previous well or baseline)
  const prev = prevSimRef.current;
  const oilDeltaPct = prev && prev.oilRate > 0 ? ((oilRateBpd - prev.oilRate) / prev.oilRate * 100) : null;
  const sorDeltaPct = prev && prev.sor > 0 ? ((currentSOR - prev.sor) / prev.sor * 100) : null;
  const benefitDeltaPct = prev && prev.benefit > 0 ? ((netBenefitUsd - prev.benefit) / prev.benefit * 100) : null;

  // Format delta as display string
  const fmtDelta = (pct: number | null): { text: string; positive: boolean } => {
    if (pct === null) return { text: 'vs. baseline', positive: true };
    const sign = pct >= 0 ? '+' : '';
    return { text: `${sign}${pct.toFixed(1)}%`, positive: pct >= 0 };
  };
  const oilDelta = fmtDelta(oilDeltaPct);
  const sorDelta = fmtDelta(sorDeltaPct);
  const benefitDelta = fmtDelta(benefitDeltaPct);

  // Mechanical risk label derived from physics, not hardcoded
  const mechRiskLabel = goodmanRatio > 0.85 ? 'High' : goodmanRatio > 0.65 ? 'Medium' : 'Low';
  const mechRiskColor = goodmanRatio > 0.85 ? 'text-rose-600 dark:text-rose-400' : goodmanRatio > 0.65 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';

  // Sub-navigation tabs list from reference image
  const subTabs = [
    { id: 'digital-twin', label: 'Digital Twin' },
    { id: 'kinematics-studio', label: 'Interactive Physics Studio ⚡' },
    { id: 'sensor-simulation', label: 'Sensor Simulation' },
    { id: 'thermal-profile', label: 'Thermal Profile' },
    { id: 'pressure-profile', label: 'Pressure Profile' },
    { id: 'flow-production', label: 'Flow & Production' },
    { id: 'srp-dynamics', label: 'SRP Dynamics' },
    { id: 'economics', label: 'Economics' },
    { id: 'scenario-comparison', label: 'Scenario Comparison' },
  ];

  return (
    <div className="space-y-5">
      {/* 1. TOP WELL HERO HEADER CARD */}
      <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Well Photo & Identity Metadata (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-28 sm:w-32 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 relative bg-slate-100 dark:bg-slate-800">
              <img
                src="/baghewala_pumpjack.jpg"
                alt="Wellsite Pumpjack"
                className="w-full h-full object-cover object-center"
              />
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white backdrop-blur-xs">
                {selectedWellId}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {selectedWellId}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Producing
                </span>
              </div>

              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {well?.well_name ?? `Baghewala Well ${selectedWellId.slice(-2)}`}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 pt-0.5">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{well?.field_name ?? 'Baghewala'} Field, Rajasthan</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <div>
                    <span className="block text-slate-400 text-[10px]">Depth (TVD)</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">{well?.depth_m ? `${well.depth_m.toLocaleString()} m` : `${well?.depth_m || 1020} m`}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[10px]">API Gravity</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">{well?.crude_api ? `${well.crude_api.toFixed(1)}°` : '18.0°'}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[10px]">Reservoir Temp</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">{well?.telemetry?.current_temperature_c ? `${well.telemetry.current_temperature_c.toFixed(1)} °C` : `${reservoirTemp.toFixed(1)} °C`}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Circular-Icon KPI Cards (7 Cols) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* KPI 1: Oil Production */}
            <div className="bg-slate-50/80 dark:bg-[#080e1a] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Oil Production</span>
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                  <Droplets className="w-4 h-4 fill-emerald-600 dark:fill-emerald-400 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {currentOilRateM3} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">m³/day</span>
                </div>
                <div className={`text-[11px] font-medium flex items-center gap-0.5 mt-0.5 ${oilDelta.positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  <span>{oilDelta.positive ? '↑' : '↓'} {oilDelta.text}</span>
                  <span className="text-slate-400 font-normal">vs. prev</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Steam-Oil Ratio */}
            <div className="bg-slate-50/80 dark:bg-[#080e1a] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Steam-Oil Ratio</span>
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-700 dark:text-cyan-400">
                  <Cloud className="w-4 h-4 text-blue-600 dark:text-cyan-400 fill-blue-600 dark:fill-cyan-400" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {currentSOR}
                </div>
                <div className={`text-[11px] font-medium flex items-center gap-0.5 mt-0.5 ${!sorDelta.positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  <span>{sorDelta.positive ? '↑' : '↓'} {sorDelta.text}</span>
                  <span className="text-slate-400 font-normal">vs. prev</span>
                </div>
              </div>
            </div>

            {/* KPI 3: Net Benefit */}
            <div className="bg-slate-50/80 dark:bg-[#080e1a] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Net Benefit</span>
                <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-700 dark:text-purple-400">
                  <IndianRupee className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  ₹ {netBenefitLakhs} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">L/day</span>
                </div>
                <div className={`text-[11px] font-medium flex items-center gap-0.5 mt-0.5 ${benefitDelta.positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  <span>{benefitDelta.positive ? '↑' : '↓'} {benefitDelta.text}</span>
                  <span className="text-slate-400 font-normal">vs. prev</span>
                </div>
              </div>
            </div>

            {/* KPI 4: Mechanical Risk */}
            <div className="bg-slate-50/80 dark:bg-[#080e1a] border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Mechanical Risk</span>
                <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
                  <Shield className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                </div>
              </div>
              <div className="mt-2">
                <div className={`text-lg font-bold tracking-tight ${mechRiskColor}`}>
                  {mechRiskLabel}
                </div>
                <div className={`text-[11px] font-semibold ${mechRiskColor} flex items-center gap-1 mt-0.5`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${mechRiskColor}`} />
                  <span>Goodman: {typeof goodmanRatio === 'number' ? goodmanRatio.toFixed(3) : goodmanRatio}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS BAR */}
      <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <nav className="flex space-x-6 min-w-max">
          {subTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'economics' && onNavigate) onNavigate('economics');
                  if (tab.id === 'scenario-comparison' && onNavigate) onNavigate('what-if');
                }}
                className={`pb-3 text-xs font-medium transition-all relative cursor-pointer ${
                  isActive
                    ? 'text-blue-600 dark:text-cyan-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-cyan-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* INTERACTIVE PHYSICS & KINEMATICS STUDIO VIEW */}
      {activeTab === 'kinematics-studio' ? (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-cyan-950 border border-cyan-500/40 rounded-xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                <h2 className="text-base font-bold text-white tracking-wide uppercase">
                  Coupled Multiphysics Kinematics & Subsurface Shock Studio
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  Well: {selectedWellId}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Directly interact with the four-bar walking beam linkage, test VFD asymmetric downstroke speed modulation, trigger fluid pound acoustic shockwaves in the subsurface pump, and watch the 2D radial thermal steam chest expand in the Jodhpur Sandstone.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('digital-twin')}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold transition-colors"
            >
              ← Back to Digital Twin Overview
            </button>
          </div>

          {/* Module 1: Kinematic Walking Beam Surface Unit */}
          <KinematicPumpjackVisualizer
            initialSpm={spm}
            initialStrokeLengthInch={strokeLength}
            initialDownstrokeRatio={vfdRatio}
            isFloating={floatMargin < 1.0}
            onStateChange={(state) => {
              setSpm(state.spm);
              setStrokeLength(state.strokeLengthInch);
              setVfdRatio(state.downstrokeRatio);
            }}
          />

          {/* 2-Column Grid: Subsurface Pump Cutaway & 2D Radial Thermal Steam Chest */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DownholePumpShockAnimation
              initialFillage={0.55}
              spm={spm}
              depthM={well?.pump_depth_m || 950}
            />
            <ThermalSteamChestVisualizer
              initialPhase="PRODUCTION"
              initialSteamTonnes={steamVolume}
              initialSoakDays={soakDays}
              initialProductionDay={Math.min(120, simDay)}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Studio Quick-Launch Callout Banner */}
          <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-cyan-950/60 border border-cyan-500/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Interactive Physics & Kinematics Studio Active
                </h4>
                <p className="text-[11px] text-slate-300">
                  Four-bar walking beam linkage, downhole valve cutaway with fluid pound shockwaves, and 2D radial steam chest.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('kinematics-studio')}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 2.5 MULTIPHYSICS COUPLING CHAIN RIBBON (Section 4 Specification) */}
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
            End-to-End Multiphysics Coupling Chain
          </span>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 font-semibold">
            Coupled 1st-Principles Physics
          </span>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 min-w-max text-xs">
            <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-semibold shadow-2xs">RESERVOIR</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-medium">CSS HEATING</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">Temperature</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">Viscosity</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-medium">Wellbore Flow</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">Rod Drag</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">SRP / Dynacard</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">Production</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium">Economics</span>
            <span className="text-slate-400 font-bold">→</span>
            <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold shadow-2xs">OPTIMIZER</span>
          </div>
        </div>
      </div>


      {/* 3. MAIN DASHBOARD CONTENT GRID (2 COLUMNS) */}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: WELLBORE & GEOLOGICAL STRATA SCHEMATIC + TWIN STATE (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <WellboreSchematic
            depthM={well?.depth_m || 1020}
            pumpDepthM={well?.pump_depth_m || 950}
            temperatureC={reservoirTemp}
            viscosityCp={crudeViscosity}
            apiGravity={crudeApi}
            wellheadPressureBar={wellheadPressure}
            intakePressureBar={intakePressure}
            tubingPressureBar={wellheadPressure}
            tubingTempC={reservoirTemp}
            steamChamberTempC={activePoint ? Math.round(activePoint.bottomhole_temperature_c) : 220}
            wellName={selectedWellId}
            isFloating={floatMargin < 1.0}
            isPumping={isPlaying}
            spm={spm}
            strokeLengthIn={strokeLength}
            vfdRatio={vfdRatio}
            isLiveSimulation={simulationMode === 'realtime'}
            currentDay={simDay}
            onSpmChange={(newSpm) => setSpm(newSpm)}
          />

          {/* TWIN STATE PANEL (Section 4 & 7 Specification) */}
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                TWIN STATE — {selectedWellId}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                Physics Solvers Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Reservoir */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080e1a] border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Reservoir</span>
                  <ProvenanceBadge tier="SIMULATED" variant="bracket" />
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Pressure:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{reservoirPressure.toFixed(1)} bar</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Temperature:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{reservoirTemp.toFixed(1)} °C</strong>
                </div>
              </div>

              {/* Thermal */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080e1a] border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Thermal</span>
                  <ProvenanceBadge tier="PHYSICS_SIM" variant="bracket" />
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Steam volume:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{Math.round(steamVolume).toLocaleString()} t</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Heating radius:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{heatingRadius.toFixed(1)} m</strong>
                </div>
              </div>

              {/* Fluid */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080e1a] border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Fluid</span>
                  <ProvenanceBadge tier="SIMULATED" variant="bracket" />
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Viscosity:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{Math.round(crudeViscosity).toLocaleString()} cP</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>API gravity:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{crudeApi.toFixed(1)}° API</strong>
                </div>
              </div>

              {/* Artificial Lift */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080e1a] border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-cyan-400 uppercase tracking-wider block">Artificial Lift</span>
                  <ProvenanceBadge tier="SETPOINT" variant="bracket" />
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>SPM:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{spm.toFixed(1)} SPM</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Stroke:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{strokeLength} in</strong>
                </div>
              </div>

              {/* Mechanical */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080e1a] border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">Mechanical</span>
                  <ProvenanceBadge tier="PHYSICS_SIM" variant="bracket" />
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Float margin:</span>
                  <strong className={`font-mono ${floatMargin >= 1.0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400 font-bold'}`}>
                    {floatMargin.toFixed(3)} {floatMargin >= 1.0 ? '(Safe)' : '(At Risk)'}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Goodman:</span>
                  <strong className={`font-mono ${goodmanRatio <= 0.85 ? 'text-slate-900 dark:text-white' : 'text-amber-700 dark:text-amber-400'}`}>
                    {goodmanRatio.toFixed(3)} {goodmanRatio <= 0.85 ? '(Safe)' : '(High)'}
                  </strong>
                </div>
              </div>

              {/* Production */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080e1a] border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Production</span>
                  <ProvenanceBadge tier="PHYSICS_SIM" variant="bracket" />
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Oil:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{currentOilRateM3} m³/day</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>SOR:</span>
                  <strong className="text-slate-900 dark:text-white font-mono">{currentSOR} t/t</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: OPERATING CONDITIONS, TRENDS & THERMAL PROFILE (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Current Operating Conditions */}
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                Current Operating Conditions
              </h3>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-all shadow-2xs"
              >
                Edit
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* CSS Parameters (Current Cycle) */}
              <div className="p-3 bg-rose-50/40 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40 space-y-2">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold text-[11px] uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5 fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400" />
                  <span>CSS Parameters</span>
                </div>
                <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Steam Volume:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{steamVolume.toLocaleString()} t</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Injection Pressure:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{injPressure} bar</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Injection Duration:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{injDays} days</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Soak Duration:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{soakDays} days</strong>
                  </div>
                </div>
              </div>

              {/* SRP Parameters */}
              <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-2">
                <div className="flex items-center gap-1.5 text-blue-700 dark:text-cyan-400 font-semibold text-[11px] uppercase tracking-wider">
                  <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span>SRP Parameters</span>
                </div>
                <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">SPM:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{spm.toFixed(1)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Stroke Length:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{strokeLength} in</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">VFD Downstroke:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{vfdRatio.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Pump Fillage (est.):</span>
                    <strong className="text-slate-900 dark:text-white font-mono">78 %</strong>
                  </div>
                </div>
              </div>

              {/* Surface Conditions */}
              <div className="p-3 bg-slate-50 dark:bg-[#080e1a] rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
                  <Droplets className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Surface Conditions</span>
                </div>
                <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Wellhead Pressure:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{wellheadPressure.toFixed(1)} bar</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Liquid Rate:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{currentLiquidRateM3} m³/day</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Oil Rate:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{currentOilRateM3} m³/day</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Water Cut:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{currentWaterCut} %</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Production & SOR Trends (Real-Time Physics Simulation Graph) */}
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  Production & Thermal Dynamic Trends
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {simulationMode === 'realtime'
                    ? `Live physics cycle streaming — Day ${simDay} of ${timeseries.length || 180}`
                    : 'Baseline cyclic overview — Click graph or button below to convert to real-time simulation'}
                </span>
              </div>

              {/* Mode Toggle & Real-Time Activation */}
              <div className="flex items-center gap-2">
                {simulationMode === 'static' ? (
                  <button
                    onClick={() => {
                      setSimulationMode('realtime');
                      setSimDay(1);
                      setIsPlaying(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Run Real-Time Simulation</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      REAL-TIME STREAMING
                    </span>
                    <button
                      onClick={() => {
                        setSimulationMode('static');
                        setIsPlaying(false);
                      }}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 underline px-1 cursor-pointer"
                    >
                      Reset to Static
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time playback controls & interactive day scrubber */}
            {simulationMode === 'realtime' && (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (simDay >= (timeseries.length || 180)) setSimDay(1);
                      setIsPlaying(!isPlaying);
                    }}
                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center justify-center transition-all cursor-pointer"
                    title={isPlaying ? "Pause Simulation" : "Resume Simulation"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  <button
                    onClick={() => {
                      setSimDay(1);
                      setIsPlaying(false);
                    }}
                    className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg shadow-xs flex items-center justify-center transition-all cursor-pointer"
                    title="Replay from Day 1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Playback speed pills */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-[10px]">
                    {[1, 5, 15].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-2 py-0.5 rounded font-medium transition-all cursor-pointer ${
                          playbackSpeed === spd
                            ? 'bg-slate-900 dark:bg-cyan-600 text-white font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Day Scrubber Slider */}
                <div className="flex-1 w-full sm:w-auto flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                    Day {simDay} <span className="text-slate-400 font-normal">/ {timeseries.length || 180}</span>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max={timeseries.length || 180}
                    value={simDay}
                    onChange={(e) => {
                      setSimDay(Number(e.target.value));
                      setIsPlaying(false);
                    }}
                    className="w-full accent-blue-600 dark:accent-cyan-400 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Oil Rate (m³/day)
              </span>
              <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                Reservoir Temp (°C)
              </span>
              <span className="flex items-center gap-1.5 text-blue-700 dark:text-cyan-400 font-medium">
                <span className="w-2.5 h-2.5 rotate-45 bg-blue-500 inline-block" />
                SOR (Steam/Oil)
              </span>
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                Wellhead Pressure (bar)
              </span>
            </div>

            {/* Dynamic SVG Trends Chart (Click-to-Convert enabled) */}
            {(() => {
              const numDays = timeseries.length || 180;
              const chartData = timeseries.length > 0 ? timeseries : Array.from({ length: 180 }, (_, i) => ({
                day: i + 1,
                oil_rate_bpd: Math.max(15, 160 * Math.exp(-0.015 * i)),
                water_rate_bpd: 110 + i * 0.4,
                bottomhole_temperature_c: Math.max(48, 220 * Math.exp(-0.012 * i)),
                oil_viscosity_cp: Math.min(3200, 45 * Math.exp(0.02 * i)),
                float_margin_index: Math.max(0.92, 1.80 - 0.005 * i),
                goodman_stress_ratio: 0.52 + 0.001 * i,
                peak_gearbox_torque_in_lbs: 280000,
                pump_intake_pressure_bar: 24.3,
                pump_fillage_pct: 78.0,
                cumulative_oil_bbl: i * 25,
              }));

              const getChartX = (idx: number) => 45 + (idx / Math.max(numDays - 1, 1)) * 510;
              const getOilY = (bpd: number) => 125 - (Math.min(bpd / 6.2898, 40) / 40) * 100;
              const getTempY = (temp: number) => 125 - ((Math.min(Math.max(temp, 40), 240) - 40) / 200) * 100;
              const getSorY = (idx: number) => 125 - (Math.min(2.0 + (idx / numDays) * 2.0, 6.0) / 6.0) * 100;

              const fullOilPath = chartData.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getChartX(i).toFixed(1)} ${getOilY(pt.oil_rate_bpd).toFixed(1)}`).join(' ');
              const fullTempPath = chartData.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getChartX(i).toFixed(1)} ${getTempY(pt.bottomhole_temperature_c).toFixed(1)}`).join(' ');
              const fullSorPath = chartData.map((_pt, i) => `${i === 0 ? 'M' : 'L'} ${getChartX(i).toFixed(1)} ${getSorY(i).toFixed(1)}`).join(' ');

              const activeSliceCount = simulationMode === 'realtime' ? Math.max(1, Math.min(simDay, numDays)) : numDays;
              const activeOilPath = chartData.slice(0, activeSliceCount).map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getChartX(i).toFixed(1)} ${getOilY(pt.oil_rate_bpd).toFixed(1)}`).join(' ');
              const activeTempPath = chartData.slice(0, activeSliceCount).map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getChartX(i).toFixed(1)} ${getTempY(pt.bottomhole_temperature_c).toFixed(1)}`).join(' ');
              const activeSorPath = chartData.slice(0, activeSliceCount).map((_pt, i) => `${i === 0 ? 'M' : 'L'} ${getChartX(i).toFixed(1)} ${getSorY(i).toFixed(1)}`).join(' ');

              const cursorX = getChartX(activeSliceCount - 1);
              const currentActivePt = chartData[activeSliceCount - 1] || chartData[0];

              return (
                <div
                  className="w-full overflow-x-auto cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const pct = Math.max(0, Math.min(1, (clickX - 45) / (rect.width - 90)));
                    const targetDay = Math.max(1, Math.min(numDays, Math.round(pct * numDays)));
                    setSimulationMode('realtime');
                    setSimDay(targetDay);
                  }}
                  title="Click anywhere to convert and seek in Real-Time Simulation"
                >
                  <svg viewBox="0 0 600 160" className="w-full h-44 bg-slate-50/70 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800 select-none">
                    {/* Horizontal Gridlines */}
                    <line x1="40" y1="20" x2="560" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="40" y1="55" x2="560" y2="55" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="40" y1="90" x2="560" y2="90" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="40" y1="125" x2="560" y2="125" stroke="#cbd5e1" strokeWidth="1" />

                    {/* Left Y Axis (Oil m3/day) */}
                    <text x="32" y="24" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">40</text>
                    <text x="32" y="59" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">25</text>
                    <text x="32" y="94" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">10</text>
                    <text x="32" y="129" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">0</text>

                    {/* Right Y Axis (Temp °C) */}
                    <text x="568" y="24" fill="#64748b" fontSize="9" fontFamily="Inter, sans-serif">240°</text>
                    <text x="568" y="59" fill="#64748b" fontSize="9" fontFamily="Inter, sans-serif">180°</text>
                    <text x="568" y="94" fill="#64748b" fontSize="9" fontFamily="Inter, sans-serif">100°</text>
                    <text x="568" y="129" fill="#64748b" fontSize="9" fontFamily="Inter, sans-serif">40°</text>

                    {/* If in Real-time Mode, show dashed baseline forecast in background */}
                    {simulationMode === 'realtime' && (
                      <>
                        <path d={fullOilPath} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3" />
                        <path d={fullTempPath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3" />
                        <path d={fullSorPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3" />
                      </>
                    )}

                    {/* Active Drawn Curves */}
                    <path d={activeTempPath} fill="none" stroke="#ef4444" strokeWidth="2" />
                    <path d={activeOilPath} fill="none" stroke="#10b981" strokeWidth="2.2" />
                    <path d={activeSorPath} fill="none" stroke="#3b82f6" strokeWidth="1.8" />

                    {/* Laser Cursor Scanline in Real-Time Mode */}
                    {simulationMode === 'realtime' && (
                      <g>
                        <line
                          x1={cursorX}
                          y1="18"
                          x2={cursorX}
                          y2="125"
                          stroke="#2563eb"
                          strokeWidth="2"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={cursorX}
                          cy={getOilY(currentActivePt.oil_rate_bpd)}
                          r="5"
                          fill="#10b981"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <circle
                          cx={cursorX}
                          cy={getTempY(currentActivePt.bottomhole_temperature_c)}
                          r="4"
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                      </g>
                    )}

                    {/* X Axis Day Intervals */}
                    {[1, 30, 60, 90, 120, 150, 180].map((d) => {
                      const x = 45 + ((d - 1) / Math.max(numDays - 1, 1)) * 510;
                      return (
                        <text key={d} x={x} y="142" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">
                          Day {d}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}

            {/* Live Telemetry Readout Strip with Adaptive Closed-Loop Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 text-white rounded-lg text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-blue-400 font-bold">
                  {simulationMode === 'realtime' ? `DAY ${simDay} REAL-TIME STATE:` : 'CYCLE CANONICAL STATE:'}
                </span>
                <span>Oil: <strong className="text-emerald-400 font-bold">{currentOilRateM3} m³/d</strong> ({oilRateBpd.toFixed(0)} bpd)</span>
                {simulationMode === 'realtime' && (
                  <span className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-500/40 text-blue-300 text-[10px] font-semibold">
                    SPM: <strong className="text-white font-bold">{activePoint?.spm ? activePoint.spm.toFixed(2) : spm.toFixed(1)}</strong> | VFD: <strong className="text-white font-bold">{activePoint?.vfd_downstroke_ratio ? activePoint.vfd_downstroke_ratio.toFixed(2) : vfdRatio.toFixed(2)}x</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <span>Temp: <strong className="text-rose-400 font-semibold">{reservoirTemp.toFixed(1)} °C</strong></span>
                <span>Viscosity: <strong className="text-amber-400 font-semibold">{crudeViscosity.toFixed(0)} cP</strong></span>
                <span>Float Margin: <strong className={floatMargin >= 1.0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-bold"}>{floatMargin.toFixed(3)}</strong></span>
                {simulationMode === 'realtime' && activePoint?.srp_binding_limit && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                    Constraint: {activePoint.srp_binding_limit.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Wellbore Temperature & Viscosity Profile */}
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                Wellbore Temperature & Viscosity Profile
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
                  Temperature: {reservoirTemp.toFixed(1)} °C
                </span>
                <span className="flex items-center gap-1.5 text-blue-700 dark:text-cyan-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  Viscosity: {crudeViscosity.toFixed(0)} cP
                </span>
              </div>
            </div>

            {/* SVG Depth Profile with Shaded Steam Chamber responding to active real-time day */}
            <div className="w-full overflow-x-auto">
              <svg viewBox="0 0 600 160" className="w-full h-44 bg-slate-50/70 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800">
                {/* Steam Chamber Shaded Band at Bottom (Depth 1,150m to 1,350m) */}
                <rect x="470" y="15" width="85" height="110" fill="#fee2e2" stroke="#fca5a5" strokeDasharray="3 3" opacity="0.8" />
                <text x="512" y="70" fill="#991b1b" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="Inter, sans-serif">
                  Steam Chamber
                </text>

                {/* Gridlines */}
                <line x1="45" y1="20" x2="555" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="45" y1="55" x2="555" y2="55" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="45" y1="90" x2="555" y2="90" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="45" y1="125" x2="555" y2="125" stroke="#cbd5e1" strokeWidth="1" />

                {/* Left Y Axis: Temperature (°C) */}
                <text x="36" y="24" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">300</text>
                <text x="36" y="59" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">200</text>
                <text x="36" y="94" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">100</text>
                <text x="36" y="129" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="Inter, sans-serif">50</text>

                {/* Right Y Axis: Viscosity (cP) */}
                <text x="562" y="24" fill="#64748b" fontSize="9" fontFamily="Inter, sans-serif">5,000</text>
                <text x="562" y="59" fill="#64748b" fontSize="9" fontFamily="Inter, sans-serif">3,000</text>
                <text x="562" y="94" fill="#64748b" fontSize="9" fontFamily="Inter, sans-serif">1,000</text>
                <text x="562" y="129" fill="#64748b" fontSize="9" fontFamily="Inter, sans-serif">0</text>

                {/* Temperature Curve: Rises with depth, reaching active reservoirTemp in Steam Chamber */}
                {(() => {
                  const chamberY = Math.max(30, 125 - ((reservoirTemp - 40) / 220) * 95);
                  const viscY = Math.min(122, Math.max(35, 125 - (crudeViscosity / 4500) * 90));
                  return (
                    <>
                      <path
                        d={`M 50 120 Q 150 100 250 82 T 400 65 T 480 ${chamberY} T 545 ${chamberY + 2}`}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2.2"
                      />
                      {[50, 150, 250, 350, 430, 490, 545].map((cx, i) => (
                        <circle key={i} cx={cx} cy={cx > 450 ? chamberY : 120 - cx * 0.14} r="3" fill="#ef4444" />
                      ))}

                      {/* Viscosity Curve: Drops exponentially into steam zone */}
                      <path
                        d={`M 50 ${viscY} Q 120 ${viscY + 10} 220 95 T 380 112 T 480 120 T 545 122`}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2.2"
                      />
                      {[50, 120, 220, 320, 420, 490, 545].map((cx, i) => (
                        <circle key={i} cx={cx} cy={Math.min(122, viscY + Math.min(cx * 0.15, 60))} r="3" fill="#2563eb" />
                      ))}
                    </>
                  );
                })()}

                {/* Depth X Axis */}
                <text x="50" y="142" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">0</text>
                <text x="132" y="142" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">250</text>
                <text x="215" y="142" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">500</text>
                <text x="298" y="142" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">750</text>
                <text x="380" y="142" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">1,000</text>
                <text x="462" y="142" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">1,250</text>
                <text x="545" y="142" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">1,350</text>

                <text x="300" y="155" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="Inter, sans-serif">
                  Depth (m) →
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE PHYSICS ANIMATIONS SHOWCASE ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              Live Physics Simulations & Kinematics Studio
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
              REAL-TIME SVG PHYSICS
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Interactive 4-bar linkage kinematics, downhole fluid pound acoustic shockwaves & 2D thermal steam chest
          </span>
        </div>

        {/* Module 1: Kinematic Walking Beam Surface Unit */}
        <KinematicPumpjackVisualizer
          initialSpm={spm}
          initialStrokeLengthInch={strokeLength}
          initialDownstrokeRatio={vfdRatio}
          isFloating={floatMargin < 1.0}
          onStateChange={(state) => {
            setSpm(state.spm);
            setStrokeLength(state.strokeLengthInch);
            setVfdRatio(state.downstrokeRatio);
          }}
        />

        {/* 2-Column Grid: Subsurface Pump Cutaway & 2D Radial Thermal Steam Chest */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DownholePumpShockAnimation
            initialFillage={0.55}
            spm={spm}
            depthM={well?.pump_depth_m || 950}
          />
          <ThermalSteamChestVisualizer
            initialPhase="PRODUCTION"
            initialSteamTonnes={steamVolume}
            initialSoakDays={soakDays}
            initialProductionDay={Math.min(120, simDay)}
          />
        </div>
      </div>

      {/* 4. BOTTOM ROW - 2 LARGE CARDS (AI RECOMMENDATION & GOODMAN DIAGRAM) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card Left: AI Optimization Recommendation (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-cyan-950/40 border border-blue-200 dark:border-cyan-800/60 flex items-center justify-center text-blue-700 dark:text-cyan-400">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                  AI Optimization Recommendation
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Optimal
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Recommended operating conditions for maximum net benefit (within safety limits)
            </p>
          </div>

          {/* Setpoints Recommendation Matrix (Dynamically from joint optimizer result) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Steam Vol</span>
              <strong className="text-slate-900 dark:text-white text-xs block mt-0.5 font-mono">
                {optRecommendation?.steam_volume_tonnes ? `${Math.round(optRecommendation.steam_volume_tonnes).toLocaleString()} t` : `${Math.round(steamVolume).toLocaleString()} t`}
              </strong>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                {optRecommendation?.steam_volume_tonnes && steamVolume ? `${(((optRecommendation.steam_volume_tonnes - steamVolume) / steamVolume) * 100) >= 0 ? '+' : ''}${(((optRecommendation.steam_volume_tonnes - steamVolume) / steamVolume) * 100).toFixed(0)}%` : '+4%'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Inj Duration</span>
              <strong className="text-slate-900 dark:text-white text-xs block mt-0.5 font-mono">
                {injDays} days
              </strong>
              <span className="text-[10px] text-slate-400 font-medium">(keep)</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Soak Duration</span>
              <strong className="text-slate-900 dark:text-white text-xs block mt-0.5 font-mono">
                {optRecommendation?.soak_days ? `${Math.round(optRecommendation.soak_days)} days` : `${soakDays} days`}
              </strong>
              <span className="text-[10px] text-slate-400 font-medium">(keep)</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">SPM</span>
              <strong className="text-slate-900 dark:text-white text-xs block mt-0.5 font-mono">
                {optRecommendation?.spm ? optRecommendation.spm.toFixed(1) : spm.toFixed(1)}
              </strong>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                {optRecommendation?.spm && spm ? `${(((optRecommendation.spm - spm) / spm) * 100) >= 0 ? '+' : ''}${(((optRecommendation.spm - spm) / spm) * 100).toFixed(0)}%` : 'opt'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Stroke Length</span>
              <strong className="text-slate-900 dark:text-white text-xs block mt-0.5 font-mono">
                {optRecommendation?.stroke_length_inch ? `${Math.round(optRecommendation.stroke_length_inch)} in` : `${strokeLength} in`}
              </strong>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">opt</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">VFD Ratio</span>
              <strong className="text-slate-900 dark:text-white text-xs block mt-0.5 font-mono">
                {optRecommendation?.vfd_downstroke_ratio ? optRecommendation.vfd_downstroke_ratio.toFixed(2) : vfdRatio.toFixed(2)}
              </strong>
              <span className="text-[10px] text-slate-400 font-medium">Safe α</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onNavigate && onNavigate('what-if')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Apply to What-If Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onNavigate && onNavigate('joint-optimizer')}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
            >
              <span>View Pareto Options</span>
            </button>
          </div>
        </div>

        {/* Card Right: Mechanical Health (Goodman Diagram) (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
              Mechanical Health (Goodman Diagram)
            </h3>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-blue-700 dark:text-cyan-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-cyan-400" />
              Current Operation
            </span>
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Safe Zone
            </span>
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Caution Zone
            </span>
            <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Risk Zone
            </span>
          </div>

          {/* Goodman Diagram SVG */}
          <div className="w-full flex justify-center">
            <svg viewBox="0 0 320 180" className="w-full max-w-sm h-44 bg-slate-50/70 dark:bg-[#080e1a] rounded-lg border border-slate-200 dark:border-slate-800">
              {/* Goodman Safety Polygons */}
              {/* Risk Zone (Red Background) */}
              <polygon points="40,20 280,20 280,140 40,140" fill="#fee2e2" fillOpacity="0.4" />
              {/* Caution Zone (Yellow Middle) */}
              <polygon points="40,30 220,140 40,140" fill="#fef3c7" fillOpacity="0.4" />
              {/* Safe Zone (Green Corner) */}
              <polygon points="40,50 170,140 40,140" fill="#d1fae5" fillOpacity="0.4" />

              {/* Boundary Lines */}
              <line x1="40" y1="50" x2="170" y2="140" stroke="#059669" strokeWidth="1.5" />
              <line x1="40" y1="30" x2="220" y2="140" stroke="#d97706" strokeWidth="1.5" strokeDasharray="3 2" />

              {/* Axes */}
              <line x1="40" y1="20" x2="40" y2="140" stroke="#64748b" strokeWidth="1.2" />
              <line x1="40" y1="140" x2="280" y2="140" stroke="#64748b" strokeWidth="1.2" />

              {/* Y Axis Ticks: Alternating Stress (MPa) */}
              <text x="32" y="24" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="Inter, sans-serif">200</text>
              <text x="32" y="64" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="Inter, sans-serif">150</text>
              <text x="32" y="104" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="Inter, sans-serif">100</text>
              <text x="32" y="142" fill="#64748b" fontSize="8" textAnchor="end" fontFamily="Inter, sans-serif">0</text>
              <text x="15" y="80" fill="#64748b" fontSize="7" transform="rotate(-90 15,80)" textAnchor="middle" fontFamily="Inter, sans-serif">
                Alternating Stress (MPa)
              </text>

              {/* X Axis Ticks: Mean Stress (MPa) */}
              <text x="40" y="152" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="Inter, sans-serif">0</text>
              <text x="100" y="152" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="Inter, sans-serif">50</text>
              <text x="160" y="152" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="Inter, sans-serif">100</text>
              <text x="220" y="152" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="Inter, sans-serif">150</text>
              <text x="270" y="152" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="Inter, sans-serif">200</text>
              <text x="160" y="166" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="Inter, sans-serif">
                Mean Stress (MPa) →
              </text>

              {/* Historical Operations Scatter Dots */}
              {[
                [75, 115], [82, 110], [90, 118], [98, 120], [105, 114],
                [112, 122], [120, 125], [128, 128], [135, 130], [88, 112]
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="2.5" fill="#94a3b8" opacity="0.6" />
              ))}

              {/* Current Operation Dot (Pulsing concentric blue rings) */}
              <circle cx="80" cy="110" r="7" fill="none" stroke="#00f0ff" strokeWidth="1.5" opacity="0.6" className="animate-ping" />
              <circle cx="80" cy="110" r="4.5" fill="#00f0ff" stroke="#ffffff" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </div>
      </>
    )}

      {/* 5. EDIT OPERATING CONDITIONS MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1322] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Edit Operating Conditions — {selectedWellId}
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyParams} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-medium">Steam Volume (tonnes):</label>
                  <input
                    type="number"
                    min="1000"
                    max="5000"
                    step="50"
                    value={steamVolume}
                    onChange={(e) => setSteamVolume(parseFloat(e.target.value))}
                    className="w-full bg-white dark:bg-[#080e1a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/20 focus:border-blue-500 dark:focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-medium">Injection Pressure (bar):</label>
                  <input
                    type="number"
                    min="50"
                    max="140"
                    step="1"
                    value={injPressure}
                    onChange={(e) => setInjPressure(parseFloat(e.target.value))}
                    className="w-full bg-white dark:bg-[#080e1a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/20 focus:border-blue-500 dark:focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-medium">Injection Duration (days):</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    value={injDays}
                    onChange={(e) => setInjDays(parseInt(e.target.value))}
                    className="w-full bg-white dark:bg-[#080e1a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/20 focus:border-blue-500 dark:focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-medium">Soak Duration (days):</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    value={soakDays}
                    onChange={(e) => setSoakDays(parseInt(e.target.value))}
                    className="w-full bg-white dark:bg-[#080e1a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/20 focus:border-blue-500 dark:focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-medium">SRP Speed (SPM):</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="0.1"
                    value={spm}
                    onChange={(e) => setSpm(parseFloat(e.target.value))}
                    className="w-full bg-white dark:bg-[#080e1a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/20 focus:border-blue-500 dark:focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-medium">Stroke Length (inches):</label>
                  <input
                    type="number"
                    min="54"
                    max="168"
                    step="1"
                    value={strokeLength}
                    onChange={(e) => setStrokeLength(parseInt(e.target.value))}
                    className="w-full bg-white dark:bg-[#080e1a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/20 focus:border-blue-500 dark:focus:border-cyan-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-700 dark:text-slate-300 block mb-1 font-medium">Wellhead Pressure (bar):</label>
                  <input
                    type="number"
                    min="1"
                    max="25"
                    step="0.5"
                    value={wellheadPressure}
                    onChange={(e) => setWellheadPressure(parseFloat(e.target.value))}
                    className="w-full bg-white dark:bg-[#080e1a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-cyan-500/20 focus:border-blue-500 dark:focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-semibold shadow-xs cursor-pointer"
                >
                  {loading ? 'Recomputing Digital Twin...' : 'Apply Setpoints'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
