import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

export function DemoLabPage() {
  const { pacts, selectedPactId, loadData, setActionNotice } = useApp();

  const currentPact = pacts.find((p) => p.id === selectedPactId) || pacts[0] || null;
  const currentPactId = currentPact?.id || 'pact_bellandur_01';

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [outputLog, setOutputLog] = useState<any | null>(null);
  const [observations, setObservations] = useState<any[]>([]);

  const fetchObservations = useCallback(async () => {
    try {
      const res = await fetch(`/api/simulation/pact/${currentPactId}`);
      if (res.ok) {
        const data = await res.json();
        setObservations(data.observations || []);
      }
    } catch (err) {
      console.error('Failed to fetch observations:', err);
    }
  }, [currentPactId]);

  useEffect(() => {
    fetchObservations();
  }, [fetchObservations]);

  const handleTriggerBreach = async () => {
    setLoadingAction('breach');
    setOutputLog(null);
    try {
      const res = await fetch('/api/simulation/trigger-breach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pact_id: currentPactId, user_id: 'user_maya' }),
      });
      const data = await res.json();
      setOutputLog(data);
      setActionNotice(data.message || 'Synthetic 2-breach sequence executed.');
      await loadData();
      await fetchObservations();
    } catch (err: any) {
      setOutputLog({ error: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReplayDedup = async () => {
    setLoadingAction('replay');
    setOutputLog(null);
    try {
      const res = await fetch('/api/simulation/replay-dedup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pact_id: currentPactId, user_id: 'user_maya' }),
      });
      const data = await res.json();
      setOutputLog(data);
      setActionNotice(data.message || 'Replay test executed.');
      await fetchObservations();
    } catch (err: any) {
      setOutputLog({ error: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCheckLive = async () => {
    setLoadingAction('live');
    setOutputLog(null);
    try {
      const res = await fetch('/api/simulation/check-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pact_id: currentPactId }),
      });
      const data = await res.json();
      setOutputLog(data);
      setActionNotice(data.message || 'Live check completed.');
      await loadData();
      await fetchObservations();
    } catch (err: any) {
      setOutputLog({ error: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSetState = async (state: string) => {
    setLoadingAction(`state_${state}`);
    setOutputLog(null);
    try {
      const res = await fetch('/api/simulation/state/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pact_id: currentPactId, state }),
      });
      const data = await res.json();
      setOutputLog(data);
      setActionNotice(data.message || `State set to ${state}`);
      await loadData();
      await fetchObservations();
    } catch (err: any) {
      setOutputLog({ error: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetDemo = async () => {
    setLoadingAction('reset');
    setOutputLog(null);
    try {
      const res = await fetch('/api/simulation/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pact_id: currentPactId }),
      });
      const data = await res.json();
      setOutputLog(data);
      setActionNotice(data.message || 'Demo data reset successfully.');
      await loadData();
      await fetchObservations();
    } catch (err: any) {
      setOutputLog({ error: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="page-container demo-lab-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">INVARIANT TEST HARNESS & SIMULATION</div>
          <h1 className="page-title">Tripwire Demo & Simulation Lab</h1>
          <p className="page-subtitle">
            Controlled test bench to demonstrate the 2-breach invariant, replay deduplication, live SerpApi checks, and system state transitions safely.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleResetDemo}
            disabled={loadingAction !== null}
          >
            {loadingAction === 'reset' ? 'Resetting...' : 'Reset Demo Data'}
          </button>
        </div>
      </div>

      {/* Action Cards */}
      <div className="demo-actions-grid">
        {/* Card 1: 2-Breach Sequence */}
        <div className="demo-card">
          <div className="demo-card-badge">CORE INVARIANT</div>
          <h3 className="demo-card-title">Trigger 2-Breach Alert</h3>
          <p className="demo-card-desc">
            Executes Step 1 (68m duration &rarr; <code>confirming</code>, streak=1) followed by Step 2 (72m duration &rarr; <code>alert</code>, fires outbox delivery).
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={handleTriggerBreach}
            disabled={loadingAction !== null}
          >
            {loadingAction === 'breach' ? 'Simulating...' : 'Run 2-Breach Sequence &rarr;'}
          </button>
        </div>

        {/* Card 2: Replay Deduplication */}
        <div className="demo-card">
          <div className="demo-card-badge">DEDUPLICATION</div>
          <h3 className="demo-card-title">Test Duplicate Replay</h3>
          <p className="demo-card-desc">
            Dispatches an observation with the identical provider timestamp and payload. Verifies rejection as <code>duplicate_or_old</code> with no second alert.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleReplayDedup}
            disabled={loadingAction !== null}
          >
            {loadingAction === 'replay' ? 'Testing Replay...' : 'Test Duplicate Rejection &rarr;'}
          </button>
        </div>

        {/* Card 3: Live SerpApi Directions */}
        <div className="demo-card">
          <div className="demo-card-badge">TRACK 1: SERPAPI</div>
          <h3 className="demo-card-title">Live SerpApi Check</h3>
          <p className="demo-card-desc">
            Calls live Google Maps Directions API for Maya (Indiranagar) and Arjun (HSR Layout) to {currentPact?.destination_name || 'Bellandur'}.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCheckLive}
            disabled={loadingAction !== null}
          >
            {loadingAction === 'live' ? 'Checking SerpApi...' : 'Run Live SerpApi Check &rarr;'}
          </button>
        </div>
      </div>

      {/* System State Presets */}
      <div className="pact-panel-card" style={{ marginBottom: '24px' }}>
        <h2 className="section-title">System State Presets (Visual Audit)</h2>
        <p className="section-hint" style={{ marginBottom: '16px', display: 'block' }}>
          Instantly configure the database into any canonical state to inspect UI rendering and visual states:
        </p>

        <div className="state-buttons-row">
          <button
            type="button"
            className="state-btn"
            onClick={() => handleSetState('draft')}
            disabled={loadingAction !== null}
          >
            Draft (Unarmed)
          </button>
          <button
            type="button"
            className="state-btn"
            onClick={() => handleSetState('armed')}
            disabled={loadingAction !== null}
          >
            Armed (0 Breaches)
          </button>
          <button
            type="button"
            className="state-btn"
            onClick={() => handleSetState('confirming')}
            disabled={loadingAction !== null}
          >
            Confirming (1 Breach)
          </button>
          <button
            type="button"
            className="state-btn alert-btn"
            onClick={() => handleSetState('alert')}
            disabled={loadingAction !== null}
          >
            Alert (2 Breaches)
          </button>
          <button
            type="button"
            className="state-btn"
            onClick={() => handleSetState('stale')}
            disabled={loadingAction !== null}
          >
            Stale (&gt;5m old)
          </button>
          <button
            type="button"
            className="state-btn"
            onClick={() => handleSetState('budget_paused')}
            disabled={loadingAction !== null}
          >
            Budget Paused (40 Cap)
          </button>
          <button
            type="button"
            className="state-btn"
            onClick={() => handleSetState('delivery_pending')}
            disabled={loadingAction !== null}
          >
            Delivery Pending
          </button>
        </div>
      </div>

      {/* Execution Output Log */}
      {outputLog && (
        <div className="pact-panel-card" style={{ marginBottom: '24px' }}>
          <div className="section-header-row">
            <h2 className="section-title">Harness Execution Result</h2>
            <button
              type="button"
              className="btn-text-link"
              onClick={() => setOutputLog(null)}
            >
              Clear Log
            </button>
          </div>
          <pre className="audit-code-box">
            {JSON.stringify(outputLog, null, 2)}
          </pre>
        </div>
      )}

      {/* Observations Inspector */}
      <div className="pact-panel-card">
        <div className="section-header-row">
          <h2 className="section-title">Recent Database Observations ({observations.length})</h2>
          <button
            type="button"
            className="btn-secondary-sm"
            onClick={fetchObservations}
          >
            Refresh Observations
          </button>
        </div>

        {observations.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--ink-secondary)' }}>
            No observations recorded yet. Trigger a live check or synthetic breach above.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="astra-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Provenance</th>
                  <th>Engine</th>
                  <th>Validity</th>
                  <th>Received At</th>
                </tr>
              </thead>
              <tbody>
                {observations.slice(0, 10).map((obs) => (
                  <tr key={obs.id}>
                    <td><code>{obs.id}</code></td>
                    <td>
                      <span className={`status-pill ${obs.provenance}`}>
                        {obs.provenance.toUpperCase()}
                      </span>
                    </td>
                    <td><code>{obs.engine}</code></td>
                    <td>{obs.validity}</td>
                    <td>{obs.received_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
