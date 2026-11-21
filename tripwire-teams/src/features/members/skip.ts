/**
 * Tripwire Teams - Member Day Skipping Flow
 * 
 * Handles `/tripwire skip <date>`:
 * Marks attendee as skipped (`hasSkipped = true`) for that date so they are
 * excluded from calculations and decision counts.
 * 
 * Non-Negotiable Rule 4: Skipped members are excluded from decision calculations.
 */

import type { PrismaClient } from '@prisma/client';

export interface SkipResult {
  success: boolean;
  message: string;
  planId?: string;
  dateStr?: string;
  hasSkipped?: boolean;
}

/**
 * Parses user-provided date string into normalized YYYY-MM-DD format.
 * Supports: "today", "tomorrow", or "YYYY-MM-DD".
 */
export function parseSkipDate(dateInput?: string): { valid: boolean; dateStr?: string; error?: string } {
  const clean = dateInput ? dateInput.trim().toLowerCase() : '';
  if (!clean) {
    return {
      valid: false,
      error: 'Please specify a date to skip, e.g. `/tripwire skip tomorrow` or `/tripwire skip 2026-11-23`.',
    };
  }

  const now = new Date();

  if (clean === 'today') {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return { valid: true, dateStr: `${year}-${month}-${day}` };
  }

  if (clean === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return { valid: true, dateStr: `${year}-${month}-${day}` };
  }

  // Expect YYYY-MM-DD format
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) {
    return {
      valid: false,
      error: `Invalid date format "${dateInput}". Please use YYYY-MM-DD (e.g. 2026-11-23), "today", or "tomorrow".`,
    };
  }

  const [_, yStr, mStr, dStr] = isoMatch;
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return {
      valid: false,
      error: `Invalid calendar date "${dateInput}".`,
    };
  }

  return { valid: true, dateStr: clean };
}

/**
 * Core business function to skip an office day.
 */
export async function skipOfficeDay(
  prisma: PrismaClient,
  params: {
    workspaceId: string;
    slackUserId: string;
    dateInput?: string;
  }
): Promise<SkipResult> {
  const parsed = parseSkipDate(params.dateInput);
  if (!parsed.valid || !parsed.dateStr) {
    return {
      success: false,
      message: parsed.error || 'Invalid date specified.',
    };
  }

  const dateStr = parsed.dateStr;

  // 1. Verify member exists and is opted in
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
      success: false,
      message: "You haven't set up your commute preferences yet. Run `/tripwire setup` first to opt in.",
    };
  }

  // 2. Find scheduled plan on that date
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  const plan = await prisma.plan.findFirst({
    where: {
      workspaceId: params.workspaceId,
      planDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  if (!plan) {
    return {
      success: false,
      message: `No office day plan found for *${dateStr}*. If a plan hasn't been created yet, please notify your team lead.`,
    };
  }

  // 3. Upsert plan attendee record marking hasSkipped = true
  await prisma.planAttendee.upsert({
    where: {
      planId_memberId: {
        planId: plan.id,
        memberId: member.id,
      },
    },
    create: {
      planId: plan.id,
      memberId: member.id,
      hasSkipped: true,
      skipReason: 'Member opted out via /tripwire skip',
    },
    update: {
      hasSkipped: true,
      skipReason: 'Member opted out via /tripwire skip',
    },
  });

  return {
    success: true,
    planId: plan.id,
    dateStr,
    hasSkipped: true,
    message: `✅ You have skipped the office day on *${dateStr}*. You are excluded from commute calculations and team recommendation counts for that day.`,
  };
}

/**
 * Registers `/tripwire skip <date>` slash command handler in Slack Bolt App.
 */
export function registerSkipCommand(app: any, prisma: PrismaClient): void {
  app.command('/tripwire', async ({ command, ack, respond }: any) => {
    const text = command.text?.trim() || '';
    if (text.startsWith('skip')) {
      await ack();

      const parts = text.split(/\s+/);
      const dateInput = parts.length > 1 ? parts.slice(1).join(' ') : '';

      try {
        const result = await skipOfficeDay(prisma, {
          workspaceId: command.team_id,
          slackUserId: command.user_id,
          dateInput,
        });

        await respond({
          text: result.message,
          response_type: 'ephemeral',
        });
      } catch (err: any) {
        console.error('[Skip] Error handling skip command:', err?.message || err);
        await respond({
          text: `❌ Error processing skip request: ${err?.message || 'Unexpected error'}`,
          response_type: 'ephemeral',
        });
      }
    }
  });
}
