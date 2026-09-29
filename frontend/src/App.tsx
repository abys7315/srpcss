import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import type { PageId } from './components/layout/Sidebar';
import { apiClient } from './api/client';
import type { WellSummary } from './api/types';

// Pages
import { CommandCenter } from './pages/CommandCenter';
import { DigitalTwin } from './pages/DigitalTwin';
import { JointOptimizer } from './pages/JointOptimizer';
import { CSSOptimizer } from './pages/CSSOptimizer';
import { SRPOptimizer } from './pages/SRPOptimizer';
import { WhatIfSimulator } from './pages/WhatIfSimulator';
import { Predictions } from './pages/Predictions';
import { Economics } from './pages/Economics';
import { RiskIntegrity } from './pages/RiskIntegrity';
import { ModelRegistry } from './pages/ModelRegistry';
import { Benchmarks } from './pages/Benchmarks';
import { DataProvenance } from './pages/DataProvenance';
import { AICommandBar } from './components/common/AICommandBar';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('command-center');
  const [selectedWellId, setSelectedWellId] = useState<string>('BGW-01');
  const [wells, setWells] = useState<WellSummary[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);

  const [apiAvailable, setApiAvailable] = useState<boolean>(true);

  useEffect(() => {
    loadWells();
  }, []);

  const loadWells = async () => {
    try {
      setLoading(true);
      const list = await apiClient.getWells();
      setWells(list);
      setApiAvailable(true);
      if (list && list.length > 0 && !list.find((w) => w.well_id === selectedWellId)) {
        setSelectedWellId(list[0].well_id);
      }
    } catch (e) {
      console.error('Failed to load initial wells list:', e);
      setApiAvailable(false);
      // Fallback 5 benchmark wells strictly labeled as SIMULATED DEMO DATA using canonical Baghewala configuration
      const fallbackWells: WellSummary[] = Array.from({ length: 5 }, (_, i) => {
        const id = `BGW-${(i + 1).toString().padStart(2, '0')}`;
        return {
          well_id: id,
          well_name: `[DEMO] Baghewala Well ${i + 1}`,
          field_name: 'Baghewala Field',
          formation: 'Jodhpur Sandstone',
          crude_api: 18.0,
          depth_m: 1050.0,
          current_cycle_number: 1,
          cycle_phase: 'PRODUCTION',
          status: i === 0 ? 'INFEASIBLE' : i === 2 ? 'NEAR_LIMIT' : 'FEASIBLE',
          telemetry: {
            current_day_in_cycle: 45,
            current_temperature_c: 75.0,
            current_viscosity_cp: 450.0,
            current_oil_rate_bpd: 28.5,
            current_water_cut_pct: 60.0,
            current_float_margin_index: i === 0 ? 0.92 : 1.18,
            current_goodman_stress_ratio: 0.68,
            current_gearbox_load_pct: 65.0,
            current_pump_intake_pressure_bar: 24.5,
            latest_dynacard_label: i === 0 ? 'ROD_FLOATING' : 'NORMAL',
          },
          operating_parameters: {
            steam_volume_tonnes: 3000.0,
            injection_pressure_bar: 125.0,
            steam_temp_celsius: 260.0,
            soak_duration_days: 6.0,
            spm: 4.5,
            stroke_length_inch: 100.0,
            vfd_downstroke_ratio: 1.0,
            economic_cutoff_oil_rate_bpd: 8.0,
          },
          provenance: 'SIMULATED',
        };
      });
      setWells(fallbackWells);
    } finally {
      setLoading(false);
    }
  };

  const activeAlertCount = wells.filter(
    (w) => w.status === 'INFEASIBLE' || (w.telemetry?.current_float_margin_index || 2.0) < 1.0
  ).length;

  const renderActivePage = () => {
    switch (currentPage) {
      case 'command-center':
        return (
          <CommandCenter
            selectedWellId={selectedWellId}
            onSelectWell={setSelectedWellId}
            onNavigate={setCurrentPage}
          />
        );
      case 'digital-twin':
        return <DigitalTwin selectedWellId={selectedWellId} />;
      case 'joint-optimizer':
        return <JointOptimizer selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
      case 'css-optimizer':
        return <CSSOptimizer selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
      case 'srp-optimizer':
        return <SRPOptimizer selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
      case 'what-if':
        return <WhatIfSimulator selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
      case 'predictions':
        return <Predictions selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
      case 'economics':
        return <Economics selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
      case 'risk':
        return <RiskIntegrity selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
      case 'model-registry':
        return <ModelRegistry onNavigate={setCurrentPage} />;
      case 'benchmarks':
        return <Benchmarks selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
      case 'provenance':
        return <DataProvenance onNavigate={setCurrentPage} />;
      default:
        return (
          <CommandCenter
            selectedWellId={selectedWellId}
            onSelectWell={setSelectedWellId}
            onNavigate={setCurrentPage}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060911] text-slate-800 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200 transition-colors duration-200">
      {/* Top Navigation */}
      <Navbar
        wells={wells}
        selectedWellId={selectedWellId}
        onSelectWell={setSelectedWellId}
        activeAlertCount={activeAlertCount}
      />

      {/* Engineering Sub-header Telemetry Ribbon */}
      <div className="bg-white dark:bg-[#080d19] border-b border-slate-200 dark:border-slate-800/80 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 shadow-xs transition-colors duration-200">
        <div className="flex flex-wrap items-center gap-3 lg:gap-5">
          <span>Well <strong className="text-slate-900 dark:text-white font-semibold">{selectedWellId}</strong></span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span>Depth <strong className="text-slate-900 dark:text-white font-semibold">1,050 m TVD</strong></span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span>Viscosity <strong className="text-slate-900 dark:text-white font-semibold">450–1,200 cP</strong></span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span>Lift Unit <strong className="text-slate-900 dark:text-white font-semibold">API C-456 Beam + Sucker Rod</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
            Synthetic Telemetry • 10 Hz
          </span>
        </div>
      </div>

      {/* Backend Offline Demo Banner */}
      {!apiAvailable && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2 text-xs font-mono text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 text-[10px] font-bold text-amber-900 dark:text-amber-200">
              SIMULATED DEMO DATA
            </span>
            <span>BACKEND DATA UNAVAILABLE — Displaying simulated Baghewala demo dataset (API offline).</span>
          </div>
          <button
            onClick={loadWells}
            className="text-[11px] underline hover:text-amber-900 dark:hover:text-amber-100 font-semibold"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 bg-slate-50 dark:bg-[#060911] transition-colors duration-200">
          <div className="max-w-7xl mx-auto space-y-6">
            {renderActivePage()}
          </div>
        </main>
      </div>

      {/* Floating AI Command Bar matching the reference UI */}
      <AICommandBar
        selectedWellId={selectedWellId}
        onNavigate={setCurrentPage}
        wellData={wells.find((w) => w.well_id === selectedWellId)}
        activeTab={currentPage}
      />
    </div>
  );
};

export default App;
