import React, { useState, useEffect } from 'react';
import {
  Flame,
  ChevronDown,
  Bell,
  Radio,
  ArrowDownCircle,
  Sun,
  Moon,
} from 'lucide-react';
import type { WellSummary } from '../../api/types';
import { apiClient } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';

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
  const { theme, toggleTheme } = useTheme();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    let mounted = true;
    const probe = async () => {
      const res = await apiClient.checkConnection();
      if (mounted) {
        setBackendStatus(res.connected ? 'connected' : 'disconnected');
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
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b14] px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs transition-colors duration-200">
      {/* Left: Brand & Well Selector */}
      <div className="flex items-center gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-950 to-slate-800 dark:from-cyan-950 dark:to-slate-900 border border-slate-700/60 dark:border-cyan-500/30 flex items-center justify-center shadow-xs">
            <Flame className="w-4.5 h-4.5 text-amber-500 fill-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                PETRO-TWIN
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight font-normal">
              CSS + SRP Digital Twin · Baghewala Field
            </span>
          </div>
        </div>

        {/* Well Switcher + Producing Badge */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Well</span>
          <div className="relative">
            <select
              value={selectedWellId}
              onChange={(e) => onSelectWell(e.target.value)}
              className="appearance-none bg-white dark:bg-[#0d1526] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 cursor-pointer shadow-2xs"
            >
              {wells.map((w) => (
                <option key={w.well_id} value={w.well_id}>
                  {w.well_id}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Producing
          </span>
        </div>
      </div>

      {/* Right Controls: Sync Time, Live Data, Notifications, Theme Switcher, Profile */}
      <div className="flex items-center gap-3">
        {/* Synthetic Telemetry Rate Info */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <ArrowDownCircle className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Synthetic Telemetry • 10 Hz</span>
        </div>

        {/* Simulation Mode / SCADA Connector Badge */}
        <div
          title={`Digital Twin running on first-principles physics. SCADA connector status: ${backendStatus}.`}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-[#0c1424] text-white text-xs font-semibold shadow-xs border border-slate-800 dark:border-slate-700/80"
        >
          <Radio className={`w-3 h-3 ${backendStatus === 'connected' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span className="tracking-wide">SIMULATION MODE</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 dark:bg-slate-800/90 text-slate-300 font-normal border border-slate-700">
            SCADA Connector Ready
          </span>
        </div>

        {/* Theme Switcher Toggle (Sun / Moon) */}
        <button
          onClick={toggleTheme}
          title={`Currently ${theme === 'dark' ? 'Dark Mode (Oceanic Obsidian)' : 'Light Mode'}. Click to toggle.`}
          className="relative p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#0e172a] dark:hover:bg-[#16223d] text-slate-700 dark:text-cyan-300 border border-slate-200 dark:border-slate-700/70 transition-all flex items-center gap-1.5 px-2.5 cursor-pointer shadow-xs"
        >
          {theme === 'dark' ? (
            <>
              <Moon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-mono font-medium hidden sm:inline text-cyan-300">Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-mono font-medium hidden sm:inline text-slate-700">Light</span>
            </>
          )}
        </button>

        {/* Notification Bell with Badge */}
        <div className="relative p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors">
          <Bell className="w-4 h-4" />
          {activeAlertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-[#070b14]">
              {activeAlertCount}
            </span>
          )}
        </div>

        {/* Team Profile Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-800 dark:bg-cyan-950 text-white dark:text-cyan-300 border border-transparent dark:border-cyan-500/40 flex items-center justify-center text-xs font-bold shadow-2xs">
            T
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
              Team SIH
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Project 26120
            </div>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
        </div>
      </div>
    </header>
  );
};
