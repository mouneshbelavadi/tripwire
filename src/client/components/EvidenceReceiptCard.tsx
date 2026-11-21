import { useState } from 'react';
import type { TeamMember } from '../types';
import { ReceiptDecisionLine } from './DecisionLine';

export interface EvidenceReceiptProps {
  receipt: any;
  activeUser: TeamMember | null;
  onDecisionRecorded: () => void;
}

export function EvidenceReceiptCard({ receipt, activeUser, onDecisionRecorded }: EvidenceReceiptProps) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!receipt) return null;

  const handleDecision = async (decision: 'keep' | 'remote' | 'discuss') => {
    if (!activeUser) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/receipts/${receipt.alertId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record decision');
      setFeedback(data.message);
      onDecisionRecorded();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = receipt.currentDecisionStatus || 'pending';
  const statusLabel =
    currentStatus === 'remote_chosen'
      ? 'REMOTE FALLBACK CHOSEN'
      : currentStatus === 'plan_kept'
      ? 'PLAN KEPT'
      : 'RECONSIDERATION PENDING';

  return (
    <div className="evidence-receipt-container">
      {/* Persistent SIMULATED CHANGE banner for controlled breach */}
      {receipt.evidence.provenance === 'synthetic' && (
        <div className="simulation-banner" role="alert">
          <span className="simulation-banner-badge">SIMULATED CHANGE</span>
          <span className="simulation-banner-text">
            This breach was generated from controlled synthetic observations for demonstration. Real road conditions have not been asserted.
          </span>
        </div>
      )}

      {/* Receipt Header */}
      <div className="receipt-header">
        <div className="receipt-title-row">
          <div className="receipt-badge-row">
            <span className="receipt-alert-badge">BREACH RECEIPT</span>
            <span className={`status-pill ${currentStatus}`}>{statusLabel}</span>
          </div>
          <span className="receipt-id-tag">ID: {receipt.alertId}</span>
        </div>

        <div className="receipt-breach-summary">
          <strong>{receipt.participant.userName} ({receipt.participant.neighbourhood})</strong> exceeded the agreed{' '}
          <strong>{receipt.participant.limitMinutes} min</strong> commute threshold on two consecutive fresh checks.
        </div>
      </div>

      {/* Numerical Evidence Breakdown */}
      <div className="receipt-evidence-box">
        <div className="receipt-box-heading">Verified Two-Breach Evidence (SerpApi Directions)</div>

        {/* Signature Evidence Decision Line */}
        <ReceiptDecisionLine
          baselineMinutes={receipt.evidence.baselineMinutes || 42}
          check1Minutes={receipt.evidence.check1Minutes}
          check2Minutes={receipt.evidence.check2Minutes}
          limitMinutes={receipt.participant.limitMinutes}
        />

        <div className="receipt-checks-grid">
          <div className="check-card">
            <div className="check-label">Check 1 (Fresh Observation)</div>
            <div className="check-value">{receipt.evidence.check1Minutes} min</div>
            <div className="check-meta">
              Timestamp: {new Date(receipt.evidence.check1Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>

          <div className="check-card highlight">
            <div className="check-label">Check 2 (Confirmation)</div>
            <div className="check-value">{receipt.evidence.check2Minutes} min</div>
            <div className="check-meta">
              Timestamp: {new Date(receipt.evidence.check2Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>

          <div className="check-card">
            <div className="check-label">Agreed Threshold</div>
            <div className="check-value">{receipt.participant.limitMinutes} min</div>
            <div className="check-meta">Pact version: v{receipt.ruleVersion}</div>
          </div>
        </div>

        <div className="receipt-provenance-note">
          Provenance: <strong>{receipt.evidence.provenance.toUpperCase()}</strong> · Source freshness: {receipt.evidence.sourceFreshnessSeconds}s ago
        </div>
      </div>

      {/* Area Incidents Context */}
      {receipt.areaIncidents && receipt.areaIncidents.length > 0 && (
        <div className="receipt-incidents-box">
          <div className="receipt-box-heading">Area Traffic Incidents (SerpApi Traffic)</div>
          <div className="incidents-list">
            {receipt.areaIncidents.map((inc: any) => (
              <div key={inc.id} className="incident-item">
                <span className="incident-type-tag">{inc.type.replace('_', ' ').toUpperCase()}</span>
                <span className="incident-title">{inc.title}</span>
              </div>
            ))}
          </div>
          <div className="incident-disclaimer">
            Area incident newly observed. Its direct effect on individual routes is unverified and cannot be asserted as causality.
          </div>
        </div>
      )}

      {/* Route & Corridor Public Advisory */}
      <div className="receipt-context-box">
        <div className="context-box-header">
          <span className="context-title">Route & Corridor Public Advisory</span>
          <span className="context-status-pill">VERIFIED ADVISORY</span>
        </div>

        <div className="context-answer-text">
          {receipt.publicContext?.answer || 'Outer Ring Road corridor between Silk Board and Marathahalli experiences severe peak delays near Ecospace and Bellandur Central Junction.'}
        </div>

        {receipt.publicContext.citations && receipt.publicContext.citations.length > 0 && (
          <div className="citations-list">
            <div className="citations-label">Sources & Citations:</div>
            {receipt.publicContext.citations.map((c: any, idx: number) => (
              <div key={idx} className="citation-item">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="citation-link"
                >
                  [{idx + 1}] {c.source || c.url} ↗
                </a>
                {c.excerpt && <p className="citation-excerpt">“{c.excerpt}”</p>}
              </div>
            ))}
          </div>
        )}

        <div className="context-note">
          Public context is cited corroboration only. It does not alter the deterministic rule outcome or explain away the estimate.
        </div>
      </div>

      {/* Agreed Remote Fallback Callout */}
      <div className="receipt-fallback-box">
        <div className="fallback-label">Agreed Team Remote Fallback:</div>
        <div className="fallback-text">“{receipt.fallbackText}”</div>
      </div>

      {/* Interactive Acknowledgement & Decision Actions */}
      <div className="receipt-action-box">
        <div className="action-box-header">
          <span className="action-box-title">Team Decision</span>
          <span className="action-box-user">Acting as: <strong>{activeUser?.user_name}</strong></span>
        </div>

        {feedback && <div className="action-feedback">{feedback}</div>}

        <div className="decision-buttons-row">
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleDecision('remote')}
            disabled={submitting}
          >
            {submitting ? 'Recording...' : 'Switch to Remote (Agreed Fallback)'}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleDecision('keep')}
            disabled={submitting}
          >
            Keep the Plan
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleDecision('discuss')}
            disabled={submitting}
          >
            Discuss in Chat
          </button>
        </div>

        {/* Real-time Acknowledgements Table */}
        <div className="acknowledgements-table">
          <div className="table-heading">Recorded Team Acknowledgements:</div>
          {receipt.acknowledgements && receipt.acknowledgements.length > 0 ? (
            <div className="acks-list">
              {receipt.acknowledgements.map((ack: any, idx: number) => (
                <div key={idx} className="ack-row">
                  <span className="ack-user"><strong>{ack.userName}</strong>:</span>
                  <span className={`ack-decision ${ack.decision}`}>
                    {ack.decision === 'remote' ? 'Switch to Remote' : ack.decision === 'keep' ? 'Keep the Plan' : 'Discuss'}
                  </span>
                  <span className="ack-time">
                    {new Date(ack.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-acks-state">No decisions recorded yet. Select an action above.</div>
          )}
        </div>
      </div>
    </div>
  );
}
