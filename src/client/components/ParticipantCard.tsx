import type { ParticipantRecord } from '../types';
import { ParticipantDecisionLine } from './DecisionLine';

interface ParticipantCardProps {
  participant: ParticipantRecord;
  currentPactVersion: number;
  currentEstimateMinutes?: number | null;
  sourceAge?: string;
}

export function ParticipantCard({
  participant,
  currentPactVersion,
  currentEstimateMinutes = null,
  sourceAge = '2m ago',
}: ParticipantCardProps) {
  const isApproved = participant.approval_version === currentPactVersion;
  const limitMinutes = Math.round(participant.max_duration_s / 60);

  return (
    <div className={`participant-card ${isApproved ? 'approved' : 'pending'}`}>
      <div className="participant-card-top">
        <div className="participant-info">
          <div className="participant-name-row">
            <span className="participant-name">{participant.user_name}</span>
            <span className="participant-origin">Starting near {participant.neighbourhood}</span>
          </div>
          <div className="participant-threshold">
            Commute Limit: <strong>{limitMinutes} min</strong> driving
          </div>
        </div>

        <div className="participant-approval-badge">
          {isApproved ? (
            <span className="approval-tag approved">
              ✓ Approved v{participant.approval_version}
            </span>
          ) : (
            <span className="approval-tag pending">
              Pending v{currentPactVersion}
            </span>
          )}
        </div>
      </div>

      {/* Signature Decision Line for Participant */}
      <ParticipantDecisionLine
        origin={participant.neighbourhood}
        limitMinutes={limitMinutes}
        isApproved={isApproved}
        currentMinutes={currentEstimateMinutes}
        sourceAge={sourceAge}
      />
    </div>
  );
}
