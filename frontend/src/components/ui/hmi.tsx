import React from 'react';

/** Control-room primitives: flat panels, 1px rules, ink-coloured values, colour only for state. */

export const Panel: React.FC<{
  title?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, aside, className = '', bodyClassName = 'p-3', children }) => (
  <section className={`bg-panel border border-rule rounded-sm ${className}`}>
    {(title || aside) && (
      <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-rule">
        {title && <h2 className="font-cond text-[14px] font-semibold text-ink">{title}</h2>}
        {aside && <div className="text-xs text-muted">{aside}</div>}
      </header>
    )}
    <div className={bodyClassName}>{children}</div>
  </section>
);

export type TagState = 'near' | 'violated' | 'steam';

export const StateTag: React.FC<{ state: TagState; children?: React.ReactNode }> = ({ state, children }) => {
  const cls =
    state === 'violated'
      ? 'text-alarm border-alarm'
      : state === 'near'
        ? 'text-warn border-warn'
        : 'text-steam border-steam';
  const text = children ?? (state === 'violated' ? 'VIOLATED' : state === 'near' ? 'NEAR LIMIT' : 'STEAM');
  return <span className={`caps num inline-block border px-1 text-[11px] leading-4 rounded-sm ${cls}`}>{text}</span>;
};

export const Stat: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  /** Footnote mark, e.g. "†" where provenance differs from the page default. */
  mark?: string;
  note?: React.ReactNode;
  state?: TagState;
}> = ({ label, value, unit, mark, note, state }) => {
  const valueCls = state === 'violated' ? 'text-alarm' : state === 'near' ? 'text-warn' : 'text-ink';
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted truncate">{label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`num text-[22px] leading-7 font-medium ${valueCls}`}>{value}</span>
        {unit && <span className="num text-xs text-muted">{unit}</span>}
        {mark && <sup className="text-muted text-xs">{mark}</sup>}
        {state && <span className="ml-1"><StateTag state={state} /></span>}
      </div>
      {note && <div className="text-xs text-muted mt-0.5">{note}</div>}
    </div>
  );
};

/** Row of up to four headline stats separated by vertical rules. */
export const StatRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-panel border border-rule rounded-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-rule">
    {React.Children.map(children, (c) => (c ? <div className="px-3 py-2.5">{c}</div> : null))}
  </div>
);

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  unit?: string;
  align?: 'left' | 'right';
  render: (row: T, i: number) => React.ReactNode;
}

export function DataTable<T>({
  columns, rows, rowKey, empty = 'No rows', highlight,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  empty?: string;
  highlight?: (row: T) => boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-rule">
            {columns.map((c) => (
              <th key={c.key} className={`font-cond font-medium text-muted px-2 py-1.5 whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.header}
                {c.unit && <span className="num text-[11px] ml-1">[{c.unit}]</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-2 py-3 text-muted">{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className={`border-b border-rule/60 hover:bg-sunk/60 transition-colors ${highlight?.(r) ? 'bg-accent-t' : ''}`}>
              {columns.map((c) => (
                <td key={c.key} className={`px-2 py-1.5 ${c.align === 'right' ? 'text-right num' : 'text-left'}`}>
                  {c.render(r, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const PageHeader: React.FC<{ title: string; sub?: React.ReactNode; aside?: React.ReactNode }> = ({ title, sub, aside }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 pb-2 border-b border-rule">
    <div>
      <h1 className="font-cond text-[20px] font-semibold text-ink">{title}</h1>
      {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
    </div>
    {aside}
  </div>
);
