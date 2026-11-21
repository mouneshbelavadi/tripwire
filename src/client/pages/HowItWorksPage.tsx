import { Link } from 'react-router-dom';

export function HowItWorksPage() {
  return (
    <div className="page-container how-it-works-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">MATHEMATICAL INVARIANTS & SPECIFICATION</div>
          <h1 className="page-title">How Tripwire: Office Pact Works</h1>
          <p className="page-subtitle">
            A deterministic, bilateral agreement system eliminating false alarms and commuter gridlock before anyone leaves for the office.
          </p>
        </div>
      </div>

      {/* Grid of Invariants */}
      <div className="invariants-doc-grid">
        {/* Invariant 1 */}
        <div className="pact-panel-card doc-card">
          <div className="doc-number-badge">INVARIANT 1</div>
          <h2 className="doc-card-title">The Two-Breach Gate</h2>
          <div className="formula-box">
            <code>T₁ &gt; limit  &and;  T₂ &gt; limit  (where t₂ &gt; t₁)</code>
          </div>
          <p>
            A single traffic spike <strong>never</strong> triggers an alert. The system requires exactly two distinct, consecutive, source-fresh observations exceeding the agreed commute limit.
          </p>
          <ul className="doc-bullets">
            <li><strong>First breach:</strong> Transitions state to <code>confirming</code> (streak = 1). No alert sent.</li>
            <li><strong>Second breach:</strong> Transitions state to <code>alert</code>, generates immutable receipt, and posts to team channel.</li>
          </ul>
        </div>

        {/* Invariant 2 */}
        <div className="pact-panel-card doc-card">
          <div className="doc-number-badge">INVARIANT 2</div>
          <h2 className="doc-card-title">Recovery Hysteresis Margin (5 min)</h2>
          <div className="formula-box">
            <code>duration &le; limit - 300 seconds</code>
          </div>
          <p>
            To prevent rapid oscillation (thrashing) between alert and non-alert states, an active alert does not clear when traffic merely drops 1 second below the threshold.
          </p>
          <p>
            Commute duration must recover by at least <strong>5 full minutes (300s)</strong> below the agreed ceiling before the alert transitions to <code>recovered</code>.
          </p>
        </div>

        {/* Invariant 3 */}
        <div className="pact-panel-card doc-card">
          <div className="doc-number-badge">INVARIANT 3</div>
          <h2 className="doc-card-title">Stale & Unknown Data Invariant</h2>
          <div className="formula-box">
            <code>t_now - t_source &gt; 300s  &rarr;  'stale'</code>
          </div>
          <p>
            Observations older than 5 minutes (300s) or with future timestamps are flagged as <code>stale</code>. Missing or unparseable responses are <code>unknown</code>.
          </p>
          <div className="critical-rule-callout">
            <strong>Critical Invariant:</strong> Stale or Unknown data clears an unconfirmed streak, but <strong>NEVER clears an active alert</strong>. An active alert can only be cleared by fresh, valid recovery.
          </div>
        </div>

        {/* Invariant 4 */}
        <div className="pact-panel-card doc-card">
          <div className="doc-number-badge">INVARIANT 4</div>
          <h2 className="doc-card-title">Fastest Driving Selection</h2>
          <div className="formula-box">
            <code>fastestDuration = min(r.duration for r in routes where travel_mode == Driving)</code>
          </div>
          <p>
            Google Maps Directions can return multiple route options. The engine filters strictly for Driving alternatives and deterministically selects the minimum positive duration.
          </p>
          <p>
            This avoids relying on arbitrary route ordering or unstable Google Maps route indexes.
          </p>
        </div>

        {/* Invariant 5 */}
        <div className="pact-panel-card doc-card">
          <div className="doc-number-badge">INVARIANT 5</div>
          <h2 className="doc-card-title">Canonical SHA-256 Query Hashing</h2>
          <div className="formula-box">
            <code>SHA-256(canonicalQueryParams \ excludedKeys)</code>
          </div>
          <p>
            Observations are compared only against the exact same canonical query. Excluded ephemeral parameters (e.g. <code>api_key</code>, <code>no_cache</code>) are stripped before hashing.
          </p>
          <p>
            If query parameters or pact rules change, comparison is declared <code>incomparable</code> and establishes a fresh baseline.
          </p>
        </div>

        {/* Invariant 6 */}
        <div className="pact-panel-card doc-card">
          <div className="doc-number-badge">INVARIANT 6</div>
          <h2 className="doc-card-title">Bilateral Version Invalidation</h2>
          <div className="formula-box">
            <code>editPact()  &rarr;  version = v + 1  &and;  approvals = cleared</code>
          </div>
          <p>
            Modifying the pact title, destination, participants, or thresholds increments the pact version (e.g. v1 &rarr; v2).
          </p>
          <p>
            Any version change immediately invalidates all prior approvals. Both participants must re-approve the exact new version before the watch re-arms.
          </p>
        </div>
      </div>

      {/* Sponsor Boundaries Section */}
      <div className="pact-panel-card" style={{ marginTop: '32px' }}>
        <h2 className="section-title">Clean Architectural Sponsor Separation</h2>
        <table className="astra-table">
          <thead>
            <tr>
              <th>Component / Track</th>
              <th>Architectural Role</th>
              <th>Data Guarantee</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>SerpApi (Track 1)</strong></td>
              <td>Supplies observable facts: Google Maps Directions duration and area traffic incidents.</td>
              <td>Audited credit accounting (max 40 credits research cap), 5m/15m TTL caching.</td>
            </tr>
            <tr>
              <td><strong>Deterministic Core Engine</strong></td>
              <td>Mathematical rules: 2-breach gate, 5m recovery hysteresis, canonical query hash.</td>
              <td>Zero hallucination. Deterministic TypeScript invariants, zero LLM reliance.</td>
            </tr>
            <tr>
              <td><strong>Internal SQLite Team Chat</strong></td>
              <td>Channel delivery for team alerts and bilateral coordination (<code>#group_office_pact</code>).</td>
              <td>Transactionally queued in outbox table with delivery retry semantics.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Link to="/demo" className="btn-primary">
          Test These Invariants in Demo Lab &rarr;
        </Link>
      </div>
    </div>
  );
}
