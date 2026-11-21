import { useState, useEffect, useRef } from 'react';
import type { PactDetails } from '../types';
import { formatTimeIST } from '../lib/time';
import type { VerifiedPlace } from './VenueSearchModal';
import { PreviewDecisionLine } from './DecisionLine';

interface PactEditorModalProps {
  pact: PactDetails | null;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSave: (updates: any) => Promise<void>;
  onOpenVenueSearch: () => void;
  selectedVenue?: VerifiedPlace | null;
}

function computeDefaultDeadline(): string {
  const d = new Date(Date.now() + 4 * 3600 * 1000);
  const timeStr = formatTimeIST(d);
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
  return `${timeStr} · ${dateStr}`;
}

function formatFutureDeadline(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
  const timeStr = formatTimeIST(d);
  const dateStr = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
  return `${timeStr} · ${dateStr}`;
}

export function PactEditorModal({
  pact,
  mode,
  onClose,
  onSave,
  onOpenVenueSearch,
  selectedVenue,
}: PactEditorModalProps) {
  const [title, setTitle] = useState(pact?.title || (mode === 'create' ? 'Team Meetup' : ''));
  const [deadlineIst, setDeadlineIst] = useState(pact?.decision_deadline_ist || computeDefaultDeadline());
  const [fallbackText, setFallbackText] = useState(
    pact?.fallback_text || 'Switch to remote Google Meet / Slack huddle'
  );

  const [destination, setDestination] = useState({
    name: pact?.destination_name || 'WeWork Bellandur',
    placeId: pact?.destination_place_id || 'ChIJk7Q3BqcUrzsR-q3Qe-place-01',
    address: pact?.destination_address || 'Outer Ring Rd, Bellandur, Bengaluru',
    lat: pact?.destination_lat ?? 12.9290,
    lon: pact?.destination_lon ?? 77.6760,
  });

  const [limits, setLimits] = useState<Record<string, number>>(() => {
    if (pact?.participants && pact.participants.length > 0) {
      return pact.participants.reduce((acc, p) => {
        acc[p.user_id] = Math.round(p.max_duration_s / 60);
        return acc;
      }, {} as Record<string, number>);
    }
    return { user_maya: 60, user_arjun: 60 };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousActiveElement = useRef<HTMLElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Sync selected venue when changed via VenueSearchModal
  useEffect(() => {
    if (selectedVenue) {
      setDestination({
        name: selectedVenue.title,
        placeId: selectedVenue.place_id,
        address: selectedVenue.address,
        lat: selectedVenue.gps_coordinates.latitude,
        lon: selectedVenue.gps_coordinates.longitude,
      });
    }
  }, [selectedVenue]);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    firstInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim() || 'Team Meetup',
        destination_name: destination.name,
        destination_place_id: destination.placeId,
        destination_lat: destination.lat,
        destination_lon: destination.lon,
        destination_address: destination.address,
        decision_deadline_ist: deadlineIst,
        fallback_text: fallbackText,
        participant_limits: Object.entries(limits).map(([userId, mins]) => ({
          user_id: userId,
          max_duration_s: mins * 60,
        })),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || (mode === 'create' ? 'Failed to create pact' : 'Failed to update pact'));
      setSaving(false);
    }
  };

  const mayaLimit = limits['user_maya'] ?? 60;
  const arjunLimit = limits['user_arjun'] ?? 60;
  const targetVersion = mode === 'create' ? 1 : (pact?.version ?? 0) + 1;

  const participantsList = pact?.participants && pact.participants.length > 0
    ? pact.participants
    : [
        { user_id: 'user_maya', user_name: 'Maya', neighbourhood: 'Indiranagar', max_duration_s: 3600 },
        { user_id: 'user_arjun', user_name: 'Arjun', neighbourhood: 'HSR Layout', max_duration_s: 3600 },
      ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="modal-title">
            {mode === 'create' ? 'Create New Office Pact' : 'Edit Office Pact Agreement'}
          </h3>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="notice-banner" role="status">
            {mode === 'create' ? (
              <>
                <strong>New Agreement:</strong> Creates a new pact in <strong>draft</strong> status. Both Maya and Arjun will be added as participants and must approve before monitoring arms.
              </>
            ) : (
              <>
                <strong>Rule Invariant:</strong> Any change to rules, thresholds, or destination advances the pact to <strong>v{targetVersion}</strong> and clears all prior approvals. Both Maya and Arjun must re-approve before monitoring arms.
              </>
            )}
          </div>

          {error && <div className="error-banner" role="alert">{error}</div>}

          <div className="form-group">
            <label htmlFor="pact-title-input">Meeting Title</label>
            <input
              id="pact-title-input"
              ref={firstInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Outer Ring Rd Sync"
              required
            />
          </div>

          <div className="form-group">
            <label>Destination Workplace</label>
            <div className="destination-row">
              <span className="destination-name-display">{destination.name}</span>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={onOpenVenueSearch}
              >
                Change Place
              </button>
            </div>
            {destination.address && (
              <div className="destination-address-display">{destination.address}</div>
            )}
          </div>

          <div className="form-group">
            <label>Per-Participant Commute Thresholds (Minutes)</label>
            {participantsList.map((p) => {
              const currentVal = Number(limits[p.user_id] ?? Math.round(p.max_duration_s / 60)) || 60;
              return (
                <div key={p.user_id} className="participant-threshold-block" style={{ marginBottom: '12px' }}>
                  <div className="participant-threshold-input">
                    <span>{p.user_name} ({p.neighbourhood}):</span>
                    <input
                      type="number"
                      min="15"
                      max="180"
                      step="5"
                      value={currentVal}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/^0+(?=\d)/, '');
                        const num = raw === '' ? 0 : parseInt(raw, 10);
                        setLimits({ ...limits, [p.user_id]: isNaN(num) ? 60 : num });
                      }}
                      onBlur={() => {
                        const val = Number(limits[p.user_id]) || 60;
                        const clamped = Math.max(15, Math.min(180, val));
                        setLimits({ ...limits, [p.user_id]: clamped });
                      }}
                      required
                      aria-label={`${p.user_name} commute limit in minutes`}
                    />
                    <span>min</span>
                  </div>
                  <div className="preset-threshold-chips" style={{ display: 'flex', gap: '4px', marginTop: '4px', marginLeft: '2px' }}>
                    {[30, 45, 60, 75, 90].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={`chip-btn ${currentVal === mins ? 'active' : ''}`}
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: currentVal === mins ? '1px solid var(--pact-green)' : '1px solid var(--rule-subtle)',
                          background: currentVal === mins ? 'var(--pact-wash)' : 'var(--paper-raised)',
                          color: currentVal === mins ? 'var(--pact-green)' : 'var(--ink-secondary)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setLimits({ ...limits, [p.user_id]: mins })}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="form-group">
            <label htmlFor="pact-deadline-input">Decision Deadline (Local Time)</label>
            <input
              id="pact-deadline-input"
              type="text"
              value={deadlineIst}
              onChange={(e) => setDeadlineIst(e.target.value)}
              placeholder="e.g. 09:00 IST · 21 Nov 2026"
              required
            />
            {pact?.decision_deadline_utc && new Date(pact.decision_deadline_utc).getTime() <= Date.now() && (
              <div style={{ marginTop: '6px', padding: '6px 10px', background: 'var(--caution-wash)', border: '1px solid var(--caution-border)', borderRadius: '4px', fontSize: '12px', color: 'var(--caution-ink)' }}>
                ⚠️ <strong>Deadline in the past:</strong> Previous deadline ({pact.decision_deadline_ist}) has passed. Pick a future time below:
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-secondary-xs"
                style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--rule-subtle)', background: 'var(--paper-raised)', cursor: 'pointer' }}
                onClick={() => setDeadlineIst(formatFutureDeadline(1))}
              >
                +1h
              </button>
              <button
                type="button"
                className="btn-secondary-xs"
                style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--rule-subtle)', background: 'var(--paper-raised)', cursor: 'pointer' }}
                onClick={() => setDeadlineIst(formatFutureDeadline(2))}
              >
                +2h
              </button>
              <button
                type="button"
                className="btn-secondary-xs"
                style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--rule-subtle)', background: 'var(--paper-raised)', cursor: 'pointer' }}
                onClick={() => setDeadlineIst(formatFutureDeadline(4))}
              >
                +4h
              </button>
              <button
                type="button"
                className="btn-secondary-xs"
                style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--rule-subtle)', background: 'var(--paper-raised)', cursor: 'pointer' }}
                onClick={() => setDeadlineIst(formatFutureDeadline(24))}
              >
                Tomorrow (+24h)
              </button>
            </div>
            <span className="form-hint" style={{ marginTop: '4px', display: 'block' }}>Monitoring stops after this time. No checks run once expired.</span>
          </div>

          <div className="form-group">
            <label htmlFor="pact-fallback-input">Remote Fallback Action</label>
            <input
              id="pact-fallback-input"
              type="text"
              value={fallbackText}
              onChange={(e) => setFallbackText(e.target.value)}
              required
            />
            <span className="form-hint">Agreed team action if either commute exceeds threshold twice.</span>
          </div>

          {/* Signature Decision Line Preview */}
          <PreviewDecisionLine
            mayaLimit={mayaLimit}
            arjunLimit={arjunLimit}
            deadlineIst={deadlineIst}
            fallbackText={fallbackText}
            nextVersion={targetVersion}
          />

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving
                ? mode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
                : mode === 'create'
                ? 'Create Pact (v1)'
                : `Save as v${targetVersion}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
