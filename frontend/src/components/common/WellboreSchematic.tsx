import React, { useState, useEffect } from 'react';
import { ProvenanceBadge } from './ProvenanceBadge';
import { Play, Pause, ChevronUp, ChevronDown } from 'lucide-react';

interface WellboreSchematicProps {
  depthM?: number;
  pumpDepthM?: number;
  temperatureC?: number;
  viscosityCp?: number;
  apiGravity?: number;
  wellheadPressureBar?: number;
  intakePressureBar?: number;
  tubingPressureBar?: number;
  tubingTempC?: number;
  steamChamberTempC?: number;
  wellName?: string;
  isFloating?: boolean;
  isPumping?: boolean;
  spm?: number;
  strokeLengthIn?: number;
  vfdRatio?: number;
  isLiveSimulation?: boolean;
  currentDay?: number;
  onSpmChange?: (spm: number) => void;
  onTogglePumping?: () => void;
}

export const WellboreSchematic: React.FC<WellboreSchematicProps> = ({
  depthM = 1050,
  pumpDepthM = 980,
  temperatureC = 58,
  viscosityCp = 2300,
  apiGravity = 18.0,
  wellheadPressureBar = 5.0,
  intakePressureBar = 6.0,
  tubingPressureBar = 4.8,
  tubingTempC = 58,
  steamChamberTempC = 220,
  wellName = 'BGW-01',
  isFloating = false,
  isPumping = true,
  spm = 4.2,
  strokeLengthIn: _strokeLengthIn = 86.0,
  vfdRatio: _vfdRatio = 0.85,
  isLiveSimulation: _isLiveSimulation = false,
  currentDay: _currentDay = 1,
  onSpmChange,
  onTogglePumping,
}) => {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [strokePhase, setStrokePhase] = useState<number>(0);
  const [fluidScrollOffset, setFluidScrollOffset] = useState<number>(0);
  const [internalRunning, setInternalRunning] = useState<boolean>(isPumping);
  const [internalSpm, setInternalSpm] = useState<number>(spm);

  // Sync internal running state with parent prop if prop changes
  useEffect(() => {
    setInternalRunning(isPumping);
  }, [isPumping]);

  // Sync internal SPM with parent prop
  useEffect(() => {
    setInternalSpm(spm);
  }, [spm]);

  // Dynamic kinematic animation loop (30 FPS)
  useEffect(() => {
    if (!internalRunning) return;
    const intervalMs = 33;
    // Step per tick based on current SPM
    const step = (Math.max(internalSpm, 0.5) / 60) * (intervalMs / 1000);
    const timer = setInterval(() => {
      setStrokePhase((prev) => (prev + step) % 1);
      setFluidScrollOffset((prev) => (prev + 3.0) % 240);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [internalRunning, internalSpm]);

  const handleTogglePumping = () => {
    const nextState = !internalRunning;
    setInternalRunning(nextState);
    if (onTogglePumping) onTogglePumping();
  };

  const handleAdjustSpm = (delta: number) => {
    const nextSpm = Math.max(1.0, Math.min(12.0, parseFloat((internalSpm + delta).toFixed(1))));
    setInternalSpm(nextSpm);
    if (onSpmChange) onSpmChange(nextSpm);
  };

  // Kinematic calculations
  const isUpstroke = strokePhase < 0.5;
  const phaseInDirection = isUpstroke ? strokePhase / 0.5 : (strokePhase - 0.5) / 0.5;
  const cyclePercent = Math.round(strokePhase * 100);

  // Smooth harmonic oscillation
  const angle = strokePhase * 2 * Math.PI;
  const rodOffset = internalRunning ? -14 * Math.sin(angle) : 0;
  const beamTilt = internalRunning ? -7.5 * Math.sin(angle) : 0;

  // Real-time instantaneous Polished Rod Load (lbs)
  // Upstroke: Base rod string + lifted fluid column + upward acceleration + viscous drag
  // Downstroke: Base rod string - buoyancy/fluid offload + downward deceleration - viscous buoyant drag
  const baseRodWeight = 9450;
  const fluidColumnWeight = 4400;
  const accelerationLbs = 1150 * Math.cos(angle);
  const viscousDragLbs = (viscosityCp / 1000) * 360;

  const dynLoadLbs = Math.round(
    internalRunning
      ? isUpstroke
        ? baseRodWeight + fluidColumnWeight * Math.sin(strokePhase * Math.PI) + accelerationLbs + viscousDragLbs
        : baseRodWeight - 2500 + accelerationLbs * 0.6 - viscousDragLbs * 0.7 - (isFloating ? 1800 : 0)
      : baseRodWeight + fluidColumnWeight * 0.5
  );

  // Dynamic stroke-coupled pressure fluctuations
  const dynWHP = (
    wellheadPressureBar +
    (internalRunning ? (isUpstroke ? Math.sin(phaseInDirection * Math.PI) * 0.32 : -0.08) : 0)
  ).toFixed(2);

  const dynPIP = (
    intakePressureBar -
    (internalRunning ? (isUpstroke ? Math.sin(phaseInDirection * Math.PI) * 0.42 : -0.12) : 0)
  ).toFixed(2);

  const dynTubingP = (
    tubingPressureBar +
    (internalRunning ? (isUpstroke ? Math.sin(phaseInDirection * Math.PI) * 0.28 : -0.06) : 0)
  ).toFixed(2);

  // Valve states
  const tvStatus = isUpstroke ? 'CLOSED' : 'OPEN';
  const svStatus = isUpstroke ? 'OPEN' : 'CLOSED';

  // Dynamic steam halo geometry
  const tempScale = Math.min(1.0, Math.max(0.1, (steamChamberTempC - 40) / 220));
  const haloRx = 95 + tempScale * 55 + (internalRunning ? Math.sin(strokePhase * 4 * Math.PI) * 2.5 : 0);
  const haloRy = 55 + tempScale * 35 + (internalRunning ? Math.cos(strokePhase * 4 * Math.PI) * 1.5 : 0);
  const activeRadiusM = (6.0 + tempScale * 9.5).toFixed(1);

  // Fluid color based on viscosity
  const fluidColorPrimary =
    viscosityCp > 1800 ? '#78350f' : viscosityCp > 800 ? '#b45309' : '#f59e0b';
  const fluidColorSecondary =
    viscosityCp > 1800 ? '#451a03' : viscosityCp > 800 ? '#78350f' : '#d97706';

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col shadow-xs overflow-hidden">
      {/* 1. Header with Title, Mode, and Viewport Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                internalRunning ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
              }`}
            />
            <span
              className={`absolute w-2 h-2 rounded-full ${
                internalRunning ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Digital Twin Kinematics — {wellName}
          </h3>
          <ProvenanceBadge tier="SIMULATED" variant="bracket" />
        </div>

        {/* View Controls & 2D/3D Switcher */}
        <div className="flex items-center gap-2">
          {/* Quick SPM Adjuster */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => handleAdjustSpm(-0.2)}
              title="Decrease SPM"
              className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded font-mono font-bold transition-colors"
            >
              -
            </button>
            <span className="px-2 font-mono font-semibold text-slate-800 dark:text-slate-100">
              {internalSpm.toFixed(1)} SPM
            </span>
            <button
              onClick={() => handleAdjustSpm(0.2)}
              title="Increase SPM"
              className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded font-mono font-bold transition-colors"
            >
              +
            </button>
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={handleTogglePumping}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
              internalRunning
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
            }`}
          >
            {internalRunning ? (
              <>
                <Pause className="w-3 h-3" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3 h-3" /> Run
              </>
            )}
          </button>

          {/* 2D / 3D Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === '2d'
                  ? 'bg-slate-900 dark:bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              2D Twin
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === '3d'
                  ? 'bg-slate-900 dark:bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              3D Strata
            </button>
          </div>
        </div>
      </div>

      {/* 2. Real-Time Dynamic Kinematics HUD Ribbon */}
      <div className="bg-[#0b1222] text-white rounded-xl p-3 mb-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs border border-slate-800/90 shadow-md">
        {/* Stroke Direction & Phase */}
        <div className="flex flex-col justify-center min-w-0">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate">
            Stroke Phase ({cyclePercent}%)
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap overflow-hidden">
            {isUpstroke ? (
              <span className="flex items-center text-emerald-400 font-bold text-xs shrink-0">
                <ChevronUp className="w-3.5 h-3.5" /> UPSTROKE
              </span>
            ) : (
              <span className="flex items-center text-sky-400 font-bold text-xs shrink-0">
                <ChevronDown className="w-3.5 h-3.5" /> DOWNSTROKE
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono">
              ({Math.round(phaseInDirection * 100)}%)
            </span>
          </div>
        </div>

        {/* Polished Rod Load */}
        <div className="flex flex-col justify-center border-l border-slate-800/80 pl-3 min-w-0">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate">
            Rod Load (PRL)
          </span>
          <span className="font-mono font-bold text-amber-300 text-xs mt-0.5 truncate">
            {dynLoadLbs.toLocaleString()} lbs
          </span>
        </div>

        {/* Valves Status */}
        <div className="flex flex-col justify-center border-l border-slate-800/80 pl-3 min-w-0">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate">
            Pump Valves
          </span>
          <div className="flex items-center flex-wrap gap-1 mt-0.5 text-[11px] font-mono">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                tvStatus === 'CLOSED'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
              }`}
            >
              TV: {tvStatus}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                svStatus === 'OPEN'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                  : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
              }`}
            >
              SV: {svStatus}
            </span>
          </div>
        </div>

        {/* Instantaneous Pressures */}
        <div className="flex flex-col justify-center border-l border-slate-800/80 pl-3 min-w-0">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate">
            WHP / PIP Dynamic
          </span>
          <div className="flex items-center flex-wrap gap-1 text-[11px] font-mono mt-0.5">
            <span className="text-cyan-400 font-bold">{dynWHP}</span>
            <span className="text-slate-600">/</span>
            <span className="text-amber-400 font-bold">{dynPIP} bar</span>
          </div>
        </div>
      </div>

      {/* 3. Main Diagram Area */}
      <div className="relative w-full rounded-xl overflow-hidden bg-slate-900 min-h-[580px] flex items-center justify-center">
        {viewMode === '3d' ? (
          /* 3D Photorealistic Geological Cutaway with Real-Time Kinematics & Fluid Animation */
          <div className="relative w-full h-[640px] overflow-hidden bg-slate-950 flex items-center justify-center select-none">
            {/* Background: Photorealistic 3D Geological Cutaway Render */}
            <img
              src="/wellbore_geology.jpg"
              alt="3D Wellbore Geological Cutaway"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />

            {/* Subtle top/bottom contrast gradient (No heavy side blackout) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35 pointer-events-none" />

            {/* Real-Time Animated SVG Glow & Kinematics Overlay aligned with wellbore */}
            <svg
              viewBox="0 0 540 640"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              <defs>
                <radialGradient id="steamAura3D" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.75" />
                  <stop offset="45%" stopColor="#ea580c" stopOpacity="0.45" />
                  <stop offset="75%" stopColor="#c2410c" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Surface Wellhead Stuffing Box & Reciprocating Polished Rod (Centered at x: 270) */}
              <g transform="translate(270, 20)">
                {/* Surface walking beam & horsehead rocking */}
                <line
                  x1="-35"
                  y1={25 - beamTilt}
                  x2="35"
                  y2={33 + beamTilt}
                  stroke="#1e293b"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Horsehead arc rocking */}
                <path
                  d={`M -35 ${25 - beamTilt} C -42 ${28 - beamTilt}, -45 ${36 - beamTilt}, -38 ${42 - beamTilt}`}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="4"
                />
                {/* Polished rod bridle */}
                <line
                  x1="-38"
                  y1={42 - beamTilt}
                  x2="0"
                  y2={48 + rodOffset}
                  stroke="#f8fafc"
                  strokeWidth="2"
                />
                {/* Wellhead stuffing box gland */}
                <rect x="-8" y="44" width="16" height="8" fill="#334155" stroke="#64748b" strokeWidth="1" rx="1.5" />
              </g>

              {/* Thermal Steam Chamber Radial Glow in Reservoir (at bottom y: 525, Centered at x: 270) */}
              <g style={{ mixBlendMode: 'screen' }}>
                <ellipse cx="270" cy="525" rx={haloRx} ry={haloRy} fill="url(#steamAura3D)" />
                {/* Soft breathing heat dissipation rings */}
                <ellipse
                  cx="270"
                  cy="525"
                  rx={haloRx * 0.72}
                  ry={haloRy * 0.68}
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  strokeDashoffset={-fluidScrollOffset * 0.5}
                  opacity="0.8"
                />
                <ellipse
                  cx="270"
                  cy="525"
                  rx={haloRx * 0.42}
                  ry={haloRy * 0.38}
                  fill="none"
                  stroke="#fdba74"
                  strokeWidth="2.5"
                  strokeDasharray="3 3"
                  strokeDashoffset={fluidScrollOffset * 0.5}
                  opacity="0.9"
                />
              </g>

              {/* Luminous Animated Fluid Flow Stream inside the Wellbore (x: 270, y: 70 to 495) */}
              <g style={{ mixBlendMode: 'screen' }}>
                {/* Ambient glowing fluid column */}
                <line
                  x1="270"
                  y1="70"
                  x2="270"
                  y2="495"
                  stroke={fluidColorPrimary}
                  strokeWidth="8"
                  opacity={isUpstroke ? 0.6 : 0.3}
                  strokeLinecap="round"
                />
                {/* Rapid upward fluid stream pulses */}
                {internalRunning && (
                  <>
                    <line
                      x1="268"
                      y1="70"
                      x2="268"
                      y2="495"
                      stroke="#fef08a"
                      strokeWidth="2"
                      strokeDasharray="16 20"
                      strokeDashoffset={-fluidScrollOffset * 1.8}
                      opacity={isUpstroke ? 0.95 : 0.4}
                    />
                    <line
                      x1="272"
                      y1="70"
                      x2="272"
                      y2="495"
                      stroke="#fde047"
                      strokeWidth="2"
                      strokeDasharray="14 22"
                      strokeDashoffset={-fluidScrollOffset * 1.5 - 25}
                      opacity={isUpstroke ? 0.85 : 0.3}
                    />
                  </>
                )}
              </g>

              {/* Reciprocating Polished Steel Sucker Rod String */}
              <line
                x1="270"
                y1={68 + rodOffset}
                x2="270"
                y2={495 + rodOffset}
                stroke={isFloating ? '#ef4444' : '#ffffff'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Rod couplings */}
              {[120, 180, 240, 300, 360, 420, 480].map((y) => (
                <rect
                  key={y}
                  x="268"
                  y={y + rodOffset}
                  width="4"
                  height="5"
                  fill="#ffffff"
                  rx="1"
                  opacity="0.9"
                />
              ))}

              {/* Subsurface SRP Plunger & Valves (at pump intake y: 495) */}
              <g transform={`translate(263, ${495 + rodOffset})`}>
                <rect
                  x="0"
                  y="0"
                  width="14"
                  height="20"
                  fill="#0284c7"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  rx="1"
                />
                {/* Traveling Valve Ball (seated red on upstroke, lifted green on downstroke) */}
                <circle
                  cx="7"
                  cy={isUpstroke ? 12 : 7}
                  r="3"
                  fill={tvStatus === 'CLOSED' ? '#ef4444' : '#10b981'}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                />
              </g>

              {/* Standing Valve at Barrel Base (fixed at y: 512) */}
              <g transform="translate(270, 514)">
                <circle
                  cx="0"
                  cy={isUpstroke ? -2 : 1}
                  r="3"
                  fill={svStatus === 'OPEN' ? '#10b981' : '#ef4444'}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                />
              </g>

              {/* Perforation Inflow Arrows crawling into wellbore (y: 525 to 555) */}
              {[-1, 1].map((dir, i) => (
                <g key={i}>
                  {[528, 538, 548].map((y) => (
                    <g key={y}>
                      <circle cx={270 + dir * 18} cy={y} r="2" fill="#f97316" />
                      <line
                        x1={270 + dir * 42}
                        y1={y}
                        x2={270 + dir * 20}
                        y2={y}
                        stroke="#f97316"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                        strokeDashoffset={dir * (internalRunning ? -fluidScrollOffset * 0.8 : 0)}
                        opacity={isUpstroke ? 0.95 : 0.45}
                      />
                    </g>
                  ))}
                </g>
              ))}
            </svg>

            {/* Ultra-Minimalist Geological Depth Ruler (Far Left) */}
            <div className="absolute left-2.5 top-3 bottom-3 flex flex-col justify-between z-10 pointer-events-none">
              {[
                { label: '0 m', name: 'Surface', color: 'bg-emerald-400' },
                { label: `${Math.round(depthM * 0.24)} m`, name: 'Conductor', color: 'bg-slate-400' },
                { label: `${Math.round(depthM * 0.48)} m`, name: 'Intermediate', color: 'bg-slate-400' },
                { label: `${Math.round(depthM * 0.72)} m`, name: 'Production', color: 'bg-sky-400' },
                { label: `${Math.round(pumpDepthM)} m`, name: 'Pump Intake', color: 'bg-amber-400 animate-pulse' },
                { label: `${Math.round(depthM)} m`, name: 'Reservoir', color: 'bg-orange-500 animate-ping' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 bg-slate-950/50 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-[10px] font-mono text-slate-200 shadow-sm">
                    <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-[9px] text-slate-400 hidden sm:inline">· {item.name}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Telemetry Callout 1: Wellhead Pressure (Top-Right) */}
            <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md border border-sky-500/40 text-white p-2.5 rounded-xl text-xs shadow-xl space-y-0.5 z-10 max-w-[190px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-sky-400 font-semibold uppercase">Wellhead Status</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="font-mono text-sm font-bold text-white">{dynWHP} bar WHP</div>
              <div className="text-[10px] text-slate-300">
                Discharge:{' '}
                <strong className={isUpstroke ? 'text-emerald-300' : 'text-sky-300'}>
                  {isUpstroke ? 'Fluid to Header' : 'Static Hold'}
                </strong>
              </div>
            </div>

            {/* Telemetry Callout 2: Pump Assembly & Valves (Mid-Right @ ~55% depth) */}
            <div className="absolute top-[52%] right-3 -translate-y-1/2 bg-slate-900/80 backdrop-blur-md border border-amber-500/40 text-white p-2.5 rounded-xl text-xs shadow-xl space-y-1 z-10 max-w-[200px]">
              <div className="flex items-center justify-between gap-2 pb-0.5 border-b border-slate-700/60">
                <span className="text-[10px] text-amber-400 font-semibold uppercase">Pump Assembly</span>
                <span className="text-[10px] font-mono text-amber-300">@ {pumpDepthM} m</span>
              </div>
              <div className="font-mono text-xs font-bold text-white flex justify-between">
                <span>PIP: {dynPIP} bar</span>
                <span className="text-amber-300">{dynLoadLbs.toLocaleString()} lbs</span>
              </div>
              <div className="text-[10px] font-mono flex items-center gap-1">
                <span
                  className={`px-1.5 py-0.2 rounded font-bold ${
                    tvStatus === 'CLOSED'
                      ? 'bg-rose-900/80 text-rose-300'
                      : 'bg-emerald-900/80 text-emerald-300'
                  }`}
                >
                  TV:{tvStatus}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded font-bold ${
                    svStatus === 'OPEN'
                      ? 'bg-emerald-900/80 text-emerald-300'
                      : 'bg-rose-900/80 text-rose-300'
                  }`}
                >
                  SV:{svStatus}
                </span>
              </div>
            </div>

            {/* Telemetry Callout 3: Steam Chamber Front (Bottom-Right corner, leaving reservoir open) */}
            <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md border border-orange-500/50 text-white p-2.5 rounded-xl text-xs shadow-xl space-y-0.5 z-10 max-w-[215px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-orange-400 font-semibold uppercase">Steam Chamber</span>
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-ping" />
              </div>
              <div className="text-xs font-bold text-orange-300 font-mono">
                ~ {steamChamberTempC} °C · Front {activeRadiusM} m
              </div>
              <div className="text-[10px] text-slate-300 font-mono">
                Viscosity: <strong className="text-amber-300">{Math.round(viscosityCp).toLocaleString()} cP</strong>
              </div>
            </div>
          </div>
        ) : (
          /* 2D Architectural Schematic View with Dynamic Kinematics */
          <div className="w-full h-full relative select-none">
            <svg
              viewBox="0 0 540 640"
              className="w-full h-auto max-h-[640px]"
              style={{ background: '#1c1917' }}
            >
              <defs>
                {/* Stratified Earth Patterns */}
                <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#7dd3fc" />
                  <stop offset="60%" stopColor="#bae6fd" />
                  <stop offset="100%" stopColor="#e0f2fe" />
                </linearGradient>

                <linearGradient id="desertSurface" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>

                <linearGradient id="shaleLayer1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#44403c" />
                  <stop offset="100%" stopColor="#292524" />
                </linearGradient>

                <linearGradient id="sandstoneLayer" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#78350f" />
                  <stop offset="50%" stopColor="#92400e" />
                  <stop offset="100%" stopColor="#5a2e0e" />
                </linearGradient>

                <linearGradient id="reservoirRock" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#292524" />
                  <stop offset="50%" stopColor="#1c1917" />
                  <stop offset="100%" stopColor="#0c0a09" />
                </linearGradient>

                {/* Steam Chamber Glow Radial */}
                <radialGradient id="steamHalo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ea580c" stopOpacity="0.88" />
                  <stop offset="35%" stopColor="#f97316" stopOpacity="0.65" />
                  <stop offset="70%" stopColor="#fdba74" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
                </radialGradient>

                {/* Dynamic Crude Oil Fluid Column Linear */}
                <linearGradient id="fluidFlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={fluidColorSecondary} />
                  <stop offset="50%" stopColor={fluidColorPrimary} />
                  <stop offset="100%" stopColor={fluidColorSecondary} />
                </linearGradient>
              </defs>

              {/* Sky Background at Surface (y: 0 to 60) */}
              <rect x="0" y="0" width="540" height="60" fill="url(#skyGrad)" />

              {/* Distant desert mountain horizon */}
              <path
                d="M 0 55 Q 60 45 120 52 T 260 48 T 420 54 T 540 50 L 540 60 L 0 60 Z"
                fill="#ca8a04"
                opacity="0.4"
              />

              {/* Surface Machinery: SRP Pumpjack & Kinematics */}
              <g transform="translate(180, 10)">
                {/* Samson post legs (support frame) */}
                <polygon points="45,45 35,55 55,55" fill="#334155" />
                <line x1="45" y1="45" x2="45" y2="55" stroke="#475569" strokeWidth="2" />

                {/* Walking beam rotating with stroke */}
                <line
                  x1="18"
                  y1={40 - beamTilt}
                  x2="68"
                  y2={48 + beamTilt}
                  stroke="#1e293b"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />

                {/* Counterweights rotating */}
                <ellipse
                  cx="66"
                  cy={50 + beamTilt * 0.8}
                  rx="7"
                  ry="5"
                  fill="#64748b"
                  stroke="#334155"
                  strokeWidth="1"
                />

                {/* Horsehead rocking with walking beam */}
                <path
                  d={`M 18 ${40 - beamTilt} C 12 ${43 - beamTilt}, 10 ${50 - beamTilt}, 15 ${54 - beamTilt}`}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="4.5"
                />

                {/* Polished rod hanger bridles */}
                <line
                  x1="15"
                  y1={54 - beamTilt}
                  x2="15"
                  y2={65 + rodOffset}
                  stroke="#94a3b8"
                  strokeWidth="2"
                />

                {/* Stuffing box at wellhead */}
                <rect x="11" y="55" width="8" height="6" fill="#475569" rx="1" />
              </g>

              {/* Distant Oil Storage Tanks & Rig */}
              <g transform="translate(380, 25)" opacity="0.85">
                <rect x="0" y="15" width="28" height="20" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
                <rect x="34" y="12" width="32" height="23" rx="2" fill="#e2e8f0" stroke="#94a3b8" />
                <line x1="75" y1="10" x2="75" y2="35" stroke="#475569" strokeWidth="1.5" />
                <circle cx="75" cy="8" r="2" fill="#f59e0b" />
              </g>

              {/* Surface Ground Line (y: 60) */}
              <rect x="0" y="60" width="540" height="8" fill="url(#desertSurface)" />

              {/* Stratified Earth Layers */}
              {/* Layer 1: Shallow Sand & Overburden (y: 68 to 170) */}
              <rect x="0" y="68" width="540" height="102" fill="url(#shaleLayer1)" />
              {/* Layer 2: Intermediate Sandstone (y: 170 to 280) */}
              <rect x="0" y="170" width="540" height="110" fill="url(#sandstoneLayer)" />
              {/* Layer 3: Caprock Shale (y: 280 to 420) */}
              <rect x="0" y="280" width="540" height="140" fill="url(#shaleLayer1)" />
              {/* Layer 4: Jodhpur Sandstone Heavy Oil Reservoir (y: 420 to 640) */}
              <rect x="0" y="420" width="540" height="220" fill="url(#reservoirRock)" />

              {/* Subtle stratum boundary lines */}
              <line
                x1="0"
                y1="170"
                x2="540"
                y2="170"
                stroke="#1c1917"
                strokeWidth="1"
                strokeDasharray="6 3"
                opacity="0.6"
              />
              <line
                x1="0"
                y1="280"
                x2="540"
                y2="280"
                stroke="#1c1917"
                strokeWidth="1"
                strokeDasharray="6 3"
                opacity="0.6"
              />
              <line x1="0" y1="420" x2="540" y2="420" stroke="#0c0a09" strokeWidth="2" />

              {/* Thermal Steam Chamber Radial Glow in Reservoir (Dynamic Scaling) */}
              <ellipse cx="270" cy="530" rx={haloRx} ry={haloRy} fill="url(#steamHalo)" />

              {/* Steam front heat propagation pulsating wave effect */}
              <ellipse
                cx="270"
                cy="530"
                rx={haloRx * 0.78}
                ry={haloRy * 0.76}
                fill="none"
                stroke="#ea580c"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeDashoffset={-fluidScrollOffset * 0.5}
                opacity="0.75"
              />
              <ellipse
                cx="270"
                cy="530"
                rx={haloRx * 0.5}
                ry={haloRy * 0.48}
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeDasharray="3 3"
                strokeDashoffset={fluidScrollOffset * 0.5}
                opacity="0.85"
              />

              {/* Central Wellbore Column (Centered at x = 270) */}
              {/* 1. Conductor Casing 20" (0 to 170 px -> 250 m) */}
              <rect x="251" y="60" width="38" height="110" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />

              {/* 2. Intermediate Casing 13 3/8" (0 to 280 px -> 500 m) */}
              <rect x="254" y="170" width="32" height="110" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />

              {/* 3. Production Casing 9 5/8" (0 to 420 px -> 750 m) */}
              <rect x="257" y="280" width="26" height="140" fill="#475569" stroke="#cbd5e1" strokeWidth="1.2" />

              {/* 4. Production Tubing 2 7/8" (0 to 510 px -> 1,020 m) with Fluid Gradient */}
              <rect
                x="261"
                y="60"
                width="18"
                height="450"
                fill="url(#fluidFlow)"
                stroke="#0284c7"
                strokeWidth="1"
                opacity="0.95"
              />

              {/* Dynamic Flow Streams inside Tubing (Moving Upward to Surface) */}
              {internalRunning && (
                <g>
                  {/* Left Fluid Stream Line */}
                  <line
                    x1="264"
                    y1="62"
                    x2="264"
                    y2="505"
                    stroke="#fef08a"
                    strokeWidth="1.5"
                    strokeDasharray="14 18"
                    strokeDashoffset={-fluidScrollOffset * 1.5}
                    opacity={isUpstroke ? 0.85 : 0.3}
                  />
                  {/* Right Fluid Stream Line */}
                  <line
                    x1="276"
                    y1="62"
                    x2="276"
                    y2="505"
                    stroke="#fde047"
                    strokeWidth="1.5"
                    strokeDasharray="16 20"
                    strokeDashoffset={-fluidScrollOffset * 1.8 - 30}
                    opacity={isUpstroke ? 0.75 : 0.25}
                  />
                </g>
              )}

              {/* Sucker Rod String (Central polished steel line with dynamic stroke) */}
              <line
                x1="270"
                y1={60 + rodOffset}
                x2="270"
                y2={505 + rodOffset}
                stroke={isFloating ? '#ef4444' : '#ffffff'}
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Rod Couplings along the string */}
              {[110, 160, 210, 260, 310, 360, 410, 460].map((y) => (
                <rect
                  key={y}
                  x="268"
                  y={y + rodOffset}
                  width="4"
                  height="6"
                  fill="#f8fafc"
                  rx="1"
                />
              ))}

              {/* Subsurface Sucker Rod Pump Assembly (at Intake Depth -> y: 505) */}
              {/* Outer Pump Barrel (Fixed in tubing string) */}
              <g transform="translate(259, 500)">
                <rect
                  x="0"
                  y="0"
                  width="22"
                  height="36"
                  fill="#0f172a"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  rx="1"
                  opacity="0.85"
                />

                {/* Standing Valve (SV) at Barrel Bottom (Fixed) */}
                <g transform="translate(11, 28)">
                  {/* Valve seat */}
                  <rect x="-6" y="2" width="12" height="3" fill="#64748b" rx="0.5" />
                  {/* Valve ball (Lifts during upstroke suction, seats on downstroke) */}
                  <circle
                    cx="0"
                    cy={isUpstroke ? -2 : 1}
                    r="3.5"
                    fill={svStatus === 'OPEN' ? '#10b981' : '#ef4444'}
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                </g>
              </g>

              {/* Moving Plunger with Traveling Valve (Moves with Rod String) */}
              <g transform={`translate(262, ${505 + rodOffset})`}>
                {/* Plunger sleeve */}
                <rect
                  x="0"
                  y="0"
                  width="16"
                  height="22"
                  fill="#0284c7"
                  stroke="#7dd3fc"
                  strokeWidth="1.2"
                  rx="1"
                />

                {/* Traveling Valve (TV) inside Plunger */}
                {/* Valve seat */}
                <rect x="2" y="14" width="12" height="2" fill="#94a3b8" />
                {/* TV Ball (Seats on upstroke carrying fluid, floats open on downstroke) */}
                <circle
                  cx="8"
                  cy={isUpstroke ? 13 : 8}
                  r="3.2"
                  fill={tvStatus === 'CLOSED' ? '#ef4444' : '#10b981'}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                />

                {/* Plunger valve cage fluid bypass slots */}
                <line x1="4" y1="5" x2="4" y2="12" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
                <line x1="12" y1="5" x2="12" y2="12" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
              </g>

              {/* Reservoir Perforations & Inflow Arrows with Dynamic Crawl (y: 535 to 570) */}
              {[-1, 1].map((dir, i) => (
                <g key={i}>
                  {[538, 548, 558, 568].map((y) => (
                    <g key={y}>
                      {/* Perforation hole in production casing */}
                      <circle cx={270 + dir * 14} cy={y} r="2.2" fill="#f97316" />
                      {/* Fluid / Steam inflow arrow animated towards wellbore */}
                      <line
                        x1={270 + dir * 38}
                        y1={y}
                        x2={270 + dir * 16}
                        y2={y}
                        stroke="#f97316"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                        strokeDashoffset={dir * (internalRunning ? -fluidScrollOffset * 0.8 : 0)}
                        opacity={isUpstroke ? 0.95 : 0.45}
                      />
                    </g>
                  ))}
                </g>
              ))}

              {/* LEFT DEPTH & CASING LABELS WITH HIGH-CONTRAST HUD BADGES & LEADER LINES */}
              <g className="text-[10px] font-sans">
                {/* Surface (0 m) */}
                <g>
                  <rect x="12" y="52" width="164" height="24" rx="4" fill="#080e1a" fillOpacity="0.9" stroke="#1e293b" strokeWidth="1" />
                  <text x="22" y="68" className="fill-white font-semibold text-[10px]">Surface Wellhead · 0 m</text>
                  <line x1="176" y1="64" x2="251" y2="65" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                </g>

                {/* Conductor Casing 20" @ 94 lb/ft */}
                <g>
                  <rect x="12" y="150" width="164" height="28" rx="4" fill="#080e1a" fillOpacity="0.9" stroke="#1e293b" strokeWidth="1" />
                  <text x="22" y="163" className="fill-slate-100 font-semibold text-[10px]">Conductor: 20" @ 94 lb/ft</text>
                  <text x="22" y="174" className="fill-cyan-400 font-mono text-[9px]">{Math.round(depthM * 0.24)} m TVD · Surface Seal</text>
                  <line x1="176" y1="164" x2="251" y2="165" stroke="#00f0ff" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                </g>

                {/* Intermediate Casing 13 3/8" @ 68 lb/ft */}
                <g>
                  <rect x="12" y="260" width="164" height="28" rx="4" fill="#080e1a" fillOpacity="0.9" stroke="#1e293b" strokeWidth="1" />
                  <text x="22" y="273" className="fill-slate-100 font-semibold text-[10px]">Intermed: 13 3/8" @ 68 lb/ft</text>
                  <text x="22" y="284" className="fill-cyan-400 font-mono text-[9px]">{Math.round(depthM * 0.48)} m TVD · Aquifer Seal</text>
                  <line x1="176" y1="274" x2="254" y2="275" stroke="#00f0ff" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                </g>

                {/* Production Casing 9 5/8" @ 47 lb/ft */}
                <g>
                  <rect x="12" y="350" width="164" height="28" rx="4" fill="#080e1a" fillOpacity="0.9" stroke="#1e293b" strokeWidth="1" />
                  <text x="22" y="363" className="fill-slate-100 font-semibold text-[10px]">Prod Casing: 9 5/8" @ 47 lb/ft</text>
                  <text x="22" y="374" className="fill-cyan-400 font-mono text-[9px]">{Math.round(depthM * 0.72)} m TVD · Liner Top</text>
                  <line x1="176" y1="364" x2="257" y2="365" stroke="#00f0ff" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                </g>

                {/* Tubing 2 7/8" @ 6.5 lb/ft */}
                <g>
                  <rect x="12" y="420" width="164" height="26" rx="4" fill="#080e1a" fillOpacity="0.9" stroke="#0284c7" strokeWidth="1" />
                  <text x="22" y="433" className="fill-sky-300 font-semibold text-[10px]">Tubing: 2 7/8" @ 6.5 lb/ft</text>
                  <text x="22" y="443" className="fill-slate-300 font-mono text-[9px]">L-80 Thermal Grade</text>
                  <line x1="176" y1="433" x2="261" y2="435" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.8" />
                </g>

                {/* Subsurface Sucker Rod Pump */}
                <g>
                  <rect x="12" y="498" width="164" height="30" rx="4" fill="#080e1a" fillOpacity="0.92" stroke="#d97706" strokeWidth="1.2" />
                  <text x="22" y="512" className="fill-amber-300 font-bold text-[10px]">Subsurface SRP Pump</text>
                  <text x="22" y="524" className="fill-white font-mono text-[9px]">Intake Depth: {Math.round(pumpDepthM)} m</text>
                  <line x1="176" y1="513" x2="259" y2="512" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.9" />
                </g>

                {/* Reservoir Top */}
                <g>
                  <rect x="12" y="565" width="164" height="26" rx="4" fill="#080e1a" fillOpacity="0.9" stroke="#ea580c" strokeWidth="1" />
                  <text x="22" y="578" className="fill-orange-400 font-semibold text-[10px]">Jodhpur Reservoir Top</text>
                  <text x="22" y="588" className="fill-slate-300 font-mono text-[9px]">{Math.round(depthM - 40)} m TVD · 58 °C</text>
                  <line x1="176" y1="578" x2="257" y2="580" stroke="#ea580c" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
                </g>

                {/* Target Heavy Oil Zone */}
                <g>
                  <rect x="12" y="608" width="164" height="26" rx="4" fill="#080e1a" fillOpacity="0.92" stroke="#ea580c" strokeWidth="1.2" />
                  <text x="22" y="621" className="fill-orange-300 font-bold text-[10px]">Heavy Oil Pay Zone</text>
                  <text x="22" y="631" className="fill-amber-300 font-mono text-[9px]">Target: {Math.round(depthM)} m TVD</text>
                  <line x1="176" y1="621" x2="270" y2="620" stroke="#ea580c" strokeWidth="1.5" opacity="0.85" />
                </g>
              </g>

              {/* RIGHT / FLOATING DYNAMIC TELEMETRY CALLOUT CARDS WITH POINTERS */}
              {/* Callout 1: Wellhead Pressure (Pulsing dynamically) */}
              <g transform="translate(310, 75)">
                <line x1="-30" y1="0" x2="0" y2="0" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx="-30" cy="0" r="3" fill="#38bdf8" />
                <rect
                  x="0"
                  y="-14"
                  width="180"
                  height="30"
                  rx="6"
                  fill="#0f172a"
                  stroke="#0284c7"
                  strokeWidth="1.5"
                />
                <text x="10" y="5" className="fill-sky-300 font-sans text-[11px] font-semibold">
                  Wellhead Pressure:{' '}
                  <tspan className="fill-white font-mono font-bold">{dynWHP} bar</tspan>
                </text>
              </g>

              {/* Callout 2: Tubing Flow (Pulsing with stroke) */}
              <g transform="translate(310, 240)">
                <line x1="-40" y1="0" x2="0" y2="0" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx="-40" cy="0" r="3" fill="#38bdf8" />
                <rect
                  x="0"
                  y="-18"
                  width="185"
                  height="38"
                  rx="6"
                  fill="#0f172a"
                  stroke="#0369a1"
                  strokeWidth="1.2"
                />
                <text x="10" y="-2" className="fill-sky-300 font-sans text-[11px] font-semibold">
                  Tubing Flow · {isUpstroke ? 'Discharge Active' : 'Transit'}
                </text>
                <text x="10" y="12" className="fill-slate-200 font-mono text-[10px]">
                  {dynTubingP} bar · {tubingTempC.toFixed(1)} °C
                </text>
              </g>

              {/* Callout 3: Subsurface Pump Assembly & PIP */}
              <g transform="translate(310, 385)">
                <line x1="-40" y1="0" x2="0" y2="0" stroke="#f59e0b" strokeWidth="1.5" />
                <circle cx="-40" cy="0" r="3" fill="#f59e0b" />
                <rect
                  x="0"
                  y="-20"
                  width="195"
                  height="44"
                  rx="6"
                  fill="#0f172a"
                  stroke="#d97706"
                  strokeWidth="1.2"
                />
                <text x="10" y="-4" className="fill-amber-300 font-sans text-[11px] font-semibold">
                  Pump Intake Pressure (PIP)
                </text>
                <text x="10" y="10" className="fill-white font-mono text-[10px]">
                  {dynPIP} bar · {temperatureC.toFixed(1)} °C
                </text>
                <text x="10" y="20" className="fill-amber-400 font-mono text-[9px]">
                  TV: {tvStatus} · SV: {svStatus}
                </text>
              </g>

              {/* Callout 4: Steam Chamber & Thermal Front */}
              <g transform="translate(310, 480)">
                <line x1="-30" y1="0" x2="0" y2="0" stroke="#ea580c" strokeWidth="1.5" />
                <circle cx="-30" cy="0" r="3" fill="#ea580c" />
                <rect
                  x="0"
                  y="-16"
                  width="185"
                  height="34"
                  rx="6"
                  fill="#431407"
                  stroke="#ea580c"
                  strokeWidth="1.5"
                />
                <text x="10" y="2" className="fill-orange-200 font-sans text-[11px] font-bold">
                  Steam Chamber: ~ {steamChamberTempC} °C
                </text>
                <text x="10" y="14" className="fill-orange-300/90 font-mono text-[9px]">
                  Thermal Front Radius: {activeRadiusM} m
                </text>
              </g>

              {/* Callout 5: Heavy Oil Reservoir & Viscosity */}
              <g transform="translate(310, 560)">
                <rect
                  x="0"
                  y="-20"
                  width="205"
                  height="44"
                  rx="6"
                  fill="#1c1917"
                  stroke="#78350f"
                  strokeWidth="1.2"
                />
                <text x="10" y="-4" className="fill-amber-200 font-sans text-[11px] font-semibold">
                  Reservoir: {temperatureC.toFixed(1)} °C · {(apiGravity || 18.0).toFixed(1)}° API
                </text>
                <text x="10" y="10" className="fill-slate-300 font-mono text-[10px]">
                  Viscosity:{' '}
                  <strong className="text-amber-300">{Math.round(viscosityCp).toLocaleString()} cP</strong>
                </text>
                <text x="10" y="20" className="fill-slate-400 font-sans text-[9px]">
                  Baghewala Heavy Crude Formations
                </text>
              </g>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
