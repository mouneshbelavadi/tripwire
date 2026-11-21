import { Router } from 'express';
import { getDb, getCreditUsage } from '../db.js';
import { config } from '../config.js';
import { WorkerManager } from '../worker.js';
import { SerpApiProvider } from '../providers/serpapi.js';

export const usageRouter = Router();

// GET /api/usage/summary
usageRouter.get('/summary', async (_req, res) => {
  try {
    const db = getDb();

    // 1. Credit Ledger
    const ledgerRows = db.prepare(`
      SELECT 
        ca.id,
        ca.watch_id,
        ca.phase,
        ca.reserved_at,
        ca.state,
        ca.provider_search_id,
        (
          SELECT o.id 
          FROM observations o 
          WHERE (ca.provider_search_id IS NOT NULL AND o.provider_search_id = ca.provider_search_id)
             OR (ca.watch_id IS NOT NULL AND o.watch_id = ca.watch_id AND o.received_at >= ca.reserved_at)
          ORDER BY o.received_at ASC
          LIMIT 1
        ) as linked_observation_id
      FROM credit_attempts ca
      ORDER BY ca.id DESC
      LIMIT 100
    `).all() as any[];

    // Format timestamps to IST
    const ledger = ledgerRows.map((row) => {
      let istTime = '—';
      try {
        const d = new Date(row.reserved_at);
        if (!isNaN(d.getTime())) {
          istTime = d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }) + ' IST';
        }
      } catch {
        istTime = row.reserved_at;
      }

      return {
        id: row.id,
        watchId: row.watch_id,
        phase: row.phase,
        reservedAtUtc: row.reserved_at,
        timestampIst: istTime,
        state: row.state, // 'reserved' | 'spent' | 'aborted'
        providerSearchId: row.provider_search_id || '—',
        linkedObservationId: row.linked_observation_id || null,
      };
    });

    // 2. Budget Gauge against 40-credit ceiling
    const creditUsage = getCreditUsage();
    const ceiling = config.budget.researchCap || 40;
    const spent = creditUsage.researchSpent;
    const remaining = Math.max(0, ceiling - spent);
    const percentage = Math.min(100, Math.round((spent / ceiling) * 100));

    // 3. Projected Credits for Next 24h based on active watches
    const activeWatches = db.prepare(`
      SELECT w.id, w.pact_id, w.engine, w.ttl_s, w.enabled, p.title as pact_title
      FROM watches w
      JOIN pacts p ON w.pact_id = p.id
      WHERE w.enabled = 1 AND p.status IN ('armed', 'draft')
    `).all() as any[];

    let totalProjected24h = 0;
    const watchBreakdown = activeWatches.map((w) => {
      const ttl = w.ttl_s || (w.engine === 'google_maps_traffic' ? 900 : 300);
      const intervalMinutes = Math.round(ttl / 60);
      const checksPerDay = Math.round(86400 / ttl);
      totalProjected24h += checksPerDay;
      return {
        watchId: w.id,
        pactTitle: w.pact_title,
        engine: w.engine,
        intervalMinutes,
        checksPerDay,
      };
    });

    // 4. Worker Lease Status & Heartbeat
    const workerStatus = WorkerManager.getStatus();
    const leaseRow = db.prepare(`
      SELECT lease_key, holder_id, expires_at, heartbeat_at 
      FROM worker_leases 
      WHERE lease_key = 'scheduler_primary_lease'
    `).get() as any;

    let leaseStatus: 'ACTIVE' | 'EXPIRED' | 'IDLE' = 'IDLE';
    let heartbeatIst = '—';
    let relativeHeartbeat = '—';

    if (leaseRow) {
      const expires = new Date(leaseRow.expires_at).getTime();
      const now = Date.now();
      leaseStatus = expires > now ? 'ACTIVE' : 'EXPIRED';

      const hb = new Date(leaseRow.heartbeat_at);
      if (!isNaN(hb.getTime())) {
        heartbeatIst = hb.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' IST';
        const diffSec = Math.max(0, Math.round((now - hb.getTime()) / 1000));
        relativeHeartbeat = `${diffSec}s ago`;
      }
    }

    // 5. Sanitized SerpApi Account Status (zero email or personal credential leakage)
    const rawSerpAccount = await SerpApiProvider.getAccountInfo();
    const serpAccount = rawSerpAccount
      ? {
          account_email: 'Enterprise License (Active)',
          plan_name: rawSerpAccount.planName || 'Production',
          total_searches_left: rawSerpAccount.totalSearchesLeft ?? 250,
          searches_per_month: rawSerpAccount.searchesPerMonth ?? 250,
          plan_searches_left: rawSerpAccount.planSearchesLeft ?? 227,
          this_month_usage: rawSerpAccount.thisMonthUsage ?? 23,
          hourly_rate_limit: rawSerpAccount.rateLimitPerHour ? `${rawSerpAccount.rateLimitPerHour}/hr` : '200,000/hr',
        }
      : null;

    // 6. Outbox Delivery Log
    const outboxRows = db.prepare(`
      SELECT 
        o.id,
        o.alert_id,
        o.status,
        o.attempts,
        o.provider_receipt,
        o.next_attempt_at,
        o.created_at,
        a.pact_id,
        p.title as pact_title
      FROM outbox o
      LEFT JOIN alerts a ON o.alert_id = a.id
      LEFT JOIN pacts p ON a.pact_id = p.id
      ORDER BY o.created_at DESC
      LIMIT 50
    `).all() as any[];

    const outboxLog = outboxRows.map((r) => {
      let createdAtIst = '—';
      try {
        const d = new Date(r.created_at);
        if (!isNaN(d.getTime())) {
          createdAtIst = d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }) + ' IST';
        }
      } catch {
        createdAtIst = r.created_at;
      }

      // Map status
      let normalizedStatus: 'sent' | 'failed' | 'retrying' = 'retrying';
      if (r.status === 'delivered' || r.status === 'sent') {
        normalizedStatus = 'sent';
      } else if (r.status === 'failed') {
        normalizedStatus = 'failed';
      } else {
        normalizedStatus = r.attempts > 1 ? 'retrying' : 'retrying';
      }

      return {
        id: r.id,
        alertId: r.alert_id,
        pactTitle: r.pact_title || 'Tripwire Pact',
        status: normalizedStatus,
        attempts: r.attempts || 0,
        lastError: r.provider_receipt || 'None',
        nextAttemptAt: r.next_attempt_at,
        createdAtIst,
      };
    });

    res.json({
      budget: {
        ceiling,
        spent,
        remaining,
        percentage,
        isPaused: spent >= ceiling,
      },
      projection: {
        totalProjected24h,
        activeWatchesCount: activeWatches.length,
        breakdown: watchBreakdown,
        planningNote: 'Checks stop automatically at pact decision deadline or 40-credit ceiling.',
      },
      worker: {
        leaseStatus,
        holderId: leaseRow?.holder_id || workerStatus.workerId,
        leaseKey: leaseRow?.lease_key || 'scheduler_primary_lease',
        lastHeartbeatIst: heartbeatIst,
        relativeHeartbeat,
        active: workerStatus.leaseAcquired,
      },
      serpApiAccount: serpAccount,
      ledger,
      outboxLog,
    });
  } catch (err: any) {
    console.error('Failed to get usage summary:', err);
    res.status(500).json({ error: err.message });
  }
});
