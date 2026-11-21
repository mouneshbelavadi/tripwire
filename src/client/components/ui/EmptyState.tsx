import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  /** Icon element or slot */
  icon?: React.ReactNode;
  /** Title header */
  title: string;
  /** Detailed description */
  description?: string;
  /** Primary call to action */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  /** Optional secondary call to action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}) => {
  return (
    <div className={`ui-empty-state ${className}`} role="status">
      <div className="ui-empty-icon" aria-hidden="true">
        {icon || (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        )}
      </div>

      <h3 className="ui-empty-title">{title}</h3>

      {description && <p className="ui-empty-description">{description}</p>}

      {(action || secondaryAction) && (
        <div className="ui-empty-actions">
          {action && (
            <Button
              variant={action.variant || 'primary'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="secondary"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
