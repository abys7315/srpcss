import React, { useEffect, useRef, useState } from "react";
import { Activity, Play, Pause } from "lucide-react";

interface DynacardLiveAnimationProps {
  wellId: string;
  spm: number;
  strokeLengthInch: number;
  viscosityCp: number;
  floatMargin: number;
  goodmanRatio: number;
}

export const DynacardLiveAnimation: React.FC<DynacardLiveAnimationProps> = ({
  wellId,
  spm,
  strokeLengthInch,
  viscosityCp,
  floatMargin,
  goodmanRatio,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const angleRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [cardLabel, setCardLabel] = useState("NORMAL");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Dynacard plot area
    const margin = { top: 30, right: 20, bottom: 35, left: 45 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const lastTimeRef = { current: performance.now() };

    // Physics-based dynacard model
    const computeCard = (theta: number): { pos: number; load: number } => {
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      // Normalized position [0, strokeLengthInch]
      const pos = (strokeLengthInch / 2) * (1 - cosT);

      // Buoyant rod weight
      const rodWeight = 14500; // lbs
      const fluidLoad = 8200; // lbs
      const isUpstroke = sinT >= 0;

      // Drag force (viscosity-dependent)
      const omega = (2 * Math.PI * spm) / 60;
      const velocity = (strokeLengthInch / 24) * omega * sinT;
      const dragCoeff = 0.35; // lbs per (cP * ft/s)
      const drag = viscosityCp * Math.abs(velocity) * dragCoeff;

      // Float risk effects
      const isFloating = floatMargin < 1.0;

      let load: number;
      if (isUpstroke) {
        load = rodWeight + fluidLoad + drag;
        // Valve opening delay effect
        if (pos < strokeLengthInch * 0.1) {
          load *= 0.85 + 0.15 * (pos / (strokeLengthInch * 0.1));
        }
      } else {
        if (isFloating) {
          // Rod float — load collapses
          load = Math.max(800, rodWeight * 0.4 - drag * 0.3);
          // Impact shock at bottom
          if (pos < strokeLengthInch * 0.05) {
            load += 5000 * Math.exp(-pos / (strokeLengthInch * 0.01));
          }
        } else {
          load = Math.max(2500, rodWeight - drag);
          // Fluid pound if low fillage
          if (pos < strokeLengthInch * 0.15 && viscosityCp > 1500) {
            load -= 2000 * Math.exp(-pos / (strokeLengthInch * 0.03));
          }
        }
      }

      // Add a small high-frequency noise for realism
      load += (Math.sin(theta * 7) * 200 + Math.sin(theta * 13) * 100);

      return { pos, load };
    };

    // Determine card classification
    if (floatMargin < 1.0) setCardLabel("FLOAT RISK");
    else if (viscosityCp > 2500) setCardLabel("HIGH DRAG");
    else if (goodmanRatio > 0.85) setCardLabel("STRESS WARNING");
    else setCardLabel("NORMAL");

    const draw = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        const omega = (2 * Math.PI * spm) / 60;
        angleRef.current = (angleRef.current + omega * dt) % (2 * Math.PI);
      }

      const theta = angleRef.current;

      ctx.clearRect(0, 0, W, H);

      // Dark background
      ctx.fillStyle = "#080e1a";
      ctx.fillRect(0, 0, W, H);

      // Plot background with subtle grid
      ctx.fillStyle = "#0a1228";
      ctx.fillRect(margin.left, margin.top, plotW, plotH);

      // Grid lines
      ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 5; i++) {
        const y = margin.top + (plotH / 5) * i;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + plotW, y);
        ctx.stroke();
      }
      for (let i = 0; i <= 4; i++) {
        const x = margin.left + (plotW / 4) * i;
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, margin.top + plotH);
        ctx.stroke();
      }

      // Compute full card envelope
      const maxLoad = 28000;
      const minLoad = 0;
      const loadRange = maxLoad - minLoad;

      const toCanvasX = (pos: number) => margin.left + (pos / strokeLengthInch) * plotW;
      const toCanvasY = (load: number) => margin.top + plotH - ((load - minLoad) / loadRange) * plotH;

      // Draw reference envelope (ideal card outline — faded)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let a = 0; a <= 360; a += 2) {
        const rad = (a / 180) * Math.PI;
        const idealPos = (strokeLengthInch / 2) * (1 - Math.cos(rad));
        const isUp = Math.sin(rad) >= 0;
        const idealLoad = isUp ? 14500 + 8200 : 14500;
        const cx = toCanvasX(idealPos);
        const cy = toCanvasY(idealLoad);
        if (a === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw the trail (historical path)
      const { pos: currentPos, load: currentLoad } = computeCard(theta);
      trailRef.current.push({ x: toCanvasX(currentPos), y: toCanvasY(currentLoad) });
      if (trailRef.current.length > 250) trailRef.current.shift();

      // Trail with gradient fade
      const trail = trailRef.current;
      if (trail.length > 2) {
        for (let i = 1; i < trail.length; i++) {
          const alpha = (i / trail.length) * 0.8;
          const isRisk = floatMargin < 1.0;
          const color = isRisk
            ? `rgba(251, 113, 133, ${alpha})`
            : goodmanRatio > 0.85
            ? `rgba(251, 191, 36, ${alpha})`
            : `rgba(52, 211, 153, ${alpha})`;

          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Current position marker with glow
      const curX = toCanvasX(currentPos);
      const curY = toCanvasY(currentLoad);

      // Glow
      const glowGrad = ctx.createRadialGradient(curX, curY, 0, curX, curY, 16);
      const glowColor = floatMargin < 1.0 ? "255, 80, 100" : "52, 211, 153";
      glowGrad.addColorStop(0, `rgba(${glowColor}, 0.4)`);
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(curX - 16, curY - 16, 32, 32);

      // Dot
      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fillStyle = floatMargin < 1.0 ? "#fb7185" : "#34d399";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Axes labels
      ctx.fillStyle = "#64748b";
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";

      // X axis
      for (let i = 0; i <= 4; i++) {
        const val = Math.round((strokeLengthInch / 4) * i);
        ctx.fillText(`${val}"`, margin.left + (plotW / 4) * i, H - 8);
      }
      ctx.fillText("Position (in)", margin.left + plotW / 2, H - 0);

      // Y axis
      ctx.textAlign = "right";
      for (let i = 0; i <= 5; i++) {
        const val = Math.round(minLoad + (loadRange / 5) * i);
        ctx.fillText(`${(val / 1000).toFixed(0)}k`, margin.left - 5, margin.top + plotH - (plotH / 5) * i + 3);
      }
      ctx.save();
      ctx.translate(10, margin.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Load (lbs)", 0, 0);
      ctx.restore();

      // HUD overlay — position / load readout
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      const hudX = W - 135;
      ctx.fillRect(hudX, margin.top + 4, 125, 58);
      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hudX, margin.top + 4, 125, 58);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 8px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("LIVE DYNACARD", hudX + 6, margin.top + 16);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillText(`Pos: ${currentPos.toFixed(1)}"`, hudX + 6, margin.top + 30);
      ctx.fillText(`Load: ${(currentLoad / 1000).toFixed(1)}k lbs`, hudX + 6, margin.top + 42);

      const phaseColor = Math.sin(theta) >= 0 ? "#34d399" : "#60a5fa";
      const phaseLabel = Math.sin(theta) >= 0 ? "▲ UP" : "▼ DOWN";
      ctx.fillStyle = phaseColor;
      ctx.font = "bold 9px 'IBM Plex Sans', sans-serif";
      ctx.fillText(phaseLabel, hudX + 6, margin.top + 55);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, spm, strokeLengthInch, viscosityCp, floatMargin, goodmanRatio]);

  // Reset trail when well changes
  useEffect(() => {
    trailRef.current = [];
    angleRef.current = 0;
  }, [wellId]);

  const statusColor = cardLabel === "NORMAL" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    : cardLabel === "FLOAT RISK" ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
    : "text-amber-400 border-amber-500/30 bg-amber-500/10";

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-700/50 bg-gradient-to-r from-emerald-950/30 to-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Live Dynacard Trace
              </h3>
              <p className="text-[10px] text-slate-400">
                {wellId} — {spm.toFixed(1)} SPM · {strokeLengthInch}" stroke
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColor}`}>
              {cardLabel}
            </span>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={440}
        height={280}
        className="w-full h-[280px]"
      />

      {/* Bottom metrics */}
      <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-700/50 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-4">
          <span className="text-slate-500">
            Float Margin: <strong className={floatMargin >= 1.0 ? "text-emerald-400" : "text-rose-400"}>{floatMargin.toFixed(3)}</strong>
          </span>
          <span className="text-slate-500">
            Goodman: <strong className={goodmanRatio <= 0.85 ? "text-emerald-400" : "text-amber-400"}>{goodmanRatio.toFixed(3)}</strong>
          </span>
        </div>
        <span className="text-slate-600 font-mono">
          µ = {viscosityCp.toFixed(0)} cP
        </span>
      </div>
    </div>
  );
};
