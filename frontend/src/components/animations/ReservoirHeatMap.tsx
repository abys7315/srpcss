import React, { useEffect, useRef } from "react";
import { Zap } from "lucide-react";

interface ReservoirHeatMapProps {
  wellId: string;
  temperatureC: number;
  steamVolumeTonnes: number;
  soakDays?: number;
  heatingRadiusM: number;
  simDay: number;
  isPlaying: boolean;
}

export const ReservoirHeatMap: React.FC<ReservoirHeatMapProps> = ({
  wellId,
  temperatureC,
  steamVolumeTonnes,
  heatingRadiusM,
  simDay,
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    // Heat intensity based on sim day and temperature
    const maxRadius = Math.min(W, H) * 0.42;
    const steamFraction = Math.min(1, steamVolumeTonnes / 5000);
    const dayFraction = Math.min(1, simDay / 180);

    const draw = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.clearRect(0, 0, W, H);

      // Deep reservoir background
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * 1.8);
      bgGrad.addColorStop(0, "#1a0e2e");
      bgGrad.addColorStop(0.5, "#0f1b3d");
      bgGrad.addColorStop(1, "#070d1a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Geological strata pattern (concentric rings)
      for (let r = maxRadius * 1.5; r > 20; r -= 15) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80, 60, 40, ${0.08 + Math.sin(r * 0.1) * 0.03})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw sandstone grain texture
      ctx.fillStyle = "rgba(120, 90, 50, 0.04)";
      for (let i = 0; i < 200; i++) {
        const angle = (i / 200) * Math.PI * 2;
        const dist = 50 + Math.random() * maxRadius * 1.4;
        const gx = cx + Math.cos(angle + Math.sin(i * 0.7) * 0.5) * dist;
        const gy = cy + Math.sin(angle + Math.cos(i * 0.5) * 0.5) * dist;
        ctx.beginPath();
        ctx.arc(gx, gy, 1 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Heated zone — pulsing radial gradient
      const heatedRadius = maxRadius * steamFraction * Math.min(1, dayFraction * 1.5);
      const pulseRadius = heatedRadius * (1 + Math.sin(t * 2) * 0.02);

      // Outer heat halo
      const haloGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseRadius * 1.3);
      haloGrad.addColorStop(0, `rgba(255, 60, 20, ${0.35 * steamFraction})`);
      haloGrad.addColorStop(0.3, `rgba(255, 120, 40, ${0.25 * steamFraction})`);
      haloGrad.addColorStop(0.6, `rgba(255, 180, 60, ${0.1 * steamFraction})`);
      haloGrad.addColorStop(0.85, `rgba(200, 100, 30, ${0.03 * steamFraction})`);
      haloGrad.addColorStop(1, "transparent");
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, W, H);

      // Steam chamber core — bright center
      const coreRadius = heatedRadius * 0.4;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
      coreGrad.addColorStop(0, `rgba(255, 255, 220, ${0.4 * steamFraction})`);
      coreGrad.addColorStop(0.4, `rgba(255, 200, 100, ${0.3 * steamFraction})`);
      coreGrad.addColorStop(1, "transparent");
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, 0, W, H);

      // Heat wavefronts (expanding rings)
      for (let i = 0; i < 4; i++) {
        const wavePhase = ((t * 0.3 + i * 0.25) % 1);
        const waveR = heatedRadius * 0.3 + wavePhase * heatedRadius * 0.8;
        const waveAlpha = Math.max(0, 0.3 * (1 - wavePhase) * steamFraction);
        ctx.beginPath();
        ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 140, 50, ${waveAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Temperature isotherms
      const temps = [200, 150, 100, 70];
      const colors = ["#ff3c14", "#ff8c28", "#ffba3c", "#ffd46e"];
      temps.forEach((isoTemp, idx) => {
        if (temperatureC < isoTemp * 0.5) return;
        const isoR = heatedRadius * (1 - idx * 0.22);
        if (isoR < 5) return;

        ctx.beginPath();
        ctx.arc(cx, cy, isoR, 0, Math.PI * 2);
        ctx.strokeStyle = colors[idx];
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = colors[idx];
        ctx.font = "bold 9px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${isoTemp}°C`, cx + isoR * 0.71, cy - isoR * 0.71 - 4);
      });

      // Wellbore (center point)
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#334155";
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Well casing cross section
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#60a5fa";
      ctx.fill();

      // Radius marker
      if (heatingRadiusM > 0) {
        const labelR = heatedRadius * 0.8;
        ctx.beginPath();
        ctx.moveTo(cx + 8, cy);
        ctx.lineTo(cx + labelR, cy);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
        ctx.beginPath();
        ctx.moveTo(cx + labelR, cy);
        ctx.lineTo(cx + labelR - 5, cy - 3);
        ctx.lineTo(cx + labelR - 5, cy + 3);
        ctx.fill();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 10px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${heatingRadiusM.toFixed(1)}m`, cx + labelR * 0.55, cy - 8);
      }

      // Compass rose
      const compassR = 16;
      const compassX = W - 28;
      const compassY = 28;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(compassX, compassY - compassR);
      ctx.lineTo(compassX, compassY + compassR);
      ctx.moveTo(compassX - compassR, compassY);
      ctx.lineTo(compassX + compassR, compassY);
      ctx.stroke();
      ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
      ctx.font = "bold 8px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", compassX, compassY - compassR - 3);
      ctx.fillText("E", compassX + compassR + 6, compassY + 3);

      // Scale bar
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(20, H - 20);
      ctx.lineTo(80, H - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, H - 24);
      ctx.lineTo(20, H - 16);
      ctx.moveTo(80, H - 24);
      ctx.lineTo(80, H - 16);
      ctx.stroke();
      ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("10m", 50, H - 8);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [temperatureC, steamVolumeTonnes, heatingRadiusM, simDay, isPlaying]);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-700/50 bg-gradient-to-r from-rose-950/30 to-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Steam Chamber — Plan View
              </h3>
              <p className="text-[10px] text-slate-400">
                {wellId} — 2D radial thermal propagation
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
            Day {simDay}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={340}
          height={340}
          className="w-full h-[340px]"
        />
      </div>

      {/* Bottom metrics */}
      <div className="px-4 py-3 bg-slate-900/60 border-t border-slate-700/50 grid grid-cols-3 gap-3 text-center">
        <div>
          <span className="block text-[9px] text-slate-500 uppercase tracking-wider">Steam Injected</span>
          <span className="block text-sm font-bold text-orange-400 font-mono">{steamVolumeTonnes.toLocaleString()}</span>
          <span className="block text-[9px] text-slate-500">tonnes</span>
        </div>
        <div>
          <span className="block text-[9px] text-slate-500 uppercase tracking-wider">Chamber Temp</span>
          <span className="block text-sm font-bold text-rose-400 font-mono">{temperatureC.toFixed(0)}</span>
          <span className="block text-[9px] text-slate-500">°C</span>
        </div>
        <div>
          <span className="block text-[9px] text-slate-500 uppercase tracking-wider">Heating Radius</span>
          <span className="block text-sm font-bold text-amber-400 font-mono">{heatingRadiusM.toFixed(1)}</span>
          <span className="block text-[9px] text-slate-500">meters</span>
        </div>
      </div>
    </div>
  );
};
