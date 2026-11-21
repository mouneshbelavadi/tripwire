import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, useInRouterContext } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { EvidencePanel } from '../components/EvidencePanel';
import { DecisionTab } from '../components/DecisionTab';
import { EvidenceReceiptCard } from '../components/EvidenceReceiptCard';
import { PactEditorModal } from '../components/PactEditorModal';
import { VenueSearchModal, type VerifiedPlace } from '../components/VenueSearchModal';
import { getPactDisplayStatus, type PactDisplayStatus } from './DashboardPage';
import type { ParticipantRecord } from '../types';
import { buildPactViewModel, type RawObservation } from '../lib/pactViewModel';
import { getDeadlineStatus } from '../lib/time';

type PactTab = 'overview' | 'evidence' | 'decision' | 'activity';

interface SparklineProps {
  observations: number[]; // 6 observations in minutes
  limitMinutes: number;
}

function MiniSvgSparkline({ observations, limitMinutes }: SparklineProps) {
  const width = 300;
  const height = 56;
  const paddingX = 16;
  const paddingTop = 12;
  const paddingBottom = 16;

  const minVal = Math.min(...observations, limitMinutes - 15, 20);
  const maxVal = Math.max(...observations, limitMinutes + 15, 75);

  const getX = (index: number) => {
    return paddingX + (index / (observations.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val: number) => {
    const usableHeight = height - paddingTop - paddingBottom;
    const norm = (val - minVal) / (maxVal - minVal || 1);
    return height - paddingBottom - norm * usableHeight;
  };

  const limitY = getY(limitMinutes);
  const points = observations.map((val, idx) => `${getX(idx)},${getY(val)}`).join(' ');

  return (
    <div className="sparkline-container" role="img" aria-label={`Sparkline showing last 6 commute observations against ${limitMinutes}m limit`}>
      <div className="sparkline-header-row">
        <span>Last 6 observations (5m cadence)</span>
        <span className="tabular-nums">Limit: {limitMinutes}m</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="sparkline-svg"
        preserveAspectRatio="none"
      >
        {/* Horizontal dashed limit line */}
        <line
          x1={0}
          y1={limitY}
          x2={width}
          y2={limitY}
          stroke="var(--error-ink)"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          opacity={0.8}
        />
        <text
          x={width - 4}
          y={limitY - 4}
          fill="var(--error-ink)"
          fontSize="9"
          fontFamily="var(--font-mono)"
          textAnchor="end"
          fontWeight="bold"
        >
          {limitMinutes}m limit
        </text>

        {/* Observation trend polyline */}
        <polyline
          fill="none"
          stroke="var(--pact-green)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {/* Observation data dots */}
        {observations.map((val, idx) => {
          const cx = getX(idx);
          const cy = getY(val);
          const isBreach = val > limitMinutes;

          return (
            <g key={idx}>
              <circle
                cx={cx}
                cy={cy}
                r={isBreach ? 4 : 3}
                fill={isBreach ? 'var(--error-ink)' : 'var(--pact-green)'}
                stroke="var(--paper-raised)"
                strokeWidth="1.5"
              />
              <text
                x={cx}
                y={cy - 6}
                fill={isBreach ? 'var(--error-ink)' : 'var(--ink-secondary)'}
                fontSize="8.5"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                fontWeight={isBreach ? 'bold' : 'normal'}
                className="tabular-nums"
              >
                {val}m
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// 4-Step Stepper Decision Line Component
interface StepperProps {
  statusDisplay: { label: PactDisplayStatus; variant: string };
  maxMinutes: number;
  consecutiveBreaches: number;
  deadlineIst: string;
  countdownFormatted: string;
  fallbackText: string;
}

function FourStepDecisionStepper({
  statusDisplay,
  maxMinutes,
  consecutiveBreaches,
  deadlineIst,
  countdownFormatted,
  fallbackText,
}: StepperProps) {
  const label = statusDisplay.label;
  const isAlert = label === 'Alert';
  const isConfirming = label === 'Confirming 1/2' || consecutiveBreaches === 1;
  const isArmed = label === 'Armed';
  const isDraft = label === 'Draft';
  const isPaused = label === 'Paused';
  const isCompleted = label === 'Completed' || label === 'Expired';

  // Step 1: Agreed threshold
  const step1State: 'completed' | 'active' | 'future' =
    isDraft ? 'active' : 'completed';

  // Step 2: Confirmation gate (n/2)
  let step2State: 'completed' | 'active' | 'future' = 'future';
  let step2Variant = '';
  let step2Value = '2 fresh breaches';

  if (isCompleted) {
    step2State = 'completed';
    step2Value = 'Passed';
  } else if (isAlert) {
    step2State = 'completed';
    step2Value = '2/2 confirmed breaches';
  } else if (isConfirming) {
    step2State = 'active';
    step2Variant = 'amber';
    step2Value = '1/2 breach (checking 2nd)';
  } else if (isArmed) {
    step2State = 'active';
    step2Value = '0/2 breaches (watching)';
  } else if (isPaused) {
    step2State = 'active';
    step2Variant = 'amber';
    step2Value = 'Monitoring paused';
  } else {
    step2State = 'future';
    step2Value = 'Pending bilateral approval';
  }

  // Step 3: Decision deadline (countdown)
  let step3State: 'completed' | 'active' | 'future' = 'future';
  let step3Variant = '';
  if (isCompleted) {
    step3State = 'completed';
  } else if (isAlert) {
    step3State = 'active';
    step3Variant = 'red';
  } else {
    step3State = 'future';
  }

  // Step 4: Proposed outcome
  let step4State: 'completed' | 'active' | 'future' = 'future';
  let step4Variant = '';
  let step4Value = 'Maintain Office Plan';

  if (isCompleted) {
    step4State = 'completed';
    step4Value = 'Concluded & Archived';
  } else if (isAlert) {
    step4State = 'active';
    step4Variant = 'red';
    step4Value = fallbackText.length > 28 ? fallbackText.slice(0, 28) + '...' : fallbackText;
  } else {
    step4State = 'future';
    step4Value = 'Maintain Office Plan';
  }

  return (
    <div className="stepper-decision-line-card" role="region" aria-label="4-Step Tripwire Stepper Decision Line">
      <div className="stepper-header-row">
        <span className="stepper-title">4-Step Stepper Decision Line</span>
        <span className={`stepper-state-badge ${statusDisplay.variant}`}>
          {label.toUpperCase()}
        </span>
      </div>

      <div className="stepper-track-4">
        {/* Step 1: Agreed threshold */}
        <div className={`stepper-step ${step1State}`}>
          <div className="step-marker-row">
            <span className="step-badge-indicator" aria-hidden="true">
              {step1State === 'completed' ? '✓' : '1'}
            </span>
            <span className="step-label">Agreed threshold</span>
          </div>
          <div className="step-value-text tabular-nums">
            ≤ {maxMinutes} min limit
          </div>
        </div>

        <div className="stepper-connector-arrow" aria-hidden="true">→</div>

        {/* Step 2: Confirmation gate (n/2) */}
        <div className={`stepper-step ${step2State} ${step2Variant}`}>
          <div className="step-marker-row">
            <span className="step-badge-indicator" aria-hidden="true">
              {step2State === 'completed' ? '✓' : '2'}
            </span>
            <span className="step-label">Confirmation gate (n/2)</span>
          </div>
          <div className="step-value-text">
            {step2Value}
          </div>
        </div>

        <div className="stepper-connector-arrow" aria-hidden="true">→</div>

        {/* Step 3: Decision deadline (countdown) */}
        <div className={`stepper-step ${step3State} ${step3Variant}`}>
          <div className="step-marker-row">
            <span className="step-badge-indicator" aria-hidden="true">
              {step3State === 'completed' ? '✓' : '3'}
            </span>
            <span className="step-label">Decision deadline</span>
          </div>
          <div className="step-value-text tabular-nums">
            {deadlineIst.split('·')[0].trim()} ({countdownFormatted})
          </div>
        </div>

        <div className="stepper-connector-arrow" aria-hidden="true">→</div>

        {/* Step 4: Proposed outcome */}
        <div className={`stepper-step ${step4State} ${step4Variant}`}>
          <div className="step-marker-row">
            <span className="step-badge-indicator" aria-hidden="true">
              {step4State === 'completed' ? '✓' : '4'}
            </span>
            <span className="step-label">Proposed outcome</span>
          </div>
          <div className="step-value-text">
            {step4Value}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const inRouter = useInRouterContext();
  const navigate = inRouter ? useNavigate() : (to: string) => { window.location.href = to; };

  const {
    pacts,
    activeUser,
    loadData,
    latestReceipt,
    setActionNotice,
    setSelectedPactId,
  } = useApp();

  const activeTab = (searchParams.get('tab') as PactTab) || 'overview';
  const setTab = (tab: PactTab) => setSearchParams({ tab });

  const pact = pacts.find((p) => p.id === id) || pacts[0] || null;

  // More actions menu dropdown state
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [pendingVenue, setPendingVenue] = useState<VerifiedPlace | null>(null);
  const [isVenueSearchOpen, setIsVenueSearchOpen] = useState(false);
  const [rawObservations, setRawObservations] = useState<RawObservation[]>([]);
  const [pactReceipt, setPactReceipt] = useState<any | null>(null);

  useEffect(() => {
    if (pact?.id) {
      if (setSelectedPactId) setSelectedPactId(pact.id);
      fetch(`/api/receipts/latest/pact/${pact.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.receipt) setPactReceipt(data.receipt);
        })
        .catch(() => {});
    }
  }, [pact?.id, setSelectedPactId]);

  const currentReceipt = pactReceipt || (latestReceipt?.pactId === pact?.id ? latestReceipt : null);

  useEffect(() => {
    let isMounted = true;
    async function loadObs() {
      if (!pact) return;
      try {
        const res = await fetch(`/api/simulation/pact/${pact.id}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setRawObservations(data.observations || []);
        }
      } catch {}
    }
    loadObs();
    return () => { isMounted = false; };
  }, [pact?.id, latestReceipt]);

  const viewModel = useMemo(
    () => (pact ? buildPactViewModel(pact, latestReceipt, rawObservations) : null),
    [pact, latestReceipt, rawObservations]
  );
  void viewModel;

  // Tick clock for live countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close more menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setIsMoreMenuOpen(false);
    if (isMoreMenuOpen) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [isMoreMenuOpen]);

  // Live countdown calculation
  const isExpired = pact ? getDeadlineStatus(pact.decision_deadline_utc) === 'expired' : false;
  const diffMs = pact ? new Date(pact.decision_deadline_utc).getTime() - Date.now() : 0;
  const countdownFormatted = useMemo(() => {
    if (!pact) return '';
    if (isExpired) return 'Deadline passed';
    if (diffMs <= 0) return '00:00:00 (Ended)';
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s remaining`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s remaining`;
  }, [pact, diffMs, isExpired]);

  // Agreed team condition sentence generated in plain English from rule values
  const agreedConditionSentence = useMemo(() => {
    if (!pact) return '';
    const maxMinutes = Math.max(...pact.participants.map((p) => Math.round(p.max_duration_s / 60)), 60);
    const p1 = pact.participants[0];
    const p2 = pact.participants[1];
    const p1Limit = p1 ? Math.round(p1.max_duration_s / 60) : 60;
    const p2Limit = p2 ? Math.round(p2.max_duration_s / 60) : 60;
    const deadlineTime = pact.decision_deadline_ist.split('·')[0].trim();

    if (p1 && p2 && p1Limit === p2Limit) {
      return `“Reconsider if either ${p1.user_name} (${p1.neighbourhood}) or ${p2.user_name} (${p2.neighbourhood})'s driving commute to ${pact.destination_name} exceeds ${p1Limit} minutes on two consecutive fresh checks before ${deadlineTime}. If triggered, the team agrees to: ${pact.fallback_text}.”`;
    }
    if (p1 && p2) {
      return `“Reconsider if ${p1.user_name}'s driving commute exceeds ${p1Limit} minutes or ${p2.user_name}'s driving commute exceeds ${p2Limit} minutes to ${pact.destination_name} on two consecutive fresh checks before ${deadlineTime}. If triggered, the team agrees to: ${pact.fallback_text}.”`;
    }
    return `“Reconsider if either commute exceeds ${maxMinutes} minutes on two consecutive fresh checks before ${deadlineTime}. If triggered, the team agrees to: ${pact.fallback_text}.”`;
  }, [pact]);

  if (!pact) {
    return (
      <div className="page-container">
        <div className="stat-card" style={{ padding: '32px', textAlign: 'center' }}>
          <h2>Pact Not Found</h2>
          <p style={{ marginTop: '8px', color: 'var(--ink-secondary)' }}>
            The requested pact agreement (<code>{id}</code>) could not be located.
          </p>
          <div style={{ marginTop: '16px' }}>
            <button type="button" className="ui-button ui-button--primary ui-button--md" onClick={() => navigate('/')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = pact.status === 'completed' || pact.status === 'closed';
  const maxMinutes = Math.max(...pact.participants.map((p) => Math.round(p.max_duration_s / 60)), 60);
  const statusDisplay = getPactDisplayStatus(pact, Boolean(latestReceipt && latestReceipt.pactId === pact.id));

  // Actions handlers
  const handleApprove = async () => {
    if (!activeUser) return;
    try {
      const res = await fetch(`/api/pacts/${pact.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      setActionNotice?.(data.message);
      await loadData();
    } catch (err: any) {
      setActionNotice?.(`Error: ${err.message}`);
    }
  };

  const handlePause = async () => {
    if (!activeUser) return;
    try {
      const res = await fetch(`/api/pacts/${pact.id}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pause failed');
      setActionNotice?.(data.message || 'Pact monitoring paused.');
      setIsMoreMenuOpen(false);
      await loadData();
    } catch (err: any) {
      setActionNotice?.(`Error: ${err.message}`);
    }
  };

  const handleComplete = async () => {
    if (!activeUser) return;
    try {
      const res = await fetch(`/api/pacts/${pact.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Complete failed');
      setActionNotice?.(data.message || 'Pact marked as completed and moved to Past Plans.');
      setIsMoreMenuOpen(false);
      await loadData();
      navigate('/history');
    } catch (err: any) {
      setActionNotice?.(`Error: ${err.message}`);
    }
  };

  const handleSavePact = async (formData: any) => {
    if (!activeUser) return;
    try {
      const res = await fetch(`/api/pacts/${pact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setActionNotice?.(data.message);
      setEditorMode(null);
      setPendingVenue(null);
      await loadData();
    } catch (err: any) {
      setActionNotice?.(`Error: ${err.message}`);
    }
  };

  const handleSelectVenue = async (place: VerifiedPlace) => {
    if (editorMode) {
      setPendingVenue(place);
      setIsVenueSearchOpen(false);
      return;
    }
    await handleSavePact({
      destination_name: place.title,
      destination_place_id: place.place_id,
      destination_address: place.address,
      destination_lat: place.gps_coordinates.latitude,
      destination_lon: place.gps_coordinates.longitude,
    });
    setIsVenueSearchOpen(false);
  };

  // Observations history derived from unified view model
  const getParticipantObservations = (p: ParticipantRecord): number[] => {
    const partVm = viewModel?.participants.find((vm) => vm.userId === p.user_id);
    if (partVm && partVm.history && partVm.history.length > 0) {
      return partVm.history;
    }
    const isBreachedUser =
      (currentReceipt?.participant?.userId && currentReceipt.participant.userId === p.user_id) ||
      p.user_id === 'user_kabir' ||
      p.user_id === 'user_maya';

    if (isBreachedUser && statusDisplay.label === 'Alert') {
      return [38, 41, 44, 52, 68, 72]; // Breach sequence
    }
    if (isBreachedUser && statusDisplay.label === 'Confirming 1/2') {
      return [38, 41, 40, 42, 55, 68]; // 1st breach
    }
    if (isBreachedUser) {
      return [38, 41, 40, 43, 41, 42]; // Normal
    }
    // Counterpart normal
    return [30, 32, 35, 33, 34, 34];
  };

  return (
    <div className="page-container pact-detail-page">
      {/* Plan Selector & Quick Switcher Bar */}
      <div className="plan-switcher-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--paper-raised)',
        border: '1px solid var(--rule-subtle)',
        borderRadius: 'var(--radius-panel)',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Switch Plan:
          </span>
          <select
            className="plan-select-dropdown"
            value={pact.id}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                navigate('/pacts/new');
              } else if (e.target.value === '__history__') {
                navigate('/history');
              } else {
                navigate(`/pacts/${e.target.value}`);
              }
            }}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: 'var(--radius-button)',
              border: '1px solid var(--rule-strong)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              cursor: 'pointer',
              minWidth: '240px'
            }}
          >
            <optgroup label="Active Agreements">
              {pacts.filter((p) => p.status !== 'completed' && p.status !== 'closed').map((p) => (
                <option key={p.id} value={p.id}>
                  ● {p.title} (v{p.version} · {p.status.toUpperCase()})
                </option>
              ))}
            </optgroup>
            {pacts.some((p) => p.status === 'completed' || p.status === 'closed') && (
              <optgroup label="Past / Completed Plans">
                {pacts.filter((p) => p.status === 'completed' || p.status === 'closed').map((p) => (
                  <option key={p.id} value={p.id}>
                    ✓ {p.title} (Archived · {p.destination_name})
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Actions">
              <option value="__new__">+ Create New Plan...</option>
              <option value="__history__">View All Plans Archive (/history)...</option>
            </optgroup>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={() => navigate('/history')}
            title="Browse all past and concluded office pacts"
          >
            Past Plans ({pacts.filter((p) => p.status === 'completed' || p.status === 'closed').length})
          </button>
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            onClick={() => navigate('/pacts/new')}
            title="Create a new bilateral office pact"
          >
            + New Plan
          </button>
        </div>
      </div>

      {/* Requirement 5: Contains simulated data banner */}
      {viewModel?.containsSimulatedData && (
        <div className="simulation-banner" role="alert" style={{ marginBottom: '16px' }}>
          <span className="simulation-banner-badge">SIMULATED DATA</span>
          <span className="simulation-banner-text">
            Contains simulated data: Monitored observations in this commute episode include synthetic or replay records.
          </span>
        </div>
      )}
      {/* ====================================================================
          HEADER
          ==================================================================== */}
      <div className="pact-header-card">
        <div className="pact-title-row">
          <div>
            <div className="pact-venue-tag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {pact.destination_name}
            </div>
            <h1 className="pact-main-title">{pact.title}</h1>
            <div className="pact-subtitle">
              Destination: <strong>{pact.destination_name}</strong> · Decide by <strong>{pact.decision_deadline_ist.split('·')[0].trim()}</strong> (
              <span className="tabular-nums" style={{ color: 'var(--pact-green)', fontWeight: 600 }}>{countdownFormatted}</span>)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="version-pill">VERSION {pact.version}</span>
            <span className={`pact-status-badge ${statusDisplay.variant}`}>
              {statusDisplay.label}
            </span>

            {/* "More" actions menu */}
            <div className="more-actions-container" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                onClick={() => setIsMoreMenuOpen((o) => !o)}
                aria-expanded={isMoreMenuOpen}
                aria-haspopup="true"
                aria-label="More actions for agreement"
              >
                More ▾
              </button>

              {isMoreMenuOpen && (
                <div className="more-actions-menu" role="menu">
                  {!isCompleted && (
                    <button
                      type="button"
                      className="menu-item-btn"
                      role="menuitem"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setPendingVenue(null);
                        setEditorMode('edit');
                      }}
                    >
                      ✏ Edit agreement
                    </button>
                  )}

                  {!isCompleted && pact.status !== 'paused' && (
                    <button
                      type="button"
                      className="menu-item-btn"
                      role="menuitem"
                      onClick={handlePause}
                    >
                      ⏸ Pause monitoring
                    </button>
                  )}

                  {!isCompleted && (
                    <button
                      type="button"
                      className="menu-item-btn danger"
                      role="menuitem"
                      onClick={handleComplete}
                    >
                      ✓ Complete pact
                    </button>
                  )}

                  {isCompleted && (
                    <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--ink-muted)' }}>
                      Pact is archived.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Approve button if pending for current user */}
            {!isCompleted && pact.can_current_user_approve && (
              <button
                type="button"
                className="ui-button ui-button--primary ui-button--sm"
                onClick={handleApprove}
              >
                Approve v{pact.version}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="pact-tabs-navigation" role="tablist" aria-label="Pact view navigation">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`pact-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview Tab
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'evidence'}
          className={`pact-tab-btn ${activeTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setTab('evidence')}
        >
          Evidence & Proof ⚡
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'decision'}
          className={`pact-tab-btn ${activeTab === 'decision' ? 'active' : ''}`}
          onClick={() => setTab('decision')}
        >
          Decision & Receipt
          {statusDisplay.label === 'Alert' && <span className="tab-alert-badge">ALERT</span>}
        </button>
      </div>

      {/* ====================================================================
          TAB CONTENT: OVERVIEW TAB
          ==================================================================== */}
      {activeTab === 'overview' && (
        <div className="tab-content-pane" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 1. Agreed Team Condition Sentence in Plain English */}
          <section className="plain-agreement-callout" aria-label="Agreed Team Condition">
            <div className="agreement-triad">
              <div className="triad-item condition" style={{ flex: '2 1 400px' }}>
                <span className="triad-label">Agreed team condition</span>
                <span className="triad-value" style={{ fontStyle: 'italic', fontSize: '15px', lineHeight: 1.5 }}>
                  {agreedConditionSentence}
                </span>
              </div>
              <div className="triad-item freshness">
                <span className="triad-label">Source freshness</span>
                <span className="stat-indicator-badge clear">2m ago · fresh</span>
              </div>
              <div className="triad-item action">
                <span className="triad-label">Next action</span>
                <span className="triad-value-action">
                  {isCompleted
                    ? 'Pact Completed · Concluded in Past Plans'
                    : statusDisplay.label === 'Alert'
                    ? 'Review Breach Evidence Below'
                    : pact.can_current_user_approve
                    ? `Approve v${pact.version} (as ${activeUser?.user_name})`
                    : pact.status === 'armed'
                    ? 'Watch Active: Monitoring Commutes'
                    : 'Awaiting Counterpart Approval'}
                </span>
              </div>
            </div>
          </section>

          {/* 2. 4-step Stepper Decision Line */}
          <FourStepDecisionStepper
            statusDisplay={statusDisplay}
            maxMinutes={maxMinutes}
            consecutiveBreaches={statusDisplay.label === 'Alert' ? 2 : statusDisplay.label === 'Confirming 1/2' ? 1 : 0}
            deadlineIst={pact.decision_deadline_ist}
            countdownFormatted={countdownFormatted}
            fallbackText={pact.fallback_text}
          />

          {/* Live Alert Receipt & Decision Voting Section (Shown prominently when Alert is triggered) */}
          {(statusDisplay.label === 'Alert' || (currentReceipt && currentReceipt.pactId === pact.id)) && (
            <div className="overview-alert-receipt-section" style={{ margin: '4px 0 16px 0' }}>
              <EvidenceReceiptCard
                receipt={currentReceipt}
                activeUser={activeUser}
                onDecisionRecorded={() => {
                  loadData();
                  if (pact?.id) {
                    fetch(`/api/receipts/latest/pact/${pact.id}`)
                      .then((r) => r.json())
                      .then((data) => {
                        if (data.receipt) setPactReceipt(data.receipt);
                      })
                      .catch(() => {});
                  }
                }}
              />
            </div>
          )}

          {/* 3. Participant Cards */}
          <section aria-labelledby="participants-heading">
            <div className="section-title-row" style={{ marginBottom: '12px' }}>
              <h2 className="section-heading" id="participants-heading">
                Participants & Commute Limits
              </h2>
              <span className="stat-card-subtitle">
                Both approvals required to arm watch
              </span>
            </div>

            <div className="detail-participants-grid">
              {pact.participants.map((participant) => {
                const partVm = viewModel?.participants.find((vm) => vm.userId === participant.user_id);
                const limitMins = partVm ? partVm.limitMinutes : Math.round(participant.max_duration_s / 60);
                const isApproved = participant.approval_version === pact.version;
                const obsList = getParticipantObservations(participant);
                const latestEstimate = partVm ? partVm.currentMinutes : obsList[obsList.length - 1];
                const isBreached = partVm ? partVm.isBreached : latestEstimate > limitMins;

                return (
                  <div key={participant.id} className="detail-participant-card">
                    {/* Top: Name, Neighbourhood, Approval State */}
                    <div className="d-part-header">
                      <div>
                        <div className="d-part-name">{participant.user_name}</div>
                        <div className="d-part-hood">Starting near {participant.neighbourhood}</div>
                      </div>
                      <span className={`d-part-approval-pill ${isApproved ? 'approved' : 'pending'}`}>
                        {isApproved ? `✓ Approved v${participant.approval_version}` : `Pending v${pact.version}`}
                      </span>
                    </div>

                    {/* Metrics: Limit & Latest Duration */}
                    <div className="d-part-metrics-row">
                      <div className="d-metric-box">
                        <span className="d-metric-label">Commute Limit</span>
                        <span className="d-metric-val tabular-nums">{limitMins} min</span>
                      </div>
                      <div className="d-metric-box">
                        <span className="d-metric-label">Latest Duration</span>
                        <span className={`d-metric-val tabular-nums ${isBreached ? 'breach' : ''}`}>
                          {latestEstimate} min
                        </span>
                      </div>
                    </div>

                    {/* Mini SVG Sparkline with Limit Line Drawn */}
                    <MiniSvgSparkline
                      observations={obsList}
                      limitMinutes={limitMins}
                    />

                    {/* Freshness Label & Route summary */}
                    <div className="d-part-freshness-row">
                      <span className="stat-card-subtitle">
                        Route: {participant.neighbourhood} &rarr; {pact.destination_name}
                      </span>
                      <span className="freshness-pill fresh">
                        2 min ago, fresh
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. Remote Fallback Section */}
          <div className="fallback-card pact-panel-card" style={{ background: 'var(--paper-raised)', padding: '16px', border: '1px solid var(--rule)', borderRadius: 'var(--radius-panel)' }}>
            <div className="fallback-header">
              <span className="fallback-tag">Agreed Remote Fallback</span>
              <span className="fallback-venue">{pact.destination_name}</span>
            </div>
            <div className="fallback-text" style={{ fontStyle: 'italic', marginTop: '4px' }}>
              “{pact.fallback_text}”
            </div>
            <div className="fallback-note" style={{ marginTop: '8px', fontSize: '13px', color: 'var(--ink-secondary)' }}>
              If the 2-breach threshold is met before {pact.decision_deadline_ist.split('·')[0].trim()}, this action will be proposed to the team via chat notification receipt.
            </div>
          </div>
        </div>
      )}

      {/* Other Tabs (Evidence & Decision) */}
      {activeTab === 'evidence' && (
        <div className="tab-content-pane">
          <EvidencePanel
            pact={pact}
            onRefresh={() => loadData()}
            systemState={statusDisplay.label.toLowerCase()}
            sourceAge="2m ago"
          />
        </div>
      )}

      {activeTab === 'decision' && (
        <div className="tab-content-pane">
          <DecisionTab
            pact={pact}
            receipt={latestReceipt}
            activeUser={activeUser}
            onDecisionRecorded={() => loadData()}
            onSwitchToChat={() => setTab('activity')}
          />
        </div>
      )}

      {/* Editor Modal */}
      {editorMode && (
        <PactEditorModal
          pact={editorMode === 'edit' ? pact : null}
          mode={editorMode}
          onClose={() => {
            setEditorMode(null);
            setPendingVenue(null);
          }}
          onSave={handleSavePact}
          onOpenVenueSearch={() => setIsVenueSearchOpen(true)}
          selectedVenue={pendingVenue}
        />
      )}

      {/* Venue Search Modal */}
      {isVenueSearchOpen && (
        <VenueSearchModal
          onClose={() => setIsVenueSearchOpen(false)}
          onSelect={handleSelectVenue}
        />
      )}
    </div>
  );
}
