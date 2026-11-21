import type { PactDetails } from '../types';

interface PactListProps {
  pacts: PactDetails[];
  selectedPactId: string | null;
  onSelectPact: (id: string) => void;
  onNewPact: () => void;
}

export function PactList({ pacts, selectedPactId, onSelectPact, onNewPact }: PactListProps) {
  return (
    <aside className="pact-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-heading">Active Pacts</div>
        <button className="btn-secondary-sm" onClick={onNewPact} title="Create new team pact">
          + New
        </button>
      </div>

      <div className="pact-items-container">
        {pacts.length === 0 ? (
          <div className="empty-sidebar-state">
            <p>No pacts created yet.</p>
            <button className="btn-primary-sm" onClick={onNewPact}>Create Pact</button>
          </div>
        ) : (
          pacts.map((p) => {
            const isSelected = p.id === selectedPactId;
            return (
              <div
                key={p.id}
                className={`pact-item ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectPact(p.id)}
              >
                <div className="pact-item-header">
                  <span className="pact-item-title">{p.title}</span>
                  <span className={`status-pill ${p.status}`}>
                    {p.status === 'armed' ? 'ARMED' : p.status === 'awaiting_approval' ? 'APPROVALS' : 'DRAFT'}
                  </span>
                </div>
                <div className="pact-item-meta">
                  <span>v{p.version}</span> · <span>{p.decision_deadline_ist.split('·')[0].trim()}</span>
                </div>
                <div className="pact-item-dest">{p.destination_name}</div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
