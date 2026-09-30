import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import type { PageId } from './components/layout/Sidebar';
import { apiClient } from './api/client';
import type { WellDetail, WellSummary } from './api/types';
import { AssistantDock } from './components/common/AICommandBar';
import { useUnits, fmt } from './lib/units';

// One chunk per page.
const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType<any>>>, key: K) =>
  lazy(() => loader().then((m) => ({ default: m[key] })));

const CommandCenter = named(() => import('./pages/CommandCenter'), 'CommandCenter');
const DigitalTwin = named(() => import('./pages/DigitalTwin'), 'DigitalTwin');
const JointOptimizer = named(() => import('./pages/JointOptimizer'), 'JointOptimizer');
const CSSOptimizer = named(() => import('./pages/CSSOptimizer'), 'CSSOptimizer');
const SRPOptimizer = named(() => import('./pages/SRPOptimizer'), 'SRPOptimizer');
const WhatIfSimulator = named(() => import('./pages/WhatIfSimulator'), 'WhatIfSimulator');
const Predictions = named(() => import('./pages/Predictions'), 'Predictions');
const Economics = named(() => import('./pages/Economics'), 'Economics');
const RiskIntegrity = named(() => import('./pages/RiskIntegrity'), 'RiskIntegrity');
const ModelRegistry = named(() => import('./pages/ModelRegistry'), 'ModelRegistry');
const Benchmarks = named(() => import('./pages/Benchmarks'), 'Benchmarks');
const DataProvenance = named(() => import('./pages/DataProvenance'), 'DataProvenance');

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('command-center');
  const [selectedWellId, setSelectedWellId] = useState<string>('BGW-01');
  const [wells, setWells] = useState<WellSummary[]>([]);
  const [detail, setDetail] = useState<WellDetail | null>(null);
  const [readiness, setReadiness] = useState<Record<string, string> | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean>(true);
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);
  const u = useUnits();

  const loadWells = async () => {
    try {
      const list = await apiClient.getWells();
      setWells(list);
      setApiAvailable(true);
      if (list.length > 0 && !list.find((w) => w.well_id === selectedWellId)) setSelectedWellId(list[0].well_id);
    } catch {
      // No fabricated fallback wells: show the offline state instead.
      setApiAvailable(false);
      setWells([]);
    }
    apiClient.getSystemReadiness().then(setReadiness).catch(() => setReadiness(null));
  };

  useEffect(() => { loadWells(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDetail(null);
    apiClient.getWell(selectedWellId).then(setDetail).catch(() => setDetail(null));
  }, [selectedWellId]);

  const well = wells.find((w) => w.well_id === selectedWellId);
  const activeAlertCount = wells.filter(
    (w) => w.status === 'INFEASIBLE' || (w.telemetry?.current_float_margin_index ?? 2) < 1.0,
  ).length;

  const page = (() => {
    const p = { selectedWellId, onNavigate: setCurrentPage };
    switch (currentPage) {
      case 'digital-twin': return <DigitalTwin selectedWellId={selectedWellId} />;
      case 'joint-optimizer': return <JointOptimizer {...p} />;
      case 'css-optimizer': return <CSSOptimizer {...p} />;
      case 'srp-optimizer': return <SRPOptimizer {...p} />;
      case 'what-if': return <WhatIfSimulator {...p} />;
      case 'predictions': return <Predictions {...p} />;
      case 'economics': return <Economics {...p} />;
      case 'risk': return <RiskIntegrity {...p} />;
      case 'model-registry': return <ModelRegistry onNavigate={setCurrentPage} />;
      case 'benchmarks': return <Benchmarks {...p} />;
      case 'provenance': return <DataProvenance onNavigate={setCurrentPage} />;
      default: return <CommandCenter selectedWellId={selectedWellId} onSelectWell={setSelectedWellId} onNavigate={setCurrentPage} />;
    }
  })();

  const depth = detail ? u.lenFromM(detail.depth_m) : null;
  const pump = detail ? u.lenFromM(detail.pump_depth_m) : null;
  const temp = well ? u.tempFromC(well.telemetry.current_temperature_c) : null;

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <Navbar wells={wells} selectedWellId={selectedWellId} onSelectWell={setSelectedWellId} activeAlertCount={activeAlertCount} />

      {/* Persistent provenance strip */}
      <div role="note" className="bg-steam-t border-b border-steam-b px-4 py-1 text-[12px] text-ink flex flex-wrap items-center justify-between gap-2">
        <span><span className="caps num text-[11px] text-steam font-medium mr-2">SIMULATED</span>Simulated data — not field measurements. Values marked † use assumed or scenario inputs.</span>
        {!apiAvailable && (
          <span className="text-alarm font-medium">
            Backend unavailable. <button onClick={loadWells} className="underline hover:text-alarm">Retry</button>
          </span>
        )}
      </div>

      {/* Selected-well ribbon */}
      <div className="bg-panel border-b border-rule px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>Well <span className="num text-ink font-semibold">{selectedWellId}</span></span>
          <span className="hidden sm:inline">Depth <span className="num text-ink">{depth ? `${fmt(depth.value, 0)} ${depth.unit}` : '—'} <span className="caps text-[10px]">TVD</span></span></span>
          <span className="hidden md:inline">Pump <span className="num text-ink">{pump ? `${fmt(pump.value, 0)} ${pump.unit}` : '—'}</span></span>
          <span>BHT <span className="num text-accent font-medium">{temp ? `${fmt(temp.value)} ${temp.unit}` : '—'}</span></span>
          <span>Viscosity <span className="num text-accent font-medium">{well ? `${fmt(well.telemetry.current_viscosity_cp, 0)}` : '—'} <span className="caps text-[10px] text-muted">CP</span></span></span>
          <span className="hidden lg:inline">Formation <span className="text-ink">{well?.formation ?? '—'}</span></span>
        </div>
        <button
          onClick={() => setAssistantOpen((o) => !o)}
          aria-expanded={assistantOpen}
          className={`h-6 px-3 border rounded-sm text-[12px] font-medium transition-colors ${
            assistantOpen ? 'border-accent text-accent bg-accent-t hover:bg-accent-b' : 'border-rule text-ink hover:bg-highlight'
          }`}
        >
          {assistantOpen ? 'Hide assistant' : 'Assistant'}
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} wells={wells} selectedWell={well} readiness={readiness} />
        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-5">
          <div key={currentPage} className="max-w-7xl mx-auto space-y-4 animate-enter">
            <Suspense fallback={<div className="text-muted text-[13px] py-8">Loading page…</div>}>{page}</Suspense>
          </div>
        </main>
        {assistantOpen && (
          <AssistantDock selectedWellId={selectedWellId} onClose={() => setAssistantOpen(false)} />
        )}
      </div>
    </div>
  );
};

export default App;
