import { useState } from 'react';

interface DecisionExplanationPanelProps {
  defaultOpen?: boolean;
  className?: string;
  pactTitle?: string;
  limitMinutes?: number;
  deadlineIst?: string;
}

export function DecisionExplanationPanel({
  defaultOpen = true,
  className = '',
  pactTitle = 'Bellandur office meetup',
  limitMinutes = 60,
  deadlineIst = '09:00 IST',
}: DecisionExplanationPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const steps = [
    {
      stepNumber: 1,
      badge: 'Step 1: Baseline & Monitoring',
      title: 'Real-Time Directions Polling',
      description: `Tripwire periodically queries Google Maps Driving via SerpApi for both participants’ agreed corridors (Indiranagar and HSR Layout to ${pactTitle}). Normal driving times (42m and 34m) are logged into the append-only SQLite ledger as within the ${limitMinutes}m limit.`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
      tag: 'Tripwire Clear',
      tagClass: 'tag-green',
    },
    {
      stepNumber: 2,
      badge: 'Step 2: 1st Breach Detected',
      title: 'Threshold Crossed → Confirming State (1/2)',
      description: `At 08:45 IST, Maya’s fastest driving estimate rose to 68m (+8m over the ${limitMinutes}m limit). Invariant rule: A single breach NEVER alerts the team or cancels plans. The system transitions to "Confirming (1/2)" and requests an expedited re-check.`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      ),
      tag: 'Need 2nd Breach',
      tagClass: 'tag-amber',
    },
    {
      stepNumber: 3,
      badge: 'Step 3: Freshness & Deduplication Gate',
      title: 'Cryptographic Cache & Replay Defense',
      description: 'Before confirming, Tripwire validates the response payload against the canonical query hash and raw SHA-256 checksum. If the provider returns a cached, replayed, or identical timestamp, it is deduplicated and rejected. Stale data (>5 min old) clears the streak to avoid false alerts.',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      tag: 'Deduplicated & Fresh',
      tagClass: 'tag-blue',
    },
    {
      stepNumber: 4,
      badge: 'Step 4: 2nd Consecutive Breach & Alert',
      title: 'Alert Fired & Immutable Evidence Receipt Generated (2/2)',
      description: `At 08:50 IST, a second independent fresh check returned 72m (+12m over limit). Having satisfied 2 consecutive fresh breaches before the ${deadlineIst} decision deadline, the alert fired. An immutable Evidence Receipt was posted to the in-app team channel recommending the agreed remote fallback.`,
      icon: '●',
      tag: 'Alert Generated',
      tagClass: 'tag-red',
    },
  ];

  return (
    <div className={`decision-explanation-card ${className}`}>
      <button
        type="button"
        className="explanation-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="decision-steps-content"
      >
        <div className="toggle-left">
          <span className="toggle-badge">Audit Explanation</span>
          <span className="toggle-title">How This Alert Was Decided (4 Plain-English Steps)</span>
        </div>
        <div className="toggle-right">
          <span className="toggle-sub">
            {isOpen ? 'Click to collapse' : 'Click to expand 4 verification steps'}
          </span>
          <span className="toggle-chevron">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {isOpen && (
        <div id="decision-steps-content" className="explanation-content" role="region">
          <div className="steps-container">
            {steps.map((st) => (
              <div key={st.stepNumber} className="explanation-step-item">
                <div className="step-indicator-col">
                  <div className="step-circle">{st.stepNumber}</div>
                  {st.stepNumber < steps.length && <div className="step-connector-line" />}
                </div>

                <div className="step-details-col">
                  <div className="step-header-line">
                    <span className="step-badge-text">{st.badge}</span>
                    <span className={`step-status-tag ${st.tagClass}`}>{st.tag}</span>
                  </div>
                  <h4 className="step-title">{st.title}</h4>
                  <p className="step-description">{st.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="decision-invariants-summary">
            <span className="summary-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <div className="summary-text">
              <strong>Core Office Pact Invariant:</strong> No unilateral cancellations, no single-spike alerts, and no guessing road closures from incident markers. Double confirmation guarantees teams only pivot when severe commute delays are real.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
