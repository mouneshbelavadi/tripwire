import React from 'react';

export type StatusType =
  | 'draft'
  | 'armed'
  | 'confirming'
  | 'alert'
  | 'paused'
  | 'expired'
  | 'completed'
  | 'closed';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The agreement or system status */
  status: StatusType | string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Whether to render the status icon */
  showIcon?: boolean;
  /** Whether to show an animated pulse indicator */
  pulse?: boolean;
  /** Custom label override */
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  pulse = false,
  label,
  className = '',
  ...props
}) => {
  const normalizedStatus = (status || '').toLowerCase() as StatusType;

  const renderIcon = () => {
    switch (normalizedStatus) {
      case 'draft':
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 2a2 2 0 0 1 3 3L5 14H2v-3L11 2z" />
          </svg>
        );
      case 'armed':
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="2" fill="currentColor" />
          </svg>
        );
      case 'confirming':
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3l2 2" />
          </svg>
        );
      case 'alert':
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="5.5 2 10.5 2 14 5.5 14 10.5 10.5 14 5.5 14 2 10.5 2 5.5 5.5 2" />
            <line x1="8" y1="5" x2="8" y2="8" />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
          </svg>
        );
      case 'paused':
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="3" width="2.5" height="10" rx="1" fill="currentColor" />
            <rect x="9.5" y="3" width="2.5" height="10" rx="1" fill="currentColor" />
          </svg>
        );
      case 'expired':
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <line x1="3" y1="3" x2="13" y2="13" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8.5l3.5 3.5 6.5-7" />
          </svg>
        );
      case 'closed':
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="1" />
            <line x1="6" y1="8" x2="10" y2="8" />
          </svg>
        );
      default:
        return (
          <svg className="ui-status-badge-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="8" cy="8" r="3" />
          </svg>
        );
    }
  };

  const statusClass = `ui-status-badge--${normalizedStatus}`;
  const sizeClass = `ui-status-badge--${size}`;
  const displayText = label || status.toUpperCase();

  return (
    <span
      className={`ui-status-badge ${statusClass} ${sizeClass} ${className}`}
      role="status"
      {...props}
    >
      {pulse && <span className="ui-status-badge-pulse" aria-hidden="true" />}
      {showIcon && renderIcon()}
      <span>{displayText}</span>
    </span>
  );
};
