import {
  AttendeeReading,
  DecisionEvaluation,
  DecisionOutcome,
  EvaluateDecisionInput,
  PlanPolicy,
  PreviousState,
  RainForecast,
  DEFAULT_PLAN_POLICY,
} from './types';

/**
 * Checks whether an attendee's reading is unknown, malformed, or stale.
 * A reading is considered unknown if:
 * 1. Its status is explicitly 'unknown'
 * 2. durationSeconds is null, undefined, NaN, or negative
 * 3. providerTimestamp is invalid, in the future, or older than freshnessMaxAgeSeconds relative to evaluationTime
 */
export function isReadingUnknown(
  reading: AttendeeReading,
  evaluationTime: Date = new Date(),
  freshnessMaxAgeSeconds: number = DEFAULT_PLAN_POLICY.freshnessMaxAgeSeconds
): boolean {
  if (reading.status === 'unknown') {
    return true;
  }

  if (
    reading.durationSeconds === null ||
    reading.durationSeconds === undefined ||
    typeof reading.durationSeconds !== 'number' ||
    Number.isNaN(reading.durationSeconds) ||
    reading.durationSeconds < 0
  ) {
    return true;
  }

  if (!reading.providerTimestamp || Number.isNaN(reading.providerTimestamp.getTime())) {
    return true;
  }

  const ageSeconds = (evaluationTime.getTime() - reading.providerTimestamp.getTime()) / 1000;
  // If timestamp is older than max allowed age or set in the future (> 0 drift)
  if (ageSeconds > freshnessMaxAgeSeconds || ageSeconds < 0) {
    return true;
  }

  return false;
}

/**
 * Checks whether an attendee is "affected" according to the plan policy:
 * (durationMinutes > personalMaxMinutes) || (baselineSeconds > 0 && durationSeconds >= baselineMultiplier * baselineSeconds)
 * Unknown or invalid readings cannot be deemed affected.
 */
export function isAttendeeAffected(
  reading: AttendeeReading,
  baselineMultiplier: number = DEFAULT_PLAN_POLICY.baselineMultiplier
): boolean {
  if (
    reading.durationSeconds === null ||
    reading.durationSeconds === undefined ||
    typeof reading.durationSeconds !== 'number' ||
    Number.isNaN(reading.durationSeconds) ||
    reading.durationSeconds < 0
  ) {
    return false;
  }

  const durationMinutes = reading.durationSeconds / 60;

  const exceedsPersonalMax =
    typeof reading.personalMaxMinutes === 'number' &&
    !Number.isNaN(reading.personalMaxMinutes) &&
    durationMinutes > reading.personalMaxMinutes;

  const exceedsBaseline =
    reading.baselineSeconds !== null &&
    reading.baselineSeconds !== undefined &&
    typeof reading.baselineSeconds === 'number' &&
    !Number.isNaN(reading.baselineSeconds) &&
    reading.baselineSeconds > 0 &&
    reading.durationSeconds >= baselineMultiplier * reading.baselineSeconds;

  return exceedsPersonalMax || exceedsBaseline;
}

/**
 * Checks whether rain conditions trigger policy tightening.
 * Threshold drops from standard (40%) to rain threshold (30%) if:
 * precipitationProbability >= 70% AND rainfallMm > 0.5mm
 */
export function isRainTightened(
  rainForecast?: RainForecast | null,
  heavyRainProbabilityPercent: number = DEFAULT_PLAN_POLICY.heavyRainProbabilityPercent,
  rainfallMmThreshold: number = DEFAULT_PLAN_POLICY.rainfallMmThreshold ?? 0.5
): boolean {
  if (!rainForecast) {
    return false;
  }

  if (
    typeof rainForecast.precipitationProbability !== 'number' ||
    Number.isNaN(rainForecast.precipitationProbability) ||
    typeof rainForecast.rainfallMm !== 'number' ||
    Number.isNaN(rainForecast.rainfallMm)
  ) {
    return false;
  }

  return (
    rainForecast.precipitationProbability >= heavyRainProbabilityPercent &&
    rainForecast.rainfallMm > rainfallMmThreshold
  );
}

/**
 * Pure mathematical invariant engine for Tripwire Teams commute decision evaluation.
 * Enforces all non-negotiable rules without database, network, or console logging.
 */
export function evaluateDecision(input: EvaluateDecisionInput): DecisionEvaluation {
  const policy: PlanPolicy = {
    ...DEFAULT_PLAN_POLICY,
    ...input.policy,
  };

  const evaluationTime = input.evaluationTime ?? new Date();
  const previousState: PreviousState | null = input.previousState ?? null;
  const reasons: string[] = [];

  // Rule a: Skipped members are excluded from denominator and numerator
  const eligibleReadings = input.readings.filter(r => !r.hasSkipped);
  const totalEligibleCount = eligibleReadings.length;

  if (totalEligibleCount === 0) {
    return {
      outcome: 'GO',
      affectedCount: 0,
      totalEligibleCount: 0,
      affectedPercent: 0,
      reasons: ['No eligible attendees to evaluate (all attendees skipped or none present).'],
      privateHeadsUpMemberIds: [],
      newConsecutiveFlaggedChecks: 0,
    };
  }

  // Rule b, c, d: Identify unknown and stale readings
  const unknownCount = eligibleReadings.filter(r =>
    isReadingUnknown(r, evaluationTime, policy.freshnessMaxAgeSeconds)
  ).length;

  const unknownPercent = (unknownCount / totalEligibleCount) * 100;
  const unknownMaxSharePercent = policy.unknownMaxSharePercent ?? 30;

  // Rule d: If > 30% of eligible attendees are unknown, immediately return CANNOT_ASSESS
  if (unknownPercent > unknownMaxSharePercent) {
    // Invariant: Unknown is never OK and never resets a pending breach to OK silently
    return {
      outcome: 'CANNOT_ASSESS',
      affectedCount: 0,
      totalEligibleCount,
      affectedPercent: 0,
      reasons: [
        `Cannot assess team status: ${unknownCount} of ${totalEligibleCount} eligible attendees (${unknownPercent.toFixed(1)}%) have unknown or stale readings, exceeding the maximum allowable threshold of ${unknownMaxSharePercent}%.`,
      ],
      privateHeadsUpMemberIds: [],
      newConsecutiveFlaggedChecks: previousState?.consecutiveFlaggedChecks ?? 0,
    };
  }

  // Rule 11: Deduplication & Replay Check
  // Check if provider timestamp has strictly advanced beyond previousState.lastProviderTimestamp
  const validTimestamps = eligibleReadings
    .map(r => r.providerTimestamp?.getTime())
    .filter((ts): ts is number => typeof ts === 'number' && !Number.isNaN(ts));

  const latestProviderTimestampMs = validTimestamps.length > 0 ? Math.max(...validTimestamps) : 0;

  const isDuplicateProviderTimestamp = Boolean(
    previousState?.lastProviderTimestamp &&
    latestProviderTimestampMs > 0 &&
    latestProviderTimestampMs <= previousState.lastProviderTimestamp.getTime()
  );

  // Evaluate affected attendees among known fresh readings
  const knownFreshReadings = eligibleReadings.filter(
    r => !isReadingUnknown(r, evaluationTime, policy.freshnessMaxAgeSeconds)
  );

  const affectedReadings = knownFreshReadings.filter(r =>
    isAttendeeAffected(r, policy.baselineMultiplier)
  );
  const affectedCount = affectedReadings.length;
  const affectedPercent = Math.round((affectedCount / totalEligibleCount) * 10000) / 100;

  // Rule f: Rain tightening
  const isRainActive = isRainTightened(
    input.rainForecast,
    policy.heavyRainProbabilityPercent,
    policy.rainfallMmThreshold
  );

  const effectiveThresholdPercent = isRainActive
    ? policy.rainAffectedThresholdPercent
    : policy.affectedThresholdPercent;

  if (isRainActive && input.rainForecast) {
    reasons.push(
      `Heavy rain forecast detected (${input.rainForecast.precipitationProbability}% chance, ${input.rainForecast.rainfallMm}mm): affected threshold lowered from ${policy.affectedThresholdPercent}% to ${policy.rainAffectedThresholdPercent}%.`
    );
  }

  const isTeamFlagged = affectedPercent >= effectiveThresholdPercent;

  // Handle replayed / duplicate provider timestamp
  if (isDuplicateProviderTimestamp) {
    const prevConsecutive = previousState?.consecutiveFlaggedChecks ?? 0;
    const outcome: DecisionOutcome =
      prevConsecutive >= 2 ? 'RECOMMEND_REMOTE' : prevConsecutive === 1 ? 'CONFIRMING' : 'GO';

    reasons.push(
      `Duplicate or replayed provider timestamp detected (${new Date(latestProviderTimestampMs).toISOString()}); ignored for state transitions.`
    );

    return {
      outcome,
      affectedCount,
      totalEligibleCount,
      affectedPercent,
      reasons,
      privateHeadsUpMemberIds: !isTeamFlagged ? affectedReadings.map(r => r.memberId) : [],
      newConsecutiveFlaggedChecks: prevConsecutive,
    };
  }

  // Rule g: Two-breach confirmation
  if (isTeamFlagged) {
    const prevConsecutive = previousState?.consecutiveFlaggedChecks ?? 0;
    const newConsecutive = prevConsecutive + 1;
    const outcome: DecisionOutcome = newConsecutive >= 2 ? 'RECOMMEND_REMOTE' : 'CONFIRMING';

    if (outcome === 'RECOMMEND_REMOTE') {
      reasons.push(
        `Remote commute recommended: ${affectedCount} of ${totalEligibleCount} eligible attendees affected (${affectedPercent.toFixed(1)}%), meeting threshold of ${effectiveThresholdPercent}% on ${newConsecutive} consecutive checks.`
      );
    } else {
      reasons.push(
        `Commute threshold breached: ${affectedCount} of ${totalEligibleCount} eligible attendees affected (${affectedPercent.toFixed(1)}%), meeting threshold of ${effectiveThresholdPercent}%. Breach confirming (check 1 of 2 required).`
      );
    }

    return {
      outcome,
      affectedCount,
      totalEligibleCount,
      affectedPercent,
      reasons,
      privateHeadsUpMemberIds: [], // Whole team is flagged, individual private heads-ups suppressed
      newConsecutiveFlaggedChecks: newConsecutive,
    };
  }

  // Rule h: Normal reading resets consecutive checks to 0 (GO)
  reasons.push(
    `Commute within normal limits: ${affectedCount} of ${totalEligibleCount} eligible attendees affected (${affectedPercent.toFixed(1)}%), below threshold of ${effectiveThresholdPercent}%. Team travel is GO.`
  );

  // Rule i: Private heads-up list for individually affected members when team threshold is not met
  const privateHeadsUpMemberIds = affectedReadings.map(r => r.memberId);
  if (privateHeadsUpMemberIds.length > 0) {
    reasons.push(
      `Private heads-up generated for ${privateHeadsUpMemberIds.length} individually affected attendee(s).`
    );
  }

  return {
    outcome: 'GO',
    affectedCount,
    totalEligibleCount,
    affectedPercent,
    reasons,
    privateHeadsUpMemberIds,
    newConsecutiveFlaggedChecks: 0,
  };
}
