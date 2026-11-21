import React, { useState } from 'react';
import { Button } from './Button';

export interface ErrorStateProps {
  /** Error header title */
  title?: string;
  /** Explanatory message */
  message: string;
  /** Error code or trace ID */
  code?: string;
  /** Retry callback */
  onRetry?: () => void | Promise<void>;
  /** Custom label for retry button */
  retryLabel?: string;
  /** Optional dismiss callback */
  onDismiss?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'An error occurred',
  message,
  code,
  onRetry,
  retryLabel = 'Retry Action',
  onDismiss,
  className = '',
}) => {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    try {
      setRetrying(true);
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={`ui-error-state ${className}`} role="alert">
      <div className="ui-error-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h3 className="ui-error-title">{title}</h3>
      <p className="ui-error-message">{message}</p>

      {code && <span className="ui-error-code">Code: {code}</span>}

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        {onRetry && (
          <Button
            variant="danger"
            size="sm"
            loading={retrying}
            onClick={handleRetry}
          >
            {retryLabel}
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
};
