import React, { useState } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, Zap, Info } from "lucide-react";

interface RodFloatRiskEnvelopeProps {
  currentSpm?: number;
  currentViscosityCp?: number;
  onOperatingPointChange?: (spm: number, viscCp: number) => void;
}

export const RodFloatRiskEnvelope: React.FC<RodFloatRiskEnvelopeProps> = ({
  currentSpm = 4.5,
  currentViscosityCp = 1200,
  onOperatingPointChange,
}) => {
  const [spm, setSpm] = useState(currentSpm);
  const [viscosity, setViscosity] = useState(currentViscosityCp);

  // Buoyant rod weight for typical 1,000m tapered string (API Grade D) ~ 14,200 lbs
  const buoyantRodWeightLbs = 14200.0;

  // Calculate float margin: M_float = W_rod_buoyant / F_drag_downstroke
  // Stokes-annular drag: F_drag = C_drag * mu * v_down
  // v_down = (Stroke / 12) * (pi * SPM / 60)
  const strokeFt = 100.0 / 12.0; // 8.33 ft
  const avgDownstrokeVelFps = strokeFt * ((Math.PI * spm) / 60.0);
  const dragCoeff = 3.65; // lbs per (cP * ft/s)
  const dragForceLbs = viscosity * avgDownstrokeVelFps * dragCoeff;
  const floatMargin = buoyantRodWeightLbs / Math.max(10.0, dragForceLbs);

  // Recommended VFD Downstroke ratio to restore M_float to 1.35 if floating
  let recommendedVfdRatio = 1.0;
  if (floatMargin < 1.3) {
    const requiredVel = buoyantRodWeightLbs / (1.35 * viscosity * dragCoeff);
    recommendedVfdRatio = Math.max(0.45, Math.min(1.0, requiredVel / Math.max(0.1, avgDownstrokeVelFps)));
  }

  // Canvas mapping (SVG dimensions 540 x 300)
  const minSpm = 2.0;
  const maxSpm = 8.5;
  const minVisc = 100.0;
  const maxVisc = 4500.0;

  const pad = { top: 25, right: 30, bottom: 40, left: 60 };
  const plotW = 540 - pad.left - pad.right;
  const plotH = 300 - pad.top - pad.bottom;

  const toX = (s: number) => pad.left + ((s - minSpm) / (maxSpm - minSpm)) * plotW;
  const toY = (v: number) => pad.top + plotH - ((v - minVisc) / (maxVisc - minVisc)) * plotH;

  const curX = toX(spm);
  const curY = toY(viscosity);

  // Generate boundary curves:
  // Critical Curve (M_float = 1.0): mu_crit(SPM) = W_rod / (1.0 * v_down * dragCoeff)
  // Warning Curve (M_float = 1.3): mu_warn(SPM) = W_rod / (1.3 * v_down * dragCoeff)
  const spmSteps = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5];

  const criticalPoints = spmSteps.map((s) => {
    const v = strokeFt * ((Math.PI * s) / 60.0);
    const muCrit = Math.min(maxVisc, buoyantRodWeightLbs / (1.0 * v * dragCoeff));
    return { s, mu: muCrit, x: toX(s), y: toY(muCrit) };
  });

  const warningPoints = spmSteps.map((s) => {
    const v = strokeFt * ((Math.PI * s) / 60.0);
    const muWarn = Math.min(maxVisc, buoyantRodWeightLbs / (1.3 * v * dragCoeff));
    return { s, mu: muWarn, x: toX(s), y: toY(muWarn) };
  });

  // Construct SVG polygon path for Danger Zone (above critical curve)
  const dangerPathD = `M ${criticalPoints[0].x} ${criticalPoints[0].y} ` +
    criticalPoints.map(p => `L ${p.x} ${p.y}`).join(" ") +
    ` L ${toX(maxSpm)} ${toY(maxVisc)} L ${toX(minSpm)} ${toY(maxVisc)} Z`;

  // Construct SVG polygon path for Transition Zone (between warn and crit)
  const warnPathD = `M ${warningPoints[0].x} ${warningPoints[0].y} ` +
    warningPoints.map(p => `L ${p.x} ${p.y}`).join(" ") +
    ` L ${criticalPoints[criticalPoints.length - 1].x} ${criticalPoints[criticalPoints.length - 1].y} ` +
    criticalPoints.slice().reverse().map(p => `L ${p.x} ${p.y}`).join(" ") +
    ` Z`;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX >= pad.left && clickX <= pad.left + plotW && clickY >= pad.top && clickY <= pad.top + plotH) {
      const newSpm = minSpm + ((clickX - pad.left) / plotW) * (maxSpm - minSpm);
      const newVisc = minVisc + ((pad.top + plotH - clickY) / plotH) * (maxVisc - minVisc);
      const roundedSpm = Math.round(newSpm * 10) / 10;
      const roundedVisc = Math.round(newVisc / 25) * 25;
      setSpm(roundedSpm);
      setViscosity(roundedVisc);
      if (onOperatingPointChange) {
        onOperatingPointChange(roundedSpm, roundedVisc);
      }
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <h3 className="text-lg font-bold text-white tracking-wide">
              Interactive 2D Rod Float Risk Envelope & Operating Space
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              Fluid Drag vs Buoyancy
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Click anywhere on the 2D surface to glide operating conditions and evaluate mechanical safety margins
          </p>
        </div>

        <div className="flex items-center gap-2">
          {floatMargin < 1.0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              SLACK ROD DANGER (Mf = {floatMargin.toFixed(2)})
            </div>
          ) : floatMargin < 1.3 ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-950/80 border border-amber-500/50 text-amber-300 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              TRANSITION ZONE (Mf = {floatMargin.toFixed(2)})
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              SAFE OPERATING ZONE (Mf = {floatMargin.toFixed(2)})
            </div>
          )}
        </div>
      </div>

      {/* SVG Interactive Heatmap Envelope */}
      <div className="relative bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex justify-center shadow-inner cursor-crosshair">
        <svg
          viewBox="0 0 540 300"
          className="w-full h-auto max-h-[320px] select-none"
          onClick={handleSvgClick}
        >
          {/* Safe Zone (Green background) */}
          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={plotH}
            fill="#064e3b"
            opacity="0.5"
          />

          {/* Caution Transition Zone (Amber fill) */}
          <path d={warnPathD} fill="#78350f" opacity="0.65" />

          {/* Danger Rod Floating Zone (Red fill) */}
          <path d={dangerPathD} fill="#881337" opacity="0.75" />

          {/* Grid lines */}
          {[2, 3, 4, 5, 6, 7, 8].map((s) => (
            <g key={s}>
              <line x1={toX(s)} y1={pad.top} x2={toX(s)} y2={pad.top + plotH} stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
              <text x={toX(s)} y={pad.top + plotH + 16} fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                {s}
              </text>
            </g>
          ))}

          {[500, 1500, 2500, 3500, 4500].map((v) => (
            <g key={v}>
              <line x1={pad.left} y1={toY(v)} x2={pad.left + plotW} y2={toY(v)} stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
              <text x={pad.left - 8} y={toY(v) + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                {v}
              </text>
            </g>
          ))}

          {/* Boundary Curve Lines */}
          <path
            d={warningPoints.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4,2"
          />
          <path
            d={criticalPoints.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.5"
          />

          {/* Boundary Labels */}
          <text x={toX(7.2)} y={toY(1100)} fill="#f59e0b" fontSize="8" fontWeight="bold" fontFamily="monospace">
            --- M_float = 1.30
          </text>
          <text x={toX(7.2)} y={toY(800)} fill="#f43f5e" fontSize="8" fontWeight="bold" fontFamily="monospace">
            ─── M_float = 1.00 (Critical Float)
          </text>

          {/* Axis Labels */}
          <text x={pad.left + plotW / 2} y={pad.top + plotH + 32} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">
            Pumping Speed (SPM)
          </text>
          <text
            x={-pad.top - plotH / 2}
            y={18}
            fill="#94a3b8"
            fontSize="10"
            textAnchor="middle"
            fontWeight="bold"
            transform="rotate(-90)"
          >
            Crude Viscosity (cP)
          </text>

          {/* Current Operating Point Marker */}
          <g>
            <circle cx={curX} cy={curY} r="14" fill="none" stroke="#00f0ff" strokeWidth="2" className="animate-ping" opacity="0.6" />
            <circle cx={curX} cy={curY} r="7" fill="#00f0ff" stroke="#ffffff" strokeWidth="2" />
            <line x1={curX} y1={pad.top} x2={curX} y2={pad.top + plotH} stroke="#00f0ff" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
            <line x1={pad.left} y1={curY} x2={pad.left + plotW} y2={curY} stroke="#00f0ff" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />

            {/* Operating Point Tooltip Badge */}
            <g transform={`translate(${Math.min(pad.left + plotW - 140, Math.max(pad.left + 10, curX + 10))}, ${Math.max(pad.top + 25, curY - 35)})`}>
              <rect x="0" y="0" width="135" height="42" rx="4" fill="#0f172a" stroke="#00f0ff" strokeWidth="1.5" opacity="0.95" />
              <text x="8" y="15" fill="#f8fafc" fontSize="9" fontWeight="bold" fontFamily="monospace">
                OPERATING POINT
              </text>
              <text x="8" y="27" fill="#38bdf8" fontSize="8" fontFamily="monospace">
                SPM: {spm.toFixed(1)} | {viscosity} cP
              </text>
              <text x="8" y="38" fill={floatMargin < 1.0 ? "#f43f5e" : "#10b981"} fontSize="8" fontWeight="bold" fontFamily="monospace">
                Float Margin: {floatMargin.toFixed(2)}
              </text>
            </g>
          </g>
        </svg>

        {/* Legend Overlay */}
        <div className="absolute top-3 right-3 bg-slate-900/85 border border-slate-700/80 rounded-lg p-2 backdrop-blur-md text-[10px] font-mono space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block"></span>
            Safe Zone (Mf ≥ 1.3)
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block"></span>
            Transition (1.0 ≤ Mf &lt; 1.3)
          </div>
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-700 inline-block"></span>
            Danger Float (Mf &lt; 1.0)
          </div>
        </div>
      </div>

      {/* Physics Feedback & Remediation HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-3 border-t border-slate-800">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <span className="text-xs text-slate-400 font-medium">Downstroke Drag Force</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold font-mono text-slate-200">
              {Math.round(dragForceLbs).toLocaleString()} lbs
            </span>
            <span className="text-xs text-slate-500">vs 14,200 lbs buoyant rod weight</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Net downstroke accelerating force: {Math.max(0, Math.round(buoyantRodWeightLbs - dragForceLbs)).toLocaleString()} lbs
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>VFD Remediation Recommendation</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold font-mono text-amber-400">
              {recommendedVfdRatio < 1.0 ? `${recommendedVfdRatio.toFixed(2)}x Downstroke Speed` : "Symmetric 1.0x OK"}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {recommendedVfdRatio < 1.0
              ? `Decelerate downstroke to ${(spm * recommendedVfdRatio).toFixed(1)} effective SPM to eliminate slack rod floating.`
              : "No asymmetric downstroke speed modulation required."}
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <Info className="w-3 h-3 text-blue-400" />
            <span>Operational Guidance</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            {floatMargin < 1.0
              ? "🚨 CRITICAL: Immediate rod uncoupling risk. Apply VFD ratio or initiate hot diluent circulation."
              : floatMargin < 1.3
              ? "⚠️ CAUTION: Rod deceleration detected. Monitor dynamometer card for compressive slap."
              : "✅ NOMINAL: Sucker rod string maintains full tension throughout 100% of the stroke."}
          </p>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Click diagram to test alternative operating points
          </div>
        </div>
      </div>
    </div>
  );
};
