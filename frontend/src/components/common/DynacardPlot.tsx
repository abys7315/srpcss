import React from 'react';
import type { DynacardData } from '../../api/types';

interface DynacardPlotProps {
  card?: DynacardData;
  title?: string;
  width?: number;
  height?: number;
}

export const DynacardPlot: React.FC<DynacardPlotProps> = ({
  card,
  title = "Surface & Downhole Dynamometer Card",
  width = 500,
  height = 320
}) => {
  if (!card || !card.surface_position_inch || card.surface_position_inch.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center h-64 text-slate-400 font-mono text-xs">
        No dynacard telemetry loaded
      </div>
    );
  }

  const padding = { top: 30, right: 30, bottom: 40, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxStroke = Math.max(...card.surface_position_inch, card.stroke_length_inch || 100.0, 1.0);
  const minLoad = Math.min(...card.surface_load_lbs, ...card.downhole_load_lbs, 0);
  const maxLoad = Math.max(...card.surface_load_lbs, ...card.downhole_load_lbs, 20000.0);
  const loadRange = Math.max(maxLoad - minLoad, 1000.0);

  const scaleX = (x: number) => padding.left + (x / maxStroke) * plotWidth;
  const scaleY = (y: number) => padding.top + plotHeight - ((y - minLoad) / loadRange) * plotHeight;

  // Generate SVG path strings
  const makePath = (posX: number[], loadY: number[]) => {
    if (posX.length === 0) return '';
    const pts = posX.map((x, i) => `${scaleX(x)},${scaleY(loadY[i])}`);
    return `M ${pts.join(' L ')} Z`;
  };

  const surfacePath = makePath(card.surface_position_inch, card.surface_load_lbs);
  const downholePath = makePath(card.downhole_position_inch, card.downhole_load_lbs);

  const isFloating = card.diagnostic_card_label === 'ROD_FLOATING';
  const isPound = card.diagnostic_card_label === 'FLUID_POUND';

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 flex flex-col items-center shadow-xs transition-colors">
      {/* Card Header */}
      <div className="w-full flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-white tracking-wider uppercase">{title}</h4>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Stroke: {card.stroke_length_inch.toFixed(0)}" | Speed: {card.spm.toFixed(1)} SPM
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border ${
            isFloating
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
              : isPound
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
          }`}>
            {card.diagnostic_card_label}
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-hidden w-full flex justify-center bg-slate-50 dark:bg-[#070b14] rounded-lg p-1 border border-slate-100 dark:border-slate-800/60">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[540px] h-auto select-none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const yVal = minLoad + frac * loadRange;
            const yPos = scaleY(yVal);
            return (
              <g key={`y-${idx}`}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={padding.left + plotWidth}
                  y2={yPos}
                  stroke="#334155"
                  strokeOpacity="0.4"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono font-medium"
                >
                  {(yVal / 1000).toFixed(1)}k
                </text>
              </g>
            );
          })}

          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const xVal = frac * maxStroke;
            const xPos = scaleX(xVal);
            return (
              <g key={`x-${idx}`}>
                <line
                  x1={xPos}
                  y1={padding.top}
                  x2={xPos}
                  y2={padding.top + plotHeight}
                  stroke="#334155"
                  strokeOpacity="0.4"
                  strokeDasharray="3 3"
                />
                <text
                  x={xPos}
                  y={padding.top + plotHeight + 16}
                  textAnchor="middle"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono font-medium"
                >
                  {xVal.toFixed(0)}"
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="#64748b"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + plotHeight}
            stroke="#64748b"
            strokeWidth="1.5"
          />

          {/* Zero load reference line */}
          {minLoad <= 0 && maxLoad >= 0 && (
            <line
              x1={padding.left}
              y1={scaleY(0)}
              x2={padding.left + plotWidth}
              y2={scaleY(0)}
              stroke="#f43f5e"
              strokeWidth="1"
              strokeDasharray="4 2"
            />
          )}

          {/* Downhole Card */}
          <path
            d={downholePath}
            fill="rgba(56, 189, 248, 0.10)"
            stroke="#38bdf8"
            strokeWidth="1.8"
            strokeDasharray="5 3"
          />

          {/* Surface Card */}
          <path
            d={surfacePath}
            fill={isFloating ? "rgba(244, 63, 94, 0.12)" : "rgba(0, 240, 255, 0.12)"}
            stroke={isFloating ? "#f43f5e" : "#00f0ff"}
            strokeWidth="2.2"
          />

          {/* Peak Load marker */}
          <line
            x1={padding.left}
            y1={scaleY(card.peak_polished_rod_load_lbs)}
            x2={padding.left + plotWidth}
            y2={scaleY(card.peak_polished_rod_load_lbs)}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text
            x={padding.left + plotWidth - 4}
            y={scaleY(card.peak_polished_rod_load_lbs) - 4}
            textAnchor="end"
            className="fill-amber-500 dark:fill-amber-400 text-[10px] font-mono font-semibold"
          >
            PPRL: {card.peak_polished_rod_load_lbs.toLocaleString()} lbs
          </text>
        </svg>
      </div>

      {/* Card Legend & KPIs */}
      <div className="w-full flex items-center justify-between text-xs pt-2.5 border-t border-slate-200 dark:border-slate-800 font-mono mt-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-semibold">
            <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
            Surface Card
          </span>
          <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-medium">
            <span className="w-2.5 h-0.5 border-t border-dashed border-sky-400 inline-block" />
            Pump Card
          </span>
        </div>
        <div className="text-slate-500 dark:text-slate-400 text-[11px] flex gap-3 whitespace-nowrap">
          <span>Torque: {(card.peak_gearbox_torque_in_lbs / 1000).toFixed(0)}k in-lb</span>
          <span>Load Range: {card.load_range_lbs.toLocaleString()} lbs</span>
        </div>
      </div>
    </div>
  );
};
