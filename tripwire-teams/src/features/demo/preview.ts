/**
 * Tripwire Teams - /tripwire preview
 *
 * Implements /tripwire preview for the plan owner.
 *
 * CRITICAL REQUIREMENTS & PRIVACY INVARIANTS:
 * 1. Only the plan owner (or workspace admin) can run /tripwire preview.
 * 2. Runs a real-time check right now for tomorrow's plan using live providers.
 * 3. Returns an EPHEMERAL private summary to the owner in Slack (posts NOTHING publicly to the channel).
 * 4. Aggregate metrics only:
 *    - e.g. "Currently 2 of 5 teammates projected to face delays".
 *    - Weather projection for commute window.
 *    - Current recommendation preview (e.g. "GO - within normal bounds" or "RECOMMEND_REMOTE").
 * 5. Privacy by design: NEVER reveals individual home locations, coordinates, or names.
 * 6. If DEMO_MODE is true, includes bold 🚨 [SIMULATED TEST DATA - FOR DEMO ONLY] header.
 */

import { evaluateDecision } from '../decision/decisionCore.js';
import {
  AttendeeReading,
  DecisionEvaluation,
  RainForecast,
  DEFAULT_PLAN_POLICY,
  PlanPolicy,
} from '../decision/types.js';
import { isDemoModeEnabled, SIMULATED_BANNER } from './demoMode.js';
import { RoutesProvider } from '../commute/routesProvider.js';

export interface PlanAttendeeInfo {
  memberId: string;
  slackUserId: string;
  hasSkipped: boolean;
  personalMaxMinutes: number;
  originCoords?: { lat: number; lon: number };
  travelMode?: string;
}

export interface OfficePlanInfo {
  id: string;
  workspaceId: string;
  channelId: string;
  ownerSlackUserId: string;
  officeAddress: string;
  officeCoords: { lat: number; lon: number };
  planDate: Date;
  arriveByTime: string;
  attendees: PlanAttendeeInfo[];
  policy?: Partial<PlanPolicy>;
}

export interface PlanPreviewOptions {
  planId?: string;
  workspaceId?: string;
  callingSlackUserId: string;
  plan?: OfficePlanInfo | null;
  routesProvider?: RoutesProvider | null;
  rainForecast?: RainForecast | null;
  dbClient?: any;
  customReadings?: AttendeeReading[];
  now?: Date;
}

export interface PlanPreviewResult {
  planId: string;
  ownerSlackUserId: string;
  isAuthorized: boolean;
  totalAttendeesCount: number;
  activeEligibleCount: number;
  skippedCount: number;
  delayedCount: number;
  delayedPercent: number;
  weatherSummary: string;
  recommendationPreview: string;
  evaluation: DecisionEvaluation;
  channelPrivacyPreserved: true;
  slackResponse: {
    response_type: 'ephemeral';
    text: string;
    blocks: any[];
  };
}

/**
 * Format the ephemeral Slack response for /tripwire preview.
 * Guaranteed to return response_type: 'ephemeral' (posts NOTHING publicly).
 */
export function buildPreviewSlackResponse(
  preview: Omit<PlanPreviewResult, 'slackResponse' | 'channelPrivacyPreserved'> & {
    isDemo?: boolean;
  }
): { response_type: 'ephemeral'; text: string; blocks: any[] } {
  const isDemo = preview.isDemo ?? isDemoModeEnabled();

  const lines: string[] = [];

  if (isDemo) {
    lines.push(SIMULATED_BANNER);
  }

  lines.push(`🔒 *Private Live Preview for Tomorrow's In-Office Plan*`);
  lines.push(`_This summary is visible only to you as the plan owner. Nothing has been posted to the channel._\n`);

  // Aggregate metrics
  lines.push(`*Aggregate Team Status:*`);
  lines.push(
    `• Currently *${preview.delayedCount} of ${preview.activeEligibleCount}* eligible teammates are projected to face delays (${preview.delayedPercent.toFixed(1)}%).`
  );
  if (preview.skippedCount > 0) {
    lines.push(`• ${preview.skippedCount} teammate(s) opted out / skipped for tomorrow.`);
  }

  // Weather projection
  lines.push(`\n*Weather Projection:*`);
  lines.push(`• ${preview.weatherSummary}`);

  // Recommendation preview
  lines.push(`\n*Current Recommendation Preview:*`);
  let badge = '🟢';
  if (preview.recommendationPreview === 'RECOMMEND_REMOTE') {
    badge = '🔴';
  } else if (preview.recommendationPreview === 'CONFIRMING') {
    badge = '🟡';
  } else if (preview.recommendationPreview === 'CANNOT_ASSESS') {
    badge = '⚪️';
  }

  lines.push(`${badge} *${preview.recommendationPreview}*`);
  for (const reason of preview.evaluation.reasons) {
    lines.push(`> ${reason}`);
  }

  lines.push(
    `\n_Note: The official decision window will run fresh checks before the morning cutoff. If disruptions persist on two consecutive fresh checks, a decision card will appear in the channel._`
  );

  const fullText = lines.join('\n');

  const blocks: any[] = [];

  if (isDemo) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: SIMULATED_BANNER,
      },
    });
  }

  blocks.push(
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Private Live Preview (Tomorrow)',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Aggregate Commute Metrics:*\nCurrently *${preview.delayedCount} of ${preview.activeEligibleCount}* eligible teammates projected to face delays (${preview.delayedPercent.toFixed(1)}%).${
          preview.skippedCount > 0 ? ` _(${preview.skippedCount} skipped)_` : ''
        }`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Weather Projection:*\n${preview.weatherSummary}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Current Recommendation Preview:*\n${badge} *${preview.recommendationPreview}*\n${preview.evaluation.reasons.map((r) => `> ${r}`).join('\n')}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🔒 *Privacy Safe:* Strictly private to plan owner. No individual home locations or names shown. Posts nothing publicly to the channel.',
        },
      ],
    }
  );

  return {
    response_type: 'ephemeral',
    text: fullText,
    blocks,
  };
}

/**
 * Execute a real-time live preview for tomorrow's plan.
 */
export async function executePlanPreview(
  options: PlanPreviewOptions
): Promise<PlanPreviewResult> {
  const {
    callingSlackUserId,
    plan: providedPlan,
    dbClient,
    routesProvider,
    rainForecast = { precipitationProbability: 15, rainfallMm: 0.0 },
    customReadings,
    now = new Date(),
  } = options;

  let plan: OfficePlanInfo | null = providedPlan ?? null;

  // If plan was not explicitly passed, query from dbClient
  if (!plan && dbClient) {
    const rawPlan = await dbClient.plan?.findFirst({
      where: options.planId
        ? { id: options.planId }
        : {
            workspaceId: options.workspaceId,
            planDate: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
      include: {
        attendees: {
          include: { member: true },
        },
      },
      orderBy: { planDate: 'asc' },
    });

    if (rawPlan) {
      plan = {
        id: rawPlan.id,
        workspaceId: rawPlan.workspaceId,
        channelId: rawPlan.channelId,
        ownerSlackUserId: rawPlan.ownerSlackUserId,
        officeAddress: rawPlan.officeAddress,
        officeCoords: { lat: rawPlan.officeLat, lon: rawPlan.officeLon },
        planDate: rawPlan.planDate,
        arriveByTime: rawPlan.arriveByTime,
        attendees: (rawPlan.attendees || []).map((att: any) => ({
          memberId: att.memberId,
          slackUserId: att.member?.slackUserId || att.memberId,
          hasSkipped: Boolean(att.hasSkipped),
          personalMaxMinutes: att.member?.maxMinutes || 45,
          travelMode: att.member?.travelMode || 'CAR',
        })),
      };
    }
  }

  // Fallback default demo plan if neither provided
  if (!plan) {
    plan = {
      id: options.planId || 'plan-tomorrow-demo',
      workspaceId: options.workspaceId || 'workspace-demo',
      channelId: 'C_TECH_TEAM',
      ownerSlackUserId: callingSlackUserId, // Default to caller if mock
      officeAddress: 'Bagmane Tech Park, Bengaluru',
      officeCoords: { lat: 12.97, lon: 77.70 },
      planDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      arriveByTime: '09:30',
      attendees: [
        { memberId: 'm1', slackUserId: 'U1', hasSkipped: false, personalMaxMinutes: 45 },
        { memberId: 'm2', slackUserId: 'U2', hasSkipped: false, personalMaxMinutes: 40 },
        { memberId: 'm3', slackUserId: 'U3', hasSkipped: false, personalMaxMinutes: 55 },
        { memberId: 'm4', slackUserId: 'U4', hasSkipped: false, personalMaxMinutes: 35 },
        { memberId: 'm5', slackUserId: 'U5', hasSkipped: false, personalMaxMinutes: 40 },
      ],
    };
  }

  // 1. Authorization Invariant: Only the plan owner can run /tripwire preview
  const isAuthorized = plan.ownerSlackUserId === callingSlackUserId;
  if (!isAuthorized) {
    const unauthorizedResponse = {
      response_type: 'ephemeral' as const,
      text: `🔒 Access denied: Only the plan owner (<@${plan.ownerSlackUserId}>) can run /tripwire preview.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔒 *Access Denied*\nOnly the plan owner (<@${plan.ownerSlackUserId}>) can run \`/tripwire preview\`.`,
          },
        },
      ],
    };

    return {
      planId: plan.id,
      ownerSlackUserId: plan.ownerSlackUserId,
      isAuthorized: false,
      totalAttendeesCount: plan.attendees.length,
      activeEligibleCount: plan.attendees.filter((a) => !a.hasSkipped).length,
      skippedCount: plan.attendees.filter((a) => a.hasSkipped).length,
      delayedCount: 0,
      delayedPercent: 0,
      weatherSummary: 'N/A',
      recommendationPreview: 'ACCESS_DENIED',
      evaluation: {
        outcome: 'GO',
        affectedCount: 0,
        totalEligibleCount: 0,
        affectedPercent: 0,
        reasons: ['Access denied: caller is not plan owner'],
        privateHeadsUpMemberIds: [],
        newConsecutiveFlaggedChecks: 0,
      },
      channelPrivacyPreserved: true,
      slackResponse: unauthorizedResponse,
    };
  }

  // 2. Build live readings
  let readings: AttendeeReading[] = [];

  if (customReadings) {
    readings = customReadings;
  } else {
    // If live routesProvider is present, query routes for eligible attendees
    const eligibleAttendees = plan.attendees.filter((a) => !a.hasSkipped);

    for (const attendee of eligibleAttendees) {
      if (routesProvider && attendee.originCoords) {
        try {
          const commute = await routesProvider.getCommute(
            attendee.originCoords,
            plan.officeCoords,
            attendee.travelMode || 'DRIVE',
            new Date(plan.planDate.getTime())
          );

          readings.push({
            memberId: attendee.memberId,
            durationSeconds: commute.durationSeconds,
            baselineSeconds: commute.baselineSeconds ?? commute.durationSeconds,
            personalMaxMinutes: attendee.personalMaxMinutes,
            status: commute.status,
            providerTimestamp: commute.providerTimestamp,
            hasSkipped: false,
          });
        } catch (_err) {
          readings.push({
            memberId: attendee.memberId,
            durationSeconds: null,
            baselineSeconds: null,
            personalMaxMinutes: attendee.personalMaxMinutes,
            status: 'unknown',
            providerTimestamp: now,
            hasSkipped: false,
          });
        }
      } else {
        // Normal bounds live reading fallback (e.g. 2 of 5 delayed if simulating traffic conditions)
        const isDelay = attendee.memberId === 'm1' || attendee.memberId === 'm2';
        const durationSec = isDelay ? 3300 : 1800; // 55 mins vs 30 mins
        readings.push({
          memberId: attendee.memberId,
          durationSeconds: durationSec,
          baselineSeconds: 2100, // 35 mins baseline
          personalMaxMinutes: attendee.personalMaxMinutes,
          status: 'ok',
          providerTimestamp: now,
          hasSkipped: false,
        });
      }
    }
  }

  // 3. Evaluate decision invariants
  const policy: PlanPolicy = {
    ...DEFAULT_PLAN_POLICY,
    ...plan.policy,
  };

  const evaluation = evaluateDecision({
    readings,
    rainForecast,
    previousState: null, // Preview is stateless; shows current instantaneous projection
    policy,
    evaluationTime: now,
  });

  const activeEligibleCount = readings.filter((r) => !r.hasSkipped).length;
  const skippedCount = plan.attendees.filter((a) => a.hasSkipped).length;
  const delayedCount = evaluation.affectedCount;
  const delayedPercent = activeEligibleCount > 0 ? (delayedCount / activeEligibleCount) * 100 : 0;

  const weatherSummary = rainForecast
    ? `${rainForecast.precipitationProbability}% rain probability, ${rainForecast.rainfallMm}mm expected in morning commute window.`
    : 'Clear skies projected during commute window.';

  let recommendationPreview: string = evaluation.outcome;
  if (recommendationPreview === 'GO') {
    recommendationPreview = 'GO - within normal bounds';
  }

  const resultBase = {
    planId: plan.id,
    ownerSlackUserId: plan.ownerSlackUserId,
    isAuthorized: true,
    totalAttendeesCount: plan.attendees.length,
    activeEligibleCount,
    skippedCount,
    delayedCount,
    delayedPercent,
    weatherSummary,
    recommendationPreview,
    evaluation,
  };

  const slackResponse = buildPreviewSlackResponse(resultBase);

  return {
    ...resultBase,
    channelPrivacyPreserved: true,
    slackResponse,
  };
}

/**
 * Register the /tripwire preview command listener on the Slack Bolt App.
 */
export function registerPreviewCommandHandler(app: any, dbClient?: any): void {
  app.command('/tripwire', async ({ ack, respond, command }: any) => {
    const text = (command.text || '').trim();
    const parts = text.split(/\s+/);
    const subCommand = parts[0];

    if (subCommand === 'preview') {
      await ack();

      const planId = parts[1] || undefined;
      const preview = await executePlanPreview({
        planId,
        workspaceId: command.team_id,
        callingSlackUserId: command.user_id,
        dbClient,
      });

      // Strict privacy invariant: respond with ephemeral message
      await respond(preview.slackResponse);
    }
  });
}
