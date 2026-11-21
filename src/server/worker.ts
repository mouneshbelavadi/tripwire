import crypto from 'crypto';
import { getDb } from './db.js';
import { WatchScheduler } from './scheduler/watchScheduler.js';
import { OutboxWorker } from './scheduler/outboxWorker.js';

export class WorkerManager {
  private static instanceId: string = crypto.randomUUID();
  private static leaseKey: string = 'scheduler_primary_lease';
  private static leaseDurationMs: number = 15000; // 15 seconds
  private static timer: NodeJS.Timeout | null = null;
  private static hasLease: boolean = false;
  private static lastHeartbeat: string | null = null;

  static start(): void {
    if (this.timer) return;
    this.tryAcquireOrRenewLease();

    // Run tick loop every 4 seconds
    this.timer = setInterval(async () => {
      this.tryAcquireOrRenewLease();
      if (this.hasLease) {
        try {
          await WatchScheduler.tick();
          await OutboxWorker.tick();
        } catch (err) {
          console.error('[WorkerManager] Tick execution error:', err);
        }
      }
    }, 4000);
  }

  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.releaseLease();
  }

  static getStatus() {
    return {
      status: this.hasLease ? ('active' as const) : ('inactive' as const),
      leaseAcquired: this.hasLease,
      lastHeartbeat: this.lastHeartbeat,
      workerId: this.instanceId,
      scheduler: WatchScheduler.getStatus(),
      outbox: OutboxWorker.getStatus(),
    };
  }

  static tryAcquireOrRenewLease(): boolean {
    try {
      const db = getDb();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.leaseDurationMs).toISOString();
      const nowIso = now.toISOString();

      const existing = db
        .prepare('SELECT holder_id, expires_at FROM worker_leases WHERE lease_key = ?')
        .get(this.leaseKey) as { holder_id: string; expires_at: string } | undefined;

      if (!existing) {
        db.prepare(
          'INSERT INTO worker_leases (lease_key, holder_id, expires_at, heartbeat_at) VALUES (?, ?, ?, ?)'
        ).run(this.leaseKey, this.instanceId, expiresAt, nowIso);
        this.hasLease = true;
        this.lastHeartbeat = nowIso;
      } else if (existing.holder_id === this.instanceId) {
        db.prepare(
          'UPDATE worker_leases SET expires_at = ?, heartbeat_at = ? WHERE lease_key = ? AND holder_id = ?'
        ).run(expiresAt, nowIso, this.leaseKey, this.instanceId);
        this.hasLease = true;
        this.lastHeartbeat = nowIso;
      } else if (new Date(existing.expires_at) < now) {
        db.prepare(
          'UPDATE worker_leases SET holder_id = ?, expires_at = ?, heartbeat_at = ? WHERE lease_key = ?'
        ).run(this.instanceId, expiresAt, nowIso, this.leaseKey);
        this.hasLease = true;
        this.lastHeartbeat = nowIso;
      } else {
        this.hasLease = false;
      }
    } catch (err) {
      console.error('[WorkerManager] Failed to acquire/renew worker lease:', err);
      this.hasLease = false;
    }
    return this.hasLease;
  }

  private static releaseLease(): void {
    try {
      if (this.hasLease) {
        const db = getDb();
        db.prepare('DELETE FROM worker_leases WHERE lease_key = ? AND holder_id = ?').run(
          this.leaseKey,
          this.instanceId
        );
        this.hasLease = false;
      }
    } catch (err) {
      console.error('[WorkerManager] Error releasing worker lease:', err);
    }
  }
}
