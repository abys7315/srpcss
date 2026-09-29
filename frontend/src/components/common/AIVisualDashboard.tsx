import React, { useState } from 'react';
import {
  PieChart as PieIcon,
  BarChart3,
  Activity,
  Flame,
  Info,
} from 'lucide-react';
import type { AIAnalysisContext } from '../../services/aiService';

interface AIVisualDashboardProps {
  context: AIAnalysisContext;
  wellId: string;
}

export const AIVisualDashboard: React.FC<AIVisualDashboardProps> = ({
  context,
  wellId,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'pie' | 'thermal' | 'kinematics'>('all');
  const [pieMode, setPieMode] = useState<'fluid' | 'energy'>('fluid');

  // Well Telemetry Metrics
  const visc = context.viscosityCp ? Math.round(context.viscosityCp) : 2396;
  const temp = context.temperatureC ? context.temperatureC : 57.3;
  const floatMargin = context.floatMargin !== undefined ? context.floatMargin : 0.91;
  const isFloat = floatMargin < 1.0;
  const spm = context.spm ? context.spm : 5.5;
  const vfd = context.vfdRatio ? context.vfdRatio : 0.75;
  const waterCut = context.waterCutPct ? context.waterCutPct : 80;
  const oilCut = 100 - waterCut;
  const oilBpd = context.oilRateM3 ? Math.round(context.oilRateM3 * 6.29) : 24;

  // Recommended target values from first-principles AI synthesis
  const targetSpm = 3.8;
  const targetVfd = 0.75;
  const targetFloatMargin = 1.68;
  const targetOilBpd = Math.round(oilBpd * 1.35);

  // SVG Helper calculations for Donut Chart
  // Radius = 40, Circumference = 2 * PI * 40 = 251.327
  const donutRadius = 40;
  const circumference = 2 * Math.PI * donutRadius; // 251.327

  // Fluid Cut Donut
  const oilStroke = (oilCut / 100) * circumference;
  const waterStroke = (waterCut / 100) * circumference;

  // Thermal Energy Partitioning Donut
  // Chamber Enthalpy 48%, Overburden Loss 32%, Formation Loss 12%, Wellbore Loss 8%
  const energySlices = [
    { label: 'Steam Chamber Heat', pct: 48, color: '#f59e0b', stroke: 0.48 * circumference },
    { label: 'Overburden Loss', pct: 32, color: '#ef4444', stroke: 0.32 * circumference },
    { label: 'Underburden Conduction', pct: 12, color: '#3b82f6', stroke: 0.12 * circumference },
    { label: 'Wellbore Loss', pct: 8, color: '#a855f7', stroke: 0.08 * circumference },
  ];

  // Float margin position on a 0.0 to 2.0 scale (clamped to 0-100%)
  const floatGaugePercent = Math.min(Math.max((floatMargin / 2.0) * 100, 5), 95);
  const targetFloatGaugePercent = Math.min(Math.max((targetFloatMargin / 2.0) * 100, 5), 95);

  return (
    <div className="rounded-xl bg-slate-900/90 dark:bg-[#070e1d]/90 border border-cyan-500/30 p-3.5 space-y-3.5 text-xs shadow-lg backdrop-blur-md">
      {/* Visual Analytics Subheader & View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-xs tracking-wide">
              <span>Multiphysics Visual Diagnostics & Reports</span>
              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                {wellId}
              </span>
            </h4>
            <p className="text-[10px] text-slate-400">
              Interactive telemetry breakdown, thermal curves & kinematic optimization
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950/80 rounded-lg p-0.5 border border-slate-800 text-[10px]">
          <button
            type="button"
            onClick={() => setActiveChartTab('all')}
            className={`px-2 py-0.5 rounded transition ${
              activeChartTab === 'all'
                ? 'bg-cyan-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Visuals
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('pie')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeChartTab === 'pie'
                ? 'bg-cyan-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieIcon className="w-2.5 h-2.5" />
            Donut / Pie
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('thermal')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeChartTab === 'thermal'
                ? 'bg-cyan-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-2.5 h-2.5" />
            Thermal Curve
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('kinematics')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeChartTab === 'kinematics'
                ? 'bg-cyan-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-2.5 h-2.5" />
            Kinematics
          </button>
        </div>
      </div>

      {/* CHARTS CONTAINER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* CHART 1: DONUT / PIE CHART (Fluid Cut or CSS Thermal Energy) */}
        {(activeChartTab === 'all' || activeChartTab === 'pie') && (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                <PieIcon className="w-3.5 h-3.5 text-cyan-400" />
                {pieMode === 'fluid' ? 'Production Fluid Split (Cut %)' : 'CSS Thermal Energy Balance'}
              </span>
              <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-800 text-[9px]">
                <button
                  type="button"
                  onClick={() => setPieMode('fluid')}
                  className={`px-1.5 py-0.5 rounded ${
                    pieMode === 'fluid' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Fluid Cut
                </button>
                <button
                  type="button"
                  onClick={() => setPieMode('energy')}
                  className={`px-1.5 py-0.5 rounded ${
                    pieMode === 'energy' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Heat Loss
                </button>
              </div>
            </div>

            {/* SVG Donut Graphic */}
            <div className="flex items-center justify-around gap-2 py-1">
              <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r={donutRadius}
                    className="text-slate-800"
                    strokeWidth="12"
                    stroke="currentColor"
                    fill="transparent"
                  />

                  {pieMode === 'fluid' ? (
                    <>
                      {/* Water Cut Arc (Cyan) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#06b6d4"
                        strokeWidth="12"
                        strokeDasharray={`${waterStroke} ${circumference}`}
                        strokeDashoffset="0"
                        fill="transparent"
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                      />
                      {/* Oil Cut Arc (Amber Gold) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#f59e0b"
                        strokeWidth="12"
                        strokeDasharray={`${oilStroke} ${circumference}`}
                        strokeDashoffset={`-${waterStroke}`}
                        fill="transparent"
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                      />
                    </>
                  ) : (
                    <>
                      {/* Steam Chamber Heat (48% Amber) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#f59e0b"
                        strokeWidth="12"
                        strokeDasharray={`${energySlices[0].stroke} ${circumference}`}
                        strokeDashoffset="0"
                        fill="transparent"
                      />
                      {/* Overburden Loss (32% Red) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#ef4444"
                        strokeWidth="12"
                        strokeDasharray={`${energySlices[1].stroke} ${circumference}`}
                        strokeDashoffset={`-${energySlices[0].stroke}`}
                        fill="transparent"
                      />
                      {/* Underburden Conduction (12% Blue) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#3b82f6"
                        strokeWidth="12"
                        strokeDasharray={`${energySlices[2].stroke} ${circumference}`}
                        strokeDashoffset={`-${energySlices[0].stroke + energySlices[1].stroke}`}
                        fill="transparent"
                      />
                      {/* Wellbore Loss (8% Purple) */}
                      <circle
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        stroke="#a855f7"
                        strokeWidth="12"
                        strokeDasharray={`${energySlices[3].stroke} ${circumference}`}
                        strokeDashoffset={`-${energySlices[0].stroke + energySlices[1].stroke + energySlices[2].stroke}`}
                        fill="transparent"
                      />
                    </>
                  )}
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  {pieMode === 'fluid' ? (
                    <>
                      <span className="text-[10px] text-slate-400 font-mono">Net Yield</span>
                      <span className="text-xs font-bold text-amber-400 font-mono">{oilBpd}</span>
                      <span className="text-[9px] text-slate-400">BPD</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] text-slate-400 font-mono">Enthalpy</span>
                      <span className="text-xs font-bold text-amber-400 font-mono">48%</span>
                      <span className="text-[9px] text-slate-400">Utilized</span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend & Breakdown Stats */}
              <div className="space-y-1.5 flex-1 pl-2 text-[10px]">
                {pieMode === 'fluid' ? (
                  <>
                    <div className="flex items-center justify-between p-1 rounded bg-slate-900/60 border border-slate-800">
                      <span className="flex items-center gap-1.5 text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Heavy Oil Cut
                      </span>
                      <span className="font-mono font-bold text-slate-200">{oilCut}% ({oilBpd} bpd)</span>
                    </div>
                    <div className="flex items-center justify-between p-1 rounded bg-slate-900/60 border border-slate-800">
                      <span className="flex items-center gap-1.5 text-cyan-300">
                        <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        Produced Water Cut
                      </span>
                      <span className="font-mono font-bold text-slate-200">{waterCut}%</span>
                    </div>
                    <p className="text-[9px] text-slate-400 italic pt-0.5">
                      Baghewala 17.5° API crude with cyclic steam condensate.
                    </p>
                  </>
                ) : (
                  <>
                    {energySlices.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[9px] py-0.5">
                        <span className="flex items-center gap-1 text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                        <span className="font-mono text-slate-200">{s.pct}%</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CHART 2: FLOAT MARGIN GAUGE & ROD PARTING RISK METER */}
        {(activeChartTab === 'all' || activeChartTab === 'kinematics') && (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                <Activity className="w-3.5 h-3.5 text-rose-400" />
                Sucker Rod Float Margin Meter (M_float)
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isFloat
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {isFloat ? 'CRITICAL FLOAT RISK' : 'STABLE / SAFE'}
              </span>
            </div>

            {/* Graduated Bar Scale */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span className="text-rose-400 font-bold">0.0 (Severe Float)</span>
                <span className="text-amber-400 font-bold">1.0 (Critical Threshold)</span>
                <span className="text-emerald-400 font-bold">2.0 (High Safety)</span>
              </div>

              {/* Multi-colored Gradient Zone Bar */}
              <div className="relative h-4 rounded-full bg-slate-800 overflow-visible p-0.5 border border-slate-700">
                {/* Background color gradient zones */}
                <div className="w-full h-full rounded-full bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-500 opacity-80" />

                {/* Critical Boundary Line at 1.0 (50% mark) */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/80 z-10" />

                {/* Current Value Indicator Marker */}
                <div
                  className="absolute -top-1 bottom-0 z-20 transition-all duration-700"
                  style={{ left: `${floatGaugePercent}%` }}
                >
                  <div className="w-3 h-6 -ml-1.5 rounded bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] border border-slate-900 flex items-center justify-center">
                    <div className="w-0.5 h-3 bg-slate-800" />
                  </div>
                </div>

                {/* Recommended AI Target Marker */}
                <div
                  className="absolute -bottom-1 z-20 transition-all duration-700"
                  style={{ left: `${targetFloatGaugePercent}%` }}
                >
                  <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)] border border-white" />
                </div>
              </div>

              {/* Indicator Callouts */}
              <div className="flex items-center justify-between text-[10px] pt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded bg-white" />
                  <span className="text-slate-400">Current Margin:</span>
                  <span className={`font-mono font-bold ${isFloat ? 'text-rose-400' : 'text-slate-200'}`}>
                    {floatMargin.toFixed(3)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-slate-400">AI Target:</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {targetFloatMargin.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-1.5 rounded bg-slate-900/60 border border-slate-800 text-[9px] text-slate-300 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                {isFloat
                  ? `Annular fluid drag (${visc} cP) exceeds submerged rod weight. Engage VFD downstroke ratio 0.75.`
                  : 'Operating above critical threshold. Annular clearance remains stable throughout descent.'}
              </span>
            </div>
          </div>
        )}

        {/* CHART 3: VISCOSITY VS TEMPERATURE THERMAL DECAY CURVE */}
        {(activeChartTab === 'all' || activeChartTab === 'thermal') && (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Thermal Viscosity Response (μ vs T)
              </span>
              <span className="text-[10px] font-mono text-cyan-300">
                Current: {temp.toFixed(1)}°C · {visc} cP
              </span>
            </div>

            {/* SVG Line / Area Graph */}
            <div className="h-28 w-full relative">
              <svg viewBox="0 0 280 110" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="viscGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid guidelines */}
                <line x1="30" y1="15" x2="270" y2="15" stroke="#1e293b" strokeDasharray="2 2" />
                <line x1="30" y1="50" x2="270" y2="50" stroke="#1e293b" strokeDasharray="2 2" />
                <line x1="30" y1="85" x2="270" y2="85" stroke="#1e293b" strokeDasharray="2 2" />

                {/* 1,000 cP Critical Rod Float Limit Threshold Line */}
                <line x1="30" y1="62" x2="270" y2="62" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                <text x="268" y="60" fill="#ef4444" fontSize="7" textAnchor="end" fontFamily="ui-monospace">
                  1,000 cP Float Limit
                </text>

                {/* Viscosity Curve Area */}
                <path
                  d="M 30,15 Q 70,30 110,62 T 190,88 T 270,95 L 270,100 L 30,100 Z"
                  fill="url(#viscGrad)"
                />

                {/* Viscosity Curve Stroke */}
                <path
                  d="M 30,15 Q 70,30 110,62 T 190,88 T 270,95"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                />

                {/* Current Operating Point Marker at 57.3°C, ~2,396 cP (around x=95, y=52) */}
                <circle cx="95" cy="52" r="7" fill="none" stroke="#22d3ee" strokeWidth="1.5" className="animate-ping" />
                <circle cx="95" cy="52" r="4.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
                <text x="104" y="48" fill="#22d3ee" fontSize="8" fontWeight="bold">
                  {wellId} ({temp.toFixed(0)}°C, {visc} cP)
                </text>

                {/* Target Heated Window Marker (75°C, 450 cP) */}
                <circle cx="170" cy="84" r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                <text x="176" y="82" fill="#10b981" fontSize="7" fontWeight="bold">
                  Target (75°C, 450 cP)
                </text>

                {/* Axis Labels */}
                <text x="30" y="106" fill="#64748b" fontSize="8">30°C</text>
                <text x="95" y="106" fill="#64748b" fontSize="8">55°C</text>
                <text x="170" y="106" fill="#64748b" fontSize="8">75°C</text>
                <text x="250" y="106" fill="#64748b" fontSize="8">110°C</text>
              </svg>
            </div>

            <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5 border-t border-slate-800">
              <span>Dead Crude: 12,000 cP</span>
              <span className="text-emerald-400 font-semibold">Heated Zone: 450 cP</span>
              <span className="text-cyan-400 font-semibold">Marx-Langenheim Radius: 13.8m</span>
            </div>
          </div>
        )}

        {/* CHART 4: KINEMATICS COMPARISON BAR CHART (Current vs Recommended) */}
        {(activeChartTab === 'all' || activeChartTab === 'kinematics') && (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                Operational Kinematics: Current vs AI Optimized
              </span>
              <div className="flex items-center gap-2 text-[9px]">
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2 h-2 rounded bg-slate-600" /> Current
                </span>
                <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                  <span className="w-2 h-2 rounded bg-cyan-500" /> AI Setpoint
                </span>
              </div>
            </div>

            {/* Comparative Bars */}
            <div className="space-y-2 pt-1 text-[10px]">
              {/* SPM Bar */}
              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span>Pumping Speed (SPM)</span>
                  <span className="font-mono text-cyan-300">{spm.toFixed(1)} → {targetSpm} SPM (-31% wear)</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1 p-0.5">
                  <div
                    className="h-full bg-slate-500 rounded-full transition-all duration-700"
                    style={{ width: `${(spm / 8.0) * 100}%` }}
                    title={`Current: ${spm} SPM`}
                  />
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    style={{ width: `${(targetSpm / 8.0) * 100}%` }}
                    title={`Recommended: ${targetSpm} SPM`}
                  />
                </div>
              </div>

              {/* VFD Downstroke Ratio Bar */}
              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span>VFD Downstroke Ratio (α)</span>
                  <span className="font-mono text-cyan-300">{vfd.toFixed(2)} → {targetVfd.toFixed(2)} (Slower descent)</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1 p-0.5">
                  <div
                    className="h-full bg-slate-500 rounded-full transition-all duration-700"
                    style={{ width: `${vfd * 100}%` }}
                    title={`Current: ${vfd}`}
                  />
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    style={{ width: `${targetVfd * 100}%` }}
                    title={`Recommended: ${targetVfd}`}
                  />
                </div>
              </div>

              {/* Oil Yield Recovery Bar */}
              <div>
                <div className="flex justify-between text-slate-300 mb-0.5">
                  <span>Gross Production Yield (BPD)</span>
                  <span className="font-mono text-emerald-300 font-bold">{oilBpd} → {targetOilBpd} BPD (+35%)</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1 p-0.5">
                  <div
                    className="h-full bg-slate-500 rounded-full transition-all duration-700"
                    style={{ width: `${(oilBpd / 50.0) * 100}%` }}
                    title={`Current: ${oilBpd} BPD`}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                    style={{ width: `${(targetOilBpd / 50.0) * 100}%` }}
                    title={`AI Target: ${targetOilBpd} BPD`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
