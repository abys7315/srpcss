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
import { Feedback } from './pages/Feedback';
import { Benchmarks } from './pages/Benchmarks';
import { DataProvenance } from './pages/DataProvenance';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('command-center');
  const [selectedWellId, setSelectedWellId] = useState<string>('BGW-01');
  const [wells, setWells] = useState<WellSummary[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadWells();
  }, []);

  const loadWells = async () => {
    try {
      setLoading(true);
      const list = await apiClient.getWells();
      setWells(list);
      if (list && list.length > 0 && !list.find((w) => w.well_id === selectedWellId)) {
        setSelectedWellId(list[0].well_id);
      }
    } catch (e) {
      console.error('Failed to load initial wells list:', e);
      // Fallback 10 wells if backend is not yet started
      const fallbackWells: WellSummary[] = Array.from({ length: 10 }, (_, i) => {
        const id = `BGW-${(i + 1).toString().padStart(2, '0')}`;
        return {
          well_id: id,
          well_name: `Baghewala Heavy Oil Well ${i + 1}`,
          field_name: 'Baghewala Field',
          formation: 'Jodhpur Sandstone',
          crude_api: 18.2,
          depth_m: 980 + i * 15,
          current_cycle_number: 3,
          cycle_phase: 'PRODUCTION',
          status: i === 0 ? 'INFEASIBLE' : i === 2 ? 'NEAR_LIMIT' : 'FEASIBLE',
          telemetry: {
            current_day_in_cycle: 45,
            current_temperature_c: 135,
            current_viscosity_cp: 1200,
            current_oil_rate_bpd: 54.2,
            current_water_cut_pct: 58.0,
            current_float_margin_index: i === 0 ? 0.92 : 1.18,
            current_goodman_stress_ratio: 0.68,
            current_gearbox_load_pct: 62.5,
            current_pump_intake_pressure_bar: 24.5,
            latest_dynacard_label: i === 0 ? 'ROD_FLOATING' : 'NORMAL',
          },
          operating_parameters: {
            steam_volume_tonnes: 3000,
            injection_pressure_bar: 105,
            steam_temp_celsius: 310,
            soak_duration_days: 6,
            spm: 4.5,
            stroke_length_inch: 100,
            vfd_downstroke_ratio: 1.0,
            economic_cutoff_oil_rate_bpd: 15.0,
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
      case 'feedback':
        return <Feedback selectedWellId={selectedWellId} onNavigate={setCurrentPage} />;
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
    <div className="min-h-screen bg-industrial-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        wells={wells}
        selectedWellId={selectedWellId}
        onSelectWell={setSelectedWellId}
        activeAlertCount={activeAlertCount}
      />

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-16">
          <div className="max-w-7xl mx-auto">{renderActivePage()}</div>
        </main>
      </div>
    </div>
  );
};

export default App;
