/**
 * Tripwire Teams - Instant GDPR & Right to be Forgotten (/tripwire forget)
 * 
 * Enforces Rule 4: "Privacy by design. /tripwire forget deletes all of a person's
 * data immediately."
 * Enforces Rule 6: "Every external action is idempotent and written to an audit_log table."
 * Enforces Rule 8: "Never log secrets, tokens or coordinates."
 */

import type { PrismaClient } from '@prisma/client';
import { recordAudit, AuditAction } from '../security/auditLog.js';

export interface ForgetResult {
  success: boolean;
  erased: boolean;
  erasedMemberId: string | null;
  recordsDeleted: {
    checks: number;
    planAttendees: number;
    googleTokens: number;
    members: number;
  };
  message: string;
}

/**
 * Permanently erases all personal data for a given member across all tables.
 * 
 * Cascade wipes:
 * - `checks` (commute readings, durations, statuses)
 * - `plan_attendees` (attendance flags, skip statuses)
 * - `google_tokens` (any personal OAuth credentials)
 * - `members` (home area label, encrypted coordinates, travel mode, consent timestamp)
 * 
 * Records an immutable compliance entry in `audit_log` with sanitized details.
 */
export async function forgetMember(
  prisma: PrismaClient,
  params: {
    workspaceId: string;
    slackUserId: string;
  }
): Promise<ForgetResult> {
  const member = await prisma.member.findUnique({
    where: {
      workspaceId_slackUserId: {
        workspaceId: params.workspaceId,
        slackUserId: params.slackUserId,
      },
    },
  });

  if (!member) {
    return {
      success: true,
      erased: false,
      erasedMemberId: null,
      recordsDeleted: {
        checks: 0,
        planAttendees: 0,
        googleTokens: 0,
        members: 0,
      },
      message: 'No personal records found for your account in Tripwire.',
    };
  }

  const memberId = member.id;

  // Execute immediate deletion across all personal tables
  const [deletedChecks, deletedAttendees, deletedTokens, deletedMember] = await prisma.$transaction([
    prisma.check.deleteMany({
      where: { memberId },
    }),
    prisma.planAttendee.deleteMany({
      where: { memberId },
    }),
    prisma.googleToken.deleteMany({
      where: {
        workspaceId: params.workspaceId,
        slackUserId: params.slackUserId,
      },
    }),
    prisma.member.delete({
      where: { id: memberId },
    }),
  ]);

  // Record audit log entry for compliance (Rule 6)
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: params.workspaceId,
        actionType: 'DATA_DELETED',
        actorSlackUserId: params.slackUserId,
        targetEntity: `member:${memberId}`,
        detailsJson: JSON.stringify({
          action: 'MEMBER_FORGET',
          reason: 'User executed /tripwire forget (GDPR right to be forgotten)',
          erasedAt: new Date().toISOString(),
          deletedCounts: {
            checks: deletedChecks.count,
            planAttendees: deletedAttendees.count,
            googleTokens: deletedTokens.count,
            members: 1,
          },
        }),
      },
    });

    // Also record in security audit system
    await recordAudit(
      params.workspaceId,
      AuditAction.DATA_DELETION,
      params.slackUserId,
      `member:${memberId}`,
      {
        reason: 'user_forget_request',
        action: 'MEMBER_FORGET',
      }
    );
  } catch (err: any) {
    console.error('[Forget] Failed to record audit log:', err?.message || err);
  }

  return {
    success: true,
    erased: true,
    erasedMemberId: memberId,
    recordsDeleted: {
      checks: deletedChecks.count,
      planAttendees: deletedAttendees.count,
      googleTokens: deletedTokens.count,
      members: 1,
    },
    message: '🛡️ All your personal records (home area, encrypted coordinates, travel mode, commute tolerance, past commute checks, and plan attendance) have been permanently erased from Tripwire. Your privacy has been respected. If you ever wish to rejoin office commute alerts, simply run `/tripwire setup`.',
  };
}

/**
 * Registers `/tripwire forget` slash command in Slack Bolt App.
 */
export function registerForgetCommand(app: any, prisma: PrismaClient): void {
  app.command('/tripwire', async ({ command, ack, respond }: any) => {
    const text = command.text?.trim() || '';
    if (text === 'forget' || text.startsWith('forget')) {
      await ack();

      try {
        const result = await forgetMember(prisma, {
          workspaceId: command.team_id,
          slackUserId: command.user_id,
        });

        await respond({
          text: result.message,
          response_type: 'ephemeral',
        });
      } catch (err: any) {
        console.error('[Forget] Error processing forget request:', err?.message || err);
        await respond({
          text: `❌ Error erasing data: ${err?.message || 'Unexpected error'}`,
          response_type: 'ephemeral',
        });
      }
    }
  });
}
