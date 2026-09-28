import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  className?: string;
}

export const DomainShiftWarning: React.FC<Props> = ({ className = '' }) => {
  return (
    <div className={`rounded-lg bg-amber-950/40 border border-amber-500/30 p-3 flex items-start gap-3 text-xs text-amber-200/90 ${className}`}>
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-amber-300 mr-1.5 uppercase tracking-wide">
          Notice — Synthetic Domain Calibration:
        </span>
        Metrics and simulated profiles are derived from physics models with synthetic mismatch and public SPE Baghewala reservoir parameters.
        Deployment on live Oil India Limited production wells requires online recalibration through the feedback loop.
      </div>
    </div>
  );
};
