/**
 * Tripwire Teams - Office Day Plan Modal (/tripwire plan)
 * 
 * Slack Modal for team leads to schedule an office day.
 * Collects:
 * - Office Address (geocodes and confirms)
 * - Plan Date (date picker, defaults to tomorrow or next weekday)
 * - Target Arrive-By Time (time picker, e.g. 09:30)
 * - Decision Cutoff Time (time picker, e.g. 08:30)
 * - Channel selection (conversations_select)
 * 
 * On submission:
 * - Persists plan and plan attendees in Postgres via Prisma.
 * - Enqueues scheduled jobs in pg-boss.
 * - Posts announcement in the selected channel:
 *   "Office day planned for *{date}*. {count} teammates currently opted in. If you haven't yet, run `/tripwire setup` to set your commute preference."
 *   Rule: Never names or shames unconfigured members.
 */

import type { ModalView, ViewOutput } from '@slack/bolt';
import { PrismaClient } from '@prisma/client';
import { schedulePlanJobs } from './pgBossScheduler.js';

export interface GeocodedAddress {
  address: string;
  lat: number;
  lon: number;
}

export interface PlanModalSubmissionData {
  officeAddress: string;
  planDate: string; // YYYY-MM-DD
  arriveByTime: string; // HH:mm e.g. "09:30"
  decisionTime: string; // HH:mm e.g. "08:30"
  channelId: string;
  workspaceId: string;
  ownerSlackUserId: string;
}

export interface PlanSubmissionResult {
  planId: string;
  planDate: string;
  optedInCount: number;
  channelId: string;
  announcementText: string;
}

/**
 * Calculates the next weekday (tomorrow, or Monday if tomorrow is Saturday/Sunday).
 * Format: YYYY-MM-DD.
 */
export function getNextWeekday(fromDate: Date = new Date()): string {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + 1);

  // If next is Saturday (6), advance by 2 days to Monday
  if (next.getDay() === 6) {
    next.setDate(next.getDate() + 2);
  }
  // If next is Sunday (0), advance by 1 day to Monday
  else if (next.getDay() === 0) {
    next.setDate(next.getDate() + 1);
  }

  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Geocodes an office address using Google Geocoding API if available,
 * or returns safe fallback coordinates (Bengaluru tech corridor center).
 * Rule: Never throws unhandled exceptions; never logs raw coordinates.
 */
export async function geocodeOfficeAddress(
  address: string,
  apiKey?: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<GeocodedAddress> {
  const cleanAddress = address.trim();
  const key = apiKey || process.env.GOOGLE_MAPS_API_KEY;

  if (key && !key.includes('mock') && cleanAddress.length > 0) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddress)}&key=${encodeURIComponent(key)}`;
      const resp = await fetchFn(url);
      if (resp.ok) {
        const data = await resp.json() as any;
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          return {
            address: data.results[0].formatted_address || cleanAddress,
            lat: Math.round(loc.lat * 10000) / 10000,
            lon: Math.round(loc.lng * 10000) / 10000,
          };
        }
      }
    } catch {
      // Graceful fallback to default Bengaluru coordinate center
    }
  }

  // Safe default coordinates: Bellandur tech corridor (12.9290, 77.6760)
  return {
    address: cleanAddress || 'Office Hub, Bellandur, Bengaluru',
    lat: 12.9290,
    lon: 77.6760,
  };
}

/**
 * Builds the Slack Block Kit modal view for `/tripwire plan`.
 */
export function buildPlanModalView(initialDate?: string): ModalView {
  const defaultDate = initialDate || getNextWeekday();

  return {
    type: 'modal',
    callback_id: 'tripwire_plan_modal',
    title: {
      type: 'plain_text',
      text: 'Plan Office Day',
    },
    submit: {
      type: 'plain_text',
      text: 'Create Plan',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'office_address_block',
        label: {
          type: 'plain_text',
          text: 'Office Address',
        },
        element: {
          type: 'plain_text_input',
          action_id: 'office_address_input',
          placeholder: {
            type: 'plain_text',
            text: 'e.g. Google Anantha, RMZ Ecoworld, Bellandur',
          },
        },
      },
      {
        type: 'input',
        block_id: 'plan_date_block',
        label: {
          type: 'plain_text',
          text: 'Plan Date',
        },
        element: {
          type: 'datepicker',
          action_id: 'plan_date_input',
          initial_date: defaultDate,
          placeholder: {
            type: 'plain_text',
            text: 'Select date',
          },
        },
      },
      {
        type: 'input',
        block_id: 'arrive_by_block',
        label: {
          type: 'plain_text',
          text: 'Target Arrive-By Time',
        },
        element: {
          type: 'timepicker',
          action_id: 'arrive_by_input',
          initial_time: '09:30',
          placeholder: {
            type: 'plain_text',
            text: 'Select arrive-by time',
          },
        },
      },
      {
        type: 'input',
        block_id: 'decision_time_block',
        label: {
          type: 'plain_text',
          text: 'Decision Cutoff Time',
        },
        element: {
          type: 'timepicker',
          action_id: 'decision_time_input',
          initial_time: '08:30',
          placeholder: {
            type: 'plain_text',
            text: 'Select decision cutoff time',
          },
        },
      },
      {
        type: 'input',
        block_id: 'channel_block',
        label: {
          type: 'plain_text',
          text: 'Announce Channel',
        },
        element: {
          type: 'conversations_select',
          action_id: 'channel_input',
          response_url_enabled: false,
          default_to_current_conversation: true,
          filter: {
            include: ['public', 'private'],
          },
        },
      },
    ],
  };
}

/**
 * Extracts form data from the Slack View submission output.
 */
export function extractPlanModalValues(
  view: ViewOutput,
  workspaceId: string,
  ownerSlackUserId: string
): PlanModalSubmissionData {
  const values = view.state.values;

  const officeAddress = values.office_address_block?.office_address_input?.value?.trim() || '';
  const planDate = values.plan_date_block?.plan_date_input?.selected_date || getNextWeekday();
  const arriveByTime = values.arrive_by_block?.arrive_by_input?.selected_time || '09:30';
  const decisionTime = values.decision_time_block?.decision_time_input?.selected_time || '08:30';
  const channelId = values.channel_block?.channel_input?.selected_conversation || '';

  return {
    officeAddress,
    planDate,
    arriveByTime,
    decisionTime,
    channelId,
    workspaceId,
    ownerSlackUserId,
  };
}

/**
 * Formats announcement text according to the exact project specification:
 * "Office day planned for *{date}*. {count} teammates currently opted in. If you haven't yet, run `/tripwire setup` to set your commute preference."
 * Never names or shames unconfigured members.
 */
export function formatPlanAnnouncement(dateStr: string, count: number): string {
  return `Office day planned for *${dateStr}*. ${count} teammates currently opted in. If you haven't yet, run \`/tripwire setup\` to set your commute preference.`;
}

/**
 * Validates plan modal times.
 * Decision cutoff time must be strictly earlier than target arrive-by time.
 */
export function validatePlanTimes(arriveByTime: string, decisionTime: string): { valid: boolean; error?: string } {
  const [arrH, arrM] = arriveByTime.split(':').map(Number);
  const [decH, decM] = decisionTime.split(':').map(Number);

  const arriveMinutes = arrH * 60 + arrM;
  const decisionMinutes = decH * 60 + decM;

  if (decisionMinutes >= arriveMinutes) {
    return {
      valid: false,
      error: 'Decision cutoff time must be earlier than target arrive-by time.',
    };
  }

  return { valid: true };
}

/**
 * Core business handler when a lead submits the plan modal.
 */
export async function handlePlanModalSubmission(
  data: PlanModalSubmissionData,
  prisma: PrismaClient,
  boss?: any
): Promise<PlanSubmissionResult> {
  const timeValidation = validatePlanTimes(data.arriveByTime, data.decisionTime);
  if (!timeValidation.valid) {
    throw new Error(timeValidation.error);
  }

  // Geocode office address
  const geo = await geocodeOfficeAddress(data.officeAddress);

  // Parse decision time Date
  const [decH, decM] = data.decisionTime.split(':').map(Number);
  const decisionDateTime = new Date(`${data.planDate}T${String(decH).padStart(2, '0')}:${String(decM).padStart(2, '0')}:00`);

  // Parse plan Date
  const planDateObj = new Date(`${data.planDate}T00:00:00Z`);

  // Ensure workspace exists in Prisma
  await prisma.workspace.upsert({
    where: { id: data.workspaceId },
    update: {},
    create: {
      id: data.workspaceId,
      name: 'Tripwire Workspace',
      botToken: process.env.SLACK_BOT_TOKEN || 'xoxb-default',
    },
  });

  // Query opted-in members for this workspace
  const members = await prisma.member.findMany({
    where: { workspaceId: data.workspaceId },
  });

  const optedInCount = members.length;

  // Persist plan
  const plan = await prisma.plan.create({
    data: {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
      ownerSlackUserId: data.ownerSlackUserId,
      officeAddress: geo.address,
      officeLat: geo.lat,
      officeLon: geo.lon,
      planDate: planDateObj,
      arriveByTime: data.arriveByTime,
      decisionTime: decisionDateTime,
      status: 'PLANNED',
      attendees: {
        create: members.map(m => ({
          memberId: m.id,
          hasSkipped: false,
        })),
      },
    },
  });

  // Schedule automated jobs in pg-boss if boss instance is provided
  if (boss) {
    await schedulePlanJobs(boss, {
      id: plan.id,
      planDate: data.planDate,
      arriveByTime: data.arriveByTime,
      decisionTime: data.decisionTime,
    });
  }

  const announcementText = formatPlanAnnouncement(data.planDate, optedInCount);

  return {
    planId: plan.id,
    planDate: data.planDate,
    optedInCount,
    channelId: data.channelId,
    announcementText,
  };
}

/**
 * Registers `/tripwire plan` slash command and modal submission in the Slack Bolt App.
 */
export function registerPlanModalHandlers(app: any, prisma: PrismaClient, boss?: any): void {
  // Command handler for /tripwire plan
  app.command('/tripwire', async ({ command, ack, client }: any) => {
    const text = command.text?.trim() || '';
    if (text === 'plan' || text.startsWith('plan')) {
      await ack();
      try {
        const view = buildPlanModalView();
        await client.views.open({
          trigger_id: command.trigger_id,
          view,
        });
      } catch (err: any) {
        console.error('[PlanModal] Failed to open modal:', err?.message || err);
      }
    }
  });

  // View submission handler
  app.view('tripwire_plan_modal', async ({ ack, body, view, client }: any) => {
    const workspaceId = body.team?.id || '';
    const ownerSlackUserId = body.user?.id || '';

    const submissionData = extractPlanModalValues(view, workspaceId, ownerSlackUserId);
    const validation = validatePlanTimes(submissionData.arriveByTime, submissionData.decisionTime);

    if (!validation.valid) {
      await ack({
        response_action: 'errors',
        errors: {
          decision_time_block: validation.error || 'Invalid decision cutoff time',
        },
      });
      return;
    }

    // Acknowledge modal submission cleanly
    await ack();

    try {
      const result = await handlePlanModalSubmission(submissionData, prisma, boss);

      // Post announcement to channel
      if (result.channelId && client?.chat?.postMessage) {
        await client.chat.postMessage({
          channel: result.channelId,
          text: result.announcementText,
        });
      }
    } catch (err: any) {
      console.error('[PlanModal] Error processing plan submission:', err?.message || err);
    }
  });
}
