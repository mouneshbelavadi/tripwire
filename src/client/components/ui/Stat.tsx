import React from 'react';

export interface StatProps {
  /** Metric label */
  label: string;
  /** Numeric or text value */
  value: string | number;
  /** Value unit (e.g., 'min', 'credits', '%') */
  unit?: string;
  /** Status or trend indicator */
  indicator?: {
    type: 'positive' | 'negative' | 'neutral' | 'alert';
    text: string;
  };
  /** Optional progress bar */
  progress?: {
    current: number;
    max: number;
    label?: string;
  };
  /** Subtitle description or timestamp */
  description?: string;
  /** Whether to force tabular numbers */
  tabularNums?: boolean;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  unit,
  indicator,
  progress,
  description,
  tabularNums = true,
  className = '',
}) => {
  const percentage = progress
    ? Math.min(100, Math.max(0, Math.round((progress.current / progress.max) * 100)))
    : null;

  const progressVariant =
    percentage !== null
      ? percentage > 85
        ? 'ui-stat-progress-bar--danger'
        : percentage > 65
        ? 'ui-stat-progress-bar--warning'
        : ''
      : '';

  return (
    <div className={`ui-stat-card ${className}`}>
      <div className="ui-stat-header">
        <span className="ui-stat-label">{label}</span>
        {indicator && (
          <span className={`ui-stat-indicator ui-stat-indicator--${indicator.type}`}>
            {indicator.type === 'positive' && '↑ '}
            {indicator.type === 'negative' && '↓ '}
            {indicator.type === 'alert' && '● '}
            {indicator.text}
          </span>
        )}
      </div>

      <div className="ui-stat-value-row">
        <span
          className="ui-stat-value"
          style={tabularNums ? { fontFeatureSettings: "'tnum'", fontVariantNumeric: 'tabular-nums' } : undefined}
        >
          {value}
        </span>
        {unit && <span className="ui-stat-unit">{unit}</span>}
      </div>

      {progress && percentage !== null && (
        <div style={{ marginTop: '4px' }}>
          <div
            className="ui-stat-progress"
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.max}
            aria-label={progress.label || label}
          >
            <div
              className={`ui-stat-progress-bar ${progressVariant}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {progress.label && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink-muted)', marginTop: '4px' }}>
              <span>{progress.label}</span>
              <span>{progress.current}/{progress.max} ({percentage}%)</span>
            </div>
          )}
        </div>
      )}

      {description && <div className="ui-stat-description">{description}</div>}
    </div>
  );
};
