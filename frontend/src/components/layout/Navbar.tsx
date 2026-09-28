import React from 'react';
import { Activity, ShieldCheck, Flame, ChevronDown } from 'lucide-react';
import type { WellSummary } from '../../api/types';
import { ProvenanceBadge } from '../common/ProvenanceBadge';

interface NavbarProps {
  wells: WellSummary[];
  selectedWellId: string;
  onSelectWell: (wellId: string) => void;
  activeAlertCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  wells,
  selectedWellId,
  onSelectWell,
  activeAlertCount,
}) => {
  return (
    <header className="h-14 border-b border-industrial-800 bg-industrial-950/90 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Field Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <Flame className="w-5 h-5 text-slate-950 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider uppercase text-slate-100 font-mono">
                PETRO-TWIN
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                PS26120
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block font-medium">
              Baghewala Field CSS + SRP Optimization
            </span>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-2 hidden sm:block" />

        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Formation: <strong className="text-slate-200">Jodhpur Sandstone</strong></span>
          <span>•</span>
          <span>API: <strong className="text-slate-200">17–19°</strong></span>
        </div>
      </div>

      {/* Right Controls: Well Switcher, Alerts, Status */}
      <div className="flex items-center gap-3">
        {/* Well Switcher */}
        <div className="relative">
          <select
            value={selectedWellId}
            onChange={(e) => onSelectWell(e.target.value)}
            className="appearance-none bg-industrial-900 border border-industrial-700 text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {wells.map((w) => (
              <option key={w.well_id} value={w.well_id}>
                {w.well_id} ({w.well_name}) — Cycle {w.current_cycle_number}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Alerts Pill */}
        {activeAlertCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-mono animate-pulse">
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>{activeAlertCount} Critical Alert{activeAlertCount > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Provenance Badge */}
        <ProvenanceBadge tier="SIMULATED" size="sm" />

        {/* Engine Status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Physics Engine Online</span>
        </div>
      </div>
    </header>
  );
};
