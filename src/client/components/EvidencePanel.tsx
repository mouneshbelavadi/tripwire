import { useState } from 'react';
import type { PactDetails } from '../types';

interface EvidencePanelProps {
  pact: PactDetails;
  onRefresh: () => void;
  systemState?: string;
  sourceAge?: string;
}

interface ActivityItem {
  id: string;
  timeIst: string;
  corridor: string;
  observedMinutes: number;
  limitMinutes: number;
  gateResult: 'within_limit' | 'confirming' | 'alert' | 'duplicate_rejected' | 'stale_rejected' | 'incident_observed';
  provenance: 'synthetic' | 'replay' | 'live';
}

export function EvidencePanel({
  pact,
  onRefresh,
  systemState = 'armed',
  sourceAge = '2m ago',
}: EvidencePanelProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  const activities: ActivityItem[] = [
    {
      id: 'act_4',
      timeIst: '08:50 IST',
      corridor: 'Indiranagar → WeWork Bellandur',
      observedMinutes: 72,
      limitMinutes: 60,
      gateResult: 'alert',
      provenance: 'synthetic',
    },
    {
      id: 'act_3',
      timeIst: '08:45 IST',
      corridor: 'Indiranagar → WeWork Bellandur',
      observedMinutes: 68,
      limitMinutes: 60,
      gateResult: 'confirming',
      provenance: 'synthetic',
    },
    {
      id: 'act_2',
      timeIst: '08:40 IST',
      corridor: 'Outer Ring Rd Bellandur Corridor',
      observedMinutes: 0,
      limitMinutes: 0,
      gateResult: 'incident_observed',
      provenance: 'synthetic',
    },
    {
      id: 'act_1',
      timeIst: '08:35 IST',
      corridor: 'HSR Layout → WeWork Bellandur',
      observedMinutes: 34,
      limitMinutes: 60,
      gateResult: 'within_limit',
      provenance: 'synthetic',
    },
  ];

  const handleTriggerBreach = async () => {
    setLoadingAction('breach');
    try {
      const res = await fetch('/api/simulation/trigger-breach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pact_id: pact.id, user_id: 'user_maya' }),
      });
      const data = await res.json();
      setSimulationResult(data);
      onRefresh();
    } catch (err) {
      console.error('Simulation breach failed:', err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReplayDedup = async () => {
    setLoadingAction('replay');
    try {
      const res = await fetch('/api/simulation/replay-dedup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pact_id: pact.id, user_id: 'user_maya' }),
      });
      const data = await res.json();
      setSimulationResult(data);
      onRefresh();
    } catch (err) {
      console.error('Simulation replay failed:', err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSetState = async (state: string) => {
    setLoadingAction(`state_${state}`);
    try {
      await fetch('/api/simulation/state/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pact_id: pact.id, state }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to set simulated state:', err);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="pact-panel-card evidence-panel-card">
      <div className="section-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 className="section-title">Commute Evidence & Verification</h2>
          <span className="mode-badge simulation">SYNTHETIC REPLAY READY</span>
        </div>
        <span className="section-hint">SerpApi Directions & Traffic Monitoring</span>
      </div>

      {/* State-Specific Status Notice Banners */}
      {systemState === 'stale' && (
        <div className="state-notice-banner stale" role="status">
          <strong>Stale Data Warning:</strong> No route estimate returned. Your last check is 12 min old. Stale data clears confirmation streaks and cannot alert.
        </div>
      )}

      {systemState === 'budget_paused' && (
        <div className="state-notice-banner paused" role="status">
          <strong>Budget Limit Reached:</strong> Monitoring paused: session credit limit reached (40/40 spent). Polling halted.
        </div>
      )}

      {systemState === 'delivery_pending' && (
        <div className="state-notice-banner pending" role="status">
          <strong>Outbox Status:</strong> Alert saved. Delivery to the conversation is pending (Nexconn unconfigured).
        </div>
      )}

      {systemState === 'confirming' && (
        <div className="state-notice-banner confirming" role="status">
          <strong>Breach Threshold Check:</strong> One estimate exceeded your limit (68 min &gt; 60 min). A second fresh check is required before alerting.
        </div>
      )}

      <div className="evidence-summary-grid">
        <div className="evidence-metric-box">
          <div className="metric-label">Maya (Indiranagar)</div>
          <div className="metric-value">
            {systemState === 'confirming'
              ? '68 min'
              : systemState === 'alert' || simulationResult?.step2?.durationMinutes
              ? '72 min'
              : '42 min'}
          </div>
          <div className="metric-meta">
            Limit: 60 min · Source: {sourceAge} · <span className="provenance-tag">SYNTHETIC</span>
          </div>
        </div>

        <div className="evidence-metric-box">
          <div className="metric-label">Arjun (HSR Layout)</div>
          <div className="metric-value">34 min</div>
          <div className="metric-meta">
            Limit: 60 min · Source: {sourceAge} · <span className="provenance-tag">SYNTHETIC</span>
          </div>
        </div>

        <div className="evidence-metric-box">
          <div className="metric-label">Area Incidents (Bellandur)</div>
          <div className="metric-value">1 Active</div>
          <div className="metric-meta">
            Outer Ring Rd waterlogging · <span className="provenance-tag">AREA ONLY</span>
          </div>
        </div>
      </div>

      {/* Activity Record with Signature Decision Line per Event */}
      <div className="activity-record-section">
        <div className="activity-header">
          <span className="activity-title">Activity & Invariant Verification Record</span>
          <span className="activity-count">{activities.length} observations recorded</span>
        </div>

        <div className="activity-list" role="feed" aria-label="Recent Commute Activity">
          {activities.map((act) => (
            <div key={act.id} className="activity-card">
              <div className="activity-top">
                <span className="activity-time">{act.timeIst}</span>
                <span className="activity-corridor">{act.corridor}</span>
                <span className={`activity-gate-badge ${act.gateResult}`}>
                  {act.gateResult === 'alert' && '● 2/2 Alert'}
                  {act.gateResult === 'confirming' && '▲ 1/2 Confirming'}
                  {act.gateResult === 'within_limit' && '✓ Within Limit'}
                  {act.gateResult === 'incident_observed' && 'ℹ Area Incident'}
                </span>
              </div>

              {/* Signature Decision Line for Activity Record */}
              <div className="activity-decision-signature" aria-label="Decision verification signature">
                <span className="ads-node">Limit: {act.limitMinutes > 0 ? `${act.limitMinutes}m` : 'Corridor'}</span>
                <span className="ads-arrow">→</span>
                <span className={`ads-node ${act.observedMinutes > act.limitMinutes && act.limitMinutes > 0 ? 'breach' : ''}`}>
                  {act.observedMinutes > 0 ? `Observed: ${act.observedMinutes}m` : 'Incident detected'}
                </span>
                <span className="ads-arrow">→</span>
                <span className="ads-node result">
                  {act.gateResult === 'alert' && 'Alert Generated'}
                  {act.gateResult === 'confirming' && 'Need 2nd Fresh Breach'}
                  {act.gateResult === 'within_limit' && 'Tripwire Clear'}
                  {act.gateResult === 'incident_observed' && 'Cannot satisfy route rule'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulation Controls for Demo & Evaluation */}
      <div className="simulation-control-box">
        <div className="simulation-control-header">
          <span className="control-title">Controlled Demo Actions (Phase 4 Invariant Proofs)</span>
          <span className="control-subtitle">Tests 2-breach rule and duplicate rejection without waiting for real traffic</span>
        </div>

        <div className="simulation-btn-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleTriggerBreach}
            disabled={loadingAction !== null}
          >
            {loadingAction === 'breach' ? 'Evaluating...' : 'Simulate 2 Fresh Breaches (68m → 72m)'}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleReplayDedup}
            disabled={loadingAction !== null}
          >
            {loadingAction === 'replay' ? 'Replaying...' : 'Replay Identical Check (Proof of Deduplication)'}
          </button>
        </div>

        {/* Audit State Switcher Bar for Phase 7 Visual Validation */}
        <div className="audit-state-switcher">
          <div className="audit-switcher-label">Phase 7 State Audit Switcher:</div>
          <div className="audit-switcher-buttons">
            <button
              type="button"
              className={`btn-audit ${pact.status === 'draft' ? 'active' : ''}`}
              onClick={() => handleSetState('draft')}
              disabled={loadingAction !== null}
            >
              Draft
            </button>
            <button
              type="button"
              className={`btn-audit ${systemState === 'armed' && pact.status === 'armed' ? 'active' : ''}`}
              onClick={() => handleSetState('armed')}
              disabled={loadingAction !== null}
            >
              Armed
            </button>
            <button
              type="button"
              className={`btn-audit ${systemState === 'confirming' ? 'active' : ''}`}
              onClick={() => handleSetState('confirming')}
              disabled={loadingAction !== null}
            >
              Confirming (1/2)
            </button>
            <button
              type="button"
              className={`btn-audit ${systemState === 'alert' ? 'active' : ''}`}
              onClick={() => handleSetState('alert')}
              disabled={loadingAction !== null}
            >
              Alert Active
            </button>
            <button
              type="button"
              className={`btn-audit ${systemState === 'stale' ? 'active' : ''}`}
              onClick={() => handleSetState('stale')}
              disabled={loadingAction !== null}
            >
              Stale (12m)
            </button>
            <button
              type="button"
              className={`btn-audit ${pact.status === 'paused' ? 'active' : ''}`}
              onClick={() => handleSetState('budget_paused')}
              disabled={loadingAction !== null}
            >
              Budget Paused
            </button>
            <button
              type="button"
              className={`btn-audit ${systemState === 'delivery_pending' ? 'active' : ''}`}
              onClick={() => handleSetState('delivery_pending')}
              disabled={loadingAction !== null}
            >
              Delivery Pending
            </button>
          </div>
        </div>

        {simulationResult && (
          <div className="simulation-feedback-box" role="status">
            <div className="feedback-message">{simulationResult.message}</div>
            {simulationResult.step1 && (
              <div className="feedback-steps">
                <div>Check 1 (68m): Outcome = <code>{simulationResult.step1.outcome}</code></div>
                <div>Check 2 (72m): Outcome = <code>{simulationResult.step2.outcome}</code> (Alert Created: {simulationResult.step2.alertCreated ? 'YES' : 'NO'})</div>
              </div>
            )}
            {simulationResult.isRejected && (
              <div className="feedback-steps">
                <div>Replay Result: Outcome = <code>{simulationResult.outcome}</code> (Rejected duplicate observation, streak not confirmed)</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
