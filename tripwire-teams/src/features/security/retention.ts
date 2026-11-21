/**
 * Data Retention Maintenance Job
 *
 * Automatically purges commute checks older than 30 days:
 * DELETE FROM checks WHERE checked_at < NOW() - INTERVAL '30 days'
 * Enforces Rule 4: "Privacy by design... retention policy: checks older than 30 days are purged."
 */

import { recordAudit, AuditAction } from './auditLog.js';

export interface RetentionJobOptions {
  retentionDays?: number;
  now?: Date;
  dryRun?: boolean;
  recordAuditEntry?: boolean;
  dbClient?: RetentionDbClient;
}

export interface RetentionJobResult {
  success: boolean;
  deletedCount: number;
  cutoffDate: Date;
  durationMs: number;
  dryRun: boolean;
}

export interface RetentionDbClient {
  check?: {
    deleteMany: (args: { where: { checked_at: { lt: Date } } }) => Promise<{ count: number }>;
    count?: (args: { where: { checked_at: { lt: Date } } }) => Promise<number>;
  };
  query?: (sql: string, params: any[]) => Promise<{ rowCount?: number; rows?: any[] }>;
  $executeRawUnsafe?: (sql: string, ...params: any[]) => Promise<number>;
}

// In-memory check storage for tests / fallback
export interface MemoryCheck {
  id: string;
  plan_id: string;
  member_id: string;
  checked_at: Date;
  provider_timestamp?: Date;
  duration_s: number;
  baseline_s?: number;
  status: 'ok' | 'unknown';
  provenance: 'live' | 'simulated';
}

const memoryChecks: MemoryCheck[] = [];

export function addInMemoryChecks(checks: MemoryCheck[]): void {
  memoryChecks.push(...checks);
}

export function getInMemoryChecks(): MemoryCheck[] {
  return [...memoryChecks];
}

export function clearInMemoryChecks(): void {
  memoryChecks.length = 0;
}

/**
 * Executes the retention cleanup job.
 * Deletes checks where checked_at < NOW() - INTERVAL '30 days'.
 */
export async function runRetentionJob(
  options: RetentionJobOptions = {}
): Promise<RetentionJobResult> {
  const startTime = Date.now();
  const retentionDays = options.retentionDays ?? 30;
  const referenceTime = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  const shouldRecordAudit = options.recordAuditEntry ?? true;

  // Calculate cutoff timestamp: exactly retentionDays in the past
  const cutoffDate = new Date(referenceTime.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  let deletedCount = 0;
  const db = options.dbClient;

  if (db?.check?.deleteMany) {
    if (dryRun) {
      deletedCount = db.check.count ? await db.check.count({ where: { checked_at: { lt: cutoffDate } } }) : 0;
    } else {
      const res = await db.check.deleteMany({
        where: { checked_at: { lt: cutoffDate } },
      });
      deletedCount = res.count;
    }
  } else if (db?.query) {
    if (dryRun) {
      const res = await db.query(
        'SELECT COUNT(*) as count FROM checks WHERE checked_at < $1',
        [cutoffDate]
      );
      deletedCount = parseInt(res.rows?.[0]?.count ?? '0', 10);
    } else {
      const res = await db.query(
        'DELETE FROM checks WHERE checked_at < $1',
        [cutoffDate]
      );
      deletedCount = res.rowCount ?? res.rows?.length ?? 0;
    }
  } else {
    // In-memory purge
    const toDelete = memoryChecks.filter((c) => c.checked_at.getTime() < cutoffDate.getTime());
    deletedCount = toDelete.length;

    if (!dryRun) {
      const remaining = memoryChecks.filter((c) => c.checked_at.getTime() >= cutoffDate.getTime());
      memoryChecks.length = 0;
      memoryChecks.push(...remaining);
    }
  }

  // Record audit trail of the maintenance action
  if (shouldRecordAudit && !dryRun) {
    await recordAudit(
      'system',
      AuditAction.RETENTION_PURGE,
      'retention_job_scheduler',
      'table:checks',
      {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        deletedCount,
      }
    );
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    deletedCount,
    cutoffDate,
    durationMs,
    dryRun,
  };
}
