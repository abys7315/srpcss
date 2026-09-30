import React, { useState, useEffect } from 'react';
import type { WellSummary } from '../../api/types';
import { apiClient } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';

interface NavbarProps {
  wells: WellSummary[];
  selectedWellId: string;
  onSelectWell: (wellId: string) => void;
  activeAlertCount: number;
}

const PHASE_LABEL: Record<string, string> = {
  INJECTION: 'Injection',
  SOAK: 'Soak',
  PRODUCTION: 'Production',
};

const PHASE_COLOR: Record<string, string> = {
  INJECTION: 'text-steam',
  SOAK: 'text-warn',
  PRODUCTION: 'text-ok',
};

export const Navbar: React.FC<NavbarProps> = ({ wells, selectedWellId, onSelectWell, activeAlertCount }) => {
  const { theme, toggleTheme, units, toggleUnits } = useTheme();
  const [backend, setBackend] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const well = wells.find((w) => w.well_id === selectedWellId);

  useEffect(() => {
    let mounted = true;
    const probe = async () => {
      const res = await apiClient.checkConnection();
      if (mounted) setBackend(res.connected ? 'connected' : 'disconnected');
    };
    probe();
    const t = setInterval(probe, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const btn = 'h-7 px-2.5 border border-rule rounded-sm text-[12px] text-muted hover:text-ink hover:bg-sunk transition-colors';

  return (
    <header className="h-12 border-b border-rule bg-panel px-4 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-5 min-w-0">
        <div className="leading-tight">
          <div className="font-cond font-semibold text-[15px] text-ink tracking-tight">PETRO-TWIN</div>
          <div className="text-[11px] text-muted">CSS + SRP well-to-surface twin</div>
        </div>

        <label className="hidden sm:flex items-center gap-2 text-[13px] text-muted">
          Well
          <select
            value={selectedWellId}
            onChange={(e) => onSelectWell(e.target.value)}
            className="num h-7 border border-rule rounded-sm px-1.5 text-[13px] text-ink bg-panel"
          >
            {wells.map((w) => <option key={w.well_id} value={w.well_id}>{w.well_id}</option>)}
          </select>
        </label>

        {well && (
          <div className="hidden md:flex items-center gap-4 text-[13px]">
            <span className="text-muted">Cycle <span className="num text-ink font-medium">{well.current_cycle_number}</span></span>
            <span className="text-muted">Phase <span className={`font-medium ${PHASE_COLOR[well.cycle_phase] ?? 'text-ink'}`}>{PHASE_LABEL[well.cycle_phase] ?? well.cycle_phase}</span></span>
            {well.status === 'INFEASIBLE' && <span className="caps num text-[11px] bg-alarm-t border border-alarm text-alarm px-1.5 py-0.5">CONSTRAINT VIOLATED</span>}
            {well.status === 'NEAR_LIMIT' && <span className="caps num text-[11px] bg-warn-t border border-warn text-warn px-1.5 py-0.5">NEAR LIMIT</span>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden xl:inline text-[12px] text-muted">1 sample/day, simulated</span>
        <span
          className={`hidden md:inline-flex items-center gap-1.5 text-[12px] ${backend === 'disconnected' ? 'text-alarm' : backend === 'connected' ? 'text-ok' : 'text-muted'}`}
          title="Backend API connection"
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${backend === 'connected' ? 'bg-ok' : backend === 'disconnected' ? 'bg-alarm' : 'bg-muted'}`}></span>
          API {backend}
        </span>
        {activeAlertCount > 0 && (
          <span className="num text-[12px] bg-alarm-t text-alarm border border-alarm px-1.5 h-7 inline-flex items-center rounded-sm font-medium">
            {activeAlertCount} alarm{activeAlertCount > 1 ? 's' : ''}
          </span>
        )}
        <button onClick={toggleUnits} className={btn} title="Toggle display units">
          {units === 'metric' ? 'Metric' : 'Field'}
        </button>
        <button onClick={toggleTheme} className={btn} title="Toggle colour theme">
          {theme === 'dark' ? 'Night shift' : 'Day'}
        </button>
      </div>
    </header>
  );
};
