import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  delta?: string;
  deltaPositive?: boolean;
  icon?: React.ReactNode;
  provenance?: string;
  warning?: boolean;
  danger?: boolean;
  footnote?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  delta,
  deltaPositive,
  icon,
  warning,
  danger,
  footnote,
}) => {
  const borderColor = danger ? 'border-alarm' : warning ? 'border-warn' : 'border-rule';
  const valuColor = danger ? 'text-alarm' : warning ? 'text-warn' : 'text-ink';
  const iconColor = danger ? 'text-alarm' : warning ? 'text-warn' : 'text-accent';

  return (
    <div className={`bg-panel border ${borderColor} rounded-sm p-3.5 flex flex-col justify-between min-w-0 transition-colors hover:bg-highlight`}>
      {/* Label */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
        <span className="stat-label flex items-center gap-1.5 truncate">
          {icon && <span className={`shrink-0 ${iconColor}`}>{icon}</span>}
          <span className="truncate">{title}</span>
          {footnote && <span className="text-muted text-[10px]">{footnote}</span>}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5 min-w-0 overflow-hidden">
        <span className={`stat-value truncate ${valuColor}`}>
          {value}
        </span>
        {unit && <span className="stat-unit shrink-0">{unit}</span>}
      </div>

      {/* Footer */}
      {(subtitle || delta) && (
        <div className="flex items-center justify-between gap-1.5 text-[11px] mt-2 pt-2 border-t border-rule min-w-0">
          {subtitle && (
            <span className="text-muted truncate max-w-[60%]" title={subtitle}>
              {subtitle}
            </span>
          )}
          {delta && (
            <span className={`font-medium ml-auto shrink-0 px-1.5 py-0.5 rounded-sm border ${
              deltaPositive
                ? 'text-ok bg-ok-t border-ok'
                : 'text-alarm bg-alarm-t border-alarm'
            }`}>
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
