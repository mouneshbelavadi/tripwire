import { useState, useMemo } from 'react';
import type { PactDetails } from '../types';
import { getDeadlineStatus } from '../lib/time';

interface PactListProps {
  pacts: PactDetails[];
  selectedPactId: string | null;
  onSelectPact: (id: string) => void;
  onNewPact: () => void;
}

export function PactList({ pacts, selectedPactId, onSelectPact, onNewPact }: PactListProps) {
  const [filterTab, setFilterTab] = useState<'active' | 'past' | 'all'>('active');

  const { activePacts, pastPacts } = useMemo(() => {
    const active: PactDetails[] = [];
    const past: PactDetails[] = [];
    for (const p of pacts) {
      if (p.status === 'completed' || p.status === 'closed') {
        past.push(p);
      } else {
        active.push(p);
      }
    }
    return { activePacts: active, pastPacts: past };
  }, [pacts]);

  // Determine which list to display
  const displayList = filterTab === 'active'
    ? activePacts
    : filterTab === 'past'
    ? pastPacts
    : pacts;

  const renderPactItem = (p: PactDetails) => {
    const isSelected = p.id === selectedPactId;
    const isPast = p.status === 'completed' || p.status === 'closed';

    let statusLabel = 'DRAFT';
    let statusClass = 'draft';

    if (isPast) {
      statusLabel = 'COMPLETED';
      statusClass = 'completed';
    } else if (getDeadlineStatus(p.decision_deadline_utc) === 'expired') {
      statusLabel = 'Deadline passed';
      statusClass = 'expired';
    } else if (p.status === 'armed') {
      if (p.is_alert_active || (p.consecutive_breaches && p.consecutive_breaches >= 2)) {
        statusLabel = 'ALERT';
        statusClass = 'alert';
      } else if (p.consecutive_breaches === 1) {
        statusLabel = 'CONFIRMING';
        statusClass = 'confirming';
      } else {
        statusLabel = 'ARMED';
        statusClass = 'armed';
      }
    } else if (p.status === 'awaiting_approval') {
      statusLabel = 'APPROVALS';
      statusClass = 'awaiting_approval';
    } else if (p.status === 'paused') {
      statusLabel = 'PAUSED';
      statusClass = 'paused';
    }

    const deadlineShort = p.decision_deadline_ist ? p.decision_deadline_ist.split('·')[0].trim() : '';

    return (
      <div
        key={p.id}
        className={`pact-item ${isSelected ? 'active' : ''} ${isPast ? 'past-item' : ''}`}
        onClick={() => onSelectPact(p.id)}
        role="button"
        tabIndex={0}
        aria-label={`${p.title}, status ${statusLabel}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectPact(p.id);
          }
        }}
      >
        <div className="pact-item-header">
          <span className="pact-item-title" title={p.title}>{p.title}</span>
          <span className={`status-pill ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="pact-item-meta">
          <span>v{p.version}</span> · <span>{deadlineShort || '09:00 IST'}</span>
        </div>
        <div className="pact-item-dest" title={p.destination_name}>
          <svg className="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" width="12" height="12">
            <path d="M8 2a4 4 0 0 0-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 0 0-4-4z" strokeWidth="1.25" />
            <circle cx="8" cy="6" r="1.5" strokeWidth="1.25" />
          </svg>
          <span>{p.destination_name}</span>
        </div>
      </div>
    );
  };

  return (
    <aside className="pact-sidebar" aria-label="Team Pacts Directory">
      {/* Top Heading & + New Action */}
      <div className="sidebar-header">
        <span className="sidebar-heading">Office Pacts</span>
        <button
          type="button"
          className="btn-secondary-sm"
          onClick={onNewPact}
          title="Create a new team pact"
        >
          + New
        </button>
      </div>

      {/* Segmented Filter Tabs: Active / Past / All */}
      <div className="pact-filter-tabs" role="tablist" aria-label="Filter pacts">
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'active'}
          className={`tab-pill ${filterTab === 'active' ? 'active' : ''}`}
          onClick={() => setFilterTab('active')}
        >
          <span>Active</span>
          <span className="tab-pill-count">{activePacts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'past'}
          className={`tab-pill ${filterTab === 'past' ? 'active' : ''}`}
          onClick={() => setFilterTab('past')}
        >
          <span>Past</span>
          <span className="tab-pill-count">{pastPacts.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterTab === 'all'}
          className={`tab-pill ${filterTab === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          <span>All</span>
          <span className="tab-pill-count">{pacts.length}</span>
        </button>
      </div>

      {/* Items Container */}
      <div className="pact-items-container">
        {displayList.length === 0 ? (
          filterTab === 'active' ? (
            <div className="empty-sidebar-state">
              <div className="empty-state-title">No Active Pacts</div>
              <p className="empty-state-desc">
                All agreements concluded or none active. Create a new pact before heading to the office.
              </p>
              <button type="button" className="btn-primary-sm" onClick={onNewPact}>
                + Create Pact
              </button>
            </div>
          ) : filterTab === 'past' ? (
            <div className="empty-sidebar-state">
              <div className="empty-state-title">No Past Plans</div>
              <p className="empty-state-desc">
                Concluded and archived agreements will appear here for audit history.
              </p>
            </div>
          ) : (
            <div className="empty-sidebar-state">
              <div className="empty-state-title">No Pacts</div>
              <p className="empty-state-desc">Click + New to create your first office agreement.</p>
              <button type="button" className="btn-primary-sm" onClick={onNewPact}>
                + Create Pact
              </button>
            </div>
          )
        ) : (
          displayList.map(renderPactItem)
        )}
      </div>
    </aside>
  );
}
