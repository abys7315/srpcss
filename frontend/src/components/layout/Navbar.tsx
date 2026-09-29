import React, { useState, useEffect } from 'react';
import { Activity, Flame, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';
import type { WellSummary } from '../../api/types';
import { ProvenanceBadge } from '../common/ProvenanceBadge';
import { apiClient } from '../../api/client';

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
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [backendVersion, setBackendVersion] = useState<string>('1.0.0');

  useEffect(() => {
    let mounted = true;
    const probe = async () => {
      const res = await apiClient.checkConnection();
      if (mounted) {
        setBackendStatus(res.connected ? 'connected' : 'disconnected');
        if (res.version) setBackendVersion(res.version);
      }
    };
    probe();
    const interval = setInterval(probe, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);
  return (
    <header className="h-14 border-b border-slate-200 bg-white px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand & Field Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-xs">
            <Flame className="w-4.5 h-4.5 text-amber-400 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900">
                PetroTwin
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                PS26120
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block font-normal">
              Baghewala Field · CSS & SRP Optimization
            </span>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-2 hidden sm:block" />

        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
          <span>Formation: <strong className="text-slate-800 font-semibold">Jodhpur Sandstone</strong></span>
          <span>·</span>
          <span>Crude API: <strong className="text-slate-800 font-semibold">17–19°</strong></span>
        </div>
      </div>

      {/* Right Controls: Well Switcher, Alerts, Status */}
      <div className="flex items-center gap-3">
        {/* Well Switcher */}
        <div className="relative">
          <select
            value={selectedWellId}
            onChange={(e) => onSelectWell(e.target.value)}
            className="appearance-none bg-white border border-slate-300 text-slate-800 text-xs font-mono rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-xs"
          >
            {wells.map((w) => (
              <option key={w.well_id} value={w.well_id}>
                {w.well_id} ({w.well_name}) — Cycle {w.current_cycle_number}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Alerts Pill */}
        {activeAlertCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <Activity className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
            <span>{activeAlertCount} Alert{activeAlertCount > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Provenance Badge */}
        <ProvenanceBadge tier="SIMULATED" size="sm" />

        {/* Backend Status Pill matching GNSS LOCK ACTIVE pill in reference */}
        <div
          title={backendStatus === 'connected' ? `Backend API v${backendVersion} Connected` : 'Backend API Offline on port 8000'}
          className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
            backendStatus === 'connected'
              ? 'text-blue-700 bg-blue-50 border-blue-200'
              : backendStatus === 'checking'
              ? 'text-amber-700 bg-amber-50 border-amber-200 animate-pulse'
              : 'text-rose-700 bg-rose-50 border-rose-200'
          }`}
        >
          {backendStatus === 'connected' ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span>SCADA SYNC ACTIVE</span>
            </>
          ) : backendStatus === 'checking' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Backend Offline</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
