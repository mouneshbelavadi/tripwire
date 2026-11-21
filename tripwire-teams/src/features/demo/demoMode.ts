/**
 * Tripwire Teams - Deterministic Demo Mode & Simulation Engine
 *
 * CRITICAL SAFETY RULES:
 * 1. Demo mode is strictly enabled ONLY when process.env.DEMO_MODE === 'true'.
 * 2. If DEMO_MODE !== 'true', simulated injection is completely impossible.
 *    Any attempt will throw DemoModeDisabledError immediately.
 * 3. Every Slack message produced in demo mode begins with bold:
 *    🚨 [SIMULATED TEST DATA - FOR DEMO ONLY]
 * 4. All injected readings strictly carry provenance: 'simulated'.
 */

import {
  BENGALURU_TECH_CORRIDORS,
  BENGALURU_RAIN_NORMAL,
  BENGALURU_RAIN_DISRUPTED,
  getSimulatedAttendeeReadings,
  generateSimulatedDbCheckRecords,
  SimulationStage,
  SimulatedCheckDbRecord,
  CorridorFixture,
} from './demoFixtures.js';
import { evaluateDecision } from '../decision/decisionCore.js';
import {
  DecisionEvaluation,
  PreviousState,
  RainForecast,
  PlanPolicy,
} from '../decision/types.js';
import { recordAudit } from '../security/auditLog.js';

export const SIMULATED_BANNER = '🚨 *[SIMULATED TEST DATA - FOR DEMO ONLY]*';
export const SIMULATED_BANNER_RAW = '🚨 [SIMULATED TEST DATA - FOR DEMO ONLY]';

/**
 * Custom error thrown when simulated disruption is triggered outside of DEMO_MODE=true.
 */
export class DemoModeDisabledError extends Error {
  constructor(
    message: string = 'Simulated injection is impossible: DEMO_MODE is not enabled (expected process.env.DEMO_MODE === "true").'
  ) {
    super(message);
    this.name = 'DemoModeDisabledError';
  }
}

/**
 * Checks whether deterministic demo mode is active.
 * Strictly requires DEMO_MODE === 'true'.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/**
 * Non-negotiable safety guard.
 * Throws DemoModeDisabledError if DEMO_MODE !== 'true'.
 */
export function assertDemoMode(): void {
  if (!isDemoModeEnabled()) {
    throw new DemoModeDisabledError();
  }
}

/**
 * Format any Slack message produced in demo mode.
 * Invariant: Every message MUST begin with bold:
 * 🚨 [SIMULATED TEST DATA - FOR DEMO ONLY]
 */
export function formatDemoSlackMessage(
  text: string,
  blocks?: any[]
): { text: string; blocks: any[] } {
  const prefixedText = `${SIMULATED_BANNER}\n${text}`;

  const bannerBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${SIMULATED_BANNER}`,
    },
  };

  const existingBlocks = Array.isArray(blocks) ? blocks : [];
  const combinedBlocks = [bannerBlock, ...existingBlocks];

  return {
    text: prefixedText,
    blocks: combinedBlocks,
  };
}

export interface InjectSimulatedDisruptionOptions {
  planId: string;
  workspaceId?: string;
  stage?: SimulationStage;
  checkedAt?: Date;
  providerTimestamp?: Date;
  previousState?: PreviousState | null;
  policy?: Partial<PlanPolicy>;
  rainForecast?: RainForecast | null;
  corridors?: readonly CorridorFixture[];
  prismaClient?: any;
}

export interface SimulatedDisruptionResult {
  planId: string;
  stage: SimulationStage;
  provenance: 'simulated';
  checks: SimulatedCheckDbRecord[];
  evaluation: DecisionEvaluation;
  slackMessage: { text: string; blocks: any[] };
  recordedAuditLogId?: string;
}

/**
 * Injects simulated disruption checks into database storage.
 * Enforces non-negotiable safety guard: throws if DEMO_MODE !== 'true'.
 */
export async function injectSimulatedDisruption(
  options: InjectSimulatedDisruptionOptions
): Promise<SimulatedDisruptionResult> {
  // Non-negotiable safety check: cannot inject unless DEMO_MODE === 'true'
  assertDemoMode();

  const {
    planId,
    workspaceId = 'demo-workspace',
    stage = 'first_breach',
    checkedAt = new Date(),
    providerTimestamp = new Date(),
    previousState = null,
    policy,
    rainForecast = stage === 'normal' ? BENGALURU_RAIN_NORMAL : BENGALURU_RAIN_DISRUPTED,
    corridors = BENGALURU_TECH_CORRIDORS,
    prismaClient,
  } = options;

  // 1. Generate simulated check records tagged with provenance: 'simulated'
  const checks = generateSimulatedDbCheckRecords(
    planId,
    stage,
    checkedAt,
    providerTimestamp,
    corridors
  );

  // 2. Persist to database if Prisma client is provided
  if (prismaClient) {
    if (prismaClient.check?.createMany) {
      await prismaClient.check.createMany({
        data: checks.map((chk) => ({
          id: chk.id,
          planId: chk.planId,
          memberId: chk.memberId,
          checkedAt: chk.checkedAt,
          providerTimestamp: chk.providerTimestamp,
          durationSeconds: chk.durationSeconds,
          baselineSeconds: chk.baselineSeconds,
          status: chk.status,
          provenance: 'simulated', // Guaranteed simulated
        })),
      });
    } else if (prismaClient.$executeRawUnsafe) {
      for (const chk of checks) {
        await prismaClient.$executeRawUnsafe(
          `INSERT INTO checks (id, "planId", "memberId", "checkedAt", "providerTimestamp", "durationSeconds", "baselineSeconds", status, provenance)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          chk.id,
          chk.planId,
          chk.memberId,
          chk.checkedAt,
          chk.providerTimestamp,
          chk.durationSeconds,
          chk.baselineSeconds,
          chk.status,
          'simulated'
        );
      }
    }
  }

  // 3. Evaluate decision invariants using pure engine
  const readings = getSimulatedAttendeeReadings(stage, providerTimestamp, corridors);
  const evaluation = evaluateDecision({
    readings,
    rainForecast,
    previousState,
    policy,
    evaluationTime: checkedAt,
  });

  // 4. Format Slack notification with required SIMULATED disclaimer
  const baseNotificationText = [
    `*Bengaluru Commute Simulation [Stage: ${stage.toUpperCase()}]*`,
    `• Affected attendees: *${evaluation.affectedCount} of ${evaluation.totalEligibleCount}* (${evaluation.affectedPercent.toFixed(1)}%)`,
    `• Decision outcome: *${evaluation.outcome}*`,
    `• Weather condition: ${rainForecast ? `${rainForecast.precipitationProbability}% rain, ${rainForecast.rainfallMm}mm` : 'None'}`,
    `• Consecutive flagged checks: *${evaluation.newConsecutiveFlaggedChecks}*`,
    ...evaluation.reasons.map((r) => `> ${r}`),
  ].join('\n');

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Tripwire Bengaluru Simulation (${stage})`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: baseNotificationText,
      },
    },
  ];

  const slackMessage = formatDemoSlackMessage(baseNotificationText, blocks);

  // 5. Record audit log entry
  let recordedAuditLogId: string | undefined;
  try {
    const auditRecord = await recordAudit(
      workspaceId,
      'SIMULATED_CHECKS_INJECTED',
      'DEMO_SIMULATOR',
      `plan:${planId}`,
      {
        stage,
        checkCount: checks.length,
        outcome: evaluation.outcome,
        provenance: 'simulated',
      }
    );
    recordedAuditLogId = auditRecord.id;
  } catch (_e) {
    // If audit log table isn't initialized yet, proceed safely
  }

  return {
    planId,
    stage,
    provenance: 'simulated',
    checks,
    evaluation,
    slackMessage,
    recordedAuditLogId,
  };
}

export interface SimulateHysteresisOptions {
  planId: string;
  workspaceId?: string;
  baseTime?: Date;
  policy?: Partial<PlanPolicy>;
  prismaClient?: any;
}

export interface HysteresisSimulationResult {
  step1FirstBreach: SimulatedDisruptionResult;
  step2DuplicateTimestampReplay: {
    evaluation: DecisionEvaluation;
    isDuplicateIgnored: boolean;
  };
  step3SecondBreachConfirmed: SimulatedDisruptionResult;
  invariantVerification: {
    firstBreachRequiresConfirmation: boolean;
    replayDoesNotAdvanceCheck: boolean;
    secondBreachTriggersRecommendation: boolean;
  };
}

/**
 * Runs a complete 2-breach hysteresis simulation sequence for evaluator demonstrations.
 * Demonstrates:
 * Step 1: First breach -> CONFIRMING (consecutive = 1, suppresses premature team alert)
 * Step 2: Replay of identical timestamp -> Ignored, does not increment consecutive checks
 * Step 3: Second consecutive breach with advancing timestamp -> RECOMMEND_REMOTE (consecutive = 2)
 */
export async function simulateHysteresisSequence(
  options: SimulateHysteresisOptions
): Promise<HysteresisSimulationResult> {
  assertDemoMode();

  const {
    planId,
    workspaceId = 'demo-workspace',
    baseTime = new Date('2026-11-22T08:00:00.000Z'),
    policy,
    prismaClient,
  } = options;

  // Step 1: Initial breach (e.g. 08:00:00)
  const time1 = new Date(baseTime.getTime());
  const step1FirstBreach = await injectSimulatedDisruption({
    planId,
    workspaceId,
    stage: 'first_breach',
    checkedAt: time1,
    providerTimestamp: time1,
    previousState: {
      consecutiveFlaggedChecks: 0,
      lastCheckedAt: null,
      lastProviderTimestamp: null,
    },
    policy,
    prismaClient,
  });

  // Step 2: Duplicate / Replayed timestamp check
  // Evaluates same timestamp against step1 state to prove replay safety
  const replayReadings = getSimulatedAttendeeReadings('first_breach', time1);
  const step2ReplayEvaluation = evaluateDecision({
    readings: replayReadings,
    evaluationTime: new Date(time1.getTime() + 60000), // Checked 1 min later
    previousState: {
      consecutiveFlaggedChecks: step1FirstBreach.evaluation.newConsecutiveFlaggedChecks,
      lastCheckedAt: time1,
      lastProviderTimestamp: time1,
    },
    policy,
  });

  // Step 3: Second consecutive breach (10 minutes later: 08:10:00 with advancing timestamp)
  const time2 = new Date(baseTime.getTime() + 10 * 60 * 1000);
  const step3SecondBreachConfirmed = await injectSimulatedDisruption({
    planId,
    workspaceId,
    stage: 'second_breach',
    checkedAt: time2,
    providerTimestamp: time2,
    previousState: {
      consecutiveFlaggedChecks: step1FirstBreach.evaluation.newConsecutiveFlaggedChecks,
      lastCheckedAt: time1,
      lastProviderTimestamp: time1,
    },
    policy,
    prismaClient,
  });

  return {
    step1FirstBreach,
    step2DuplicateTimestampReplay: {
      evaluation: step2ReplayEvaluation,
      isDuplicateIgnored: step2ReplayEvaluation.newConsecutiveFlaggedChecks === 1,
    },
    step3SecondBreachConfirmed,
    invariantVerification: {
      firstBreachRequiresConfirmation: step1FirstBreach.evaluation.outcome === 'CONFIRMING',
      replayDoesNotAdvanceCheck: step2ReplayEvaluation.newConsecutiveFlaggedChecks === 1,
      secondBreachTriggersRecommendation:
        step3SecondBreachConfirmed.evaluation.outcome === 'RECOMMEND_REMOTE',
    },
  };
}
