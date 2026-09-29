import React from 'react';

interface WellboreSchematicProps {
  depthM?: number;
  pumpDepthM?: number;
  temperatureC?: number;
  viscosityCp?: number;
  heatedRadiusM?: number;
  isFloating?: boolean;
}

export const WellboreSchematic: React.FC<WellboreSchematicProps> = ({
  depthM = 1050,
  pumpDepthM = 980,
  temperatureC = 85,
  viscosityCp = 280,
  heatedRadiusM = 14.5,
  isFloating = false,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center shadow-xs">
      <div className="w-full flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          2D Wellbore & Reservoir Architecture
        </h4>
        <span className="text-[11px] font-mono text-blue-700 font-semibold">
          TVD: {depthM}m | Pump: {pumpDepthM}m
        </span>
      </div>

      <div className="w-full flex justify-center py-2">
        <svg viewBox="0 0 280 440" className="w-full max-w-[260px] h-auto select-none">
          <defs>
            {/* Reservoir heated zone gradient */}
            <radialGradient id="steamZone" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#ea580c" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7c2d12" stopOpacity="0.02" />
            </radialGradient>
            
            {/* Crude fluid gradient */}
            <linearGradient id="crudeColumn" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>

          {/* Surface Beam Unit Icon */}
          <g transform="translate(100, 10)">
            {/* Samson post */}
            <polygon points="40,40 30,55 50,55" fill="#64748b" />
            {/* Walking beam */}
            <line x1="15" y1="36" x2="65" y2="44" stroke="#475569" strokeWidth="4" />
            {/* Horse head */}
            <path d="M 15 36 C 8 40, 8 50, 12 56" fill="none" stroke="#334155" strokeWidth="4" />
            {/* Polished rod wire */}
            <line x1="12" y1="56" x2="12" y2="70" stroke="#0284c7" strokeWidth="2" />
          </g>

          {/* Ground line */}
          <line x1="20" y1="80" x2="260" y2="80" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="3 3" />
          <text x="30" y="75" className="fill-slate-500 text-[9px] font-mono font-medium">SURFACE (0m)</text>

          {/* Casing 7" */}
          <rect x="100" y="80" width="80" height="300" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
          <text x="185" y="100" className="fill-slate-500 text-[8px] font-mono">7" Casing</text>

          {/* Heated zone expansion in reservoir */}
          <ellipse cx="140" cy="370" rx="90" ry="45" fill="url(#steamZone)" />
          <text x="140" y="425" textAnchor="middle" className="fill-orange-700 text-[9px] font-mono font-bold">
            Heated Zone Rh: {heatedRadiusM.toFixed(1)}m ({temperatureC}°C)
          </text>

          {/* Tubing 3.5" */}
          <rect x="120" y="80" width="40" height="280" fill="url(#crudeColumn)" stroke="#0284c7" strokeWidth="1.5" />
          <text x="80" y="200" textAnchor="end" className="fill-blue-700 text-[8px] font-mono font-medium">3.5" Tubing</text>

          {/* Sucker Rod String (API 76 Taper) */}
          {/* Top section 1.0" */}
          <line x1="140" y1="80" x2="140" y2="170" stroke={isFloating ? "#ef4444" : "#334155"} strokeWidth="3" />
          {/* Mid section 7/8" */}
          <line x1="140" y1="170" x2="140" y2="260" stroke={isFloating ? "#ef4444" : "#475569"} strokeWidth="2.5" />
          {/* Bottom section 3/4" */}
          <line x1="140" y1="260" x2="140" y2="350" stroke={isFloating ? "#ef4444" : "#64748b"} strokeWidth="2" />

          {/* Rod Couplings */}
          {[110, 140, 170, 200, 230, 260, 290, 320].map((y, idx) => (
            <rect key={idx} x="137" y={y} width="6" height="4" fill="#334155" rx="1" />
          ))}

          {/* Downhole Subsurface Pump */}
          <g transform="translate(130, 350)">
            <rect x="0" y="0" width="20" height="25" fill="#f1f5f9" stroke="#d97706" strokeWidth="1.5" />
            <circle cx="10" cy="7" r="3" fill="#0284c7" />
            <polygon points="7,20 13,20 10,14" fill="#ef4444" />
          </g>
          <text x="185" y="365" className="fill-amber-800 text-[8px] font-mono font-semibold">Pump (980m)</text>

          {/* Perforations */}
          {[-15, -5, 5, 15].map((off, idx) => (
            <g key={idx}>
              <line x1="90" y1={370 + off} x2="100" y2={370 + off} stroke="#ea580c" strokeWidth="2" />
              <line x1="180" y1={370 + off} x2="190" y2={370 + off} stroke="#ea580c" strokeWidth="2" />
            </g>
          ))}
          <text x="40" y="373" className="fill-orange-700 text-[8px] font-mono font-medium">Perfs (1050m)</text>
        </svg>
      </div>

      <div className="w-full flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-200 text-slate-700">
        <span>Viscosity: <strong className="text-blue-700 font-bold">{viscosityCp} cP</strong></span>
        <span>Temp: <strong className="text-orange-700 font-bold">{temperatureC}°C</strong></span>
        {isFloating && (
          <span className="text-rose-600 font-bold animate-pulse">
            Active Rod Float!
          </span>
        )}
      </div>
    </div>
  );
};
