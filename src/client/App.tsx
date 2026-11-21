import { useEffect, useState, useCallback } from 'react';
import type { HealthResponse, PactDetails, TeamMember } from './types';
import { TopBar } from './components/TopBar';
import { PactList } from './components/PactList';
import { DecisionLine } from './components/DecisionLine';
import { ParticipantCard } from './components/ParticipantCard';
import { EvidencePanel } from './components/EvidencePanel';
import { EvidenceReceiptCard } from './components/EvidenceReceiptCard';
import { PactEditorModal } from './components/PactEditorModal';
import { VenueSearchModal, type VerifiedPlace } from './components/VenueSearchModal';
import { NexconnChat } from './components/NexconnChat';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activeUser, setActiveUser] = useState<TeamMember | null>(null);
  const [pacts, setPacts] = useState<PactDetails[]>([]);
  const [selectedPactId, setSelectedPactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestReceipt, setLatestReceipt] = useState<any | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isVenueSearchOpen, setIsVenueSearchOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'pact' | 'evidence' | 'chat'>('pact');

  // Load session and pacts for current user
  const loadData = useCallback(async (currentUserId?: string) => {
    try {
      const sessionRes = await fetch('/api/session');
      const sessionData = await sessionRes.json();
      setTeamMembers(sessionData.members || []);

      const chosenUser = currentUserId
        ? (sessionData.members || []).find((m: TeamMember) => m.user_id === currentUserId) || sessionData.activeUser
        : sessionData.activeUser;
      setActiveUser(chosenUser);

      const userIdToUse = chosenUser?.user_id || 'user_maya';

      // Fetch health
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }

      // Fetch pacts with explicit user header
      const pactsRes = await fetch('/api/pacts', {
        headers: { 'x-user-id': userIdToUse },
      });
      if (pactsRes.ok) {
        const pactsData = await pactsRes.json();
        setPacts(pactsData.pacts || []);
        const targetPactId = selectedPactId || pactsData.pacts?.[0]?.id;
        if (pactsData.pacts?.length > 0 && !selectedPactId) {
          setSelectedPactId(pactsData.pacts[0].id);
        }

        if (targetPactId) {
          const rRes = await fetch(`/api/receipts/latest/pact/${targetPactId}`);
          if (rRes.ok) {
            const rData = await rRes.json();
            setLatestReceipt(rData.receipt || null);
          } else {
            setLatestReceipt(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPactId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSwitchUser = async (userId: string) => {
    try {
      await fetch('/api/session/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      await loadData(userId);
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const handleApprove = async () => {
    if (!selectedPactId || !activeUser) return;
    try {
      const res = await fetch(`/api/pacts/${selectedPactId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      setActionNotice(data.message);
      await loadData(activeUser.user_id);
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    }
  };

  const handleSavePact = async (updates: any) => {
    if (!selectedPactId || !activeUser) return;
    const res = await fetch(`/api/pacts/${selectedPactId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': activeUser.user_id,
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setActionNotice(data.message);
    await loadData(activeUser.user_id);
  };

  const handleSelectVenue = async (place: VerifiedPlace) => {
    if (!selectedPactId || !activeUser) return;
    await handleSavePact({
      destination_name: place.title,
      destination_place_id: place.place_id,
      destination_address: place.address,
      destination_lat: place.gps_coordinates.latitude,
      destination_lon: place.gps_coordinates.longitude,
    });
  };

  const selectedPact = pacts.find((p) => p.id === selectedPactId) || pacts[0] || null;
  const maxMinutes = selectedPact
    ? Math.max(...selectedPact.participants.map((p) => Math.round(p.max_duration_s / 60)))
    : 60;

  const nowEpoch = Math.floor(Date.now() / 1000);
  const isStale = Boolean(selectedPact?.latest_source_at && (nowEpoch - selectedPact.latest_source_at > 300));

  // Derive systemState for visual audit
  const systemState = latestReceipt?.outboxStatus === 'pending'
    ? 'delivery_pending'
    : latestReceipt
    ? 'alert'
    : selectedPact?.status === 'paused'
    ? 'budget_paused'
    : selectedPact?.consecutive_breaches === 1
    ? 'confirming'
    : isStale
    ? 'stale'
    : selectedPact?.status || 'draft';

  return (
    <div className="app-container">
      <TopBar
        health={health}
        activeUser={activeUser}
        allMembers={teamMembers}
        onSwitchUser={handleSwitchUser}
      />

      {/* Mobile Tab Navigation */}
      <nav className="mobile-tabs" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-tab ${mobileTab === 'pact' ? 'active' : ''}`}
          onClick={() => setMobileTab('pact')}
        >
          Pact Agreement
        </button>
        <button
          type="button"
          className={`mobile-tab ${mobileTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setMobileTab('evidence')}
        >
          Evidence Receipt {latestReceipt ? '●' : ''}
        </button>
        <button
          type="button"
          className={`mobile-tab ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileTab('chat')}
        >
          Conversation
        </button>
      </nav>

      <div className="main-layout">
        {/* 224px Pact List Sidebar (hidden on small screen when on evidence/chat tab) */}
        <div className={`pact-sidebar-slot ${mobileTab !== 'pact' ? 'mobile-hidden' : ''}`}>
          <PactList
            pacts={pacts}
            selectedPactId={selectedPactId}
            onSelectPact={(id) => {
              setSelectedPactId(id);
              setActionNotice(null);
            }}
            onNewPact={() => setIsEditorOpen(true)}
          />
        </div>

        {/* Primary Agreement / Evidence Workspace (>=560px) */}
        <main className={`primary-workspace ${mobileTab === 'chat' ? 'mobile-hidden' : ''}`}>
          {actionNotice && (
            <div className="action-notification" role="status">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} aria-label="Dismiss notice">×</button>
            </div>
          )}

          {loading ? (
            <div className="pact-panel-card">
              <p style={{ fontStyle: 'italic' }}>Loading team pacts...</p>
            </div>
          ) : selectedPact ? (
            <div className="workspace-content">
              {/* Main Pact Agreement section: shown on desktop or on mobile 'pact' tab */}
              <div className={`pact-primary-view ${mobileTab === 'evidence' ? 'mobile-hidden' : ''}`}>
                {/* Header Box */}
                <div className="pact-header-card">
                  <div className="pact-title-row">
                    <div>
                      <h1 className="pact-main-title">{selectedPact.title}</h1>
                      <div className="pact-subtitle">
                        Destination: <strong>{selectedPact.destination_name}</strong> · Decide by <strong>{selectedPact.decision_deadline_ist}</strong>
                      </div>
                    </div>
                    <div className="pact-version-badge">
                      <span className="version-pill">VERSION {selectedPact.version}</span>
                      <span className={`status-pill ${selectedPact.status}`}>
                        {selectedPact.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* 5-Second Legibility Triad */}
                  <div className="plain-agreement-callout">
                    <div className="agreement-triad">
                      <div className="triad-item condition">
                        <span className="triad-label">Agreed Team Condition</span>
                        <span className="triad-value">
                          “Reconsider if either commute exceeds {maxMinutes}m twice before {selectedPact.decision_deadline_ist.split('·')[0].trim()}.”
                        </span>
                      </div>
                      <div className="triad-item freshness">
                        <span className="triad-label">Source Age</span>
                        <span className="triad-value-badge fresh">2m ago · fresh</span>
                      </div>
                      <div className="triad-item action">
                        <span className="triad-label">Next Action</span>
                        <span className="triad-value-action">
                          {selectedPact.can_current_user_approve
                            ? `Approve v${selectedPact.version} (as ${activeUser?.user_name})`
                            : latestReceipt
                            ? 'Review Breach Evidence Below'
                            : selectedPact.status === 'armed'
                            ? 'Monitoring Commute Estimates'
                            : 'Awaiting Counterpart Approval'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Signature Decision Line */}
                  <DecisionLine
                    maxDurationMinutes={maxMinutes}
                    deadlineIst={selectedPact.decision_deadline_ist}
                    isArmed={selectedPact.status === 'armed'}
                    status={selectedPact.status}
                    consecutiveBreaches={latestReceipt ? 2 : 0}
                  />
                </div>

                {/* Participants Section */}
                <div className="pact-panel-card">
                  <div className="section-header-row">
                    <h2 className="section-title">Participants & Commute Limits</h2>
                    <span className="section-hint">Both approvals required to arm watch</span>
                  </div>

                  <div className="participants-grid">
                    {selectedPact.participants.map((p) => (
                      <ParticipantCard
                        key={p.id}
                        participant={p}
                        currentPactVersion={selectedPact.version}
                        currentEstimateMinutes={p.user_id === 'user_maya' && latestReceipt ? 72 : p.user_id === 'user_maya' ? 42 : 34}
                        sourceAge="2m ago"
                      />
                    ))}
                  </div>

                  {/* Action Bar */}
                  <div className="approval-action-bar">
                    <div className="approval-status-message">
                      {selectedPact.status === 'armed' ? (
                        <span className="armed-indicator">
                          ● All participants have approved v{selectedPact.version}. Watch is actively monitoring.
                        </span>
                      ) : selectedPact.is_current_user_approved ? (
                        <span className="approved-indicator">
                          ✓ You have approved v{selectedPact.version}. Awaiting counterpart approval to arm.
                        </span>
                      ) : (
                        <span className="pending-indicator">
                          Action required: Review rules above and approve version {selectedPact.version}.
                        </span>
                      )}
                    </div>

                    <div className="button-group">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setIsEditorOpen(true)}
                      >
                        Edit Agreement
                      </button>

                      {selectedPact.can_current_user_approve && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleApprove}
                        >
                          Approve v{selectedPact.version} (as {activeUser?.user_name})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remote Fallback Section */}
                <div className="pact-panel-card fallback-card">
                  <div className="fallback-header">
                    <span className="fallback-tag">Agreed Remote Fallback</span>
                    <span className="fallback-venue">{selectedPact.destination_name}</span>
                  </div>
                  <div className="fallback-text">
                    “{selectedPact.fallback_text}”
                  </div>
                  <div className="fallback-note">
                    If the 2-breach threshold is met before {selectedPact.decision_deadline_ist.split('·')[0].trim()}, this action will be proposed to the team via Nexconn chat receipt.
                  </div>
                </div>
              </div>

              {/* Evidence Section: shown on desktop or on mobile 'evidence' tab */}
              <div className={`evidence-primary-view ${mobileTab === 'pact' ? 'mobile-hidden' : ''}`}>
                {/* Evidence Receipt Component (Alert Active) */}
                {latestReceipt && (
                  <EvidenceReceiptCard
                    receipt={latestReceipt}
                    activeUser={activeUser}
                    onDecisionRecorded={() => loadData(activeUser?.user_id)}
                  />
                )}

                {/* Evidence & Verification Section */}
                <EvidencePanel
                  pact={selectedPact}
                  onRefresh={() => loadData(activeUser?.user_id)}
                  systemState={systemState}
                  sourceAge="2m ago"
                />
              </div>
            </div>
          ) : (
            <div className="empty-workspace-state">
              <h2>No Pact Selected</h2>
              <p>Create your first team agreement to start monitoring.</p>
              <button className="btn-primary" onClick={() => setIsEditorOpen(true)}>
                Create New Pact
              </button>
            </div>
          )}
        </main>

        {/* 336px Nexconn Conversation Slot */}
        <aside className={`conversation-slot ${mobileTab !== 'chat' ? 'mobile-hidden' : ''}`}>
          <NexconnChat pact={selectedPact} activeUser={activeUser} />
        </aside>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      {selectedPact && (
        <div className="mobile-bottom-action-bar" role="region" aria-label="Mobile Quick Action Bar">
          <div className="m-action-user">
            Acting as <strong>{activeUser?.user_name}</strong>
          </div>
          <div className="m-action-button-slot">
            {selectedPact.can_current_user_approve ? (
              <button
                type="button"
                className="btn-primary-sm"
                onClick={handleApprove}
              >
                Approve v{selectedPact.version}
              </button>
            ) : latestReceipt ? (
              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => setMobileTab('evidence')}
              >
                View Evidence
              </button>
            ) : selectedPact.status === 'armed' ? (
              <span className="m-armed-pill">● Armed</span>
            ) : (
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => setIsEditorOpen(true)}
              >
                Edit Pact
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pact Editor Modal */}
      {isEditorOpen && selectedPact && (
        <PactEditorModal
          pact={selectedPact}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSavePact}
          onOpenVenueSearch={() => setIsVenueSearchOpen(true)}
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
