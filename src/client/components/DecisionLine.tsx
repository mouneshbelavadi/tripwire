import { getDeadlineStatus } from '../lib/time';

interface DecisionLineProps {
  maxDurationMinutes: number;
  deadlineIst: string;
  isArmed: boolean;
  status: string;
  consecutiveBreaches?: number;
  lastObservationMinutes?: number | null;
  deadlineUtc?: string;
}

export function DecisionLine({
  maxDurationMinutes,
  deadlineIst,
  isArmed,
  status,
  consecutiveBreaches = 0,
  lastObservationMinutes = null,
  deadlineUtc,
}: DecisionLineProps) {
  const isExpired = status === 'expired' || (deadlineUtc ? getDeadlineStatus(deadlineUtc) === 'expired' : false);
  const isConfirming = consecutiveBreaches === 1;
  const isAlert = status === 'alert' || consecutiveBreaches >= 2;
  const isPaused = status === 'paused';

  let stateLabel = 'DRAFT AGREEMENT';
  if (isExpired) stateLabel = 'DEADLINE PASSED';
  else if (isAlert) stateLabel = 'ALERT TRIGGERED · 2/2 BREACHES';
  else if (isConfirming) stateLabel = 'CONFIRMING · 1/2 BREACHES';
  else if (isPaused) stateLabel = 'MONITORING PAUSED';
  else if (status === 'completed' || status === 'closed') stateLabel = 'PACT COMPLETED · ARCHIVED';
  else if (isArmed) stateLabel = 'ARMED · WATCHING';
  else if (status === 'awaiting_approval') stateLabel = 'AWAITING APPROVALS';

  return (
    <div className="decision-line-container" role="region" aria-label="Tripwire Decision Line">
      <div className="decision-line-header">
        <span className="decision-line-title">Signature Decision Line</span>
        <span className={`decision-line-state ${isAlert ? 'alert' : isConfirming ? 'confirming' : isArmed ? 'armed' : ''}`}>
          {stateLabel}
        </span>
      </div>

      <div className="decision-track">
        {/* Node 1: Agreed Limit */}
        <div className="decision-node active">
          <div className="node-marker" />
          <div className="node-label">Agreed Threshold</div>
          <div className="node-value">{maxDurationMinutes} min limit</div>
        </div>

        <div className="decision-segment active" />

        {/* Node 2: Checkpoint Gate */}
        <div className={`decision-node ${isAlert ? 'node-alert' : isConfirming ? 'node-confirming' : isArmed ? 'active' : ''}`}>
          <div className="node-marker" />
          <div className="node-label">Confirmation Gate</div>
          <div className="node-value">
            {isAlert
              ? '2/2 breaches'
              : isConfirming
              ? '1/2 breach (need 2nd)'
              : lastObservationMinutes
              ? `Current: ${lastObservationMinutes}m`
              : '2 fresh breaches'}
          </div>
        </div>

        <div className={`decision-segment ${isAlert ? 'segment-alert' : isConfirming ? 'segment-confirming' : isArmed ? 'active' : ''}`} />

        {/* Node 3: Decision Deadline */}
        <div className="decision-node">
          <div className="node-marker" />
          <div className="node-label">Decision Deadline</div>
          <div className="node-value">{isExpired ? 'Deadline passed' : deadlineIst.split('·')[0].trim()}</div>
        </div>

        <div className={`decision-segment ${isAlert ? 'segment-alert' : ''}`} />

        {/* Node 4: Action */}
        <div className={`decision-node ${isAlert ? 'node-alert' : ''}`}>
          <div className="node-marker" />
          <div className="node-label">Proposed Outcome</div>
          <div className="node-value">{isAlert ? 'Switch to Remote' : 'Maintain Office Plan'}</div>
        </div>
      </div>
    </div>
  );
}

// Compact Decision Line for Participant Card
export function ParticipantDecisionLine({
  origin,
  limitMinutes,
  isApproved,
  currentMinutes,
  sourceAge,
}: {
  origin: string;
  limitMinutes: number;
  isApproved: boolean;
  currentMinutes?: number | null;
  sourceAge?: string;
}) {
  return (
    <div className="participant-decision-line" aria-label={`Tripwire signature for ${origin}`}>
      <div className="pdl-node active">
        <span className="pdl-dot" />
        <span className="pdl-label">{origin}</span>
      </div>
      <div className="pdl-segment active" />
      <div className="pdl-node active">
        <span className="pdl-dot" />
        <span className="pdl-label">≤ {limitMinutes}m limit</span>
      </div>
      <div className="pdl-segment active" />
      <div className={`pdl-node ${currentMinutes && currentMinutes > limitMinutes ? 'breach' : 'ok'}`}>
        <span className="pdl-dot" />
        <span className="pdl-label">
          {currentMinutes ? `${currentMinutes}m · ${sourceAge || 'fresh'}` : 'awaiting poll'}
        </span>
      </div>
      <div className={`pdl-segment ${isApproved ? 'active' : ''}`} />
      <div className={`pdl-node ${isApproved ? 'approved' : 'pending'}`}>
        <span className="pdl-dot" />
        <span className="pdl-label">{isApproved ? 'Armed' : 'Pending'}</span>
      </div>
    </div>
  );
}

// Decision Line for Evidence Receipt Card
export function ReceiptDecisionLine({
  baselineMinutes,
  check1Minutes,
  check2Minutes,
  limitMinutes,
}: {
  baselineMinutes: number;
  check1Minutes: number;
  check2Minutes: number;
  limitMinutes: number;
}) {
  return (
    <div className="receipt-decision-line" aria-label="Evidence Verification Decision Line">
      <div className="rdl-node">
        <div className="rdl-marker" />
        <div className="rdl-label">Baseline</div>
        <div className="rdl-value">{baselineMinutes}m normal</div>
      </div>
      <div className="rdl-segment active" />
      <div className="rdl-node breach">
        <div className="rdl-marker" />
        <div className="rdl-label">Check 1 (Breach)</div>
        <div className="rdl-value">{check1Minutes}m ({check1Minutes - limitMinutes}m over)</div>
      </div>
      <div className="rdl-segment breach" />
      <div className="rdl-node breach">
        <div className="rdl-marker" />
        <div className="rdl-label">Check 2 (Confirmed)</div>
        <div className="rdl-value">{check2Minutes}m ({check2Minutes - limitMinutes}m over)</div>
      </div>
      <div className="rdl-segment breach" />
      <div className="rdl-node outcome">
        <div className="rdl-marker" />
        <div className="rdl-label">Rule Outcome</div>
        <div className="rdl-value">Alert: Switch to Remote</div>
      </div>
    </div>
  );
}

// Decision Line for Pact Editor Preview Dialog
export function PreviewDecisionLine({
  mayaLimit,
  arjunLimit,
  deadlineIst,
  fallbackText,
  nextVersion,
}: {
  mayaLimit: number;
  arjunLimit: number;
  deadlineIst: string;
  fallbackText: string;
  nextVersion: number;
}) {
  return (
    <div className="preview-decision-line" aria-label="Preview Rule Invariant Decision Line">
      <div className="preview-dl-header">Rule Invariant Preview (v{nextVersion})</div>
      <div className="preview-track">
        <div className="preview-node">
          <span className="preview-dot" />
          <span className="preview-label">Thresholds</span>
          <span className="preview-value">M:{mayaLimit}m / A:{arjunLimit}m</span>
        </div>
        <div className="preview-segment active" />
        <div className="preview-node warning">
          <span className="preview-dot" />
          <span className="preview-label">Invalidation</span>
          <span className="preview-value">Reset Approvals</span>
        </div>
        <div className="preview-segment" />
        <div className="preview-node">
          <span className="preview-dot" />
          <span className="preview-label">Deadline</span>
          <span className="preview-value">{deadlineIst.split('·')[0].trim()}</span>
        </div>
        <div className="preview-segment" />
        <div className="preview-node">
          <span className="preview-dot" />
          <span className="preview-label">Fallback</span>
          <span className="preview-value">{fallbackText.length > 20 ? fallbackText.slice(0, 20) + '...' : fallbackText}</span>
        </div>
      </div>
    </div>
  );
}
