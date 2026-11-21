import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export function HistoryPage() {
  const { pacts } = useApp();
  const [filter, setFilter] = useState<'all' | 'completed' | 'active'>('all');

  const completedPacts = pacts.filter((p) => p.status === 'completed' || p.status === 'closed');
  const activePacts = pacts.filter((p) => p.status !== 'completed' && p.status !== 'closed');

  const filteredPacts = filter === 'completed' ? completedPacts : filter === 'active' ? activePacts : pacts;

  return (
    <div className="page-container history-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">AUDIT & HISTORICAL ARCHIVE</div>
          <h1 className="page-title">Pact & Commute History</h1>
          <p className="page-subtitle">
            Complete record of past agreements, tripwire decisions, and commute resolutions across Bengaluru corridors.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-bar">
        <button
          type="button"
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Pacts ({pacts.length})
        </button>
        <button
          type="button"
          className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active / Armed ({activePacts.length})
        </button>
        <button
          type="button"
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Past / Completed ({completedPacts.length})
        </button>
      </div>

      {/* Pacts Grid */}
      <div className="history-grid">
        {filteredPacts.length === 0 ? (
          <div className="pact-panel-card empty-state-box">
            <h3>No Pacts in this Category</h3>
            <p>No agreements match the selected filter.</p>
          </div>
        ) : (
          filteredPacts.map((p) => {
            const isCompleted = p.status === 'completed' || p.status === 'closed';
            return (
              <div key={p.id} className="history-pact-card">
                <div className="history-card-header">
                  <div>
                    <span className="history-pact-venue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span>{p.destination_name}</span>
                    </span>
                    <h3 className="history-pact-title">{p.title}</h3>
                  </div>
                  <span className={`status-pill ${p.status}`}>{p.status.toUpperCase()}</span>
                </div>

                <div className="history-card-meta">
                  <div>
                    <strong>Deadline:</strong> {p.decision_deadline_ist}
                  </div>
                  <div>
                    <strong>Version:</strong> v{p.version} · <strong>Created:</strong> {p.created_at?.split('T')[0] || '21 Nov 2026'}
                  </div>
                </div>

                <div className="history-participants-list">
                  {p.participants.map((part) => (
                    <div key={part.id} className="history-part-item">
                      <span className="part-name">{part.user_name}</span>
                      <span className="part-hood">({part.neighbourhood})</span>
                      <span className="part-limit">&le; {Math.round(part.max_duration_s / 60)}m</span>
                    </div>
                  ))}
                </div>

                <div className="history-fallback-box">
                  <strong>Fallback Plan:</strong> “{p.fallback_text}”
                </div>

                <div className="history-card-footer">
                  <Link to={`/pacts/${p.id}`} className="btn-secondary-sm">
                    View Agreement &rarr;
                  </Link>
                  {isCompleted && (
                    <span className="archive-stamp">ARCHIVED</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
