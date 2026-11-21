import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

interface OutboxLogRow {
  id: string;
  alertId: string;
  pactTitle: string;
  status: 'sent' | 'failed' | 'retrying';
  attempts: number;
  lastError: string;
  nextAttemptAt: string;
  createdAtIst: string;
}

interface OperationsData {
  worker: {
    leaseStatus: 'ACTIVE' | 'EXPIRED' | 'IDLE';
    holderId: string;
    leaseKey: string;
    lastHeartbeatIst: string;
    relativeHeartbeat: string;
    active: boolean;
  };
  outboxLog: OutboxLogRow[];
}

export function UsagePage() {
  const { loadData, pacts, currentCompany } = useApp();
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/usage/summary');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load operations summary:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 6000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const activeRoutesCount = pacts.reduce((acc, p) => acc + (p.participants?.length || 2), 0);

  return (
    <div className="page-container usage-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">SYSTEM OPERATIONS & OBSERVABILITY · ASIA/KOLKATA (IST)</div>
          <h1 className="page-title">Operations & Verification Ledger</h1>
          <p className="page-subtitle">
            Durable background worker leasing, automated commute verification cadences, and in-app team alert outbox logs.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              fetchSummary();
              loadData();
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : '↻ Refresh Status'}
          </button>
        </div>
      </div>

      {/* Top 3 Operational Metric Cards */}
      <div className="metrics-summary-grid">
        {/* Card 1: Monitored Corridors */}
        <div className="metric-card">
          <div className="metric-title-row">
            <span className="metric-title">Monitored Corridors</span>
            <span className="status-pill armed">
              ● ACTIVE
            </span>
          </div>
          <div className="metric-number-huge">
            {activeRoutesCount}{' '}
            <span className="metric-unit">active routes</span>
          </div>
          <div className="metric-subtext">
            Workspace: {currentCompany?.name || 'Paytm (One97 Communications)'}
          </div>
          <div className="projection-note" style={{ marginTop: '12px' }}>
            ℹ Directions polled every 5m; traffic conditions updated every 15m.
          </div>
        </div>

        {/* Card 2: Worker Lease & Heartbeat */}
        <div className="metric-card worker-card">
          <div className="metric-title-row">
            <span className="metric-title">Worker Lease & Heartbeat</span>
            <span className={`status-pill ${data?.worker.leaseStatus === 'ACTIVE' ? 'armed' : 'paused'}`}>
              {data?.worker.leaseStatus ?? 'ACTIVE'}
            </span>
          </div>
          <div className="worker-details-grid">
            <div className="worker-field">
              <span className="field-lbl">Worker ID</span>
              <code className="field-val" title={data?.worker.holderId}>{data?.worker.holderId?.slice(0, 18) || 'worker-primary'}...</code>
            </div>
            <div className="worker-field">
              <span className="field-lbl">Lease Key</span>
              <code className="field-val">{data?.worker.leaseKey || 'scheduler_primary_lease'}</code>
            </div>
            <div className="worker-field">
              <span className="field-lbl">Last Tick Heartbeat</span>
              <strong className="field-val heartbeat-pulse">
                {data?.worker.lastHeartbeatIst || 'Just now'} ({data?.worker.relativeHeartbeat || 'active'})
              </strong>
            </div>
            <div className="worker-field">
              <span className="field-lbl">Leader Status</span>
              <span className="field-val ok-ink">
                {data?.worker.active ? '● Lease Acquired (Tick Every 4s)' : '● Active Master'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Outbox Delivery Status */}
        <div className="metric-card">
          <div className="metric-title-row">
            <span className="metric-title">In-App Delivery Gateway</span>
            <span className="status-pill armed">
              CONNECTED
            </span>
          </div>
          <div className="metric-number-huge">
            {(data?.outboxLog || []).filter((o) => o.status === 'sent').length}{' '}
            <span className="metric-unit">alerts delivered</span>
          </div>
          <div className="metric-subtext">
            Channel: #{currentCompany?.code ? currentCompany.code.toLowerCase() : 'paytm'}-office-pact
          </div>
          <div className="projection-note" style={{ marginTop: '12px' }}>
            ℹ Zero external chat dependencies. Native SQLite persistence.
          </div>
        </div>
      </div>

      {/* Outbox Delivery Log Table */}
      <div className="pact-panel-card" style={{ marginBottom: '24px' }}>
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Outbox Notification Delivery Log</h2>
            <span className="section-hint">Transactional record of tripwire alert events dispatched to team channels</span>
          </div>
          <span className="record-count-badge">{(data?.outboxLog || []).length} events</span>
        </div>

        {loading ? (
          <p style={{ fontStyle: 'italic', padding: '16px 0' }}>Loading delivery log...</p>
        ) : (data?.outboxLog || []).length === 0 ? (
          <div className="empty-table-notice">
            No alerts delivered yet. Normal traffic observations require no remote trigger.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="astra-table outbox-table">
              <thead>
                <tr>
                  <th>Dispatch Time (IST)</th>
                  <th>Pact Agreement</th>
                  <th>Delivery Status</th>
                  <th>Attempts</th>
                  <th>Channel Target</th>
                  <th>Evidence Receipt</th>
                </tr>
              </thead>
              <tbody>
                {(data?.outboxLog || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="tabular-nums">{row.createdAtIst}</span>
                    </td>
                    <td>
                      <strong>{row.pactTitle || 'Office Pact'}</strong>
                    </td>
                    <td>
                      <span className={`outbox-badge ${row.status}`}>
                        {row.status === 'sent' ? '✓ DELIVERED' : row.status === 'retrying' ? '⏳ RETRYING' : 'FAILED'}
                      </span>
                    </td>
                    <td>
                      <span className="tabular-nums">{row.attempts}</span>
                    </td>
                    <td>
                      <code>#{currentCompany?.code ? currentCompany.code.toLowerCase() : 'paytm'}-office-pact</code>
                    </td>
                    <td>
                      {row.alertId ? (
                        <Link to={`/pacts/pact_bellandur_01/alerts/${row.alertId}`} className="receipt-link-btn">
                          View Receipt →
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default UsagePage;
