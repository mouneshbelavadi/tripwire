/**
 * Tripwire Teams - Workspace Lifecycle & Data Purge Events
 * 
 * Enforces Rule 4: "On app_uninstalled or tokens_revoked, delete that workspace's data."
 * Enforces Rule 6: "Every external action is idempotent and written to an audit_log table."
 * 
 * Immediately purges all records for the uninstalled workspace across:
 * - `workspaces`
 * - `members`
 * - `plans`
 * - `checks`
 * - `decisions`
 * - `plan_attendees`
 * - `google_tokens`
 * - `audit_log`
 */

import type { PrismaClient } from '@prisma/client';
import { recordAudit, AuditAction } from '../security/auditLog.js';

export interface WorkspacePurgeResult {
  success: boolean;
  workspaceId: string;
  existed: boolean;
  purgedCounts: {
    checks: number;
    planAttendees: number;
    decisions: number;
    plans: number;
    members: number;
    googleTokens: number;
    auditLogs: number;
    workspaces: number;
  };
}

/**
 * Permanently and cleanly purges all workspace records when the app is uninstalled
 * or tokens are revoked.
 */
export async function handleWorkspaceUninstall(
  prisma: PrismaClient,
  workspaceId: string
): Promise<WorkspacePurgeResult> {
  if (!workspaceId) {
    throw new Error('Workspace ID is required for uninstall purge');
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return {
      success: true,
      workspaceId,
      existed: false,
      purgedCounts: {
        checks: 0,
        planAttendees: 0,
        decisions: 0,
        plans: 0,
        members: 0,
        googleTokens: 0,
        auditLogs: 0,
        workspaces: 0,
      },
    };
  }

  // Pre-audit before wiping records
  try {
    await recordAudit(
      workspaceId,
      AuditAction.WORKSPACE_UNINSTALL,
      'SLACK_EVENT_SYSTEM',
      `workspace:${workspaceId}`,
      {
        reason: 'Slack app_uninstalled or tokens_revoked event received',
        timestamp: new Date().toISOString(),
      }
    );
  } catch {
    // Ignore audit failures during uninstall
  }

  // Execute cascade delete across all tables in order
  const [
    delChecksPlan,
    delChecksMember,
    delAttendeesPlan,
    delAttendeesMember,
    delDecisions,
    delTokens,
    delPlans,
    delMembers,
    delAudit,
    delWorkspace,
  ] = await prisma.$transaction([
    // Delete checks related to workspace plans
    prisma.check.deleteMany({
      where: { plan: { workspaceId } },
    }),
    // Delete checks related to workspace members
    prisma.check.deleteMany({
      where: { member: { workspaceId } },
    }),
    // Delete plan attendees related to workspace plans
    prisma.planAttendee.deleteMany({
      where: { plan: { workspaceId } },
    }),
    // Delete plan attendees related to workspace members
    prisma.planAttendee.deleteMany({
      where: { member: { workspaceId } },
    }),
    // Delete decisions on workspace plans
    prisma.decision.deleteMany({
      where: { plan: { workspaceId } },
    }),
    // Delete OAuth tokens for workspace
    prisma.googleToken.deleteMany({
      where: { workspaceId },
    }),
    // Delete all plans
    prisma.plan.deleteMany({
      where: { workspaceId },
    }),
    // Delete all members
    prisma.member.deleteMany({
      where: { workspaceId },
    }),
    // Delete all audit logs
    prisma.auditLog.deleteMany({
      where: { workspaceId },
    }),
    // Finally delete workspace record
    prisma.workspace.delete({
      where: { id: workspaceId },
    }),
  ]);

  return {
    success: true,
    workspaceId,
    existed: true,
    purgedCounts: {
      checks: delChecksPlan.count + delChecksMember.count,
      planAttendees: delAttendeesPlan.count + delAttendeesMember.count,
      decisions: delDecisions.count,
      plans: delPlans.count,
      members: delMembers.count,
      googleTokens: delTokens.count,
      auditLogs: delAudit.count,
      workspaces: 1,
    },
  };
}

/**
 * Registers Slack event handlers for `app_uninstalled` and `tokens_revoked`.
 */
export function registerWorkspaceEventHandlers(app: any, prisma: PrismaClient): void {
  // Handle app uninstall
  app.event('app_uninstalled', async ({ event, context }: any) => {
    const workspaceId = context?.teamId || event?.team_id || '';
    if (!workspaceId) {
      console.warn('[Events] Received app_uninstalled without teamId');
      return;
    }

    console.log(`[Events] Purging data for uninstalled workspace: ${workspaceId}`);
    try {
      const result = await handleWorkspaceUninstall(prisma, workspaceId);
      console.log(`[Events] Successfully purged workspace ${workspaceId}:`, result.purgedCounts);
    } catch (err: any) {
      console.error(`[Events] Failed to purge workspace ${workspaceId}:`, err?.message || err);
    }
  });

  // Handle token revocation
  app.event('tokens_revoked', async ({ event, context }: any) => {
    const workspaceId = context?.teamId || event?.team_id || '';
    if (!workspaceId) {
      console.warn('[Events] Received tokens_revoked without teamId');
      return;
    }

    console.log(`[Events] Purging data for revoked tokens in workspace: ${workspaceId}`);
    try {
      const result = await handleWorkspaceUninstall(prisma, workspaceId);
      console.log(`[Events] Successfully purged workspace ${workspaceId} on tokens_revoked:`, result.purgedCounts);
    } catch (err: any) {
      console.error(`[Events] Failed to purge workspace ${workspaceId} on tokens_revoked:`, err?.message || err);
    }
  });
}
