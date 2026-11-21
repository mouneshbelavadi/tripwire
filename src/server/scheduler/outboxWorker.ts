import { getDb } from '../db.js';
import { config } from '../config.js';

export interface OutboxStatus {
  pendingCount: number;
  deliveredCount: number;
  failedCount: number;
}

export class OutboxWorker {
  static getStatus(): OutboxStatus {
    const db = getDb();
    const rows = db.prepare(`
      SELECT status, COUNT(*) as count FROM outbox GROUP BY status
    `).all() as Array<{ status: string; count: number }>;

    let pending = 0;
    let delivered = 0;
    let failed = 0;

    for (const r of rows) {
      if (r.status === 'pending') pending = Number(r.count);
      if (r.status === 'delivered') delivered = Number(r.count);
      if (r.status === 'failed') failed = Number(r.count);
    }

    return {
      pendingCount: pending,
      deliveredCount: delivered,
      failedCount: failed,
    };
  }

  /**
   * Processes pending delivery jobs from the outbox with capped retries and jitter.
   */
  static async tick(): Promise<number> {
    const db = getDb();
    const now = new Date();
    const nowIso = now.toISOString();

    const pendingJobs = db
      .prepare(`
        SELECT o.*, a.pact_id, a.episode_id, p.title as pact_title, p.fallback_text
        FROM outbox o
        JOIN alerts a ON o.alert_id = a.id
        JOIN pacts p ON a.pact_id = p.id
        WHERE o.status = 'pending'
          AND o.next_attempt_at <= ?
        LIMIT 5
      `)
      .all(nowIso) as any[];

    if (pendingJobs.length === 0) return 0;

    for (const job of pendingJobs) {
      const attempts = (job.attempts || 0) + 1;

      // Invariant: If Nexconn credentials missing, retain as 'pending' with explicit note.
      // Do NOT invent fake delivery or mark 'delivered' optimistically.
      if (!config.nexconn.isConfigured) {
        db.prepare(`
          UPDATE outbox
          SET attempts = ?,
              provider_receipt = 'Delivery pending: Nexconn credentials pending in .env',
              next_attempt_at = datetime('now', '+30 seconds')
          WHERE id = ?
        `).run(attempts, job.id);
        continue;
      }

      try {
        // Prepare alert delivery payload
        const alertText = `🚨 Tripwire: Office Pact Alert for "${job.pact_title}"\nTwo consecutive checks exceeded agreed commute threshold.\nSuggested Action: ${job.fallback_text}`;

        const base = config.nexconn.apiBase!.replace(/\/$/, '');
        // Example delivery dispatch (reconciling server group-send contract)
        const response = await fetch(`${base}/v4/group-channel/message/send`, {
          method: 'POST',
          headers: {
            'App-Key': config.nexconn.appKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId: 'group_office_pact',
            content: { text: alertText },
          }),
        });

        if (response.ok) {
          const resData = (await response.json()) as any;
          db.prepare(`
            UPDATE outbox
            SET status = 'delivered',
                attempts = ?,
                provider_receipt = ?
            WHERE id = ?
          `).run(attempts, JSON.stringify(resData), job.id);
        } else {
          throw new Error(`Nexconn HTTP ${response.status}`);
        }
      } catch (err: any) {
        if (attempts >= 3) {
          db.prepare(`
            UPDATE outbox
            SET status = 'failed',
                attempts = ?,
                provider_receipt = ?
            WHERE id = ?
          `).run(attempts, `Delivery failed after 3 attempts: ${err.message}`, job.id);
        } else {
          // Exponential backoff with jitter
          const backoffSec = Math.floor(Math.pow(2, attempts) * 2 + Math.random() * 2);
          const nextAttempt = new Date(now.getTime() + backoffSec * 1000).toISOString();
          db.prepare(`
            UPDATE outbox
            SET attempts = ?,
                next_attempt_at = ?,
                provider_receipt = ?
            WHERE id = ?
          `).run(attempts, nextAttempt, `Attempt ${attempts} failed: ${err.message}`, job.id);
        }
      }
    }

    return pendingJobs.length;
  }
}
