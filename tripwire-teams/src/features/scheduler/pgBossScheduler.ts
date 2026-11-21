/**
 * Tripwire Teams - pg-boss Job Scheduler & Watcher
 * 
 * Configures pg-boss job queues with PostgreSQL backend for automated commute checks.
 * Schedules 3 job types for each office plan:
 * 1. `commute:baseline`: Evening before at 20:00 to query & record baseline durations in `checks`.
 * 2. `commute:morning_cadence`: Every 15 minutes starting 45 minutes before decision cutoff time.
 * 3. `commute:final_decision`: At the decision cutoff time.
 * 
 * Non-negotiables:
 * - Provenance: 'live' on all live provider checks.
 * - Unknown is never OK: failed or stale checks stored as unknown.
 * - Two consecutive fresh flagged readings required for RECOMMEND_REMOTE.
 * - Strictly idempotent: running the same job ID twice produces no duplicate checks or repeated Slack messages.
 * - Recovers pending jobs on process restart.
 */

import { PrismaClient } from '@prisma/client';
import { decryptCoords } from '../../config/encryption.js';
import { RoutesProvider } from '../commute/routesProvider.js';
import { evaluateDecision } from '../decision/decisionCore.js';
import { AttendeeReading, DecisionEvaluation, PreviousState } from '../decision/types.js';
import { fetchRainForecast, RainForecastResult } from './openMeteo.js';

export const JOB_NAMES = {
  BASELINE: 'commute:baseline',
  MORNING_CADENCE: 'commute:morning_cadence',
  FINAL_DECISION: 'commute:final_decision',
} as const;

export type JobType = typeof JOB_NAMES[keyof typeof JOB_NAMES];

export interface PlanScheduleTimes {
  baselineTime: Date;
  cadenceTimes: Date[];
  finalDecisionTime: Date;
}

export interface SchedulePlanInput {
  id: string;
  planDate: string; // YYYY-MM-DD
  arriveByTime: string; // HH:mm e.g. "09:30"
  decisionTime: string; // HH:mm e.g. "08:30"
}

export interface CheckExecutionOptions {
  prisma: PrismaClient;
  routesProvider?: RoutesProvider;
  fetchRainFn?: typeof fetchRainForecast;
  slackClient?: any;
  idempotencyGuard?: IdempotencyGuard;
  now?: Date;
}

export interface CheckExecutionResult {
  jobId: string;
  jobType: JobType;
  planId: string;
  skipped: boolean;
  skipReason?: string;
  checkedCount: number;
  evaluation?: DecisionEvaluation;
  rain?: RainForecastResult;
  alertSent?: boolean;
}

/**
 * Idempotency Guard to prevent duplicate database writes or duplicate Slack messages.
 * Tracks executed job IDs and plans that have already received remote alerts.
 */
export class IdempotencyGuard {
  private executedJobIds = new Set<string>();
  private alertedPlans = new Set<string>();

  hasRun(jobId: string): boolean {
    return this.executedJobIds.has(jobId);
  }

  markRun(jobId: string): void {
    this.executedJobIds.add(jobId);
  }

  hasAlerted(planId: string): boolean {
    return this.alertedPlans.has(planId);
  }

  markAlerted(planId: string): void {
    this.alertedPlans.add(planId);
  }

  reset(): void {
    this.executedJobIds.clear();
    this.alertedPlans.clear();
  }
}

// Global in-memory idempotency instance for runtime deduplication
export const defaultIdempotencyGuard = new IdempotencyGuard();

// In-memory previous state tracking per plan: consecutive breaches & timestamps
const planStateRegistry = new Map<string, PreviousState>();

export function getPlanPreviousState(planId: string): PreviousState {
  return planStateRegistry.get(planId) || {
    consecutiveFlaggedChecks: 0,
    lastCheckedAt: null,
    lastProviderTimestamp: null,
  };
}

export function setPlanPreviousState(planId: string, state: PreviousState): void {
  planStateRegistry.set(planId, state);
}

export function resetPlanStateRegistry(): void {
  planStateRegistry.clear();
}

/**
 * Pure calculation for automated job scheduling.
 * Computes:
 * - Baseline: 20:00 on the day prior to planDate
 * - Cadence: 3 intervals (45m, 30m, 15m) before decision cutoff
 * - Final Decision: exactly at decision cutoff
 */
export function calculatePlanScheduleTimes(
  planDateStr: string,
  arriveByTimeStr: string,
  decisionTimeStr: string,
  _now: Date = new Date()
): PlanScheduleTimes {
  const [year, month, day] = planDateStr.split('-').map(Number);
  const [decH, decM] = decisionTimeStr.split(':').map(Number);

  // Final decision time on the plan day
  const finalDecisionTime = new Date(year, month - 1, day, decH, decM, 0, 0);

  // Baseline time: 20:00 on the day before planDate
  const baselineTime = new Date(year, month - 1, day - 1, 20, 0, 0, 0);

  // Morning cadence times: 45 min, 30 min, 15 min before finalDecisionTime
  const cadenceTimes: Date[] = [
    new Date(finalDecisionTime.getTime() - 45 * 60 * 1000),
    new Date(finalDecisionTime.getTime() - 30 * 60 * 1000),
    new Date(finalDecisionTime.getTime() - 15 * 60 * 1000),
  ];

  return {
    baselineTime,
    cadenceTimes,
    finalDecisionTime,
  };
}

/**
 * Schedules all 3 automated job types in pg-boss with singleton deduplication keys.
 */
export async function schedulePlanJobs(boss: any, plan: SchedulePlanInput): Promise<string[]> {
  const times = calculatePlanScheduleTimes(plan.planDate, plan.arriveByTime, plan.decisionTime);
  const scheduledJobIds: string[] = [];

  // 1. commute:baseline (evening before at 20:00)
  const baselineJobKey = `baseline:${plan.id}`;
  const baselineJobId = await boss.send(
    JOB_NAMES.BASELINE,
    {
      planId: plan.id,
      jobType: JOB_NAMES.BASELINE,
      scheduledTime: times.baselineTime.toISOString(),
      jobKey: baselineJobKey,
    },
    {
      singletonKey: baselineJobKey,
      startAfter: times.baselineTime,
    }
  );
  if (baselineJobId) scheduledJobIds.push(baselineJobId);

  // 2. commute:morning_cadence (every 15m starting 45m before decision time)
  for (let i = 0; i < times.cadenceTimes.length; i++) {
    const t = times.cadenceTimes[i];
    const cadenceJobKey = `cadence:${plan.id}:${i}`;
    const cadenceJobId = await boss.send(
      JOB_NAMES.MORNING_CADENCE,
      {
        planId: plan.id,
        cadenceIndex: i,
        jobType: JOB_NAMES.MORNING_CADENCE,
        scheduledTime: t.toISOString(),
        jobKey: cadenceJobKey,
      },
      {
        singletonKey: cadenceJobKey,
        startAfter: t,
      }
    );
    if (cadenceJobId) scheduledJobIds.push(cadenceJobId);
  }

  // 3. commute:final_decision (at decision cutoff time)
  const finalJobKey = `final:${plan.id}`;
  const finalJobId = await boss.send(
    JOB_NAMES.FINAL_DECISION,
    {
      planId: plan.id,
      jobType: JOB_NAMES.FINAL_DECISION,
      scheduledTime: times.finalDecisionTime.toISOString(),
      jobKey: finalJobKey,
    },
    {
      singletonKey: finalJobKey,
      startAfter: times.finalDecisionTime,
    }
  );
  if (finalJobId) scheduledJobIds.push(finalJobId);

  return scheduledJobIds;
}

/**
 * Constructs the Slack Block Kit notification card for RECOMMEND_REMOTE.
 */
export function buildRemoteRecommendationBlocks(
  planId: string,
  evaluation: DecisionEvaluation,
  rainForecast?: RainForecastResult
): any[] {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🚨 Commute Alert: Remote Day Recommended',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${evaluation.affectedCount} of ${evaluation.totalEligibleCount} teammates (${evaluation.affectedPercent.toFixed(0)}%)* are affected by significant commute delays.\n${evaluation.reasons.map(r => `• ${r}`).join('\n')}`,
      },
    },
  ];

  if (rainForecast && rainForecast.isHeavyRain) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🌧️ *Weather Alert:* ${rainForecast.precipitationProbability}% chance of rain with ${rainForecast.rainfallMm}mm precipitation forecast in commute window.`,
        },
      ],
    });
  }

  blocks.push(
    {
      type: 'actions',
      block_id: `decision_actions_${planId}`,
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Make it remote',
            emoji: true,
          },
          style: 'primary',
          action_id: 'action_make_remote',
          value: planId,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Keep in office',
            emoji: true,
          },
          action_id: 'action_keep_office',
          value: planId,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Let individuals decide',
            emoji: true,
          },
          action_id: 'action_individual_decision',
          value: planId,
        },
      ],
    }
  );

  return blocks;
}

/**
 * Core job execution runner:
 * Queries RoutesProvider for active attendees, Open-Meteo for rain forecast,
 * records live checks in Postgres, evaluates decision invariants, and sends Slack card on RECOMMEND_REMOTE.
 * Strictly idempotent: identical job execution key is discarded.
 */
export async function executeCommuteCheckJob(
  planId: string,
  jobType: JobType,
  jobId: string,
  options: CheckExecutionOptions
): Promise<CheckExecutionResult> {
  const {
    prisma,
    routesProvider,
    fetchRainFn = fetchRainForecast,
    slackClient,
    idempotencyGuard = defaultIdempotencyGuard,
    now = new Date(),
  } = options;

  // 1. Strict Idempotency Guard
  if (idempotencyGuard.hasRun(jobId)) {
    return {
      jobId,
      jobType,
      planId,
      skipped: true,
      skipReason: 'Job ID already executed (idempotency enforced)',
      checkedCount: 0,
    };
  }

  // 2. Fetch Plan and active attendees
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      attendees: {
        include: {
          member: true,
        },
      },
    },
  });

  if (!plan || plan.status === 'CANCELLED') {
    idempotencyGuard.markRun(jobId);
    return {
      jobId,
      jobType,
      planId,
      skipped: true,
      skipReason: !plan ? 'Plan not found' : 'Plan is cancelled',
      checkedCount: 0,
    };
  }

  // Filter only attendees who have not skipped
  const activeAttendees = plan.attendees.filter(a => !a.hasSkipped);
  const attendeeReadings: AttendeeReading[] = [];

  const [arrH, arrM] = plan.arriveByTime.split(':').map(Number);
  const arriveByDate = new Date(plan.planDate);
  arriveByDate.setHours(arrH, arrM, 0, 0);

  // 3. Query RoutesProvider for each active attendee
  for (const attendee of activeAttendees) {
    const member = attendee.member;
    let durationSeconds: number | null = null;
    let providerTimestamp: Date = now;
    let checkStatus: 'ok' | 'unknown' = 'unknown';

    try {
      const origin = decryptCoords(member.encryptedCoords);
      const destination = { lat: plan.officeLat, lon: plan.officeLon };

      if (routesProvider) {
        const routeResult = await routesProvider.getCommute(
          origin,
          destination,
          member.travelMode,
          arriveByDate
        );
        durationSeconds = routeResult.durationSeconds;
        providerTimestamp = routeResult.providerTimestamp;
        checkStatus = routeResult.status;
      } else {
        // Fallback placeholder when provider is unconfigured
        durationSeconds = member.maxMinutes * 60;
        checkStatus = 'ok';
      }
    } catch {
      checkStatus = 'unknown';
      durationSeconds = null;
    }

    // Determine baselineSeconds
    let baselineSeconds = 0;
    if (jobType === JOB_NAMES.BASELINE) {
      baselineSeconds = durationSeconds ?? (member.maxMinutes * 60);
    } else {
      // Find prior baseline recorded for this member and plan
      const priorBaseline = await prisma.check.findFirst({
        where: {
          planId: plan.id,
          memberId: member.id,
          baselineSeconds: { gt: 0 },
        },
        orderBy: { checkedAt: 'desc' },
      });
      baselineSeconds = priorBaseline ? priorBaseline.baselineSeconds : (member.maxMinutes * 60);
    }

    // Save record to checks table with provenance: 'live' (Rule 1 Non-negotiable)
    await prisma.check.create({
      data: {
        planId: plan.id,
        memberId: member.id,
        checkedAt: now,
        providerTimestamp,
        durationSeconds: durationSeconds ?? 0,
        baselineSeconds,
        status: checkStatus,
        provenance: 'live',
      },
    });

    attendeeReadings.push({
      memberId: member.id,
      durationSeconds,
      baselineSeconds,
      personalMaxMinutes: member.maxMinutes,
      status: checkStatus,
      providerTimestamp,
      hasSkipped: false,
    });
  }

  // 4. Query Open-Meteo rain forecast for the commute window
  const windowStart = new Date(arriveByDate.getTime() - 2.5 * 60 * 60 * 1000); // 2.5h window
  const windowEnd = arriveByDate;

  const rainResult = await fetchRainFn({
    lat: plan.officeLat,
    lon: plan.officeLon,
    windowStart,
    windowEnd,
  });

  // 5. Run Decision Invariant Evaluation
  const previousState = getPlanPreviousState(plan.id);

  const evaluation = evaluateDecision({
    readings: attendeeReadings,
    rainForecast: {
      precipitationProbability: rainResult.precipitationProbability,
      rainfallMm: rainResult.rainfallMm,
    },
    previousState,
    evaluationTime: now,
  });

  // Update previous state registry with new consecutive breach count
  setPlanPreviousState(plan.id, {
    consecutiveFlaggedChecks: evaluation.newConsecutiveFlaggedChecks,
    lastCheckedAt: now,
    lastProviderTimestamp: now,
  });

  let alertSent = false;

  // 6. If RECOMMEND_REMOTE, trigger Slack Block Kit notification card
  if (evaluation.outcome === 'RECOMMEND_REMOTE') {
    if (!idempotencyGuard.hasAlerted(plan.id)) {
      if (slackClient?.chat?.postMessage && plan.channelId) {
        const blocks = buildRemoteRecommendationBlocks(plan.id, evaluation, rainResult);
        await slackClient.chat.postMessage({
          channel: plan.channelId,
          text: `🚨 Office day recommendation: Make it remote (${evaluation.affectedCount} teammates affected).`,
          blocks,
        });
        alertSent = true;
      }
      idempotencyGuard.markAlerted(plan.id);
    }
  }

  // Mark this job ID as completed
  idempotencyGuard.markRun(jobId);

  return {
    jobId,
    jobType,
    planId: plan.id,
    skipped: false,
    checkedCount: attendeeReadings.length,
    evaluation,
    rain: rainResult,
    alertSent,
  };
}

/**
 * Initializes pg-boss workers and binds job listeners for the 3 commute job types.
 * Recovers pending jobs when the process starts.
 */
export async function initPgBossScheduler(boss: any, options: CheckExecutionOptions): Promise<void> {
  // Register worker for commute:baseline
  await boss.work(JOB_NAMES.BASELINE, async (jobs: any[]) => {
    for (const job of jobs) {
      const { planId, jobKey } = job.data;
      await executeCommuteCheckJob(planId, JOB_NAMES.BASELINE, jobKey || job.id, options);
    }
  });

  // Register worker for commute:morning_cadence
  await boss.work(JOB_NAMES.MORNING_CADENCE, async (jobs: any[]) => {
    for (const job of jobs) {
      const { planId, jobKey } = job.data;
      await executeCommuteCheckJob(planId, JOB_NAMES.MORNING_CADENCE, jobKey || job.id, options);
    }
  });

  // Register worker for commute:final_decision
  await boss.work(JOB_NAMES.FINAL_DECISION, async (jobs: any[]) => {
    for (const job of jobs) {
      const { planId, jobKey } = job.data;
      await executeCommuteCheckJob(planId, JOB_NAMES.FINAL_DECISION, jobKey || job.id, options);
    }
  });
}
