import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, AlertOctagon, Activity, Droplets } from "lucide-react";

interface DownholePumpShockAnimationProps {
  initialFillage?: number; // 0.0 to 1.0 (e.g. 0.50 for severe fluid pound)
  spm?: number;
  depthM?: number;
}

export const DownholePumpShockAnimation: React.FC<DownholePumpShockAnimationProps> = ({
  initialFillage = 0.55,
  spm = 4.5,
  depthM = 1000.0,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [fillage, setFillage] = useState(initialFillage);
  const [gasCutPct, setGasCutPct] = useState(25);

  const crankAngleRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Shock wave state
  const [shockActive, setShockActive] = useState(false);
  const [shockIntensity, setShockIntensity] = useState(0);
  const lastImpactTriggeredRef = useRef(false);

  // Derived downhole states
  const [downholeState, setDownholeState] = useState({
    strokeProgress: 0,
    phase: "UPSTROKE" as "UPSTROKE" | "DOWNSTROKE",
    travelingValveOpen: false,
    standingValveOpen: true,
    plungerY: 150,
    impactDetected: false,
    shockWaveRadius: 0,
  });

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000.0, 0.1);
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        const omega = (2.0 * Math.PI * spm) / 60.0;
        const newTheta = (crankAngleRef.current + omega * dt) % (2.0 * Math.PI);
        crankAngleRef.current = newTheta;

        const sinTheta = Math.sin(newTheta);
        const cosTheta = Math.cos(newTheta);
        const isUpstroke = sinTheta >= 0;

        // Normalized stroke s in [0, 1] (0 = Bottom, 1 = Top)
        const s = 0.5 * (1.0 - cosTheta);

        // Barrel stroke range: Y = 90 (TDC) to Y = 220 (BDC)
        const plungerY = 220 - s * 130;

        // Traveling valve (TV): Closes on UPSTROKE to lift fluid column, opens on DOWNSTROKE to transfer fluid
        // Standing valve (SV): Opens on UPSTROKE to draw reservoir fluid, closes on DOWNSTROKE
        let tvOpen = !isUpstroke;
        let svOpen = isUpstroke;

        // Fluid pound impact event:
        // Liquid level inside barrel is determined by fillage (e.g. 50% means top half of barrel is gas/void)
        // Liquid surface is at Y = 220 - fillage * 130
        const liquidSurfaceY = 220 - fillage * 130;

        let impactNow = false;
        if (!isUpstroke && plungerY >= liquidSurfaceY && fillage < 0.85) {
          // Plunger is falling into fluid
          if (!lastImpactTriggeredRef.current) {
            impactNow = true;
            lastImpactTriggeredRef.current = true;
            setShockActive(true);
            setShockIntensity(1.0 - fillage); // Lower fillage = harder impact
            setTimeout(() => {
              setShockActive(false);
            }, 600);
          }
        }

        if (isUpstroke) {
          lastImpactTriggeredRef.current = false;
        }

        setDownholeState({
          strokeProgress: s,
          phase: isUpstroke ? "UPSTROKE" : "DOWNSTROKE",
          travelingValveOpen: tvOpen,
          standingValveOpen: svOpen,
          plungerY,
          impactDetected: impactNow,
          shockWaveRadius: shockActive ? Math.min(120, (1.0 - fillage) * 140) : 0,
        });
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, spm, fillage, shockActive]);

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <h3 className="text-lg font-bold text-white tracking-wide">
              Downhole Subsurface Pump & Fluid Pound Shockwave Visualizer
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              Depth: {depthM} m
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Micro-mechanical cutaway of Traveling Valve, Standing Valve, and fluid pound acoustic stress wave propagation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {fillage < 0.8 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold animate-pulse">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              FLUID POUND ACTIVE ({(fillage * 100).toFixed(0)}% FILLAGE)
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              FULL PUMP FILLAGE ({(fillage * 100).toFixed(0)}%)
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

      {/* Animation Canvas */}
      <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-lg border border-slate-800 overflow-hidden flex justify-center py-2 shadow-inner">
        <svg
          viewBox="0 0 600 380"
          className="w-full h-auto max-h-[360px] select-none"
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
        >
          <defs>
            {/* Fluid gradient inside pump */}
            <linearGradient id="heavyOilGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#78350f" />
              <stop offset="50%" stopColor="#451a03" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>

            {/* Shockwave radial glow */}
            <radialGradient id="shockGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#fb7185" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Geological Formation Stratum (Jodhpur Sandstone) */}
          <rect x="20" y="20" width="160" height="340" fill="#1e1b18" stroke="#382e2b" strokeWidth="1.5" />
          <rect x="420" y="20" width="160" height="340" fill="#1e1b18" stroke="#382e2b" strokeWidth="1.5" />
          <text x="100" y="45" fill="#a8a29e" fontSize="9" fontWeight="bold" textAnchor="middle">
            JODHPUR SANDSTONE
          </text>
          <text x="100" y="60" fill="#78716c" fontSize="8" textAnchor="middle">
            1050 m Depth (47°C)
          </text>

          {/* Casing String (7-inch OD) */}
          <rect x="180" y="10" width="240" height="360" fill="#0f172a" stroke="#475569" strokeWidth="3" />
          <line x1="180" y1="10" x2="180" y2="370" stroke="#94a3b8" strokeWidth="4" />
          <line x1="420" y1="10" x2="420" y2="370" stroke="#94a3b8" strokeWidth="4" />

          {/* Casing Perforations (entry holes for heavy oil) */}
          {[270, 290, 310, 330, 350].map((y) => (
            <g key={y}>
              <circle cx="180" cy={y} r="4" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
              <circle cx="420" cy={y} r="4" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
              {/* Inflow oil streams when standing valve is open */}
              {downholeState.standingValveOpen && (
                <>
                  <path d={`M 155 ${y} Q 170 ${y} 220 ${y + 5}`} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="4,2" />
                  <path d={`M 445 ${y} Q 430 ${y} 380 ${y + 5}`} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="4,2" />
                </>
              )}
            </g>
          ))}

          {/* Annular fluid column outside tubing */}
          <rect x="184" y="240" width="36" height="126" fill="url(#heavyOilGrad)" opacity="0.8" />
          <rect x="380" y="240" width="36" height="126" fill="url(#heavyOilGrad)" opacity="0.8" />

          {/* Tubing String (3.5-inch OD) */}
          <rect x="220" y="10" width="160" height="80" fill="#1e293b" stroke="#64748b" strokeWidth="2.5" />
          <text x="300" y="35" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">
            PRODUCTION TUBING STRING
          </text>

          {/* Downhole Pump Barrel (precision honed cylinder) */}
          <rect x="235" y="80" width="130" height="200" fill="#020617" stroke="#cbd5e1" strokeWidth="3" />
          <text x="300" y="98" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
            API PUMP BARREL (2.25" ID)
          </text>

          {/* Fluid fillage inside barrel */}
          {(() => {
            const barrelBottom = 275;
            const barrelLiquidHeight = fillage * 180;
            const liquidTopY = barrelBottom - barrelLiquidHeight;
            return (
              <g>
                {/* Liquid column */}
                <rect x="238" y={liquidTopY} width="124" height={barrelLiquidHeight} fill="url(#heavyOilGrad)" opacity="0.9" />
                {/* Meniscus / Liquid surface */}
                <ellipse cx="300" cy={liquidTopY} rx="62" ry="4" fill="#b45309" stroke="#f59e0b" strokeWidth="1" />
                {/* Vapor / Gas cushion above liquid if underfilled */}
                {fillage < 0.95 && (
                  <g>
                    <rect x="238" y="105" width="124" height={liquidTopY - 105} fill="#0369a1" opacity="0.25" />
                    <text x="300" y={(105 + liquidTopY) / 2} fill="#38bdf8" fontSize="8" textAnchor="middle">
                      Low-Pressure Gas/Vapor Cushion ({gasCutPct}% GOR)
                    </text>
                  </g>
                )}
              </g>
            );
          })()}

          {/* Sucker Rod String (descending into pump barrel) */}
          <line
            x1="300"
            y1="0"
            x2="300"
            y2={downholeState.plungerY}
            stroke={shockActive ? "#f43f5e" : "#10b981"}
            strokeWidth={shockActive ? "6" : "4.5"}
            strokeLinecap="round"
          />

          {/* Acoustic Stress Wave Ripples shooting UP the rod string during shock */}
          {shockActive && (
            <g>
              {[downholeState.plungerY - 30, downholeState.plungerY - 70, downholeState.plungerY - 110, 40].map((wy, idx) => (
                <circle key={idx} cx="300" cy={wy} r={6 + idx * 2} fill="none" stroke="#f43f5e" strokeWidth="2" opacity={1.0 - idx * 0.2} />
              ))}
            </g>
          )}

          {/* Plunger Assembly */}
          <g transform={`translate(242, ${downholeState.plungerY})`}>
            {/* Plunger Body */}
            <rect x="0" y="0" width="116" height="55" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
            <text x="58" y="16" fill="#f8fafc" fontSize="7.5" textAnchor="middle" fontWeight="bold">
              PLUNGER (TRAVELING)
            </text>

            {/* Traveling Valve (TV) Ball & Seat Cage */}
            <rect x="42" y="24" width="32" height="26" rx="2" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
            {/* TV Valve Seat */}
            <line x1="44" y1="46" x2="72" y2="46" stroke="#f59e0b" strokeWidth="2.5" />
            {/* TV Ball (Opens upward when traveling downward) */}
            <circle
              cx="58"
              cy={downholeState.travelingValveOpen ? 32 : 42}
              r="6.5"
              fill={downholeState.travelingValveOpen ? "#38bdf8" : "#94a3b8"}
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            {/* Valve state label */}
            <text x="58" y="22" fill={downholeState.travelingValveOpen ? "#38bdf8" : "#94a3b8"} fontSize="6" textAnchor="middle">
              {downholeState.travelingValveOpen ? "TV OPEN" : "TV CLOSED"}
            </text>
          </g>

          {/* Standing Valve (SV) at Base of Barrel */}
          <g transform="translate(265, 275)">
            <rect x="0" y="0" width="70" height="38" rx="2" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
            {/* SV Valve Seat */}
            <line x1="10" y1="32" x2="60" y2="32" stroke="#f59e0b" strokeWidth="3" />
            {/* SV Ball (Opens upward during upstroke intake) */}
            <circle
              cx="35"
              cy={downholeState.standingValveOpen ? 16 : 28}
              r="7.5"
              fill={downholeState.standingValveOpen ? "#10b981" : "#94a3b8"}
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            <text x="35" y="-5" fill={downholeState.standingValveOpen ? "#10b981" : "#94a3b8"} fontSize="7" textAnchor="middle" fontWeight="bold">
              {downholeState.standingValveOpen ? "SV OPEN (INTAKE)" : "SV CLOSED"}
            </text>
          </g>

          {/* Fluid Pound Shockwave Radial Rings Effect */}
          {shockActive && (
            <g transform={`translate(300, ${downholeState.plungerY + 45})`}>
              <circle cx="0" cy="0" r={40} fill="url(#shockGlow)" opacity={0.5 + shockIntensity * 0.4} />
              <circle cx="0" cy="0" r={65} fill="none" stroke="#f43f5e" strokeWidth={2 + shockIntensity * 2} strokeDasharray="6,4" className="animate-ping" />
              <circle cx="0" cy="0" r={90} fill="none" stroke="#fb7185" strokeWidth="2" />
              <rect x="-110" y="15" width="220" height="28" rx="4" fill="#4c0519" stroke="#f43f5e" strokeWidth="2" />
              <text x="0" y="32" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">
                💥 FLUID POUND IMPACT SHOCK ({(shockIntensity * 100).toFixed(0)}% SEVERITY)
              </text>
            </g>
          )}
        </svg>

        {/* Live Diagnostics Overlay */}
        <div className="absolute top-3 left-3 bg-slate-900/85 border border-slate-700/80 rounded-lg p-2.5 backdrop-blur-md text-xs font-mono space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Stroke Phase:</span>
            <span className={downholeState.phase === "UPSTROKE" ? "text-emerald-400 font-bold" : "text-blue-400 font-bold"}>
              {downholeState.phase}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Traveling Valve:</span>
            <span className={downholeState.travelingValveOpen ? "text-cyan-400 font-bold" : "text-slate-400"}>
              {downholeState.travelingValveOpen ? "OPEN (TRANSFER)" : "CLOSED (LIFT)"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Standing Valve:</span>
            <span className={downholeState.standingValveOpen ? "text-emerald-400 font-bold" : "text-slate-400"}>
              {downholeState.standingValveOpen ? "OPEN (INTAKE)" : "CLOSED"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Pump Fillage:</span>
            <span className={fillage < 0.7 ? "text-rose-400 font-bold animate-pulse" : "text-emerald-400 font-bold"}>
              {(fillage * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-3 border-t border-slate-800">
        {/* Pump Fillage Slider */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-300 font-medium">Barrel Liquid Fillage</span>
            <span className={fillage < 0.7 ? "text-xs font-mono font-bold text-rose-400" : "text-xs font-mono font-bold text-emerald-400"}>
              {(fillage * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.20"
            max="1.00"
            step="0.05"
            value={fillage}
            onChange={(e) => setFillage(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span className="text-rose-400 font-medium">20% (Severe Shock)</span>
            <span>60%</span>
            <span className="text-emerald-400">100% (Full)</span>
          </div>
        </div>

        {/* Free Gas Interference Slider */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1">
              <Droplets className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-slate-300 font-medium">Free Gas Cut</span>
            </div>
            <span className="text-xs font-mono font-bold text-blue-400">{gasCutPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="5"
            value={gasCutPct}
            onChange={(e) => setGasCutPct(parseInt(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>0%</span>
            <span>25% Standard</span>
            <span>60% High GOR</span>
          </div>
        </div>

        {/* Quick Scenario Preset Buttons */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 flex flex-col justify-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mb-0.5">Quick Simulation Scenarios:</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setFillage(0.45);
                setGasCutPct(35);
              }}
              className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-600/40 rounded text-[11px] text-rose-300 font-medium transition-colors"
            >
              Simulate Fluid Pound
            </button>
            <button
              onClick={() => {
                setFillage(0.98);
                setGasCutPct(5);
              }}
              className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-600/40 rounded text-[11px] text-emerald-300 font-medium transition-colors"
            >
              Simulate Full Fillage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
