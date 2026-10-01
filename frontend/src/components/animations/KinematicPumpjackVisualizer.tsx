import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, AlertTriangle, ShieldCheck, Zap } from "lucide-react";

interface KinematicPumpjackVisualizerProps {
  initialSpm?: number;
  initialStrokeLengthInch?: number;
  initialDownstrokeRatio?: number;
  isFloating?: boolean;
  onStateChange?: (state: {
    spm: number;
    strokeLengthInch: number;
    downstrokeRatio: number;
    instantaneousLoadKlbf: number;
    floatMargin: number;
    isFloating: boolean;
  }) => void;
}

export const KinematicPumpjackVisualizer: React.FC<KinematicPumpjackVisualizerProps> = ({
  initialSpm = 4.5,
  initialStrokeLengthInch = 100.0,
  initialDownstrokeRatio = 1.0,
  isFloating: forcedFloating = false,
  onStateChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [spm, setSpm] = useState(initialSpm);
  const [strokeLength, setStrokeLength] = useState(initialStrokeLengthInch);
  const [downstrokeRatio, setDownstrokeRatio] = useState(initialDownstrokeRatio);
  const [viscosityCp, setViscosityCp] = useState(1200);

  // Animation state
  const crankAngleRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Derived kinematic states for HUD
  const [hudState, setHudState] = useState({
    angleDeg: 0,
    normalizedStroke: 0,
    rodVelocityFps: 0,
    rodLoadKlbf: 16.5,
    floatMargin: 1.65,
    isFloatRisk: false,
    phase: "UPSTROKE" as "UPSTROKE" | "DOWNSTROKE",
  });

  // Calculate float margin and load based on physics
  const calculatePhysics = (theta: number, omega: number) => {
    // Crank angle normalized [0, 2pi)
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    // Normalized stroke position s in [0, 1] (0 = Bottom Dead Center, 1 = Top Dead Center)
    const normStroke = 0.5 * (1.0 - cosTheta);

    // Rod velocity in ft/s: v = (Stroke / 12) * (omega / 2) * sin(theta)
    const strokeFt = strokeLength / 12.0;
    const velocity = 0.5 * strokeFt * omega * sinTheta;

    const isUpstroke = sinTheta >= 0;
    const phase: "UPSTROKE" | "DOWNSTROKE" = isUpstroke ? "UPSTROKE" : "DOWNSTROKE";

    // Viscous drag estimation: Stokes annular drag F_drag ~ mu * v * factor
    const dragCoeff = 0.00035; // klbf per (cP * ft/s)
    const dragForceKlbf = viscosityCp * Math.abs(velocity) * dragCoeff;

    // Buoyant rod weight ~ 14.5 klbf
    const buoyantWeightKlbf = 14.5;
    // Fluid load on upstroke ~ 8.2 klbf
    const fluidLoadKlbf = isUpstroke ? 8.2 : 0.0;

    // Downstroke net driving force vs drag -> Float Margin
    const downstrokeDrag = viscosityCp * Math.abs(Math.min(0, velocity)) * dragCoeff;
    const floatMargin = buoyantWeightKlbf / Math.max(0.1, downstrokeDrag + 0.1);
    const isFloatRisk = floatMargin < 1.0 || forcedFloating;

    // Polished rod load (Surface dynacard tension)
    let totalLoadKlbf = 0;
    if (isUpstroke) {
      totalLoadKlbf = buoyantWeightKlbf + fluidLoadKlbf + dragForceKlbf;
    } else {
      if (isFloatRisk) {
        // Rod float: load collapses towards 0 as polished rod uncouples from carrier bar
        totalLoadKlbf = Math.max(0.8, buoyantWeightKlbf - dragForceKlbf * 1.4);
      } else {
        totalLoadKlbf = Math.max(2.5, buoyantWeightKlbf - dragForceKlbf);
      }
    }

    return {
      normStroke,
      velocity,
      totalLoadKlbf,
      floatMargin,
      isFloatRisk,
      phase,
    };
  };

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000.0, 0.1);
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        // Base angular velocity omega = 2 * pi * SPM / 60
        const baseOmega = (2.0 * Math.PI * spm) / 60.0;
        const theta = crankAngleRef.current;
        const isUpstroke = Math.sin(theta) >= 0;

        // VFD Asymmetric speed modulation:
        // If downstrokeRatio != 1.0, downstroke angular velocity is modulated
        let omega = baseOmega;
        if (downstrokeRatio !== 1.0) {
          if (isUpstroke) {
            // Faster or slower upstroke
            omega = baseOmega / Math.max(0.3, 1.0 - (downstrokeRatio - 1.0) * 0.4);
          } else {
            // Slower downstroke to prevent rod floating
            omega = baseOmega * Math.max(0.3, 1.0 / downstrokeRatio);
          }
        }

        const newTheta = (theta + omega * dt) % (2.0 * Math.PI);
        crankAngleRef.current = newTheta;

        const phys = calculatePhysics(newTheta, omega);
        const angleDeg = Math.round((newTheta * 180) / Math.PI);

        setHudState({
          angleDeg,
          normalizedStroke: phys.normStroke,
          rodVelocityFps: Number(phys.velocity.toFixed(2)),
          rodLoadKlbf: Number(phys.totalLoadKlbf.toFixed(2)),
          floatMargin: Number(phys.floatMargin.toFixed(2)),
          isFloatRisk: phys.isFloatRisk,
          phase: phys.phase,
        });

        if (onStateChange) {
          onStateChange({
            spm,
            strokeLengthInch: strokeLength,
            downstrokeRatio,
            instantaneousLoadKlbf: phys.totalLoadKlbf,
            floatMargin: phys.floatMargin,
            isFloating: phys.isFloatRisk,
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, spm, strokeLength, downstrokeRatio, viscosityCp, forcedFloating]);

  // Geometric 4-bar linkage coordinates (SVG canvas 700 x 420)
  const theta = crankAngleRef.current;
  const crankCenterX = 240;
  const crankCenterY = 310;
  const crankRadius = 38 * (strokeLength / 100.0);

  // Crank pin coordinate
  const crankPinX = crankCenterX + crankRadius * Math.cos(theta);
  const crankPinY = crankCenterY - crankRadius * Math.sin(theta);

  // Samson post fulcrum (pivot point of walking beam)
  const fulcrumX = 390;
  const fulcrumY = 145;

  // Rear beam arm connects to pitman arm
  // Approximate walking beam angle beta based on crank pin elevation
  const beamAngleRad = -0.16 * Math.sin(theta) * (strokeLength / 100.0);
  const rearBeamLength = 170;
  const frontBeamLength = 220;

  const rearBeamX = fulcrumX - rearBeamLength * Math.cos(beamAngleRad);
  const rearBeamY = fulcrumY + rearBeamLength * Math.sin(beamAngleRad);

  const horseheadFrontX = fulcrumX + frontBeamLength * Math.cos(beamAngleRad);
  const horseheadFrontY = fulcrumY - frontBeamLength * Math.sin(beamAngleRad);

  // Polished rod hang point (descends vertically from horsehead arc)
  const polishedRodX = 610;
  const polishedRodTopY = horseheadFrontY + 8;
  const strokeDisplacement = hudState.normalizedStroke * 68 * (strokeLength / 100.0);
  const carrierBarY = 230 - strokeDisplacement;
  const stuffingBoxY = 320;

  // Color dynamics based on stress and floating
  let rodColor = "#10b981"; // Emerald safe
  if (hudState.isFloatRisk) {
    rodColor = "#06b6d4"; // Cyan pulse / slack tension
  } else if (hudState.rodLoadKlbf > 21.0) {
    rodColor = "#f59e0b"; // Amber warning
  }

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md">
      {/* Header & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="text-lg font-bold text-white tracking-wide">
              API Spec 11E Kinematic Walking Beam Engine
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
              Four-Bar Linkage
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time mechanical kinematic simulation with VFD asymmetric downstroke speed modulation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hudState.isFloatRisk ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-xs font-semibold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />
              ROD FLOATING DETECTED ({hudState.floatMargin} &lt; 1.0)
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              MECHANICALLY STABLE ({hudState.floatMargin} Mf)
            </div>
          )}

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-medium text-slate-200 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            {isPlaying ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative bg-gradient-to-b from-slate-950 to-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-inner flex justify-center">
        <svg
          viewBox="0 0 700 400"
          className="w-full h-auto max-h-[360px] select-none"
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
        >
          {/* Ground surface and Wellhead cellar */}
          <line x1="40" y1="360" x2="680" y2="360" stroke="#475569" strokeWidth="3" />
          <pattern id="groundHatch" width="10" height="10" patternUnits="userSpaceOnUse">
            <line x1="0" y1="10" x2="10" y2="0" stroke="#334155" strokeWidth="1.5" />
          </pattern>
          <rect x="40" y="360" width="640" height="40" fill="url(#groundHatch)" opacity="0.6" />

          {/* Samson Post (A-Frame support) */}
          <polygon
            points={`350,360 430,360 ${fulcrumX + 10},${fulcrumY + 15} ${fulcrumX - 10},${fulcrumY + 15}`}
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth="2.5"
          />
          {/* Samson post lattice bracing */}
          <line x1="365" y1="300" x2="415" y2="230" stroke="#475569" strokeWidth="1.5" />
          <line x1="415" y1="300" x2="365" y2="230" stroke="#475569" strokeWidth="1.5" />
          <circle cx={fulcrumX} cy={fulcrumY} r="8" fill="#94a3b8" stroke="#0f172a" strokeWidth="3" />

          {/* Gear Reducer Box */}
          <rect x="205" y="275" width="70" height="85" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
          <text x="240" y="340" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
            GEARBOX
          </text>
          <circle cx={crankCenterX} cy={crankCenterY} r="14" fill="#334155" stroke="#94a3b8" strokeWidth="2" />

          {/* Rotating Crank Arm & Counterweight */}
          <g>
            {/* Crank arm bar */}
            <line
              x1={crankCenterX}
              y1={crankCenterY}
              x2={crankPinX}
              y2={crankPinY}
              stroke="#cbd5e1"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Counterweight slab opposite crank pin */}
            {(() => {
              const oppX = crankCenterX - (crankPinX - crankCenterX) * 0.7;
              const oppY = crankCenterY - (crankPinY - crankCenterY) * 0.7;
              return (
                <rect
                  x={oppX - 18}
                  y={oppY - 14}
                  width="36"
                  height="28"
                  rx="4"
                  fill="#475569"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  transform={`rotate(${(-theta * 180) / Math.PI + 90}, ${oppX}, ${oppY})`}
                />
              );
            })()}
            {/* Crank pin */}
            <circle cx={crankPinX} cy={crankPinY} r="6" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />
          </g>

          {/* Pitman Arm (connecting crank pin to rear walking beam) */}
          <line
            x1={crankPinX}
            y1={crankPinY}
            x2={rearBeamX}
            y2={rearBeamY}
            stroke="#94a3b8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx={rearBeamX} cy={rearBeamY} r="5" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />

          {/* Walking Beam (I-Beam rocker) */}
          <line
            x1={rearBeamX}
            y1={rearBeamY}
            x2={horseheadFrontX}
            y2={horseheadFrontY}
            stroke="#38bdf8"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <line
            x1={rearBeamX}
            y1={rearBeamY}
            x2={horseheadFrontX}
            y2={horseheadFrontY}
            stroke="#0284c7"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Horsehead Curved Arc */}
          <path
            d={`M ${horseheadFrontX - 10} ${horseheadFrontY - 32} Q ${horseheadFrontX + 38} ${horseheadFrontY + 20} ${horseheadFrontX + 8} ${horseheadFrontY + 70} L ${horseheadFrontX - 35} ${horseheadFrontY + 25} Z`}
            fill="#0369a1"
            stroke="#38bdf8"
            strokeWidth="2"
          />

          {/* Bridle Wire Cables (hanging from horsehead to carrier bar) */}
          <line
            x1={polishedRodX - 4}
            y1={polishedRodTopY + 12}
            x2={polishedRodX - 4}
            y2={carrierBarY}
            stroke="#e2e8f0"
            strokeWidth="2"
            strokeDasharray={hudState.isFloatRisk ? "3,2" : undefined}
          />
          <line
            x1={polishedRodX + 4}
            y1={polishedRodTopY + 12}
            x2={polishedRodX + 4}
            y2={carrierBarY}
            stroke="#e2e8f0"
            strokeWidth="2"
            strokeDasharray={hudState.isFloatRisk ? "3,2" : undefined}
          />

          {/* Carrier Bar & Polished Rod Clamp */}
          <rect
            x={polishedRodX - 18}
            y={carrierBarY - 4}
            width="36"
            height="9"
            rx="2"
            fill="#f59e0b"
            stroke="#0f172a"
            strokeWidth="1.5"
          />

          {/* Polished Rod (vertical stroke line through stuffing box) */}
          <line
            x1={polishedRodX}
            y1={carrierBarY + 5}
            x2={polishedRodX}
            y2={stuffingBoxY + 38}
            stroke={rodColor}
            strokeWidth={hudState.isFloatRisk ? "3" : "4.5"}
            strokeLinecap="round"
          />

          {/* Wellhead & Stuffing Box */}
          <rect x={polishedRodX - 14} y={stuffingBoxY} width="28" height="24" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
          <text x={polishedRodX} y={stuffingBoxY + 16} fill="#f1f5f9" fontSize="7" textAnchor="middle" fontFamily="monospace">
            STUFFING BOX
          </text>

          {/* Wellhead Casing Flange / Cellar */}
          <rect x={polishedRodX - 22} y={stuffingBoxY + 24} width="44" height="16" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <line x1={polishedRodX - 30} y1={360} x2={polishedRodX + 30} y2={360} stroke="#cbd5e1" strokeWidth="3" />

          {/* Flowline exit pipe */}
          <path d={`M ${polishedRodX + 22} ${stuffingBoxY + 30} L ${polishedRodX + 55} ${stuffingBoxY + 30} L ${polishedRodX + 55} 360`} fill="none" stroke="#64748b" strokeWidth="4" />

          {/* Rod Motion Velocity Vector Arrow */}
          {hudState.rodVelocityFps !== 0 && (
            <g transform={`translate(${polishedRodX + 28}, ${carrierBarY + 15})`}>
              {hudState.phase === "UPSTROKE" ? (
                <>
                  <line x1="0" y1="20" x2="0" y2="-15" stroke="#10b981" strokeWidth="2.5" markerEnd="url(#arrowUp)" />
                  <polygon points="0,-20 -5,-12 5,-12" fill="#10b981" />
                  <text x="8" y="-5" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    +{Math.abs(hudState.rodVelocityFps)} fps
                  </text>
                </>
              ) : (
                <>
                  <line x1="0" y1="-15" x2="0" y2="20" stroke="#38bdf8" strokeWidth="2.5" />
                  <polygon points="0,25 -5,17 5,17" fill="#38bdf8" />
                  <text x="8" y="10" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    -{Math.abs(hudState.rodVelocityFps)} fps
                  </text>
                </>
              )}
            </g>
          )}

          {/* Float alert overlay banner in SVG */}
          {hudState.isFloatRisk && (
            <g transform="translate(480, 270)">
              <rect x="0" y="0" width="180" height="42" rx="4" fill="#082f49" stroke="#06b6d4" strokeWidth="1.5" opacity="0.9" />
              <text x="90" y="18" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
                ⚠️ SLACK ROD WARNING
              </text>
              <text x="90" y="32" fill="#94a3b8" fontSize="8" textAnchor="middle">
                Annular drag exceeds rod weight
              </text>
            </g>
          )}
        </svg>

        {/* Live HUD telemetry badges overlay */}
        <div className="absolute top-3 left-3 bg-slate-900/80 border border-slate-700/70 rounded-lg p-2.5 backdrop-blur-md text-xs font-mono space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Crank Angle:</span>
            <span className="text-white font-bold">{hudState.angleDeg}°</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Cycle Phase:</span>
            <span className={hudState.phase === "UPSTROKE" ? "text-emerald-400 font-bold" : "text-blue-400 font-bold"}>
              {hudState.phase}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Polished Rod Load:</span>
            <span className={hudState.rodLoadKlbf > 21.0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
              {hudState.rodLoadKlbf} klbf
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Float Margin Index:</span>
            <span className={hudState.floatMargin < 1.0 ? "text-cyan-400 font-bold animate-pulse" : "text-slate-200 font-bold"}>
              {hudState.floatMargin}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Real-Time Parameter Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-3 border-t border-slate-800">
        {/* SPM Slider */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-300 font-medium">Pumping Speed (SPM)</span>
            <span className="text-xs font-mono font-bold text-blue-400">{spm.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="2.0"
            max="8.5"
            step="0.1"
            value={spm}
            onChange={(e) => setSpm(parseFloat(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>2.0</span>
            <span>Recommended: 4.5</span>
            <span>8.5</span>
          </div>
        </div>

        {/* Stroke Length Slider */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-300 font-medium">Stroke Length</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{strokeLength} in</span>
          </div>
          <input
            type="range"
            min="64"
            max="120"
            step="2"
            value={strokeLength}
            onChange={(e) => setStrokeLength(parseInt(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>64"</span>
            <span>API Standard: 100"</span>
            <span>120"</span>
          </div>
        </div>

        {/* VFD Asymmetric Downstroke Ratio Slider */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-slate-300 font-medium">VFD Downstroke Ratio</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">{downstrokeRatio.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.50"
            max="1.50"
            step="0.05"
            value={downstrokeRatio}
            onChange={(e) => setDownstrokeRatio(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>0.50 (Slow down)</span>
            <span>1.0 (Symmetric)</span>
            <span>1.50</span>
          </div>
        </div>

        {/* Heavy Oil Viscosity Slider */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-300 font-medium">Fluid Viscosity</span>
            <span className="text-xs font-mono font-bold text-purple-400">{viscosityCp} cP</span>
          </div>
          <input
            type="range"
            min="100"
            max="3500"
            step="50"
            value={viscosityCp}
            onChange={(e) => setViscosityCp(parseInt(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>100 (Hot)</span>
            <span>1200 (Warmed)</span>
            <span>3500 (Cold)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
