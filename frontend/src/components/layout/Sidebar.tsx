import React from 'react';
import type { WellSummary } from '../../api/types';
import { useUnits, fmt } from '../../lib/units';

export type PageId =
  | 'command-center'
  | 'digital-twin'
  | 'css-optimizer'
  | 'srp-optimizer'
  | 'joint-optimizer'
  | 'what-if'
  | 'predictions'
  | 'economics'
  | 'risk'
  | 'model-registry'
  | 'benchmarks'
  | 'provenance';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  wells: WellSummary[];
  selectedWell?: WellSummary;
  readiness?: Record<string, string> | null;
}

const SECTIONS: { n: number; title: string; items: { id: PageId; label: string }[] }[] = [
  {
    n: 1, title: 'Operate', items: [
      { id: 'command-center', label: 'Field overview' },
      { id: 'digital-twin', label: 'Well digital twin' },
      { id: 'css-optimizer', label: 'CSS thermal model' },
      { id: 'srp-optimizer', label: 'SRP dynamics' },
      { id: 'joint-optimizer', label: 'Joint optimizer' },
      { id: 'what-if', label: 'What-if scenarios' },
    ],
  },
  {
    n: 2, title: 'Analyse', items: [
      { id: 'predictions', label: 'Production and diagnostics' },
      { id: 'economics', label: 'Economics and sensitivity' },
      { id: 'risk', label: 'Risk and integrity' },
    ],
  },
  {
    n: 3, title: 'Validate', items: [
      { id: 'model-registry', label: 'Model registry' },
      { id: 'benchmarks', label: 'Benchmark and ablation' },
      { id: 'provenance', label: 'Data provenance' },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, wells, selectedWell, readiness }) => {
  const u = useUnits();
  const producing = wells.filter((w) => w.cycle_phase === 'PRODUCTION');
  const avgBpd = producing.length
    ? producing.reduce((s, w) => s + (w.telemetry?.current_oil_rate_bpd ?? 0), 0) / producing.length
    : null;
  const avg = avgBpd !== null ? u.rateFromBpd(avgBpd) : null;
  const sel = selectedWell?.telemetry?.current_oil_rate_bpd;
  const selQ = sel !== undefined ? u.rateFromBpd(sel) : null;
  const mlState = !readiness ? 'unknown' : readiness.ml_models === 'PASS' ? 'EXPERIMENTAL' : 'not loaded';
  const mlColor = mlState === 'EXPERIMENTAL' ? 'text-steam' : mlState === 'unknown' ? 'text-muted' : 'text-alarm';

  return (
    <aside className="w-56 shrink-0 border-r border-rule bg-panel h-[calc(100vh-3rem)] sticky top-12 overflow-y-auto flex flex-col justify-between select-none">
      <nav aria-label="Primary" className="py-3">
        {SECTIONS.map((s) => (
          <div key={s.n} className="mb-4">
            <div className="px-4 pb-1.5 font-cond text-[11px] text-muted caps">
              <span className="num mr-1.5 text-accent">{s.n}</span>{s.title}
            </div>
            <ul>
              {s.items.map((it, i) => {
                const active = currentPage === it.id;
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => onNavigate(it.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full text-left pl-[14px] pr-3 py-1.5 text-[13px] border-l-2 transition-colors ${active
                        ? 'border-accent text-ink font-semibold bg-highlight'
                        : 'border-transparent text-muted hover:text-ink hover:bg-highlight/60'
                        }`}
                    >
                      <span className="num text-[11px] text-muted/70 mr-2">{s.n}.{i + 1}</span>
                      {it.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-rule px-4 py-3 text-[12px] space-y-1.5">
        <div className="font-cond text-[13px] text-ink font-semibold">Baghewala field</div>
        <div className="text-muted text-[11px]">Bikaner–Nagaur Basin, Rajasthan</div>
        <dl className="pt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <dt className="text-muted">Wells in model</dt><dd className="num text-right text-ink font-medium">{wells.length}</dd>
          <dt className="text-muted">In production phase</dt><dd className="num text-right text-ok font-medium">{producing.length}</dd>
          <dt className="text-muted">Avg oil rate</dt>
          <dd className="num text-right text-ink font-medium">{avg ? `${fmt(avg.value)} ${avg.unit}` : '—'}</dd>
          {selectedWell && (
            <>
              <dt className="text-muted">{selectedWell.well_id} oil rate</dt>
              <dd className="num text-right text-accent font-medium">{selQ ? `${fmt(selQ.value)} ${selQ.unit}` : '—'}</dd>
            </>
          )}
          <dt className="text-muted">ML models</dt><dd className={`num text-right caps text-[11px] font-medium ${mlColor}`}>{mlState}</dd>
        </dl>
        <div className="text-muted/70 pt-1 text-[11px]">1 sample/day, simulated</div>
      </div>
    </aside>
  );
};
