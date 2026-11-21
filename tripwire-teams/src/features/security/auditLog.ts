/**
 * Immutable Audit Logging
 *
 * Records all critical events (calendar updates, decision clicks, data deletions,
 * Slack notifications) to the audit_log table.
 * Enforces Rule 6: "Every external action is idempotent and written to an audit_log table."
 */

import { scrubObject } from './logScrubber.js';
import { assertTenantIsolation } from './workspaceIsolation.js';

export const AuditAction = {
  CALENDAR_UPDATE: 'CALENDAR_UPDATE',
  DECISION_CLICK: 'DECISION_CLICK',
  DATA_DELETION: 'DATA_DELETION',
  SLACK_POST: 'SLACK_POST',
  MEMBER_OPT_IN: 'MEMBER_OPT_IN',
  MEMBER_FORGET: 'MEMBER_FORGET',
  PLAN_CREATE: 'PLAN_CREATE',
  PLAN_UPDATE: 'PLAN_UPDATE',
  RETENTION_PURGE: 'RETENTION_PURGE',
  WORKSPACE_UNINSTALL: 'WORKSPACE_UNINSTALL',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction] | string;

export interface AuditRecord {
  id: string;
  workspace_id: string;
  action_type: AuditActionType;
  actor_slack_user_id: string;
  target_entity: string;
  details: Record<string, any>;
  created_at: Date;
}

export interface AuditDbClient {
  audit_log?: {
    create: (args: { data: Omit<AuditRecord, 'id' | 'created_at'> }) => Promise<AuditRecord>;
    findMany?: (args: { where: Record<string, any>; orderBy?: any }) => Promise<AuditRecord[]>;
  };
  query?: (sql: string, params: any[]) => Promise<{ rows: any[] }>;
  $executeRawUnsafe?: (sql: string, ...params: any[]) => Promise<any>;
}

// In-memory audit storage fallback (useful for tests or standalone operation)
const memoryAuditLog: AuditRecord[] = [];
let defaultDbClient: AuditDbClient | null = null;

export function setAuditDbClient(client: AuditDbClient | null): void {
  defaultDbClient = client;
}

export function clearInMemoryAuditLog(): void {
  memoryAuditLog.length = 0;
}

export function getInMemoryAuditRecords(workspaceId?: string): AuditRecord[] {
  if (workspaceId) {
    return memoryAuditLog.filter((r) => r.workspace_id === workspaceId);
  }
  return [...memoryAuditLog];
}

/**
 * Records an entry into the audit_log table.
 * Sanitizes details automatically using logScrubber to guarantee zero credential/coordinate leakage.
 */
export async function recordAudit(
  workspaceId: string,
  actionType: AuditActionType,
  actorSlackUserId: string,
  targetEntity: string,
  details: Record<string, any> = {},
  client?: AuditDbClient
): Promise<AuditRecord> {
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error('Audit log error: workspaceId is required');
  }
  if (!actionType || typeof actionType !== 'string') {
    throw new Error('Audit log error: actionType is required');
  }
  if (!actorSlackUserId || typeof actorSlackUserId !== 'string') {
    throw new Error('Audit log error: actorSlackUserId is required');
  }
  if (!targetEntity || typeof targetEntity !== 'string') {
    throw new Error('Audit log error: targetEntity is required');
  }

  // Sanitize details deeply: remove any credentials, raw coordinates, or user emails
  const sanitizedDetails = scrubObject(details ?? {});

  const auditEntry: AuditRecord = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    workspace_id: workspaceId,
    action_type: actionType,
    actor_slack_user_id: actorSlackUserId,
    target_entity: targetEntity,
    details: sanitizedDetails,
    created_at: new Date(),
  };

  const activeClient = client || defaultDbClient;

  if (activeClient) {
    if (activeClient.audit_log?.create) {
      const created = await activeClient.audit_log.create({
        data: {
          workspace_id: auditEntry.workspace_id,
          action_type: auditEntry.action_type,
          actor_slack_user_id: auditEntry.actor_slack_user_id,
          target_entity: auditEntry.target_entity,
          details: auditEntry.details,
        },
      });
      memoryAuditLog.push(created);
      return created;
    }

    if (activeClient.query) {
      const sql = `
        INSERT INTO audit_log (workspace_id, action_type, actor_slack_user_id, target_entity, details, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const res = await activeClient.query(sql, [
        auditEntry.workspace_id,
        auditEntry.action_type,
        auditEntry.actor_slack_user_id,
        auditEntry.target_entity,
        JSON.stringify(auditEntry.details),
        auditEntry.created_at,
      ]);
      const record = res.rows[0] as AuditRecord;
      memoryAuditLog.push(record || auditEntry);
      return record || auditEntry;
    }
  }

  // Store in in-memory audit log
  memoryAuditLog.push(auditEntry);
  return auditEntry;
}

/**
 * Retrieves audit logs for a workspace with strict tenant isolation.
 */
export async function getAuditLogsForWorkspace(
  workspaceId: string,
  client?: AuditDbClient
): Promise<AuditRecord[]> {
  const activeClient = client || defaultDbClient;

  let records: AuditRecord[];
  if (activeClient?.audit_log?.findMany) {
    records = await activeClient.audit_log.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
    });
  } else if (activeClient?.query) {
    const res = await activeClient.query(
      'SELECT * FROM audit_log WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    );
    records = res.rows;
  } else {
    records = getInMemoryAuditRecords(workspaceId);
  }

  // Verify that no cross-tenant records leak into the response
  assertTenantIsolation(records, workspaceId, 'audit_log');
  return records;
}
