import React, { useState } from 'react';
import type { TeamMember } from '../types';

export type FallbackDecisionType = 'meet' | 'cancel_cab' | 'cancel_meeting' | 'keep' | 'discuss';

export interface FallbackOptionConfig {
  key: FallbackDecisionType;
  icon: string;
  label: string;
  subLabel: string;
  celebrationTitle: string;
  celebrationDesc: string;
  externalUrl?: string;
}

export const FALLBACK_OPTIONS: FallbackOptionConfig[] = [
  {
    key: 'meet',
    icon: '📹',
    label: 'Go to Google Meet',
    subLabel: 'Launch virtual Google Meet room & send link',
    celebrationTitle: '🎉 Fallback Activated: Google Meet Launched!',
    celebrationDesc: 'Virtual Google Meet room opened in a new tab (https://meet.google.com/new). Vote recorded and link shared with the team.',
    externalUrl: 'https://meet.google.com/new',
  },
  {
    key: 'cancel_cab',
    icon: '🚕',
    label: 'Cancel the Cab',
    subLabel: 'Cancel Uber / Ola ride reservation to avoid surge fee',
    celebrationTitle: '🚕 Cab Ride Reservation Canceled!',
    celebrationDesc: 'Cab reservation canceled to avoid surge fee penalties. Confirmation logged to team channel.',
  },
  {
    key: 'cancel_meeting',
    icon: '📅',
    label: 'Cancel the Meeting',
    subLabel: "Reschedule today's in-person sync to tomorrow",
    celebrationTitle: "📅 Meeting Rescheduled to Tomorrow!",
    celebrationDesc: "Today's in-person sync has been marked as canceled and rescheduled. Calendar update broadcast to team.",
  },
  {
    key: 'keep',
    icon: '🚗',
    label: 'Maintain Office Plan',
    subLabel: 'Proceed with office commute despite traffic delay',
    celebrationTitle: '🚗 Office Plan Maintained!',
    celebrationDesc: 'Vote recorded to proceed with office meeting despite corridor delays. Participants advised to travel safely.',
  },
  {
    key: 'discuss',
    icon: '💬',
    label: 'Discuss in Chat',
    subLabel: 'Open team conversation to align on next steps',
    celebrationTitle: '💬 Team Discussion Thread Opened!',
    celebrationDesc: 'Opened team conversation in #bellandur-office-pact to align with participants on immediate next steps.',
  },
];

export interface FallbackOptionsGridProps {
  alertId?: string;
  activeUser: TeamMember | null;
  currentDecision?: string | null;
  isLocked?: boolean;
  onDecisionRecorded: (decision: string) => void;
  onSwitchToChat?: () => void;
  title?: string;
  subtitle?: string;
}

export function FallbackOptionsGrid({
  alertId,
  activeUser,
  currentDecision,
  isLocked = false,
  onDecisionRecorded,
  onSwitchToChat,
  title = 'Selectable Fallback Options',
  subtitle,
}: FallbackOptionsGridProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    if (currentDecision === 'remote' || currentDecision === 'remote_fallback' || currentDecision === 'meet') return 'meet';
    if (currentDecision === 'keep_plan' || currentDecision === 'keep') return 'keep';
    return currentDecision || null;
  });

  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; desc: string; icon: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync selectedKey with external prop changes
  React.useEffect(() => {
    if (currentDecision) {
      if (currentDecision === 'remote' || currentDecision === 'remote_fallback' || currentDecision === 'meet') {
        setSelectedKey('meet');
      } else if (currentDecision === 'keep_plan' || currentDecision === 'keep') {
        setSelectedKey('keep');
      } else {
        setSelectedKey(currentDecision);
      }
    }
  }, [currentDecision]);

  const handleSelectOption = async (option: FallbackOptionConfig) => {
    if (isLocked || submittingKey) return;
    if (!activeUser) {
      setErrorMsg('Please select an active user profile before voting.');
      return;
    }

    setSubmittingKey(option.key);
    setErrorMsg(null);

    // 1. If Google Meet option, open virtual room in new tab immediately
    if (option.externalUrl) {
      try {
        window.open(option.externalUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Could not automatically open Google Meet tab:', err);
      }
    }

    // 2. Cast vote to backend API
    try {
      const targetAlertId = alertId || 'latest';
      // Attempt /api/receipts/:alertId/decision first, then fallback to /api/alerts/:id/decision
      let res = await fetch(`/api/receipts/${targetAlertId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
        body: JSON.stringify({ decision: option.key, action: option.key }),
      });

      if (!res.ok && res.status === 404) {
        res = await fetch(`/api/alerts/${targetAlertId}/decision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': activeUser.user_id,
          },
          body: JSON.stringify({ action: option.key, decision: option.key }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record decision');
      }

      setSelectedKey(option.key);
      setCelebration({
        title: option.celebrationTitle,
        desc: option.celebrationDesc,
        icon: option.icon,
      });

      onDecisionRecorded(option.key);

      // If discuss option and onSwitchToChat provided, offer quick jump
      if (option.key === 'discuss' && onSwitchToChat) {
        setTimeout(() => {
          onSwitchToChat();
        }, 1400);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record decision choice');
    } finally {
      setSubmittingKey(null);
    }
  };

  return (
    <div className="fallback-options-component" role="region" aria-label="Selectable Fallback Options Grid">
      {/* Header Row */}
      <div className="fallback-grid-header">
        <div>
          <h3 className="fallback-grid-title" style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: 'var(--ink)' }}>
            {title}
          </h3>
          <p className="fallback-grid-subtitle" style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--ink-secondary)' }}>
            {subtitle || (
              <>
                Threshold breach active. Choose an action for your team · Voting as <strong>{activeUser?.user_name || 'Participant'}</strong>
              </>
            )}
          </p>
        </div>
        {selectedKey && (
          <span className="current-choice-tag" style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 700,
            background: 'var(--paper-raised, #ffffff)',
            border: '1px solid var(--pact-green, #1b4d3e)',
            color: 'var(--pact-green, #1b4d3e)',
            padding: '4px 10px',
            borderRadius: '12px'
          }}>
            Voted: {FALLBACK_OPTIONS.find((o) => o.key === selectedKey)?.label}
          </span>
        )}
      </div>

      {/* Celebratory / Informative Banner */}
      {celebration && (
        <div className="celebration-banner" role="status" style={{
          background: 'linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)',
          border: '1.5px solid #81c784',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '12px 16px',
          margin: '12px 0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          position: 'relative'
        }}>
          <span style={{ fontSize: '24px', lineHeight: 1 }} aria-hidden="true">
            {celebration.icon}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#1b5e20', marginBottom: '2px' }}>
              {celebration.title}
            </div>
            <div style={{ fontSize: '12.5px', color: '#2e7d32', lineHeight: 1.4 }}>
              {celebration.desc}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCelebration(null)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '16px',
              color: '#2e7d32',
              cursor: 'pointer',
              padding: '2px 6px',
              lineHeight: 1
            }}
            title="Dismiss banner"
          >
            ×
          </button>
        </div>
      )}

      {/* Error Notice */}
      {errorMsg && (
        <div className="error-banner" role="alert" style={{
          background: '#fee2e2',
          border: '1px solid #ef4444',
          color: '#b91c1c',
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '12.5px',
          margin: '10px 0'
        }}>
          {errorMsg}
        </div>
      )}

      {/* Selectable Options Grid */}
      <div className="fallback-options-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px',
        marginTop: '12px'
      }}>
        {FALLBACK_OPTIONS.map((option) => {
          const isSelected = selectedKey === option.key;
          const isSubmitting = submittingKey === option.key;

          return (
            <button
              key={option.key}
              type="button"
              className={`fallback-option-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelectOption(option)}
              disabled={isLocked || Boolean(submittingKey)}
              aria-pressed={isSelected}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '14px 16px',
                background: isSelected ? '#f2f8f5' : 'var(--paper-raised, #ffffff)',
                border: isSelected ? '2px solid var(--pact-green, #1b4d3e)' : '1.5px solid var(--rule, #e2e2df)',
                borderRadius: 'var(--radius-md, 8px)',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                position: 'relative',
                textAlign: 'left',
                transition: 'all 0.16s ease',
                boxShadow: isSelected ? '0 0 0 1px var(--pact-green, #1b4d3e), 0 2px 8px rgba(27, 77, 62, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                opacity: isLocked && !isSelected ? 0.65 : 1
              }}
            >
              {/* Selected Choice Checkmark Pill */}
              {isSelected && (
                <span className="selected-choice-pill" style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '10px',
                  fontWeight: 700,
                  background: 'var(--pact-green, #1b4d3e)',
                  color: '#ffffff',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                }}>
                  Selected Choice ✓
                </span>
              )}

              {/* Option Icon & Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '20px', lineHeight: 1 }} aria-hidden="true">
                  {option.icon}
                </span>
                <span style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: isSelected ? 'var(--pact-green, #1b4d3e)' : 'var(--ink, #1a1a1a)'
                }}>
                  {option.label}
                </span>
              </div>

              {/* Sub-label description */}
              <div style={{
                fontSize: '11.5px',
                color: 'var(--ink-secondary, #4a4a47)',
                lineHeight: 1.4,
                marginTop: '2px'
              }}>
                {option.subLabel}
              </div>

              {/* In-flight loading state */}
              {isSubmitting && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--pact-green, #1b4d3e)'
                }}>
                  Recording decision...
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
