import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PactDetails, TeamMember } from '../types';
import { FallbackOptionsGrid } from './FallbackOptionsGrid';

export interface DecisionTabProps {
  pact: PactDetails;
  receipt: any | null;
  activeUser: TeamMember | null;
  onDecisionRecorded: () => void;
  onSwitchToChat?: () => void;
}

export function DecisionTab({
  pact,
  receipt,
  activeUser,
  onDecisionRecorded,
  onSwitchToChat,
}: DecisionTabProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [chatSentFeedback, setChatSentFeedback] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Derived values from receipt / pact
  const alertId = receipt?.alertId || receipt?.id;
  const participant = receipt?.participant || {
    userName: pact.participants?.[0]?.user_name || 'Kabir',
    neighbourhood: pact.participants?.[0]?.neighbourhood || 'HSR Layout',
    limitMinutes: pact.participants?.[0] ? Math.round(pact.participants[0].max_duration_s / 60) : 60,
  };

  const evidence = receipt?.evidence || {
    check1Minutes: 68,
    check2Minutes: 72,
    sourceFreshnessSeconds: 30,
    provenance: 'synthetic',
  };

  const check2Minutes = evidence.check2Minutes || 72;
  const limitMinutes = participant.limitMinutes || 60;
  const excessMinutes = Math.max(0, check2Minutes - limitMinutes);
  const breachUserName = participant.userName || 'Kabir';

  // Format Top Summary: "Kabir's commute reached 72 min, 12 min over limit, on two fresh checks."
  const topSummaryText = `${breachUserName}'s commute reached ${check2Minutes} min, ${excessMinutes} min over limit (${limitMinutes}m limit), on two fresh checks.`;

  // Acknowledgements & choices derivation
  const acknowledgements: Array<{
    userId: string;
    userName: string;
    decision: string;
    createdAt?: string;
    createdAtIst?: string;
  }> = receipt?.acknowledgements || [];

  const decisions = acknowledgements;

  // Map choices by user_id
  const userChoicesMap = new Map<string, { decision: string; timeIst: string }>();
  for (const ack of acknowledgements) {
    const rawDecision = ack.decision;
    let normalized = rawDecision;
    if (rawDecision === 'remote' || rawDecision === 'remote_fallback' || rawDecision === 'meet') normalized = 'meet';
    else if (rawDecision === 'keep' || rawDecision === 'keep_plan') normalized = 'keep';
    else if (rawDecision === 'discuss') normalized = 'discuss';
    else if (rawDecision === 'cancel_cab') normalized = 'cancel_cab';
    else if (rawDecision === 'cancel_meeting') normalized = 'cancel_meeting';

    let istTime = ack.createdAtIst;
    if (!istTime && ack.createdAt) {
      try {
        const d = new Date(ack.createdAt);
        istTime = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(d) + ' IST';
      } catch {
        istTime = '08:52:14 IST';
      }
    }

    userChoicesMap.set(ack.userId, {
      decision: normalized,
      timeIst: istTime || '08:52:14 IST',
    });
  }

  // Consensus Resolution Logic
  const participantsList = pact.participants && pact.participants.length > 0
    ? pact.participants
    : [
        { id: 'part_maya', user_id: 'user_maya', user_name: 'Maya', neighbourhood: 'Indiranagar', max_duration_s: 3600 },
        { id: 'part_arjun', user_id: 'user_arjun', user_name: 'Arjun', neighbourhood: 'HSR Layout', max_duration_s: 3600 },
      ];

  // Include any participant from acknowledgements who might not be in pact.participants
  const displayParticipants = [...participantsList];
  for (const ack of acknowledgements) {
    if (!displayParticipants.some((p) => p.user_id === ack.userId)) {
      displayParticipants.push({
        id: `part_${ack.userId}`,
        pact_id: pact.id,
        user_id: ack.userId,
        user_name: ack.userName || ack.userId,
        neighbourhood: 'Bangalore',
        origin_lat: 12.9716,
        origin_lon: 77.5946,
        max_duration_s: 3600,
        approval_version: pact.version,
        approved_at: null,
        is_approved: true,
      });
    }
  }

  const totalParticipants = displayParticipants.length;
  const recordedChoices = displayParticipants.map((p) => userChoicesMap.get(p.user_id)).filter(Boolean);
  const uniqueDecisions = Array.from(new Set(recordedChoices.map((c) => c!.decision)));

  let isResolved = false;
  let isNeedsDiscussion = false;
  let isPending = false;
  let resolvedAction: string | null = null;
  let resolvedLabel = '';

  if (
    receipt?.consensus?.isResolved ||
    receipt?.currentDecisionStatus === 'remote_chosen' ||
    receipt?.currentDecisionStatus === 'plan_kept' ||
    receipt?.currentDecisionStatus === 'cab_canceled' ||
    receipt?.currentDecisionStatus === 'meeting_canceled'
  ) {
    isResolved = true;
    if (
      receipt?.currentDecisionStatus === 'remote_chosen' ||
      receipt?.consensus?.resolvedAction === 'remote' ||
      receipt?.consensus?.resolvedAction === 'remote_fallback' ||
      receipt?.consensus?.resolvedAction === 'meet'
    ) {
      resolvedAction = 'meet';
      resolvedLabel = 'Switch to virtual Google Meet room (agreed fallback)';
    } else if (
      receipt?.currentDecisionStatus === 'plan_kept' ||
      receipt?.consensus?.resolvedAction === 'keep' ||
      receipt?.consensus?.resolvedAction === 'keep_plan'
    ) {
      resolvedAction = 'keep';
      resolvedLabel = 'Maintain office meeting plan';
    } else if (
      receipt?.currentDecisionStatus === 'cab_canceled' ||
      receipt?.consensus?.resolvedAction === 'cancel_cab'
    ) {
      resolvedAction = 'cancel_cab';
      resolvedLabel = 'Cancel cab reservation to avoid surge fee';
    } else if (
      receipt?.currentDecisionStatus === 'meeting_canceled' ||
      receipt?.consensus?.resolvedAction === 'cancel_meeting'
    ) {
      resolvedAction = 'cancel_meeting';
      resolvedLabel = "Cancel today's in-person sync & reschedule to tomorrow";
    }
  } else if (
    receipt?.consensus?.needsDiscussion ||
    receipt?.currentDecisionStatus === 'needs_discussion'
  ) {
    isNeedsDiscussion = true;
  } else if (recordedChoices.length >= totalParticipants && uniqueDecisions.length === 1) {
    // Both choose the SAME action -> Resolved / Final!
    isResolved = true;
    resolvedAction = uniqueDecisions[0];
    if (resolvedAction === 'meet' || resolvedAction === 'remote' || resolvedAction === 'remote_fallback') {
      resolvedLabel = 'Switch to virtual Google Meet room (agreed fallback)';
    } else if (resolvedAction === 'cancel_cab') {
      resolvedLabel = 'Cancel cab reservation to avoid surge fee';
    } else if (resolvedAction === 'cancel_meeting') {
      resolvedLabel = "Cancel today's in-person sync & reschedule to tomorrow";
    } else if (resolvedAction === 'keep' || resolvedAction === 'keep_plan') {
      resolvedLabel = 'Maintain office meeting plan';
    } else {
      resolvedLabel = 'Discuss in chat';
    }
  } else if (uniqueDecisions.length > 1 || (recordedChoices.length > 0 && uniqueDecisions.includes('discuss'))) {
    // Choices differ -> Needs discussion
    isNeedsDiscussion = true;
  } else {
    // Only 1 person has chosen so far or pending
    isPending = true;
  }

  // Pre-filled discussion chat message
  const p1 = displayParticipants[0];
  const p2 = displayParticipants[1];
  const p1ChoiceObj = p1 ? userChoicesMap.get(p1.user_id) : undefined;
  const p2ChoiceObj = p2 ? userChoicesMap.get(p2.user_id) : undefined;
  const p1Name = p1?.user_name || 'Participant 1';
  const p2Name = p2?.user_name || 'Participant 2';

  const actionFriendly = (d?: string) => {
    if (d === 'meet' || d === 'remote_fallback' || d === 'remote') return 'switch to Google Meet';
    if (d === 'cancel_cab') return 'cancel the cab';
    if (d === 'cancel_meeting') return "cancel today's meeting";
    if (d === 'keep_plan' || d === 'keep') return 'keep the plan';
    if (d === 'discuss') return 'discuss in chat';
    return 'pending';
  };

  // Bilateral participant choices resolution (supports Maya & Arjun as well as Kabir & Ananya)
  const mayaChoiceObj =
    decisions.find(
      (d) =>
        d.userId === 'user_maya' ||
        d.userName?.toLowerCase().includes('maya') ||
        d.userId === 'user_kabir' ||
        d.userName?.toLowerCase().includes('kabir') ||
        d.userId === p1?.user_id
    ) || (p1ChoiceObj ? { userId: p1?.user_id || 'user_maya', userName: p1Name || 'Maya', decision: p1ChoiceObj.decision } : undefined);

  const arjunChoiceObj =
    decisions.find(
      (d) =>
        d.userId === 'user_arjun' ||
        d.userName?.toLowerCase().includes('arjun') ||
        d.userId === 'user_ananya' ||
        d.userName?.toLowerCase().includes('ananya') ||
        d.userId === p2?.user_id
    ) || (p2ChoiceObj ? { userId: p2?.user_id || 'user_arjun', userName: p2Name || 'Arjun', decision: p2ChoiceObj.decision } : undefined);

  const mayaDisplayName = mayaChoiceObj?.userName || p1Name || 'Maya';
  const arjunDisplayName = arjunChoiceObj?.userName || p2Name || 'Arjun';

  const preFilledChatMessage = `⚠️ Commute breach on ${breachUserName}'s route (${check2Minutes} min reached, ${excessMinutes} min over ${limitMinutes} min limit). ${p1Name} voted to ${actionFriendly(
    p1ChoiceObj?.decision || mayaChoiceObj?.decision
  )}, but ${p2Name} voted to ${actionFriendly(
    p2ChoiceObj?.decision || arjunChoiceObj?.decision
  )}. Let's discuss our plan for today's meeting.`;

  // Send pre-filled message to chat
  const handleSendToChat = async () => {
    if (!activeUser) return;
    setIsSendingChat(true);
    setChatSentFeedback(null);
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
        body: JSON.stringify({ text: preFilledChatMessage }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send chat message');

      setChatSentFeedback('✓ Pre-filled message posted to #bellandur-office-pact chat!');
      if (onSwitchToChat) {
        setTimeout(onSwitchToChat, 1200);
      }
    } catch (err: any) {
      setChatSentFeedback(`Error: ${err.message}`);
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <div className="decision-flow-container" role="region" aria-label="Tripwire Decision Flow">
      {/* 1. TOP SUMMARY BANNER */}
      {receipt ? (
        <div className="decision-summary-banner" role="alert">
          <div className="summary-banner-top">
            <span className="summary-alert-pill">● 2/2 BREACH DETECTED</span>
            <span className="summary-provenance-tag">
              {evidence.provenance === 'synthetic' ? 'SIMULATED DATA' : 'LIVE SERPAPI'}
            </span>
          </div>

          <h2 className="summary-headline">
            “{topSummaryText}”
          </h2>

          <div className="summary-meta-row">
            <span>
              Recorded at <strong>{receipt.evidence?.check2TimestampIst || '08:50:15 IST'}</strong>
            </span>
            <span className="meta-dot">·</span>
            <span>
              Freshness: <strong>{evidence.sourceFreshnessSeconds || 30}s ago</strong>
            </span>
            <span className="meta-dot">·</span>
            <Link
              to={`/pacts/${pact.id}/alerts/${alertId}`}
              className="shareable-receipt-link"
              title="Open full printable shareable breach receipt"
            >
              📄 View Shareable Breach Receipt ↗
            </Link>
          </div>
        </div>
      ) : (
        <div className="decision-summary-banner idle">
          <div className="summary-banner-top">
            <span className="summary-idle-pill">WATCHING · ALL NORMAL</span>
          </div>
          <h2 className="summary-headline">
            No active threshold breach. All participant commute estimates are currently within agreed limits.
          </h2>
          <div className="summary-meta-row">
            <span>Agreed limit: <strong>60 min</strong></span>
            <span className="meta-dot">·</span>
            <span>Decision deadline: <strong>{pact.decision_deadline_ist}</strong></span>
          </div>
        </div>
      )}

      {/* Feedback Notice */}
      {feedback && (
        <div className="decision-feedback-banner" role="status">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      {/* 2. AGREED FALLBACK ACTION DISPLAY */}
      <div className="fallback-action-card" data-testid="proposed-fallback-plan">
        <div className="fallback-card-header">
          <div className="fallback-badge-row">
            <span className="fallback-icon-symbol" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </span>
            <span className="fallback-title-label">Proposed Remote Fallback Plan</span>
          </div>
          <span className="fallback-version-tag">RATIFIED IN v{pact.version}</span>
        </div>

        <div className="fallback-action-text">
          “{pact.fallback_text || 'Switch to remote Google Meet and cancel cab'}”
        </div>

        <div className="fallback-context-note">
          Destination: <strong>{pact.destination_name}</strong> · If the 2-breach threshold is met before {pact.decision_deadline_ist.split('·')[0].trim()}, this action is proposed to the team.
        </div>
      </div>

      {/* 3. CONSENSUS STATUS NOTICES */}
      {/* Case A: Consensus Resolved / Final */}
      {isResolved && (
        <div className="consensus-resolved-banner" role="status">
          <div className="resolved-header-row">
            <span className="resolved-check-badge">✓ CONSENSUS REACHED · RESOLVED</span>
            <span className="resolved-time-tag">
              {receipt?.consensus?.resolvedAtIst || userChoicesMap.get('user_maya')?.timeIst || userChoicesMap.get('user_kabir')?.timeIst || recordedChoices[0]?.timeIst || '08:52:14 IST'}
            </span>
          </div>
          <div className="resolved-body-text">
            Both participants agreed to: <strong>{resolvedLabel}</strong>.
          </div>
          <div className="resolved-audit-note" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Action buttons are locked. Decision logged to immutable activity record and announced to team channel.
          </div>
        </div>
      )}

      {/* Case B: Choices Differ -> Needs Discussion Warning */}
      {isNeedsDiscussion && (
        <div className="consensus-warning-banner" role="alert">
          <div className="warning-header-row">
            <span className="warning-alert-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              NEEDS DISCUSSION · CHOICES DIFFER
            </span>
            <span className="warning-status-pill">CONSENSUS REQUIRED</span>
          </div>
          <div className="warning-body-text">
            Participant choices differ: <strong>{mayaDisplayName}</strong> chose “{actionFriendly(mayaChoiceObj?.decision)}”, while <strong>{arjunDisplayName}</strong> chose “{actionFriendly(arjunChoiceObj?.decision)}”.
          </div>

          {/* Pre-filled Chat Message Box */}
          <div className="prefilled-chat-box">
            <div className="prefilled-box-title">Pre-filled Team Alignment Prompt:</div>
            <div className="prefilled-quote">
              “{preFilledChatMessage}”
            </div>
            <div className="prefilled-actions-row">
              <button
                type="button"
                className="btn-primary-send-chat"
                onClick={handleSendToChat}
                disabled={isSendingChat}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                {isSendingChat ? 'Sending to Chat...' : 'Send Message to Team Chat'}
              </button>
              {onSwitchToChat && (
                <button
                  type="button"
                  className="btn-secondary-open-chat"
                  onClick={onSwitchToChat}
                >
                  Open Team Channel →
                </button>
              )}
            </div>
            {chatSentFeedback && (
              <div className="chat-sent-note" role="status">{chatSentFeedback}</div>
            )}
          </div>
        </div>
      )}

      {/* Case C: Pending remaining participant */}
      {isPending && recordedChoices.length > 0 && (
        <div className="consensus-pending-banner">
          <span>
            <strong>1 of {totalParticipants}</strong> participant decisions recorded. Awaiting counterpart's choice to resolve team consensus.
          </span>
        </div>
      )}

      {/* 4. SELECTABLE FALLBACK OPTIONS GRID */}
      <div className="decision-actions-panel">
        <FallbackOptionsGrid
          alertId={alertId}
          activeUser={activeUser}
          currentDecision={userChoicesMap.get(activeUser?.user_id || '')?.decision}
          isLocked={Boolean(isResolved)}
          onDecisionRecorded={() => {
            onDecisionRecorded();
          }}
          onSwitchToChat={onSwitchToChat}
          title="Selectable Fallback Options"
          subtitle={`Threshold breach active (${check2Minutes} min reached, ${excessMinutes} min over limit). Select an action for your team:`}
        />
      </div>

      {/* 5. PARTICIPANTS' CHOICES TABLE WITH IST TIMESTAMP */}
      <div className="participants-decision-status-card">
        <div className="card-title-row">
          <h3 className="subcard-title">Bilateral Participant Vote Badges & IST Timestamps</h3>
          <span className="subcard-hint">Consensus requires unanimous agreement</span>
        </div>

        <div className="participant-votes-grid">
          {displayParticipants.map((p) => {
            const voteInfo = userChoicesMap.get(p.user_id);
            const hasVoted = Boolean(voteInfo);
            const decisionType = voteInfo?.decision;

            let badgeClass = 'vote-pending';
            let badgeText = 'Awaiting decision...';

            if (decisionType === 'meet' || decisionType === 'remote_fallback' || decisionType === 'remote') {
              badgeClass = 'vote-remote';
              badgeText = '📹 Go to Google Meet';
            } else if (decisionType === 'cancel_cab') {
              badgeClass = 'vote-cancel-cab';
              badgeText = '🚕 Cancel the Cab';
            } else if (decisionType === 'cancel_meeting') {
              badgeClass = 'vote-cancel-meeting';
              badgeText = '📅 Cancel the Meeting';
            } else if (decisionType === 'keep_plan' || decisionType === 'keep') {
              badgeClass = 'vote-keep';
              badgeText = '🚗 Maintain Office Plan';
            } else if (decisionType === 'discuss') {
              badgeClass = 'vote-discuss';
              badgeText = '💬 Discuss in Chat';
            }

            return (
              <div key={p.user_id} className={`participant-vote-box ${hasVoted ? 'voted' : 'pending'}`}>
                <div className="vote-box-header">
                  <div className="vote-user-slot">
                    <span className="vote-avatar-initial">{p.user_name.charAt(0)}</span>
                    <div>
                      <strong className="vote-user-name">{p.user_name}</strong>
                      <div className="vote-neighbourhood">{p.neighbourhood} · {Math.round(p.max_duration_s / 60)}m limit</div>
                    </div>
                  </div>
                  {p.user_id === activeUser?.user_id && (
                    <span className="you-pill">You</span>
                  )}
                </div>

                <div className="vote-choice-slot">
                  <span className={`vote-status-badge ${badgeClass}`}>
                    {hasVoted ? '● ' : '○ '} {badgeText}
                  </span>
                </div>

                <div className="vote-timestamp-slot">
                  {hasVoted ? (
                    <span>IST Timestamp: <strong className="tabular-nums mono-text">{voteInfo?.timeIst}</strong></span>
                  ) : (
                    <span className="text-muted">Awaiting choice</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
