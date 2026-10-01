import React, { useEffect, useRef, useState } from "react";

interface ThermalSteamChestVisualizerProps {
  initialPhase?: "INJECTION" | "SOAK" | "PRODUCTION";
  initialSteamTonnes?: number;
  initialSoakDays?: number;
  initialProductionDay?: number;
}

export const ThermalSteamChestVisualizer: React.FC<ThermalSteamChestVisualizerProps> = ({
  initialPhase = "PRODUCTION",
  initialSteamTonnes = 3000,
  initialSoakDays = 6,
  initialProductionDay = 25,
}) => {
  const [phase, setPhase] = useState<"INJECTION" | "SOAK" | "PRODUCTION">(initialPhase);
  const [steamTonnes, setSteamTonnes] = useState(initialSteamTonnes);
  const [soakDays, setSoakDays] = useState(initialSoakDays);
  const [productionDay, setProductionDay] = useState(initialProductionDay);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Compute thermal physics
  // Marx-Langenheim radial steam zone radius: r_steam = sqrt(M_steam / (pi * h * rho_c * delta_T))
  // For Jodhpur Sandstone: h = 14m, rho_c = 2.3e6 J/m3/K, delta_T = 260 - 47 = 213 K
  // At 3000 tonnes -> r_steam ~ 18.5 meters
  const baseRadiusMeters = Math.sqrt((steamTonnes * 1000.0 * 2.1e6) / (Math.PI * 14.0 * 2.3e6 * 213.0));

  let currentRadiusMeters = baseRadiusMeters;
  let wellboreTempC = 260.0;

  if (phase === "INJECTION") {
    currentRadiusMeters = baseRadiusMeters * 0.95;
    wellboreTempC = 260.0;
  } else if (phase === "SOAK") {
    // During soak, conductive diffusion slightly broadens radius while core cools slightly
    currentRadiusMeters = baseRadiusMeters * (1.0 + 0.02 * soakDays);
    wellboreTempC = Math.max(160.0, 260.0 - soakDays * 12.0);
  } else {
    // During production, cold inflow and thermal loss cools reservoir: T(t) = T_res + (T_peak - T_res) * exp(-kappa * t)
    const decay = Math.exp(-0.022 * productionDay);
    currentRadiusMeters = Math.max(3.0, baseRadiusMeters * (0.3 + 0.7 * decay));
    wellboreTempC = Math.max(47.0, 47.0 + (180.0 - 47.0) * decay);
  }

  // Viscosity at wellbore (Andrade model)
  const muWellboreCp = 0.000145267 * Math.exp(5320.94 / (wellboreTempC + 273.15));

  // Canvas drawing loop
  useEffect(() => {
    let startTime: number | null = null;

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000.0;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // Scale: 40 meters maps to 260 pixels -> ~6.5 px/m
      const scale = 6.5;

      // Clear background (unstimulated reservoir rock: 47°C deep brown/slate)
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      // Draw geological formation boundaries
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // Draw Radial Heat Gradient
      const pixelRadius = currentRadiusMeters * scale;
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        2,
        centerX,
        centerY,
        Math.max(10, pixelRadius * 1.5)
      );

      if (phase === "INJECTION") {
        gradient.addColorStop(0.0, "#ffffff"); // 260 C Superheated steam core
        gradient.addColorStop(0.2, "#fef08a"); // Bright yellow
        gradient.addColorStop(0.5, "#f97316"); // Orange condensation front
        gradient.addColorStop(0.8, "#b91c1c"); // Crimson warm zone
        gradient.addColorStop(1.0, "#0f172a"); // 47 C cold reservoir
      } else if (phase === "SOAK") {
        gradient.addColorStop(0.0, "#fde047"); // 200 C Conductive soak
        gradient.addColorStop(0.3, "#f97316");
        gradient.addColorStop(0.7, "#991b1b");
        gradient.addColorStop(1.0, "#0f172a");
      } else {
        // PRODUCTION Phase
        gradient.addColorStop(0.0, "#ea580c"); // 85-110 C Warmed heavy oil
        gradient.addColorStop(0.4, "#9a3412");
        gradient.addColorStop(0.75, "#431407");
        gradient.addColorStop(1.0, "#0f172a");
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(10, pixelRadius * 1.5), 0, 2 * Math.PI);
      ctx.fill();

      // Draw Isotherm rings
      const isotherms = [
        { r: currentRadiusMeters * 0.4, label: `${Math.round(wellboreTempC * 0.9)}°C`, color: "rgba(254, 240, 138, 0.4)" },
        { r: currentRadiusMeters * 0.8, label: `${Math.round(wellboreTempC * 0.65)}°C`, color: "rgba(249, 115, 22, 0.4)" },
        { r: currentRadiusMeters * 1.2, label: "65°C", color: "rgba(239, 68, 68, 0.3)" },
      ];

      isotherms.forEach((iso) => {
        const rPx = iso.r * scale;
        if (rPx > 5 && rPx < width / 2 - 10) {
          ctx.beginPath();
          ctx.arc(centerX, centerY, rPx, 0, 2 * Math.PI);
          ctx.strokeStyle = iso.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#cbd5e1";
          ctx.font = "9px monospace";
          ctx.fillText(iso.label, centerX + rPx + 4, centerY - 4);
        }
      });

      // In Production Phase: Draw animated heavy oil inflow streamlines entering the wellbore!
      if (phase === "PRODUCTION") {
        const numStreams = 16;
        for (let i = 0; i < numStreams; i++) {
          const angle = (2 * Math.PI * i) / numStreams;
          const outerR = Math.min(width / 2 - 40, currentRadiusMeters * scale * 1.3);
          const innerR = 12;

          // Animated particle position traveling inwards
          const travelCycle = (elapsed * 0.4 + i / numStreams) % 1.0;
          const currentR = outerR - travelCycle * (outerR - innerR);

          const px = centerX + Math.cos(angle) * currentR;
          const py = centerY + Math.sin(angle) * currentR;

          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = "#f59e0b"; // Golden mobile crude
          ctx.fill();

          // Streamline trace
          ctx.beginPath();
          ctx.moveTo(centerX + Math.cos(angle) * outerR, centerY + Math.sin(angle) * outerR);
          ctx.lineTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
          ctx.strokeStyle = "rgba(217, 119, 6, 0.25)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // In Injection Phase: Animated steam jet pulses expanding outward!
      if (phase === "INJECTION") {
        const pulseR = ((elapsed * 50) % (currentRadiusMeters * scale)) + 5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseR, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Wellbore Casing Center Circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
      ctx.fillStyle = "#020617";
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Legend & Scale bar
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.fillText("Wellbore (BGW-01)", centerX - 45, centerY + 24);

      // Distance scale line (10 meters)
      const scaleBarLen = 10 * scale;
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(35, height - 35);
      ctx.lineTo(35 + scaleBarLen, height - 35);
      ctx.stroke();
      ctx.fillText("10 meters", 35, height - 22);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, steamTonnes, soakDays, productionDay, currentRadiusMeters, wellboreTempC]);

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <h3 className="text-lg font-bold text-white tracking-wide">
              2D Radial Thermal Steam Chest Expansion & Dissipation Engine
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
              Jodhpur Sandstone (h = 14m)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Marx-Langenheim heat balance, conductive overburden losses, and temperature-dependent viscosity thinning
          </p>
        </div>

        {/* Phase Switcher Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(["INJECTION", "SOAK", "PRODUCTION"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                phase === p
                  ? p === "INJECTION"
                    ? "bg-rose-600 text-white shadow-lg"
                    : p === "SOAK"
                    ? "bg-amber-600 text-white shadow-lg"
                    : "bg-emerald-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex justify-center shadow-inner">
        <canvas
          ref={canvasRef}
          width={640}
          height={340}
          className="w-full h-auto max-h-[340px] select-none"
        />

        {/* Live Reservoir Thermal HUD */}
        <div className="absolute top-3 left-3 bg-slate-900/85 border border-slate-700/80 rounded-lg p-2.5 backdrop-blur-md text-xs font-mono space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Steam Chest Radius:</span>
            <span className="text-amber-400 font-bold">{currentRadiusMeters.toFixed(1)} m</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Wellbore Temperature:</span>
            <span className="text-rose-400 font-bold">{wellboreTempC.toFixed(1)} °C</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Near-Wellbore Viscosity:</span>
            <span className="text-emerald-400 font-bold">{muWellboreCp.toFixed(0)} cP</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-400">
            <span>Baseline Reservoir:</span>
            <span className="text-slate-300">47.0 °C (2400 cP)</span>
          </div>
        </div>

        {/* Phase-specific telemetry badge */}
        <div className="absolute bottom-3 right-3 bg-slate-900/85 border border-slate-700/80 rounded-lg p-2 backdrop-blur-md text-[11px] font-mono text-slate-300">
          {phase === "INJECTION" && "🔥 Superheated Steam Condensation Chest (T = 260°C)"}
          {phase === "SOAK" && "⏳ Rock Matrix Thermal Diffusion (Overburden Conductive Soak)"}
          {phase === "PRODUCTION" && "🛢️ Stimulated Heavy Oil Radial Inflow Streamlines"}
        </div>
      </div>

      {/* Interactive Controls based on Active Phase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-3 border-t border-slate-800">
        {/* Steam Volume Slider */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-300 font-medium">Injected Steam Volume</span>
            <span className="text-xs font-mono font-bold text-rose-400">{steamTonnes} tonnes</span>
          </div>
          <input
            type="range"
            min="1000"
            max="4500"
            step="100"
            value={steamTonnes}
            onChange={(e) => setSteamTonnes(parseInt(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>1,000 t</span>
            <span>Design: 3,000 t</span>
            <span>4,500 t</span>
          </div>
        </div>

        {/* Phase Dependent Slider (Soak or Production Days) */}
        {phase === "SOAK" ? (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-slate-300 font-medium">Soak Duration</span>
              <span className="text-xs font-mono font-bold text-amber-400">{soakDays} days</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="1"
              value={soakDays}
              onChange={(e) => setSoakDays(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>1 day</span>
              <span>Design: 6 days</span>
              <span>15 days</span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-slate-300 font-medium">Production Day</span>
              <span className="text-xs font-mono font-bold text-emerald-400">Day {productionDay} / 120</span>
            </div>
            <input
              type="range"
              min="1"
              max="120"
              step="1"
              value={productionDay}
              onChange={(e) => setProductionDay(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Day 1 (Hot)</span>
              <span>Day 60</span>
              <span>Day 120 (Economic Cutoff)</span>
            </div>
          </div>
        )}

        {/* Heavy Oil Stimulation Summary Metric */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Mobility Stimulation Factor:</span>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {(2400.0 / Math.max(1.0, muWellboreCp)).toFixed(1)}x
            </span>
            <span className="text-xs text-slate-400">oil viscosity reduction</span>
          </div>
          <span className="text-[10px] text-slate-500">
            Initial 2400 cP reduced to {muWellboreCp.toFixed(0)} cP via thermal stimulation
          </span>
        </div>
      </div>
    </div>
  );
};
