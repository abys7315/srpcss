import React from 'react';
import { AlertOctagon, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface AlertDetails {
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  title: string;
  affectedComponent: string;
  rootCause: string;
  telemetryProof: string;
  consequence: string;
  recommendedAction: string;
  expectedBenefit: string;
  onApplyAction?: () => void;
}

export const AlertBanner: React.FC<{ alert: AlertDetails }> = ({ alert }) => {
  const isCritical = alert.severity === 'CRITICAL';

  return (
    <div className={`rounded-xl border p-4 shadow-lg mb-4 ${
      isCritical
        ? 'bg-rose-950/40 border-rose-500/50 shadow-rose-950/50'
        : 'bg-amber-950/40 border-amber-500/50 shadow-amber-950/50'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b pb-3 mb-3 border-slate-800">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span className={`font-semibold tracking-wide text-sm ${isCritical ? 'text-rose-300' : 'text-amber-300'}`}>
            {alert.title}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 font-mono">
            {alert.affectedComponent}
          </span>
        </div>
        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
          isCritical ? 'bg-rose-900/80 text-rose-200' : 'bg-amber-900/80 text-amber-200'
        }`}>
          {alert.severity}
        </span>
      </div>

      {/* Grid details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-400 block font-medium uppercase text-[10px]">Physics Root Cause</span>
          <p className="text-slate-200 font-mono mt-0.5">{alert.rootCause}</p>
        </div>
        <div>
          <span className="text-slate-400 block font-medium uppercase text-[10px]">Telemetry Proof</span>
          <p className="text-cyan-300 font-mono mt-0.5 font-semibold">{alert.telemetryProof}</p>
        </div>
        <div>
          <span className="text-slate-400 block font-medium uppercase text-[10px]">Consequence if Ignored</span>
          <p className="text-rose-300/90 font-mono mt-0.5">{alert.consequence}</p>
        </div>
        <div>
          <span className="text-slate-400 block font-medium uppercase text-[10px]">Expected Benefit</span>
          <p className="text-emerald-300 font-mono mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {alert.expectedBenefit}
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">Action:</span>
          <span className="text-slate-200 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-700/80 font-mono">
            {alert.recommendedAction}
          </span>
        </div>
        {alert.onApplyAction && (
          <button
            onClick={alert.onApplyAction}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all shadow-md ${
              isCritical
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50'
                : 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold shadow-amber-900/50'
            }`}
          >
            Apply Recommended Action
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
