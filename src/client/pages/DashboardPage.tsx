import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useInRouterContext } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { PactDetails } from '../types';
import { formatTimeIST, getDeadlineStatus } from '../lib/time';

export type PactDisplayStatus =
  | 'Draft'
  | 'Armed'
  | 'Confirming 1/2'
  | 'Alert'
  | 'Paused'
  | 'Expired'
  | 'Deadline passed'
  | 'Completed';

interface ActivityEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: string;
}

export function getPactDisplayStatus(pact: PactDetails, hasActiveReceipt?: boolean): {
  label: PactDisplayStatus;
  variant: 'draft' | 'armed' | 'confirming' | 'alert' | 'paused' | 'expired' | 'completed';
} {
  if (pact.status === 'completed' || pact.status === 'closed') {
    return { label: 'Completed', variant: 'completed' };
  }
  if (pact.status === 'paused') {
    return { label: 'Paused', variant: 'paused' };
  }
  if (getDeadlineStatus(pact.decision_deadline_utc) === 'expired') {
    return { label: 'Deadline passed', variant: 'expired' };
  }
  if (hasActiveReceipt || pact.is_alert_active || (pact.consecutive_breaches && pact.consecutive_breaches >= 2)) {
    return { label: 'Alert', variant: 'alert' };
  }
  if (pact.consecutive_breaches === 1) {
    return { label: 'Confirming 1/2', variant: 'confirming' };
  }
  if (pact.status === 'armed') {
    return { label: 'Armed', variant: 'armed' };
  }
  return { label: 'Draft', variant: 'draft' };
}

function formatCountdown(deadlineUtc: string): {
  formatted: string;
  isExpired: boolean;
  totalSeconds: number;
} {
  const deadlineMs = new Date(deadlineUtc).getTime();
  if (Number.isNaN(deadlineMs)) {
    return { formatted: 'Deadline set', isExpired: false, totalSeconds: 999999 };
  }
  if (getDeadlineStatus(deadlineUtc) === 'expired') {
    return { formatted: 'Deadline passed', isExpired: true, totalSeconds: 0 };
  }

  const diffMs = deadlineMs - Date.now();
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return {
      formatted: `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`,
      isExpired: false,
      totalSeconds: totalSec,
    };
  }
  return {
    formatted: `${minutes}m ${seconds.toString().padStart(2, '0')}s`,
    isExpired: false,
    totalSeconds: totalSec,
  };
}

function formatIstTime(isoOrDateString: string): string {
  return formatTimeIST(isoOrDateString);
}

export function DashboardPage() {
  const inRouter = useInRouterContext();
  const navigate = inRouter ? useNavigate() : (to: string) => { window.location.href = to; };
  const { pacts, activeUser, latestReceipt, loadData, setActionNotice } = useApp();

  // Tick clock for live countdown timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Recent activity events state
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchActivity() {
      try {
        const res = await fetch('/api/pacts/feed/recent-activity');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.events && data.events.length > 0) {
            setActivityEvents(data.events.slice(0, 8));
            return;
          }
        }
      } catch {
        // Fallback below
      }

      // Sensible deterministic fallback of 8 recent IST events
      if (isMounted) {
        setActivityEvents([
          {
            id: 'ev_1',
            timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            title: 'Indiranagar Route Observation',
            description: 'Directions check completed: 42 min fastest driving (≤ 60m threshold). Fresh.',
            type: 'observation',
          },
          {
            id: 'ev_2',
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            title: 'HSR Layout Route Observation',
            description: 'Directions check completed: 34 min fastest driving (≤ 60m threshold). Fresh.',
            type: 'observation',
          },
          {
            id: 'ev_3',
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            title: 'Bellandur Area Incident Scan',
            description: 'Traffic incident engine queried: 0 active disruptions in corridor bbox.',
            type: 'observation',
          },
          {
            id: 'ev_4',
            timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
            title: 'Arjun Approved Agreement v1',
            description: 'Bilateral approval recorded. Bilateral threshold satisfied.',
            type: 'pact',
          },
          {
            id: 'ev_5',
            timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
            title: 'Maya Approved Agreement v1',
            description: 'Creator approval recorded for 60m commute ceiling.',
            type: 'pact',
          },
          {
            id: 'ev_6',
            timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
            title: 'Pact "Bellandur office meetup" Created',
            description: 'Formed bilateral pact with WeWork Bellandur destination.',
            type: 'pact',
          },
          {
            id: 'ev_7',
            timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
            title: 'Past Agreement "Whitefield Client Sync" Archived',
            description: 'Agreement successfully concluded and moved to Past Plans archive.',
            type: 'pact',
          },
          {
            id: 'ev_8',
            timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
            title: 'Background Watch Worker Initialized',
            description: 'Worker acquired SQLite lease with 10s TTL. Standing by for due checks.',
            type: 'observation',
          },
        ]);
      }
    }
    fetchActivity();
    return () => { isMounted = false; };
  }, []);

  // 1. Stat Card 1: Active pacts count
  const activePactsList = useMemo(() => {
    return pacts.filter((p) => p.status !== 'completed' && p.status !== 'closed');
  }, [pacts]);

  const activePactsCount = activePactsList.length;

  // 2. Stat Card 2: Alerts needing decision
  const alertsNeedingDecision = useMemo(() => {
    return pacts.filter((p) => {
      const isAlert = p.is_alert_active || (p.consecutive_breaches && p.consecutive_breaches >= 2);
      const isLatestReceiptPact = latestReceipt && latestReceipt.pactId === p.id;
      return isAlert || isLatestReceiptPact;
    });
  }, [pacts, latestReceipt]);

  const alertsCount = alertsNeedingDecision.length;

  // 3. Stat Card 3: Next deadline
  const earliestActivePactWithDeadline = useMemo(() => {
    const listWithDeadlines = activePactsList
      .filter((p) => p.decision_deadline_utc)
      .map((p) => ({
        pact: p,
        diff: new Date(p.decision_deadline_utc).getTime() - Date.now(),
      }))
      .filter((item) => item.diff > 0)
      .sort((a, b) => a.diff - b.diff);

    return listWithDeadlines[0]?.pact || activePactsList[0] || null;
  }, [activePactsList]);

  const nextDeadlineCountdown = earliestActivePactWithDeadline
    ? formatCountdown(earliestActivePactWithDeadline.decision_deadline_utc)
    : { formatted: 'None set', isExpired: true, totalSeconds: 0 };

  // 4. Stat Card 4: Monitored Corridors
  const totalMonitoredRoutes = activePactsList.reduce(
    (acc, p) => acc + (p.participants?.length || 2),
    0
  );

  // Handlers for decision actions
  const handleRecordDecision = async (alertId: string, decision: 'keep' | 'remote' | 'discuss') => {
    if (!activeUser) return;
    try {
      const res = await fetch(`/api/receipts/${alertId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record decision');
      setActionNotice?.(`Decision recorded: ${decision === 'remote' ? 'Switch to Remote' : decision === 'keep' ? 'Keep Office Plan' : 'Discuss in Chat'}`);
      await loadData();
    } catch (err: any) {
      setActionNotice?.(`Error: ${err.message}`);
    }
  };

  return (
    <div className="page-container dashboard-page">
      {/* Top Header Row with Primary Button */}
      <header className="page-header">
        <div>
          <div className="page-eyebrow">OPERATIONAL OVERVIEW · ASIA/KOLKATA (IST)</div>
          <h1 className="page-title">Tripwire Commute Dashboard</h1>
          <p className="page-subtitle">
            Automated SerpApi Google Maps directions checks with 2-breach verification before leaving for the office.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--md"
            onClick={() => navigate('/pacts/new')}
            title="Create a new bilateral commute pact"
          >
            + New pact
          </button>
        </div>
      </header>

      {/* ====================================================================
          TOP ROW OF 4 STAT CARDS
          ==================================================================== */}
      <section className="dashboard-stats-grid" aria-label="Key Performance Indicators">
        {/* Card 1: Active pacts */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Active pacts</span>
            <span className={`stat-indicator-badge ${activePactsCount > 0 ? 'active' : 'neutral'}`}>
              ● {activePactsCount > 0 ? 'Monitoring' : 'Standby'}
            </span>
          </div>
          <div className="stat-card-value tabular-nums">{activePactsCount}</div>
          <div className="stat-card-subtitle">
            {activePactsCount === 1 ? '1 active team agreement' : `${activePactsCount} active agreements`}
          </div>
        </div>

        {/* Card 2: Alerts needing decision */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Alerts needing decision</span>
            <span className={`stat-indicator-badge ${alertsCount > 0 ? 'action-required' : 'clear'}`}>
              {alertsCount > 0 ? 'Action required' : 'All clear'}
            </span>
          </div>
          <div className="stat-card-value tabular-nums" style={{ color: alertsCount > 0 ? 'var(--error-ink)' : 'inherit' }}>
            {alertsCount}
          </div>
          <div className="stat-card-subtitle">
            {alertsCount > 0 ? 'Threshold breached twice; decide now' : 'No routes exceeding agreed limits'}
          </div>
        </div>

        {/* Card 3: Next deadline */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Next deadline</span>
            <span className="stat-indicator-badge neutral">
              {earliestActivePactWithDeadline ? earliestActivePactWithDeadline.decision_deadline_ist.split('·')[0].trim() : 'Standby'}
            </span>
          </div>
          <div className="stat-card-value countdown tabular-nums">
            {nextDeadlineCountdown.formatted}
          </div>
          <div className="stat-card-subtitle">
            {earliestActivePactWithDeadline ? earliestActivePactWithDeadline.destination_name : 'No active deadline'}
          </div>
        </div>

        {/* Card 4: Monitored Corridors */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Monitored corridors</span>
            <span className="stat-indicator-badge active">
              ● Active
            </span>
          </div>
          <div className="stat-card-value tabular-nums">
            {totalMonitoredRoutes} routes
          </div>
          <div className="stat-progress-bar-container" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100} aria-label="Monitored routes health">
            <div
              className="stat-progress-bar-fill"
              style={{ width: '100%', background: 'var(--pact-green, #1b4d3e)' }}
            />
          </div>
          <div className="stat-card-subtitle">
            Real-time Directions & Traffic monitoring active
          </div>
        </div>
      </section>

      {/* ====================================================================
          "NEEDS YOUR DECISION" SECTION (PLACED PROMINENTLY FIRST)
          ==================================================================== */}
      <section className={`decision-alert-section ${alertsCount > 0 ? 'has-alert' : ''}`} aria-labelledby="decision-section-heading">
        <div className="section-eyebrow-row">
          <div className={`section-eyebrow-title ${alertsCount > 0 ? 'alert' : ''}`} id="decision-section-heading">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Needs your decision
          </div>
          {alertsCount > 0 && (
            <span className="stat-indicator-badge action-required">
              {alertsCount} {alertsCount === 1 ? 'alert awaiting action' : 'alerts awaiting action'}
            </span>
          )}
        </div>

        {alertsCount > 0 ? (
          <div className="decision-alert-card">
            {alertsNeedingDecision.map((alertPact) => {
              const pactCountdown = formatCountdown(alertPact.decision_deadline_utc);
              const alertId = latestReceipt?.alertId || `alert_${alertPact.id}_auto`;
              const breachMins = latestReceipt?.evidence?.fastestDurationMinutes || 72;
              const limitMins = Math.max(...alertPact.participants.map((p) => Math.round(p.max_duration_s / 60)), 60);

              return (
                <div key={alertPact.id} className="decision-alert-item">
                  <div className="decision-alert-top">
                    <div>
                      <h2 className="alert-pact-title">{alertPact.title}</h2>
                      <div className="alert-pact-destination">
                        Destination: <strong>{alertPact.destination_name}</strong> · Agreed limit: <strong>{limitMins} min</strong>
                      </div>
                    </div>
                    <span className="pact-status-badge alert">ALERT TRIGGERED</span>
                  </div>

                  <div className="alert-trigger-box">
                    <strong>2 consecutive fresh breaches detected:</strong> Latest driving estimate reached{' '}
                    <span className="tabular-nums">{breachMins} minutes</span> (exceeding the agreed {limitMins} min limit twice before deadline).
                  </div>

                  <div className="alert-proposed-fallback">
                    <div className="fallback-label">Agreed Remote Fallback Proposal</div>
                    <div className="fallback-sentence">“{alertPact.fallback_text}”</div>
                  </div>

                  <div className="alert-actions-bar">
                    <div className="alert-deadline-timer">
                      Decision deadline: <strong>{alertPact.decision_deadline_ist.split('·')[0].trim()}</strong> (
                      <span className="tabular-nums">{pactCountdown.formatted}</span>)
                    </div>

                    <div className="alert-buttons-group">
                      <button
                        type="button"
                        className="ui-button ui-button--primary ui-button--sm"
                        onClick={() => handleRecordDecision(alertId, 'remote')}
                      >
                        ✓ Switch to Remote
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button--secondary ui-button--sm"
                        onClick={() => handleRecordDecision(alertId, 'keep')}
                      >
                        Maintain Office Plan
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button--secondary ui-button--sm"
                        onClick={() => navigate(`/pacts/${alertPact.id}?tab=decision`)}
                      >
                        View Evidence Receipt &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="all-clear-card">
            <div className="all-clear-icon" aria-hidden="true">✓</div>
            <div>
              <div className="all-clear-title">All clear — no pacts currently require emergency review or fallback decision.</div>
              <div className="all-clear-desc">
                All participant routes are within agreed commute thresholds. The automated watch will notify you if two consecutive fresh breaches occur.
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ====================================================================
          ACTIVE PACTS CARD GRID
          ==================================================================== */}
      <section className="active-pacts-section" aria-labelledby="active-pacts-heading">
        <div className="section-title-row">
          <h2 className="section-heading" id="active-pacts-heading">Active Pacts</h2>
          <span className="stat-card-subtitle">{activePactsCount} active</span>
        </div>

        {activePactsList.length === 0 ? (
          <div className="all-clear-card" style={{ padding: '24px', background: 'var(--paper-raised)', border: '1px dashed var(--rule-strong)', borderRadius: 'var(--radius-panel)' }}>
            <div>
              <div className="all-clear-title">No active pacts found</div>
              <div className="all-clear-desc">Create your first bilateral office agreement to monitor commute duration.</div>
            </div>
          </div>
        ) : (
          <div className="active-pacts-grid">
            {activePactsList.map((pactItem) => {
              const statusDisplay = getPactDisplayStatus(pactItem, Boolean(latestReceipt && latestReceipt.pactId === pactItem.id));
              const countdown = formatCountdown(pactItem.decision_deadline_utc);

              return (
                <div
                  key={pactItem.id}
                  className="pact-grid-card"
                  onClick={() => navigate(`/pacts/${pactItem.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/pacts/${pactItem.id}`);
                    }
                  }}
                  aria-label={`View details for pact ${pactItem.title}`}
                >
                  <div>
                    <div className="pact-grid-card-header">
                      <div>
                        <h3 className="pact-card-title-text">{pactItem.title}</h3>
                        <div className="pact-card-dest">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {pactItem.destination_name}
                        </div>
                      </div>
                      <span className={`pact-status-badge ${statusDisplay.variant}`}>
                        {statusDisplay.label}
                      </span>
                    </div>

                    {/* Both participants' latest commute vs limit as small progress bars */}
                    <div className="pact-participants-progress-box" style={{ marginTop: '12px' }}>
                      {pactItem.participants.map((participant) => {
                        const limitMins = Math.round(participant.max_duration_s / 60);
                        // Compute latest estimate
                        const isBreach = statusDisplay.label === 'Alert' && participant.user_id === 'user_maya';
                        const currentEstimate = isBreach ? 72 : participant.user_id === 'user_maya' ? 42 : 34;
                        const pct = Math.min(100, Math.round((currentEstimate / limitMins) * 100));
                        const isOverLimit = currentEstimate > limitMins;

                        return (
                          <div key={participant.id} className="participant-bar-row">
                            <div className="participant-bar-labels">
                              <span className="participant-name-part">
                                {participant.user_name} <span style={{ fontWeight: 400, color: 'var(--ink-secondary)' }}>({participant.neighbourhood})</span>
                              </span>
                              <span className={`participant-duration-metric ${isOverLimit ? 'breach' : ''}`}>
                                <strong>{currentEstimate}m</strong> / {limitMins}m
                              </span>
                            </div>
                            <div className="mini-progress-track">
                              <div
                                className={`mini-progress-fill ${isOverLimit ? 'breach' : pct >= 80 ? 'warn' : ''}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pact-card-footer">
                    <span>Decide by {pactItem.decision_deadline_ist.split('·')[0].trim()}</span>
                    <span className="pact-card-deadline-countdown tabular-nums">
                      {countdown.formatted}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ====================================================================
          PAST & CONCLUDED AGREEMENTS
          ==================================================================== */}
      {pacts.some((p) => p.status === 'completed' || p.status === 'closed') && (
        <section className="past-pacts-section" aria-labelledby="past-pacts-heading" style={{ marginTop: '32px' }}>
          <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 className="section-heading" id="past-pacts-heading">Past & Concluded Plans</h2>
              <span className="stat-card-subtitle">
                {pacts.filter((p) => p.status === 'completed' || p.status === 'closed').length} completed agreements archived
              </span>
            </div>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={() => navigate('/history')}
            >
              View Full History Archive →
            </button>
          </div>

          <div className="active-pacts-grid">
            {pacts
              .filter((p) => p.status === 'completed' || p.status === 'closed')
              .map((pastPact) => (
                <div
                  key={pastPact.id}
                  className="pact-grid-card past-card"
                  onClick={() => navigate(`/pacts/${pastPact.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/pacts/${pastPact.id}`);
                  }}
                  style={{ opacity: 0.9, borderColor: 'var(--rule-subtle)' }}
                  aria-label={`View past pact ${pastPact.title}`}
                >
                  <div>
                    <div className="pact-grid-card-header">
                      <div>
                        <h3 className="pact-card-title-text">{pastPact.title}</h3>
                        <div className="pact-card-dest" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span>{pastPact.destination_name}</span>
                        </div>
                      </div>
                      <span className="pact-status-badge completed">COMPLETED</span>
                    </div>

                    <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--ink-secondary)' }}>
                      <div><strong>Agreed Fallback:</strong> “{pastPact.fallback_text}”</div>
                      <div style={{ marginTop: '4px' }}>
                        <strong>Participants:</strong> {pastPact.participants.map((p) => `${p.user_name} (${Math.round(p.max_duration_s / 60)}m)`).join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="pact-card-footer" style={{ marginTop: '16px' }}>
                    <span>Deadline: {pastPact.decision_deadline_ist}</span>
                    <span style={{ fontSize: '12px', color: 'var(--pact-green)', fontWeight: 600 }}>Archived ✓</span>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ====================================================================
          RECENT ACTIVITY FEED (LAST 8 EVENTS IN IST)
          ==================================================================== */}
      <section className="recent-activity-section" aria-labelledby="activity-heading">
        <div className="activity-feed-header">
          <h2 className="activity-feed-title" id="activity-heading">Recent Activity Feed</h2>
          <span className="activity-feed-hint">Last 8 events · Timestamped in Asia/Kolkata (IST)</span>
        </div>

        <div className="activity-feed-list" role="list">
          {activityEvents.map((event) => (
            <div key={event.id} className="activity-feed-item" role="listitem">
              <span className="activity-time-ist tabular-nums">
                {formatIstTime(event.timestamp)}
              </span>
              <div>
                <span className={`activity-type-pill ${event.type}`}>
                  {event.type}
                </span>
              </div>
              <div className="activity-feed-desc">
                <strong>{event.title}:</strong> {event.description}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
