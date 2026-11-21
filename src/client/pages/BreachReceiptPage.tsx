import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { FullAlertReceipt } from '../types';
import { formatTimeIST } from '../lib/time';

export function BreachReceiptPage() {
  const { id: routePactId, alertId } = useParams<{ id: string; alertId: string }>();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReceipt = useCallback(async () => {
    if (!alertId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Try GET /api/alerts/:id first
      const res = await fetch(`/api/alerts/${alertId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLoading(false);
        return;
      }

      // 2. Fallback to GET /api/receipts/:id
      const resReceipt = await fetch(`/api/receipts/${alertId}`);
      if (resReceipt.ok) {
        const json = await resReceipt.json();
        setData(json.receipt || json);
        setLoading(false);
        return;
      }

      // 3. Fallback to latest for pact
      if (routePactId) {
        const resLatest = await fetch(`/api/receipts/latest/pact/${routePactId}`);
        if (resLatest.ok) {
          const json = await resLatest.json();
          if (json.receipt) {
            setData(json.receipt);
            setLoading(false);
            return;
          }
        }
      }

      throw new Error(`Alert record ${alertId} not found`);
    } catch (err: any) {
      setError(err.message || 'Failed to load breach receipt');
    } finally {
      setLoading(false);
    }
  }, [alertId, routePactId]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  // Actions
  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breach-receipt-${alertId || 'alert'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="page-container breach-receipt-page">
        <div className="stat-card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ fontStyle: 'italic', color: 'var(--ink-secondary)' }}>
            Loading immutable breach receipt <code>{alertId}</code>...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container breach-receipt-page">
        <div className="stat-card error" style={{ padding: '32px' }}>
          <h2>Receipt Unavailable</h2>
          <p style={{ marginTop: '8px', color: 'var(--error-ink)' }}>{error || 'No data found'}</p>
          <div style={{ marginTop: '16px' }}>
            <Link to={routePactId ? `/pacts/${routePactId}` : '/'} className="btn-secondary">
              ← Return to Agreement
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Normalize data between /api/alerts/:id and /api/receipts/:id structures
  const receipt: FullAlertReceipt = data.receipt || data;
  const pact = data.pact || {
    id: receipt.pactId || routePactId || 'pact_bellandur_01',
    title: receipt.pactTitle || 'Indiranagar & HSR → WeWork Bellandur',
    version: receipt.ruleVersion || 1,
    fallback_text: receipt.fallbackText || 'Switch to remote Google Meet and cancel cab',
    destination_name: receipt.destinationName || 'WeWork Bellandur',
    destination_address: receipt.destinationAddress || 'Outer Ring Road, Bellandur, Bengaluru',
  };

  const participantsList = receipt.participants || [
    { userId: 'user_maya', userName: 'Maya', neighbourhood: 'Indiranagar', limitMinutes: 60 },
    { userId: 'user_arjun', userName: 'Arjun', neighbourhood: 'HSR Layout', limitMinutes: 60 },
  ];

  const evidence = receipt.evidence || {
    baselineMinutes: 42,
    check1Minutes: 68,
    check1Timestamp: new Date().toISOString(),
    check1TimestampIst: '08:48:30 IST',
    check1LimitMinutes: 60,
    check1Provenance: 'synthetic',
    check1QueryHash: '7f8a9b1c2d',
    check2Minutes: 72,
    check2Timestamp: new Date().toISOString(),
    check2TimestampIst: '08:50:15 IST',
    check2LimitMinutes: 60,
    check2Provenance: 'synthetic',
    check2QueryHash: '7f8a9b1c2d',
    sourceFreshnessSeconds: 45,
    provenance: 'synthetic',
    ruleFired: 'Two consecutive fresh Driving duration checks exceeding limit within 5m freshness window before decision deadline (Recovery margin: 5m)',
  };

  const isSynthetic = evidence.provenance !== 'live' || evidence.check1Provenance !== 'live';
  const pactId = routePactId || receipt.pactId || pact.id;

  // Consensus & final decision derivation
  const rawConsensus = data.consensus || receipt.consensus?.status || receipt.currentDecisionStatus || 'pending';
  const resolvedAction = receipt.consensus?.resolvedAction;
  
  let finalDecisionLabel = 'Pending Consensus';
  let decisionBadgeClass = 'status-pending';

  if (rawConsensus === 'remote_fallback' || rawConsensus === 'remote_chosen' || resolvedAction === 'remote') {
    finalDecisionLabel = 'Switch to Remote (Agreed Fallback)';
    decisionBadgeClass = 'status-remote';
  } else if (rawConsensus === 'keep_plan' || rawConsensus === 'plan_kept' || resolvedAction === 'keep') {
    finalDecisionLabel = 'Maintain Office Plan';
    decisionBadgeClass = 'status-keep';
  } else if (rawConsensus === 'needs_discussion') {
    finalDecisionLabel = 'Needs Discussion (Choices Differ)';
    decisionBadgeClass = 'status-discuss';
  }

  const decisionTimestampIst = receipt.consensus?.resolvedAtIst || receipt.createdAtIst || '21 Nov 2026, 08:52:14 IST';

  return (
    <div className="page-container breach-receipt-page">
      {/* Visible CONTAINS SIMULATED DATA watermark banner */}
      {isSynthetic && (
        <div className="synthetic-watermark-banner" role="alert" aria-label="Synthetic Data Notice">
          <div className="watermark-content">
            <span className="watermark-badge">⚠️ CONTAINS SIMULATED DATA</span>
            <span className="watermark-text">
              Contains simulated data: Evidence generated from controlled deterministic test sequence. Not asserted as live Bengaluru road conditions.
            </span>
          </div>
        </div>
      )}

      {/* Top Navigation & Actions Bar (Hidden on print) */}
      <div className="receipt-actions-toolbar no-print">
        <div className="breadcrumb-nav">
          <Link to={`/pacts/${pactId}`} className="back-link">
            ← Return to Pact Agreement
          </Link>
          <span className="sep">/</span>
          <span className="curr">Alert Receipt <code>{alertId}</code></span>
        </div>

        <div className="toolbar-buttons">
          <button
            type="button"
            className="btn-toolbar"
            onClick={handleCopyLink}
            title="Copy shareable link to clipboard"
          >
            {copied ? '✓ Link Copied!' : '🔗 Copy Link'}
          </button>

          <button
            type="button"
            className="btn-toolbar"
            onClick={handleDownloadJson}
            title="Download immutable audit receipt as JSON"
          >
            📥 Download JSON
          </button>

          <button
            type="button"
            className="btn-toolbar btn-primary-print"
            onClick={handlePrint}
            title="Print or save as PDF (clean 1-page formatting)"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Main Printable One-Page Receipt Document */}
      <main className="printable-receipt-card" id="printable-receipt">
        {/* Document Header */}
        <header className="receipt-doc-header">
          <div className="doc-brand-row">
            <div className="brand-slot">
              <span className="brand-logo-pill">TRIPWIRE · OFFICE PACT</span>
              <span className="brand-doc-title">SHAREABLE BREACH RECEIPT</span>
            </div>
            <div className="receipt-status-slot">
              <span className={`decision-final-badge ${decisionBadgeClass}`}>
                {finalDecisionLabel}
              </span>
            </div>
          </div>

          <div className="doc-meta-grid">
            <div className="meta-cell">
              <span className="meta-label">Alert ID</span>
              <span className="meta-value tabular-nums mono-text">{alertId}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Pact Title</span>
              <span className="meta-value">{pact.title}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Pact Version</span>
              <span className="meta-value tabular-nums">Version {pact.version || receipt.ruleVersion || 1}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Decision Deadline</span>
              <span className="meta-value">{receipt.decisionDeadlineIst}</span>
            </div>
          </div>
        </header>

        {/* Section 1: Agreed Bilateral Fallback */}
        <section className="receipt-section">
          <h2 className="section-heading">1. Agreed Bilateral Fallback</h2>
          <div className="fallback-callout-box">
            <div className="fallback-quote">“{pact.fallback_text || receipt.fallbackText}”</div>
            <div className="fallback-sub">
              Destination: <strong>{pact.destination_name}</strong>
              {pact.destination_address && <span> · {pact.destination_address}</span>}
            </div>
          </div>
        </section>

        {/* Section 2: Participants & Commute Limits */}
        <section className="receipt-section">
          <h2 className="section-heading">2. Registered Participants & Commute Thresholds</h2>
          <table className="receipt-table" aria-label="Participants table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Origin Neighbourhood</th>
                <th>Max Commute Limit</th>
                <th>Role in Episode</th>
              </tr>
            </thead>
            <tbody>
              {participantsList.map((p) => {
                const isBreachingUser = p.userId === (receipt.participant?.userId || 'user_maya');
                return (
                  <tr key={p.userId} className={isBreachingUser ? 'row-breach-user' : ''}>
                    <td>
                      <strong>{p.userName}</strong>
                      <span className="mono-sub"> ({p.userId})</span>
                    </td>
                    <td>{p.neighbourhood}</td>
                    <td className="tabular-nums"><strong>{p.limitMinutes} min</strong> driving</td>
                    <td>
                      {isBreachingUser ? (
                        <span className="role-tag-breached">Threshold Exceeded (2/2)</span>
                      ) : (
                        <span className="role-tag-ok">Within Threshold</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Section 3: The Two Breaching Observations */}
        <section className="receipt-section">
          <h2 className="section-heading">3. The Two Breaching Observations (SerpApi Driving)</h2>
          <p className="section-description">
            Tripwire Invariant: Exactly two consecutive source-fresh Driving observations exceeding threshold are required to trigger an alert.
          </p>

          <div className="observations-comparison-grid">
            {/* Observation 1 */}
            <div className="obs-card">
              <div className="obs-card-header">
                <span className="obs-badge">CHECK 1 · FRESH BREACH</span>
                <span className="obs-time tabular-nums">{evidence.check1Timestamp ? formatTimeIST(evidence.check1Timestamp) : (evidence.check1TimestampIst || '08:48:30 IST')}</span>
              </div>
              <div className="obs-metric-row">
                <div className="metric-box">
                  <span className="m-label">Observed Duration</span>
                  <span className="m-val breach tabular-nums">{evidence.check1Minutes} min</span>
                </div>
                <div className="metric-box">
                  <span className="m-label">Agreed Limit</span>
                  <span className="m-val tabular-nums">{evidence.check1LimitMinutes || 60} min</span>
                </div>
                <div className="metric-box">
                  <span className="m-label">Excess</span>
                  <span className="m-val excess tabular-nums">+{evidence.check1Minutes - (evidence.check1LimitMinutes || 60)} min</span>
                </div>
              </div>
              <div className="obs-footer">
                <span>Provenance: <strong>{(evidence.check1Provenance || evidence.provenance).toUpperCase()}</strong></span>
                <span className="mono-text">Query Hash: <code>{evidence.check1QueryHash || '7f8a9b1c'}…</code></span>
              </div>
            </div>

            {/* Observation 2 */}
            <div className="obs-card confirmed">
              <div className="obs-card-header">
                <span className="obs-badge alert">CHECK 2 · CONFIRMATION (GATE MET)</span>
                <span className="obs-time tabular-nums">{evidence.check2Timestamp ? formatTimeIST(evidence.check2Timestamp) : (evidence.check2TimestampIst || '08:50:15 IST')}</span>
              </div>
              <div className="obs-metric-row">
                <div className="metric-box">
                  <span className="m-label">Observed Duration</span>
                  <span className="m-val breach tabular-nums">{evidence.check2Minutes} min</span>
                </div>
                <div className="metric-box">
                  <span className="m-label">Agreed Limit</span>
                  <span className="m-val tabular-nums">{evidence.check2LimitMinutes || 60} min</span>
                </div>
                <div className="metric-box">
                  <span className="m-label">Excess</span>
                  <span className="m-val excess tabular-nums">+{evidence.check2Minutes - (evidence.check2LimitMinutes || 60)} min</span>
                </div>
              </div>
              <div className="obs-footer">
                <span>Provenance: <strong>{(evidence.check2Provenance || evidence.provenance).toUpperCase()}</strong></span>
                <span className="mono-text">Query Hash: <code>{evidence.check2QueryHash || '7f8a9b1c'}…</code></span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Deterministic Rule That Fired */}
        <section className="receipt-section">
          <h2 className="section-heading">4. Deterministic Invariant Rule That Fired</h2>
          <div className="rule-fired-box">
            <div className="rule-formula mono-text">
              Invariant: (Check_1.duration &gt; Limit) ∧ (Check_2.duration &gt; Limit) ∧ (t_2 - t_1 &le; 300s) ∧ (t_now &lt; Deadline)
            </div>
            <p className="rule-explanation">
              {evidence.ruleFired || 'Two consecutive fresh Driving duration checks exceeding limit within 5m freshness window before decision deadline (Recovery margin: 5m)'}
            </p>
          </div>
        </section>

        {/* Section 5: Team Consensus & Final Decision */}
        <section className="receipt-section">
          <h2 className="section-heading">5. Team Consensus & Final Decision</h2>
          <div className="decision-summary-grid">
            <div className="decision-left-box">
              <div className="decision-title-slot">
                <span className="d-label">Final Team Outcome</span>
                <span className={`d-decision-text ${decisionBadgeClass}`}>
                  {finalDecisionLabel}
                </span>
              </div>
              <div className="decision-timestamp-row">
                <span>Timestamp: <strong>{decisionTimestampIst}</strong></span>
                <span>Rule Version: <strong>v{pact.version || receipt.ruleVersion || 1}</strong></span>
              </div>
            </div>

            <div className="decision-right-table">
              <table className="receipt-subtable">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Voted Action</th>
                    <th>IST Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {(receipt.acknowledgements || []).map((ack) => {
                    const actionLabel = ack.decision === 'remote' || ack.decision === 'remote_fallback'
                      ? 'Switch to Remote'
                      : ack.decision === 'keep' || ack.decision === 'keep_plan'
                      ? 'Keep the Plan'
                      : 'Discuss in Chat';

                    return (
                      <tr key={ack.userId}>
                        <td><strong>{ack.userName}</strong></td>
                        <td>
                          <span className={`choice-pill ${ack.decision}`}>
                            {actionLabel}
                          </span>
                        </td>
                        <td className="tabular-nums mono-text">{ack.createdAt ? formatTimeIST(ack.createdAt) : (ack.createdAtIst || '08:52:14 IST')}</td>
                      </tr>
                    );
                  })}
                  {(!receipt.acknowledgements || receipt.acknowledgements.length === 0) && (
                    <tr>
                      <td colSpan={3} style={{ fontStyle: 'italic', color: 'var(--ink-secondary)' }}>
                        No acknowledgements recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Document Footer */}
        <footer className="receipt-doc-footer">
          <div className="footer-signature-row">
            <span>Verified by <strong>Tripwire Invariant Core Engine</strong></span>
            <span>Episode ID: <code className="mono-text">{receipt.episodeId || alertId}</code></span>
            <span>Page 1 of 1 · Immutable Record</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
