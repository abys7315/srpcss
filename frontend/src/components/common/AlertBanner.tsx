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
    <div className={`rounded-xl border p-4 shadow-xs mb-4 ${
      isCritical
        ? 'bg-rose-50/70 border-rose-200'
        : 'bg-amber-50/70 border-amber-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b pb-3 mb-3 border-slate-200">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <span className={`font-semibold tracking-tight text-sm ${isCritical ? 'text-rose-800' : 'text-amber-800'}`}>
            {alert.title}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 font-medium shadow-xs">
            {alert.affectedComponent}
          </span>
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
          isCritical ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200'
        }`}>
          {alert.severity === 'CRITICAL' ? 'Critical' : alert.severity === 'WARNING' ? 'Warning' : 'Advisory'}
        </span>
      </div>

      {/* Grid details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-500 block font-medium text-xs">Physics Root Cause</span>
          <p className="text-slate-800 mt-0.5 leading-relaxed">{alert.rootCause}</p>
        </div>
        <div>
          <span className="text-slate-500 block font-medium text-xs">Observed Telemetry</span>
          <p className="text-blue-700 mt-0.5 font-semibold">{alert.telemetryProof}</p>
        </div>
        <div>
          <span className="text-slate-500 block font-medium text-xs">Operational Risk</span>
          <p className="text-rose-700 mt-0.5 font-medium leading-relaxed">{alert.consequence}</p>
        </div>
        <div>
          <span className="text-slate-500 block font-medium text-xs">Expected Outcome</span>
          <p className="text-emerald-700 mt-0.5 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            {alert.expectedBenefit}
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-600">Action:</span>
          <span className="text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-medium shadow-xs">
            {alert.recommendedAction}
          </span>
        </div>
        {alert.onApplyAction && (
          <button
            onClick={alert.onApplyAction}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all shadow-xs text-white ${
              isCritical
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
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
