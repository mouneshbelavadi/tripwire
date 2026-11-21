import { describe, it, expect } from 'vitest';
import {
  evaluateDecision,
  isAttendeeAffected,
  isReadingUnknown,
  isRainTightened,
} from './decisionCore';
import {
  AttendeeReading,
  DEFAULT_PLAN_POLICY,
  PreviousState,
  RainForecast,
} from './types';

// Helper to construct test readings concisely
function createReading(overrides: Partial<AttendeeReading> = {}): AttendeeReading {
  return {
    memberId: overrides.memberId ?? 'member-1',
    durationSeconds: overrides.durationSeconds !== undefined ? overrides.durationSeconds : 1200, // 20 min
    baselineSeconds: overrides.baselineSeconds !== undefined ? overrides.baselineSeconds : 1200, // 20 min
    personalMaxMinutes: overrides.personalMaxMinutes !== undefined ? overrides.personalMaxMinutes : 45,
    status: overrides.status ?? 'ok',
    providerTimestamp: overrides.providerTimestamp ?? new Date('2026-11-21T08:00:00Z'),
    hasSkipped: overrides.hasSkipped ?? false,
  };
}

describe('Decision Core Invariant Engine', () => {
  const baseTime = new Date('2026-11-21T08:05:00Z');
  const providerTime1 = new Date('2026-11-21T08:00:00Z');
  const providerTime2 = new Date('2026-11-21T08:05:00Z');

  // 1. Baseline clear day: 0% affected -> GO
  it('1. Baseline clear day: 0% affected -> GO', () => {
    const readings: AttendeeReading[] = [
      createReading({ memberId: 'm1', durationSeconds: 1200, personalMaxMinutes: 45, baselineSeconds: 1200 }),
      createReading({ memberId: 'm2', durationSeconds: 1500, personalMaxMinutes: 45, baselineSeconds: 1500 }),
      createReading({ memberId: 'm3', durationSeconds: 900, personalMaxMinutes: 45, baselineSeconds: 900 }),
      createReading({ memberId: 'm4', durationSeconds: 1800, personalMaxMinutes: 45, baselineSeconds: 1800 }),
      createReading({ memberId: 'm5', durationSeconds: 1200, personalMaxMinutes: 45, baselineSeconds: 1200 }),
    ];

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
    });

    expect(result.outcome).toBe('GO');
    expect(result.affectedCount).toBe(0);
    expect(result.totalEligibleCount).toBe(5);
    expect(result.affectedPercent).toBe(0);
    expect(result.newConsecutiveFlaggedChecks).toBe(0);
    expect(result.privateHeadsUpMemberIds).toEqual([]);
  });

  // 2. Single person affected below 40% -> GO + private heads-up
  it('2. Single person affected below 40% -> GO + private heads-up', () => {
    const readings: AttendeeReading[] = [
      createReading({ memberId: 'm1', durationSeconds: 3000, personalMaxMinutes: 45 }), // 50m > 45m -> affected
      createReading({ memberId: 'm2', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm3', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm4', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm5', durationSeconds: 1200, personalMaxMinutes: 45 }),
    ];

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
    });

    expect(result.outcome).toBe('GO');
    expect(result.affectedCount).toBe(1);
    expect(result.totalEligibleCount).toBe(5);
    expect(result.affectedPercent).toBe(20);
    expect(result.newConsecutiveFlaggedChecks).toBe(0);
    expect(result.privateHeadsUpMemberIds).toEqual(['m1']);
  });

  // 3. 45% affected on check 1 -> CONFIRMING (1 of 2)
  it('3. 45% affected on check 1 -> CONFIRMING (1 of 2)', () => {
    // 9 of 20 affected = 45%
    const readings: AttendeeReading[] = Array.from({ length: 20 }, (_, i) =>
      createReading({
        memberId: `m${i + 1}`,
        durationSeconds: i < 9 ? 3600 : 1200, // 9 affected (60 min > 45 max)
        personalMaxMinutes: 45,
        providerTimestamp: providerTime1,
      })
    );

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
      previousState: null,
    });

    expect(result.outcome).toBe('CONFIRMING');
    expect(result.affectedCount).toBe(9);
    expect(result.totalEligibleCount).toBe(20);
    expect(result.affectedPercent).toBe(45);
    expect(result.newConsecutiveFlaggedChecks).toBe(1);
    expect(result.privateHeadsUpMemberIds).toEqual([]);
  });

  // 4. 45% affected on check 2 -> RECOMMEND_REMOTE (2 of 2)
  it('4. 45% affected on check 2 -> RECOMMEND_REMOTE (2 of 2)', () => {
    const readings: AttendeeReading[] = Array.from({ length: 20 }, (_, i) =>
      createReading({
        memberId: `m${i + 1}`,
        durationSeconds: i < 9 ? 3600 : 1200,
        personalMaxMinutes: 45,
        providerTimestamp: providerTime2,
      })
    );

    const previousState: PreviousState = {
      consecutiveFlaggedChecks: 1,
      lastCheckedAt: new Date('2026-11-21T08:00:00Z'),
      lastProviderTimestamp: providerTime1,
    };

    const result = evaluateDecision({
      readings,
      evaluationTime: new Date('2026-11-21T08:10:00Z'),
      previousState,
    });

    expect(result.outcome).toBe('RECOMMEND_REMOTE');
    expect(result.affectedCount).toBe(9);
    expect(result.totalEligibleCount).toBe(20);
    expect(result.affectedPercent).toBe(45);
    expect(result.newConsecutiveFlaggedChecks).toBe(2);
    expect(result.privateHeadsUpMemberIds).toEqual([]);
  });

  // 5. Spike then clear check -> resets to GO
  it('5. Spike then clear check -> resets to GO', () => {
    // All 5 attendees commute normally
    const readings: AttendeeReading[] = Array.from({ length: 5 }, (_, i) =>
      createReading({
        memberId: `m${i + 1}`,
        durationSeconds: 1200,
        personalMaxMinutes: 45,
        providerTimestamp: providerTime2,
      })
    );

    const previousState: PreviousState = {
      consecutiveFlaggedChecks: 1, // Pending breach from spike
      lastCheckedAt: new Date('2026-11-21T08:00:00Z'),
      lastProviderTimestamp: providerTime1,
    };

    const result = evaluateDecision({
      readings,
      evaluationTime: new Date('2026-11-21T08:10:00Z'),
      previousState,
    });

    expect(result.outcome).toBe('GO');
    expect(result.affectedCount).toBe(0);
    expect(result.affectedPercent).toBe(0);
    expect(result.newConsecutiveFlaggedChecks).toBe(0);
    expect(result.privateHeadsUpMemberIds).toEqual([]);
  });

  // 6. Exactly at 40% threshold -> CONFIRMING / RECOMMEND_REMOTE
  it('6a. Exactly at 40% threshold -> CONFIRMING on check 1', () => {
    // 2 of 5 = exactly 40.0%
    const readings: AttendeeReading[] = [
      createReading({ memberId: 'm1', durationSeconds: 3000, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm2', durationSeconds: 3000, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm3', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm4', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm5', durationSeconds: 1200, personalMaxMinutes: 45 }),
    ];

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
    });

    expect(result.outcome).toBe('CONFIRMING');
    expect(result.affectedCount).toBe(2);
    expect(result.totalEligibleCount).toBe(5);
    expect(result.affectedPercent).toBe(40);
    expect(result.newConsecutiveFlaggedChecks).toBe(1);
  });

  it('6b. Exactly at 40% threshold -> RECOMMEND_REMOTE on check 2', () => {
    const readings: AttendeeReading[] = [
      createReading({ memberId: 'm1', durationSeconds: 3000, personalMaxMinutes: 45, providerTimestamp: providerTime2 }),
      createReading({ memberId: 'm2', durationSeconds: 3000, personalMaxMinutes: 45, providerTimestamp: providerTime2 }),
      createReading({ memberId: 'm3', durationSeconds: 1200, personalMaxMinutes: 45, providerTimestamp: providerTime2 }),
      createReading({ memberId: 'm4', durationSeconds: 1200, personalMaxMinutes: 45, providerTimestamp: providerTime2 }),
      createReading({ memberId: 'm5', durationSeconds: 1200, personalMaxMinutes: 45, providerTimestamp: providerTime2 }),
    ];

    const previousState: PreviousState = {
      consecutiveFlaggedChecks: 1,
      lastCheckedAt: new Date('2026-11-21T08:00:00Z'),
      lastProviderTimestamp: providerTime1,
    };

    const result = evaluateDecision({
      readings,
      evaluationTime: new Date('2026-11-21T08:10:00Z'),
      previousState,
    });

    expect(result.outcome).toBe('RECOMMEND_REMOTE');
    expect(result.affectedCount).toBe(2);
    expect(result.affectedPercent).toBe(40);
    expect(result.newConsecutiveFlaggedChecks).toBe(2);
  });

  // 7. Rain forecast 75% -> triggers 30% threshold
  it('7. Rain forecast 75% -> triggers 30% threshold', () => {
    // 3 of 10 = 30.0% affected
    const readings: AttendeeReading[] = Array.from({ length: 10 }, (_, i) =>
      createReading({
        memberId: `m${i + 1}`,
        durationSeconds: i < 3 ? 3600 : 1200,
        personalMaxMinutes: 45,
      })
    );

    const rainForecast: RainForecast = {
      precipitationProbability: 75,
      rainfallMm: 1.2,
    };

    const result = evaluateDecision({
      readings,
      rainForecast,
      evaluationTime: baseTime,
    });

    // Under 40%, 30% would be GO, but rain drops threshold to 30%, so 30% flags!
    expect(result.outcome).toBe('CONFIRMING');
    expect(result.affectedCount).toBe(3);
    expect(result.totalEligibleCount).toBe(10);
    expect(result.affectedPercent).toBe(30);
    expect(result.newConsecutiveFlaggedChecks).toBe(1);
    expect(result.reasons.some(r => r.includes('Heavy rain forecast detected'))).toBe(true);
  });

  // 8. Rain forecast 50% -> maintains 40% threshold
  it('8. Rain forecast 50% -> maintains 40% threshold', () => {
    // 3 of 10 = 30% affected
    const readings: AttendeeReading[] = Array.from({ length: 10 }, (_, i) =>
      createReading({
        memberId: `m${i + 1}`,
        durationSeconds: i < 3 ? 3600 : 1200,
        personalMaxMinutes: 45,
      })
    );

    const rainForecast: RainForecast = {
      precipitationProbability: 50,
      rainfallMm: 3.0,
    };

    const result = evaluateDecision({
      readings,
      rainForecast,
      evaluationTime: baseTime,
    });

    expect(result.outcome).toBe('GO');
    expect(result.affectedCount).toBe(3);
    expect(result.totalEligibleCount).toBe(10);
    expect(result.affectedPercent).toBe(30);
    expect(result.newConsecutiveFlaggedChecks).toBe(0);
    expect(result.privateHeadsUpMemberIds).toEqual(['m1', 'm2', 'm3']);
  });

  // 9. 35% unknown readings (>30%) -> CANNOT_ASSESS
  it('9. 35% unknown readings (>30%) -> CANNOT_ASSESS', () => {
    // 7 unknown out of 20 = 35% > 30%
    const readings: AttendeeReading[] = Array.from({ length: 20 }, (_, i) =>
      createReading({
        memberId: `m${i + 1}`,
        status: i < 7 ? 'unknown' : 'ok',
        durationSeconds: i < 7 ? null : 1200,
      })
    );

    const previousState: PreviousState = {
      consecutiveFlaggedChecks: 1, // Pending breach must not be silently cleared
      lastCheckedAt: new Date('2026-11-21T08:00:00Z'),
      lastProviderTimestamp: providerTime1,
    };

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
      previousState,
    });

    expect(result.outcome).toBe('CANNOT_ASSESS');
    expect(result.totalEligibleCount).toBe(20);
    // Invariant: Unknown never resets a pending breach to OK silently!
    expect(result.newConsecutiveFlaggedChecks).toBe(1);
    expect(result.privateHeadsUpMemberIds).toEqual([]);
  });

  // 10. Skipped members do not skew percentage
  it('10. Skipped members do not skew percentage', () => {
    // 10 total members, 5 skipped.
    // Of the remaining 5 eligible: 2 affected (2/5 = 40.0% -> meets 40% threshold!)
    const readings: AttendeeReading[] = [
      createReading({ memberId: 'm1', durationSeconds: 3000, personalMaxMinutes: 45, hasSkipped: false }),
      createReading({ memberId: 'm2', durationSeconds: 3000, personalMaxMinutes: 45, hasSkipped: false }),
      createReading({ memberId: 'm3', durationSeconds: 1200, personalMaxMinutes: 45, hasSkipped: false }),
      createReading({ memberId: 'm4', durationSeconds: 1200, personalMaxMinutes: 45, hasSkipped: false }),
      createReading({ memberId: 'm5', durationSeconds: 1200, personalMaxMinutes: 45, hasSkipped: false }),
      // Skipped members: even if they have long or short durations, they are excluded
      createReading({ memberId: 'm6', durationSeconds: 5000, personalMaxMinutes: 45, hasSkipped: true }),
      createReading({ memberId: 'm7', durationSeconds: 5000, personalMaxMinutes: 45, hasSkipped: true }),
      createReading({ memberId: 'm8', durationSeconds: 500, personalMaxMinutes: 45, hasSkipped: true }),
      createReading({ memberId: 'm9', durationSeconds: 500, personalMaxMinutes: 45, hasSkipped: true }),
      createReading({ memberId: 'm10', durationSeconds: 500, personalMaxMinutes: 45, hasSkipped: true }),
    ];

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
    });

    expect(result.totalEligibleCount).toBe(5);
    expect(result.affectedCount).toBe(2);
    expect(result.affectedPercent).toBe(40);
    expect(result.outcome).toBe('CONFIRMING');
  });

  // 11. Replayed / duplicate provider timestamp ignored
  it('11. Replayed / duplicate provider timestamp ignored', () => {
    // Check 1 flagged with providerTime1
    const readings: AttendeeReading[] = [
      createReading({ memberId: 'm1', durationSeconds: 3000, personalMaxMinutes: 45, providerTimestamp: providerTime1 }),
      createReading({ memberId: 'm2', durationSeconds: 3000, personalMaxMinutes: 45, providerTimestamp: providerTime1 }),
    ];

    const previousState: PreviousState = {
      consecutiveFlaggedChecks: 1,
      lastCheckedAt: new Date('2026-11-21T08:00:00Z'),
      lastProviderTimestamp: providerTime1, // EXACT SAME provider timestamp (replayed cache hit)
    };

    const result = evaluateDecision({
      readings,
      evaluationTime: new Date('2026-11-21T08:05:00Z'),
      previousState,
    });

    // A cached response replay is not a second confirmation!
    expect(result.outcome).toBe('CONFIRMING');
    expect(result.newConsecutiveFlaggedChecks).toBe(1); // Did not increment to 2!
    expect(result.reasons.some(r => r.includes('Duplicate or replayed provider timestamp'))).toBe(true);
  });

  // 12. Stale provider timestamp (>10m) treated as unknown
  it('12. Stale provider timestamp (>10m) treated as unknown', () => {
    const evalTime = new Date('2026-11-21T08:20:00Z');
    const staleTime = new Date('2026-11-21T08:05:00Z'); // 15 mins old (> 10m freshness limit)

    // 4 of 10 are stale (> 30% unknown)
    const readings: AttendeeReading[] = Array.from({ length: 10 }, (_, i) =>
      createReading({
        memberId: `m${i + 1}`,
        durationSeconds: 1200,
        providerTimestamp: i < 4 ? staleTime : new Date('2026-11-21T08:15:00Z'),
      })
    );

    const result = evaluateDecision({
      readings,
      evaluationTime: evalTime,
    });

    expect(result.outcome).toBe('CANNOT_ASSESS');
    expect(result.reasons.some(r => r.includes('unknown or stale readings'))).toBe(true);
  });

  // 13. Boundary: Baseline seconds is zero (baselineSeconds = 0)
  it('13. Boundary: Baseline seconds is zero (baselineSeconds = 0)', () => {
    const reading = createReading({
      memberId: 'm1',
      durationSeconds: 1800, // 30 min
      baselineSeconds: 0,
      personalMaxMinutes: 45,
    });

    expect(isAttendeeAffected(reading)).toBe(false);

    const result = evaluateDecision({
      readings: [reading],
      evaluationTime: baseTime,
    });
    expect(result.outcome).toBe('GO');
    expect(result.affectedCount).toBe(0);
  });

  // 14. Boundary: Baseline seconds is null or negative
  it('14. Boundary: Baseline seconds is null or negative', () => {
    const rNull = createReading({ memberId: 'm1', durationSeconds: 1800, baselineSeconds: null, personalMaxMinutes: 45 });
    const rNeg = createReading({ memberId: 'm2', durationSeconds: 1800, baselineSeconds: -600, personalMaxMinutes: 45 });

    expect(isAttendeeAffected(rNull)).toBe(false);
    expect(isAttendeeAffected(rNeg)).toBe(false);
  });

  // 15. Boundary: Negative durationSeconds treated as unknown
  it('15. Boundary: Negative durationSeconds treated as unknown', () => {
    const rNegDuration = createReading({ memberId: 'm1', durationSeconds: -100 });
    expect(isReadingUnknown(rNegDuration, baseTime)).toBe(true);
    expect(isAttendeeAffected(rNegDuration)).toBe(false);
  });

  // 16. Boundary: NaN durationSeconds treated as unknown
  it('16. Boundary: NaN durationSeconds treated as unknown', () => {
    const rNaN = createReading({ memberId: 'm1', durationSeconds: Number.NaN });
    expect(isReadingUnknown(rNaN, baseTime)).toBe(true);
    expect(isAttendeeAffected(rNaN)).toBe(false);
  });

  // 17. Boundary: NaN baselineSeconds handled safely
  it('17. Boundary: NaN baselineSeconds handled safely', () => {
    const rNaNBaseline = createReading({ memberId: 'm1', durationSeconds: 1800, baselineSeconds: Number.NaN, personalMaxMinutes: 45 });
    expect(isAttendeeAffected(rNaNBaseline)).toBe(false);
  });

  // 18. Boundary: All members skipped (totalEligibleCount = 0)
  it('18. Boundary: All members skipped (totalEligibleCount = 0)', () => {
    const readings = [
      createReading({ memberId: 'm1', hasSkipped: true }),
      createReading({ memberId: 'm2', hasSkipped: true }),
    ];

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
    });

    expect(result.outcome).toBe('GO');
    expect(result.totalEligibleCount).toBe(0);
    expect(result.affectedCount).toBe(0);
    expect(result.affectedPercent).toBe(0);
    expect(result.newConsecutiveFlaggedChecks).toBe(0);
  });

  // 19. Boundary: Empty readings list
  it('19. Boundary: Empty readings list', () => {
    const result = evaluateDecision({
      readings: [],
      evaluationTime: baseTime,
    });

    expect(result.outcome).toBe('GO');
    expect(result.totalEligibleCount).toBe(0);
    expect(result.affectedCount).toBe(0);
  });

  // 20. Boundary: 100% of team affected on check 1 and check 2
  it('20. Boundary: 100% of team affected on check 1 and check 2', () => {
    const readings = [
      createReading({ memberId: 'm1', durationSeconds: 3600, personalMaxMinutes: 30, providerTimestamp: providerTime1 }),
      createReading({ memberId: 'm2', durationSeconds: 3600, personalMaxMinutes: 30, providerTimestamp: providerTime1 }),
    ];

    const check1 = evaluateDecision({
      readings,
      evaluationTime: baseTime,
    });
    expect(check1.outcome).toBe('CONFIRMING');
    expect(check1.affectedPercent).toBe(100);
    expect(check1.newConsecutiveFlaggedChecks).toBe(1);

    const check2Readings = [
      createReading({ memberId: 'm1', durationSeconds: 3600, personalMaxMinutes: 30, providerTimestamp: providerTime2 }),
      createReading({ memberId: 'm2', durationSeconds: 3600, personalMaxMinutes: 30, providerTimestamp: providerTime2 }),
    ];

    const check2 = evaluateDecision({
      readings: check2Readings,
      evaluationTime: new Date('2026-11-21T08:10:00Z'),
      previousState: {
        consecutiveFlaggedChecks: 1,
        lastCheckedAt: baseTime,
        lastProviderTimestamp: providerTime1,
      },
    });
    expect(check2.outcome).toBe('RECOMMEND_REMOTE');
    expect(check2.newConsecutiveFlaggedChecks).toBe(2);
  });

  // 21. Boundary: Exactly 30% unknown readings is acceptable (not > 30%)
  it('21. Boundary: Exactly 30% unknown readings is acceptable (not > 30%)', () => {
    // 3 of 10 = exactly 30% unknown
    const readings: AttendeeReading[] = Array.from({ length: 10 }, (_, i) =>
      createReading({
        memberId: `m${i + 1}`,
        status: i < 3 ? 'unknown' : 'ok',
        durationSeconds: i < 3 ? null : 1200,
        personalMaxMinutes: 45,
      })
    );

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
    });

    // 30% is not > 30%, so evaluation proceeds
    expect(result.outcome).toBe('GO');
    expect(result.totalEligibleCount).toBe(10);
  });

  // 22. Boundary: Rain rainfallMm exactly 0.5mm vs 0.51mm
  it('22a. Rain probability 70% and rainfallMm 0.50mm does NOT trigger tightening', () => {
    const forecast: RainForecast = { precipitationProbability: 70, rainfallMm: 0.5 };
    expect(isRainTightened(forecast)).toBe(false);
  });

  it('22b. Rain probability 70% and rainfallMm 0.51mm DOES trigger tightening', () => {
    const forecast: RainForecast = { precipitationProbability: 70, rainfallMm: 0.51 };
    expect(isRainTightened(forecast)).toBe(true);
  });

  // 23. Boundary: PersonalMaxMinutes tie: durationMinutes === personalMaxMinutes
  it('23. PersonalMaxMinutes tie: durationMinutes === personalMaxMinutes is NOT affected', () => {
    // 30 min duration (1800s) === 30 min personal max
    const reading = createReading({
      durationSeconds: 1800,
      personalMaxMinutes: 30,
      baselineSeconds: 1800,
    });

    // Invariant: must strictly exceed personal max
    expect(isAttendeeAffected(reading)).toBe(false);
  });

  // 24. Boundary: Baseline multiplier tie: durationSeconds === 1.35 * baselineSeconds
  it('24. Baseline multiplier tie: durationSeconds === 1.35 * baselineSeconds IS affected', () => {
    // 1000s baseline * 1.35 = 1350s
    const reading = createReading({
      durationSeconds: 1350,
      baselineSeconds: 1000,
      personalMaxMinutes: 60, // personal max not breached
    });

    // Invariant: durationSeconds >= 1.35 * baselineSeconds (inclusive)
    expect(isAttendeeAffected(reading)).toBe(true);
  });

  // 25. Boundary: Consecutive checks progression beyond 2
  it('25. Consecutive checks progression beyond 2 remains RECOMMEND_REMOTE', () => {
    const readings = [
      createReading({ memberId: 'm1', durationSeconds: 3000, personalMaxMinutes: 30, providerTimestamp: providerTime2 }),
      createReading({ memberId: 'm2', durationSeconds: 3000, personalMaxMinutes: 30, providerTimestamp: providerTime2 }),
    ];

    const previousState: PreviousState = {
      consecutiveFlaggedChecks: 2,
      lastCheckedAt: baseTime,
      lastProviderTimestamp: providerTime1,
    };

    const result = evaluateDecision({
      readings,
      evaluationTime: new Date('2026-11-21T08:10:00Z'),
      previousState,
    });

    expect(result.outcome).toBe('RECOMMEND_REMOTE');
    expect(result.newConsecutiveFlaggedChecks).toBe(3);
  });

  // 26. Boundary: CANNOT_ASSESS preserves pending breach and resumes on next clear flagged check
  it('26. CANNOT_ASSESS preserves pending breach across evaluations', () => {
    // Check 1: Flagged -> consecutive = 1
    const readingsFlagged = [
      createReading({ memberId: 'm1', durationSeconds: 3600, personalMaxMinutes: 30, providerTimestamp: providerTime1 }),
      createReading({ memberId: 'm2', durationSeconds: 3600, personalMaxMinutes: 30, providerTimestamp: providerTime1 }),
    ];
    const check1 = evaluateDecision({ readings: readingsFlagged, evaluationTime: baseTime });
    expect(check1.outcome).toBe('CONFIRMING');
    expect(check1.newConsecutiveFlaggedChecks).toBe(1);

    // Check 2: 100% unknown -> CANNOT_ASSESS, preserves consecutive = 1
    const readingsUnknown = [
      createReading({ memberId: 'm1', status: 'unknown', durationSeconds: null, providerTimestamp: providerTime1 }),
      createReading({ memberId: 'm2', status: 'unknown', durationSeconds: null, providerTimestamp: providerTime1 }),
    ];
    const check2 = evaluateDecision({
      readings: readingsUnknown,
      evaluationTime: new Date('2026-11-21T08:08:00Z'),
      previousState: {
        consecutiveFlaggedChecks: check1.newConsecutiveFlaggedChecks,
        lastCheckedAt: baseTime,
        lastProviderTimestamp: providerTime1,
      },
    });
    expect(check2.outcome).toBe('CANNOT_ASSESS');
    expect(check2.newConsecutiveFlaggedChecks).toBe(1);

    // Check 3: Fresh flagged reading -> promotes to RECOMMEND_REMOTE (consecutive = 2)
    const readingsFlagged2 = [
      createReading({ memberId: 'm1', durationSeconds: 3600, personalMaxMinutes: 30, providerTimestamp: providerTime2 }),
      createReading({ memberId: 'm2', durationSeconds: 3600, personalMaxMinutes: 30, providerTimestamp: providerTime2 }),
    ];
    const check3 = evaluateDecision({
      readings: readingsFlagged2,
      evaluationTime: new Date('2026-11-21T08:12:00Z'),
      previousState: {
        consecutiveFlaggedChecks: check2.newConsecutiveFlaggedChecks,
        lastCheckedAt: new Date('2026-11-21T08:08:00Z'),
        lastProviderTimestamp: providerTime1,
      },
    });
    expect(check3.outcome).toBe('RECOMMEND_REMOTE');
    expect(check3.newConsecutiveFlaggedChecks).toBe(2);
  });

  // 27. Boundary: Freshness limit exact boundary (600s vs 601s)
  it('27. Freshness limit exact boundary (600s fresh vs 601s stale)', () => {
    const evalTime = new Date('2026-11-21T08:10:00Z');
    // Exactly 600s old: 08:00:00
    const exact600s = createReading({
      providerTimestamp: new Date('2026-11-21T08:00:00Z'),
    });
    expect(isReadingUnknown(exact600s, evalTime, 600)).toBe(false);

    // 601s old: 07:59:59
    const stale601s = createReading({
      providerTimestamp: new Date('2026-11-21T07:59:59Z'),
    });
    expect(isReadingUnknown(stale601s, evalTime, 600)).toBe(true);
  });

  // 28. Boundary: Future provider timestamp is treated as unknown
  it('28. Boundary: Future provider timestamp is treated as unknown', () => {
    const evalTime = new Date('2026-11-21T08:00:00Z');
    const futureReading = createReading({
      providerTimestamp: new Date('2026-11-21T08:05:00Z'), // in future
    });
    expect(isReadingUnknown(futureReading, evalTime, 600)).toBe(true);
  });

  // 29. Boundary: Custom policy overrides
  it('29. Boundary: Custom policy overrides', () => {
    const readings = [
      createReading({ memberId: 'm1', durationSeconds: 3000, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm2', durationSeconds: 1200, personalMaxMinutes: 45 }),
    ]; // 1 of 2 = 50%

    // Custom policy with 60% threshold
    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
      policy: { affectedThresholdPercent: 60 },
    });

    // 50% < 60% -> GO
    expect(result.outcome).toBe('GO');
    expect(result.affectedPercent).toBe(50);
  });

  // 30. Multiple private heads-up recipients when below threshold
  it('30. Multiple private heads-up recipients when below threshold', () => {
    const readings = [
      createReading({ memberId: 'm1', durationSeconds: 3000, personalMaxMinutes: 45 }), // affected
      createReading({ memberId: 'm2', durationSeconds: 3000, personalMaxMinutes: 45 }), // affected
      createReading({ memberId: 'm3', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm4', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm5', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm6', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm7', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm8', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm9', durationSeconds: 1200, personalMaxMinutes: 45 }),
      createReading({ memberId: 'm10', durationSeconds: 1200, personalMaxMinutes: 45 }),
    ]; // 2 of 10 = 20% < 40%

    const result = evaluateDecision({
      readings,
      evaluationTime: baseTime,
    });

    expect(result.outcome).toBe('GO');
    expect(result.affectedCount).toBe(2);
    expect(result.privateHeadsUpMemberIds).toEqual(['m1', 'm2']);
  });
});
