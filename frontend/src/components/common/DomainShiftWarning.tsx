import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  className?: string;
}

export const DomainShiftWarning: React.FC<Props> = ({ className = '' }) => {
  return (
    <div className={`rounded-xl bg-amber-50/80 border border-amber-200 p-3 flex items-start gap-3 text-xs text-amber-900 ${className}`}>
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <strong className="font-semibold text-amber-900 mr-1.5">
          Reservoir Calibration Advisory:
        </strong>
        Simulation profiles are calibrated to published SPE Baghewala geological parameters. Live well integration utilizes closed-loop gauge calibration.
      </div>
    </div>
  );
};
