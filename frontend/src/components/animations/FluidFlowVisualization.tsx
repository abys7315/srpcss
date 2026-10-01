import React, { useEffect, useRef, useState } from "react";
import { Droplets, Thermometer, Gauge } from "lucide-react";

interface FluidFlowVisualizationProps {
  wellId: string;
  temperatureC: number;
  viscosityCp: number;
  oilRateBpd: number;
  waterCutPct: number;
  depthM: number;
  pumpDepthM: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: "oil" | "water" | "gas";
  opacity: number;
  life: number;
  maxLife: number;
}

export const FluidFlowVisualization: React.FC<FluidFlowVisualizationProps> = ({
  wellId,
  temperatureC,
  viscosityCp,
  oilRateBpd,
  waterCutPct,
  depthM,
  pumpDepthM,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number | null>(null);
  const [hoveredParticle, setHoveredParticle] = useState<string | null>(null);

  // Normalize flow speed based on oil rate
  const flowSpeed = Math.max(0.3, Math.min(2.0, oilRateBpd / 50));
  // Viscosity affects particle wobble
  const wobbleFactor = Math.max(0.2, Math.min(1.5, viscosityCp / 2000));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Wellbore geometry
    const tubing = { x: W * 0.42, w: W * 0.16 };
    const annulus = { x: W * 0.3, w: W * 0.4 };

    const spawnParticle = (): Particle => {
      const rand = Math.random();
      const type: "oil" | "water" | "gas" =
        rand < (100 - waterCutPct) / 100 ? "oil" : rand < 0.97 ? "water" : "gas";

      const inTubing = Math.random() > 0.3;
      const x = inTubing
        ? tubing.x + Math.random() * tubing.w
        : annulus.x + Math.random() * annulus.w;

      return {
        x,
        y: H - 20 + Math.random() * 30,
        vx: (Math.random() - 0.5) * 0.5 * wobbleFactor,
        vy: -(0.8 + Math.random() * 1.2) * flowSpeed,
        radius: type === "gas" ? 1.5 + Math.random() * 1.5 : 2 + Math.random() * 2.5,
        type,
        opacity: 0.6 + Math.random() * 0.4,
        life: 0,
        maxLife: 200 + Math.random() * 150,
      };
    };

    // Initialize particles
    particlesRef.current = Array.from({ length: 60 }, () => {
      const p = spawnParticle();
      p.y = Math.random() * H;
      return p;
    });

    const getParticleColor = (type: string, temp: number): string => {
      const t = Math.min(1, Math.max(0, (temp - 40) / 200));
      if (type === "oil") {
        const r = Math.round(30 + t * 80);
        const g = Math.round(20 + t * 40);
        const b = Math.round(10 + t * 20);
        return `rgb(${r}, ${g}, ${b})`;
      }
      if (type === "water") {
        const r = Math.round(30 + t * 50);
        const g = Math.round(100 + t * 80);
        const b = Math.round(200 - t * 40);
        return `rgb(${r}, ${g}, ${b})`;
      }
      // gas
      return `rgba(200, 220, 255, 0.6)`;
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background gradient — underground rock
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#1a1a2e");
      bgGrad.addColorStop(0.3, "#16213e");
      bgGrad.addColorStop(0.7, "#0f3460");
      bgGrad.addColorStop(1, "#1a0f2e");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Rock strata layers
      for (let i = 0; i < 6; i++) {
        const y = (H / 6) * i;
        ctx.fillStyle = `rgba(${60 + i * 12}, ${40 + i * 8}, ${30 + i * 15}, 0.15)`;
        ctx.fillRect(0, y, W, H / 6);
        ctx.strokeStyle = `rgba(100, 80, 60, 0.2)`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < W; x += 20) {
          ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
        }
        ctx.stroke();
      }

      // Casing wall glow
      const casingGrad = ctx.createLinearGradient(annulus.x - 8, 0, annulus.x + annulus.w + 8, 0);
      casingGrad.addColorStop(0, "rgba(100, 116, 139, 0.4)");
      casingGrad.addColorStop(0.1, "rgba(148, 163, 184, 0.8)");
      casingGrad.addColorStop(0.15, "rgba(71, 85, 105, 0.3)");
      casingGrad.addColorStop(0.85, "rgba(71, 85, 105, 0.3)");
      casingGrad.addColorStop(0.9, "rgba(148, 163, 184, 0.8)");
      casingGrad.addColorStop(1, "rgba(100, 116, 139, 0.4)");
      ctx.fillStyle = casingGrad;
      ctx.fillRect(annulus.x - 8, 0, annulus.w + 16, H);

      // Tubing wall (inner steel)
      ctx.strokeStyle = "rgba(200, 200, 220, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tubing.x, 0);
      ctx.lineTo(tubing.x, H);
      ctx.moveTo(tubing.x + tubing.w, 0);
      ctx.lineTo(tubing.x + tubing.w, H);
      ctx.stroke();

      // Heat glow effect — radial gradient from bottom center
      const heatGlow = ctx.createRadialGradient(
        W * 0.5, H * 0.85, 10,
        W * 0.5, H * 0.85, H * 0.5
      );
      const heatIntensity = Math.min(0.25, (temperatureC - 40) / 600);
      heatGlow.addColorStop(0, `rgba(255, 80, 20, ${heatIntensity})`);
      heatGlow.addColorStop(0.5, `rgba(255, 140, 60, ${heatIntensity * 0.4})`);
      heatGlow.addColorStop(1, "transparent");
      ctx.fillStyle = heatGlow;
      ctx.fillRect(0, 0, W, H);

      // Draw and update particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Update
        p.x += p.vx + Math.sin(p.life * 0.08 * wobbleFactor) * 0.3;
        p.y += p.vy;
        p.life++;

        // Constrain to tubing/annulus bounds
        if (p.x < annulus.x + 4) p.x = annulus.x + 4;
        if (p.x > annulus.x + annulus.w - 4) p.x = annulus.x + annulus.w - 4;

        // Fade in/out
        if (p.life < 15) p.opacity = (p.life / 15) * 0.9;
        if (p.life > p.maxLife - 30) p.opacity = ((p.maxLife - p.life) / 30) * 0.9;

        // Remove dead / off-screen particles
        if (p.y < -10 || p.life > p.maxLife) {
          particles[i] = spawnParticle();
          continue;
        }

        // Gas bubbles rise differently
        if (p.type === "gas") {
          p.vy -= 0.01; // accelerate up
          p.vx += (Math.random() - 0.5) * 0.15;
          p.radius += 0.003; // expand
        }

        // Draw particle with glow
        const color = getParticleColor(p.type, temperatureC - (p.y / H) * 30);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();

        // Glow for oil particles
        if (p.type === "oil" && p.radius > 2.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = p.opacity * 0.15;
          ctx.fill();
        }

        ctx.globalAlpha = 1;
      }

      // Pump marker
      const pumpY = (pumpDepthM / depthM) * H * 0.85;
      ctx.fillStyle = "rgba(96, 165, 250, 0.3)";
      ctx.fillRect(annulus.x - 2, pumpY - 6, annulus.w + 4, 12);
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(annulus.x - 2, pumpY - 6, annulus.w + 4, 12);
      ctx.fillStyle = "#93c5fd";
      ctx.font = "bold 9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("PUMP", W * 0.5, pumpY + 3);

      // Depth scale on left
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      for (let d = 0; d <= depthM; d += Math.round(depthM / 5)) {
        const y = (d / depthM) * H * 0.9 + 15;
        ctx.fillText(`${d}m`, annulus.x - 16, y);
        ctx.beginPath();
        ctx.moveTo(annulus.x - 12, y - 3);
        ctx.lineTo(annulus.x - 4, y - 3);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [temperatureC, viscosityCp, oilRateBpd, waterCutPct, depthM, pumpDepthM, flowSpeed, wobbleFactor]);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-700/50 bg-gradient-to-r from-cyan-950/40 to-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Droplets className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Multiphase Fluid Flow
              </h3>
              <p className="text-[10px] text-slate-400">
                {wellId} — Real-time particle simulation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={340}
          height={380}
          className="w-full h-[380px]"
          style={{ imageRendering: "auto" }}
        />

        {/* Legend overlay */}
        <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700/50 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-[#6e3a1e]" />
            <span className="text-slate-300">Heavy Oil</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-[#50a0cc]" />
            <span className="text-slate-300">Formation Water</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="w-2 h-2 rounded-full bg-[#c8dcff] opacity-60" />
            <span className="text-slate-300">Dissolved Gas</span>
          </div>
        </div>
      </div>

      {/* Bottom telemetry strip */}
      <div className="px-4 py-3 bg-slate-900/60 border-t border-slate-700/50 grid grid-cols-4 gap-3 text-center">
        <div>
          <span className="block text-[9px] text-slate-500 uppercase tracking-wider">Flow Rate</span>
          <span className="block text-sm font-bold text-emerald-400 font-mono">{(oilRateBpd / 6.289).toFixed(1)}</span>
          <span className="block text-[9px] text-slate-500">m³/day</span>
        </div>
        <div>
          <span className="block text-[9px] text-slate-500 uppercase tracking-wider">Temp</span>
          <span className="block text-sm font-bold text-rose-400 font-mono">{temperatureC.toFixed(0)}</span>
          <span className="block text-[9px] text-slate-500">°C</span>
        </div>
        <div>
          <span className="block text-[9px] text-slate-500 uppercase tracking-wider">Viscosity</span>
          <span className="block text-sm font-bold text-amber-400 font-mono">{viscosityCp.toFixed(0)}</span>
          <span className="block text-[9px] text-slate-500">cP</span>
        </div>
        <div>
          <span className="block text-[9px] text-slate-500 uppercase tracking-wider">Water Cut</span>
          <span className="block text-sm font-bold text-blue-400 font-mono">{waterCutPct.toFixed(1)}</span>
          <span className="block text-[9px] text-slate-500">%</span>
        </div>
      </div>
    </div>
  );
};
