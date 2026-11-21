import React, { useState } from 'react';
import { StatusBadge, type StatusType } from './StatusBadge';

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description?: string;
  status?: StatusType | 'info';
  author?: string;
  details?: Record<string, any>;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = '' }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleDetails = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className={`ui-timeline ${className}`} role="list">
      {items.map((item) => {
        const isExpanded = expandedId === item.id;
        const nodeStatusClass = item.status && item.status !== 'info' ? `ui-timeline-node--${item.status}` : '';

        return (
          <div key={item.id} className="ui-timeline-item" role="listitem">
            <div className={`ui-timeline-node ${nodeStatusClass}`} aria-hidden="true" />

            <div className="ui-timeline-content">
              <div className="ui-timeline-header">
                <span className="ui-timeline-title">{item.title}</span>
                <span className="ui-timeline-time">{item.time}</span>
              </div>

              {item.description && (
                <div className="ui-timeline-body">{item.description}</div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                {item.status && item.status !== 'info' && (
                  <StatusBadge status={item.status} size="sm" />
                )}
                {item.author && (
                  <span style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
                    by {item.author}
                  </span>
                )}
                {item.details && (
                  <button
                    type="button"
                    className="ui-timeline-details-btn"
                    onClick={() => toggleDetails(item.id)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Hide Raw Details' : 'View Raw Details'}
                  </button>
                )}
              </div>

              {isExpanded && item.details && (
                <pre className="ui-timeline-details-pre">
                  {JSON.stringify(item.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
