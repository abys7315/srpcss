import React, { useEffect, useRef, useState } from "react";
import { TrendingDown, BarChart3 } from "lucide-react";

interface ProductionPulseProps {
  wellId: string;
  oilRateBpd: number;
  waterCutPct: number;
  steamOilRatio: number;
  temperatureC: number;
  viscosityCp: number;
  simDay: number;
}

export const ProductionPulse: React.FC<ProductionPulseProps> = ({
  wellId,
  oilRateBpd,
  waterCutPct,
  steamOilRatio,
  temperatureC,
  viscosityCp,
  simDay,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const historyRef = useRef<{ oil: number; water: number; temp: number }[]>([]);

  useEffect(() => {
    // Build up history as simDay progresses
    if (historyRef.current.length < simDay) {
      historyRef.current.push({
        oil: oilRateBpd,
        water: waterCutPct,
        temp: temperatureC,
      });
    }
  }, [simDay, oilRateBpd, waterCutPct, temperatureC]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = "#080e1a";
      ctx.fillRect(0, 0, W, H);

      // Draw flowing oil-drop particles at the top
      const numDrops = Math.round(oilRateBpd / 8);
      for (let i = 0; i < Math.min(numDrops, 30); i++) {
        const phase = ((t * 0.5 + i * 0.3) % 3);
        if (phase > 1) continue; // Only show during "drop" phase

        const dropX = 30 + (i / 30) * (W - 60);
        const dropY = 15 + phase * 50;
        const dropAlpha = Math.max(0, 1 - phase);

        // Oil drop shape
        ctx.beginPath();
        ctx.ellipse(dropX, dropY, 3, 4.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 120, 40, ${dropAlpha * 0.8})`;
        ctx.fill();

        // Glow
        const glow = ctx.createRadialGradient(dropX, dropY, 0, dropX, dropY, 8);
        glow.addColorStop(0, `rgba(255, 180, 60, ${dropAlpha * 0.2})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(dropX - 8, dropY - 8, 16, 16);
      }

      // Central circular gauge — oil rate
      const gaugeCx = W * 0.3;
      const gaugeCy = H * 0.48;
      const gaugeR = Math.min(W, H) * 0.22;

      // Gauge background ring
      ctx.beginPath();
      ctx.arc(gaugeCx, gaugeCy, gaugeR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
      ctx.lineWidth = 12;
      ctx.stroke();

      // Gauge filled arc — oil production
      const maxRate = 200; // bpd for full arc
      const fillAngle = Math.min(1, oilRateBpd / maxRate) * Math.PI * 1.5;
      const startAngle = Math.PI * 0.75;

      ctx.beginPath();
      ctx.arc(gaugeCx, gaugeCy, gaugeR, startAngle, startAngle + fillAngle);
      const arcGrad = ctx.createLinearGradient(
        gaugeCx - gaugeR, gaugeCy,
        gaugeCx + gaugeR, gaugeCy
      );
      arcGrad.addColorStop(0, "#10b981");
      arcGrad.addColorStop(0.5, "#34d399");
      arcGrad.addColorStop(1, "#6ee7b7");
      ctx.strokeStyle = arcGrad;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      // Gauge center text
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 22px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${(oilRateBpd / 6.289).toFixed(1)}`, gaugeCx, gaugeCy + 4);
      ctx.fillStyle = "#64748b";
      ctx.font = "9px 'IBM Plex Sans', sans-serif";
      ctx.fillText("m³/day", gaugeCx, gaugeCy + 18);
      ctx.font = "bold 8px 'IBM Plex Sans', sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("OIL PRODUCTION", gaugeCx, gaugeCy - gaugeR + 26);

      // Water cut gauge — smaller, to the right
      const wcCx = W * 0.72;
      const wcCy = H * 0.35;
      const wcR = gaugeR * 0.55;

      ctx.beginPath();
      ctx.arc(wcCx, wcCy, wcR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100, 116, 139, 0.12)";
      ctx.lineWidth = 8;
      ctx.stroke();

      const wcAngle = (waterCutPct / 100) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.arc(wcCx, wcCy, wcR, startAngle, startAngle + wcAngle);
      ctx.strokeStyle = waterCutPct > 85 ? "#f43f5e" : waterCutPct > 70 ? "#f59e0b" : "#3b82f6";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 16px 'IBM Plex Mono', monospace";
      ctx.fillText(`${waterCutPct.toFixed(0)}%`, wcCx, wcCy + 4);
      ctx.fillStyle = "#64748b";
      ctx.font = "8px 'IBM Plex Sans', sans-serif";
      ctx.fillText("WATER CUT", wcCx, wcCy + 16);

      // SOR indicator — bar style
      const sorCx = W * 0.72;
      const sorCy = H * 0.72;
      const sorBarW = wcR * 2;
      const sorBarH = 10;

      ctx.fillStyle = "rgba(100, 116, 139, 0.12)";
      ctx.fillRect(sorCx - sorBarW / 2, sorCy, sorBarW, sorBarH);

      const sorFill = Math.min(1, steamOilRatio / 6);
      const sorColor = steamOilRatio > 4 ? "#f43f5e" : steamOilRatio > 3 ? "#f59e0b" : "#10b981";
      ctx.fillStyle = sorColor;
      ctx.fillRect(sorCx - sorBarW / 2, sorCy, sorBarW * sorFill, sorBarH);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 13px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${steamOilRatio.toFixed(2)}`, sorCx, sorCy - 6);
      ctx.fillStyle = "#64748b";
      ctx.font = "8px 'IBM Plex Sans', sans-serif";
      ctx.fillText("STEAM-OIL RATIO", sorCx, sorCy + sorBarH + 12);

      // Mini sparkline at bottom — recent oil rate trend
      const sparkY = H - 35;
      const sparkH = 25;
      const history = historyRef.current;
      if (history.length > 1) {
        const visible = history.slice(-60);
        const maxOil = Math.max(...visible.map(h => h.oil), 1);

        ctx.beginPath();
        visible.forEach((pt, i) => {
          const sx = 30 + (i / (visible.length - 1)) * (W - 60);
          const sy = sparkY + sparkH - (pt.oil / maxOil) * sparkH;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.strokeStyle = "rgba(52, 211, 153, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Fill area
        const lastX = 30 + ((visible.length - 1) / (visible.length - 1)) * (W - 60);
        ctx.lineTo(lastX, sparkY + sparkH);
        ctx.lineTo(30, sparkY + sparkH);
        ctx.closePath();
        ctx.fillStyle = "rgba(52, 211, 153, 0.05)";
        ctx.fill();
      }

      ctx.fillStyle = "#475569";
      ctx.font = "7px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("60-day trend →", 30, sparkY - 3);

      // Pulsing border effect
      const pulseAlpha = 0.1 + Math.sin(t * 2) * 0.05;
      ctx.strokeStyle = `rgba(52, 211, 153, ${pulseAlpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [oilRateBpd, waterCutPct, steamOilRatio, temperatureC, viscosityCp, simDay]);

  // Reset history when well changes
  useEffect(() => {
    historyRef.current = [];
  }, [wellId]);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-700/50 bg-gradient-to-r from-emerald-950/30 to-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Production Pulse
              </h3>
              <p className="text-[10px] text-slate-400">
                {wellId} — Day {simDay} live KPIs
              </p>
            </div>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={380}
        height={260}
        className="w-full h-[260px]"
      />
    </div>
  );
};
