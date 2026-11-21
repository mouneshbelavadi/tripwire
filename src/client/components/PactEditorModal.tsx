import { useState, useEffect, useRef } from 'react';
import type { PactDetails } from '../types';
import { PreviewDecisionLine } from './DecisionLine';

interface PactEditorModalProps {
  pact: PactDetails;
  onClose: () => void;
  onSave: (updates: any) => Promise<void>;
  onOpenVenueSearch: () => void;
}

export function PactEditorModal({ pact, onClose, onSave, onOpenVenueSearch }: PactEditorModalProps) {
  const [title, setTitle] = useState(pact.title);
  const [deadlineIst, setDeadlineIst] = useState(pact.decision_deadline_ist);
  const [fallbackText, setFallbackText] = useState(pact.fallback_text);
  const [limits, setLimits] = useState<Record<string, number>>(
    pact.participants.reduce((acc, p) => {
      acc[p.user_id] = Math.round(p.max_duration_s / 60);
      return acc;
    }, {} as Record<string, number>)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousActiveElement = useRef<HTMLElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

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
        title,
        decision_deadline_ist: deadlineIst,
        fallback_text: fallbackText,
        participant_limits: Object.entries(limits).map(([userId, mins]) => ({
          user_id: userId,
          max_duration_s: mins * 60,
        })),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update pact');
      setSaving(false);
    }
  };

  const mayaLimit = limits['user_maya'] ?? 60;
  const arjunLimit = limits['user_arjun'] ?? 60;

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
          <h3 id="modal-title">Edit Office Pact Agreement</h3>
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
            <strong>Rule Invariant:</strong> Any change to rules, thresholds, or destination advances the pact to <strong>v{pact.version + 1}</strong> and clears all prior approvals. Both Maya and Arjun must re-approve before monitoring arms.
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
              required
            />
          </div>

          <div className="form-group">
            <label>Destination Workplace</label>
            <div className="destination-row">
              <span className="destination-name-display">{pact.destination_name}</span>
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={onOpenVenueSearch}
              >
                Change Place
              </button>
            </div>
            <div className="destination-address-display">{pact.destination_address}</div>
          </div>

          <div className="form-group">
            <label>Per-Participant Commute Thresholds (Minutes)</label>
            {pact.participants.map((p) => (
              <div key={p.user_id} className="participant-threshold-input">
                <span>{p.user_name} ({p.neighbourhood}):</span>
                <input
                  type="number"
                  min="15"
                  max="180"
                  step="5"
                  value={limits[p.user_id] ?? 60}
                  onChange={(e) =>
                    setLimits({ ...limits, [p.user_id]: Number(e.target.value) })
                  }
                  required
                  aria-label={`${p.user_name} commute limit in minutes`}
                />
                <span>min</span>
              </div>
            ))}
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
            <span className="form-hint">Monitoring stops after this time. No checks run once expired.</span>
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
            nextVersion={pact.version + 1}
          />

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : `Save as v${pact.version + 1}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
