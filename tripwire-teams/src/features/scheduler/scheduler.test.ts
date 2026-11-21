import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseOpenMeteoResponse,
  fetchRainForecast,
  createFallbackForecast,
  OpenMeteoResponse,
} from './openMeteo.js';
import {
  calculatePlanScheduleTimes,
  schedulePlanJobs,
  executeCommuteCheckJob,
  buildRemoteRecommendationBlocks,
  IdempotencyGuard,
  JOB_NAMES,
  resetPlanStateRegistry,
} from './pgBossScheduler.js';
import {
  getNextWeekday,
  validatePlanTimes,
  formatPlanAnnouncement,
  geocodeOfficeAddress,
  buildPlanModalView,
} from './planModal.js';
import { encryptCoords } from '../../config/encryption.js';

describe('Job Scheduler & Rain Specialist Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPlanStateRegistry();
  });

  // =========================================================================
  // 1. OPEN-METEO WEATHER API TESTS
  // =========================================================================
  describe('Open-Meteo Weather Parser & Fallback', () => {
    const mockWindowStart = new Date('2026-11-23T07:00:00Z');
    const mockWindowEnd = new Date('2026-11-23T09:30:00Z');

    const sampleOpenMeteoPayload: OpenMeteoResponse = {
      latitude: 12.929,
      longitude: 77.676,
      utc_offset_seconds: 0,
      hourly: {
        time: [
          '2026-11-23T06:00',
          '2026-11-23T07:00',
          '2026-11-23T08:00',
          '2026-11-23T09:00',
          '2026-11-23T10:00',
        ],
        precipitation_probability: [10, 45, 80, 75, 20],
        rain: [0.0, 0.2, 1.8, 0.6, 0.0],
      },
    };

    it('extracts peak precipitation probability and total rain mm in commute window', () => {
      const result = parseOpenMeteoResponse(sampleOpenMeteoPayload, mockWindowStart, mockWindowEnd);

      expect(result.status).toBe('ok');
      expect(result.provenance).toBe('live');
      // Slots 07:00, 08:00, 09:00 match window 07:00-09:30
      // Probabilities: 45, 80, 75 -> peak is 80
      expect(result.precipitationProbability).toBe(80);
      // Rain mm: 0.2 + 1.8 + 0.6 = 2.6 mm
      expect(result.rainfallMm).toBe(2.6);
      expect(result.maxRainfallMm).toBe(1.8);
      expect(result.matchingSlotsCount).toBe(3);
    });

    it('correctly identifies heavy rain when probability >= 70% and rainfall > 0.5mm', () => {
      const result = parseOpenMeteoResponse(sampleOpenMeteoPayload, mockWindowStart, mockWindowEnd);
      expect(result.isHeavyRain).toBe(true);
    });

    it('flags heavy rain as false when probability is high but rainfall is trivial (<= 0.5mm)', () => {
      const drizzlePayload: OpenMeteoResponse = {
        latitude: 12.929,
        longitude: 77.676,
        utc_offset_seconds: 0,
        hourly: {
          time: ['2026-11-23T07:00', '2026-11-23T08:00'],
          precipitation_probability: [85, 90],
          rain: [0.1, 0.2], // total 0.3mm <= 0.5mm
        },
      };

      const result = parseOpenMeteoResponse(drizzlePayload, mockWindowStart, mockWindowEnd);
      expect(result.precipitationProbability).toBe(90);
      expect(result.rainfallMm).toBe(0.3);
      expect(result.isHeavyRain).toBe(false);
    });

    it('flags heavy rain as false on completely clear/dry commute windows', () => {
      const clearDayPayload: OpenMeteoResponse = {
        latitude: 12.929,
        longitude: 77.676,
        utc_offset_seconds: 0,
        hourly: {
          time: ['2026-11-23T07:00', '2026-11-23T08:00', '2026-11-23T09:00'],
          precipitation_probability: [0, 5, 0],
          rain: [0.0, 0.0, 0.0],
        },
      };

      const result = parseOpenMeteoResponse(clearDayPayload, mockWindowStart, mockWindowEnd);
      expect(result.precipitationProbability).toBe(5);
      expect(result.rainfallMm).toBe(0);
      expect(result.isHeavyRain).toBe(false);
      expect(result.status).toBe('ok');
    });

    it('gracefully handles malformed or empty payloads by returning safe fallback (0% probability, 0mm rain)', () => {
      const emptyPayload = {} as OpenMeteoResponse;
      const result = parseOpenMeteoResponse(emptyPayload, mockWindowStart, mockWindowEnd);

      expect(result.status).toBe('unknown');
      expect(result.provenance).toBe('fallback');
      expect(result.precipitationProbability).toBe(0);
      expect(result.rainfallMm).toBe(0);
      expect(result.isHeavyRain).toBe(false);
    });

    it('returns safe fallback when commute window dates are invalid or reversed', () => {
      const invalidStart = new Date('2026-11-23T10:00:00Z');
      const invalidEnd = new Date('2026-11-23T08:00:00Z'); // start > end

      const result = parseOpenMeteoResponse(sampleOpenMeteoPayload, invalidStart, invalidEnd);
      expect(result.status).toBe('unknown');
      expect(result.provenance).toBe('fallback');
      expect(result.precipitationProbability).toBe(0);
    });

    it('handles network timeouts gracefully and returns safe fallback without crashing', async () => {
      const mockFetchTimeout = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          setTimeout(() => reject(err), 10);
        });
      });

      const result = await fetchRainForecast({
        lat: 12.929,
        lon: 77.676,
        windowStart: mockWindowStart,
        windowEnd: mockWindowEnd,
        timeoutMs: 50,
        fetchFn: mockFetchTimeout as any,
      });

      expect(result.status).toBe('unknown');
      expect(result.provenance).toBe('fallback');
      expect(result.precipitationProbability).toBe(0);
      expect(result.rainfallMm).toBe(0);
      expect(result.errorReason).toContain('timed out');
    });

    it('handles HTTP 500 server errors gracefully and returns safe fallback', async () => {
      const mockFetch500 = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchRainForecast({
        lat: 12.929,
        lon: 77.676,
        windowStart: mockWindowStart,
        windowEnd: mockWindowEnd,
        fetchFn: mockFetch500 as any,
      });

      expect(result.status).toBe('unknown');
      expect(result.provenance).toBe('fallback');
      expect(result.precipitationProbability).toBe(0);
      expect(result.rainfallMm).toBe(0);
      expect(result.errorReason).toContain('HTTP 500');
    });
  });

  // =========================================================================
  // 2. SCHEDULE CALCULATION TESTS
  // =========================================================================
  describe('Plan Schedule Calculation', () => {
    it('calculates evening baseline (20:00 the day before), 45m cadence, and final decision time', () => {
      const planDate = '2026-11-23'; // Monday
      const arriveByTime = '09:30';
      const decisionTime = '08:30';

      const schedule = calculatePlanScheduleTimes(planDate, arriveByTime, decisionTime);

      // Baseline: Sunday Nov 22 at 20:00:00
      expect(schedule.baselineTime.getFullYear()).toBe(2026);
      expect(schedule.baselineTime.getMonth()).toBe(10); // Nov is index 10
      expect(schedule.baselineTime.getDate()).toBe(22);
      expect(schedule.baselineTime.getHours()).toBe(20);
      expect(schedule.baselineTime.getMinutes()).toBe(0);

      // Final decision: Monday Nov 23 at 08:30:00
      expect(schedule.finalDecisionTime.getFullYear()).toBe(2026);
      expect(schedule.finalDecisionTime.getDate()).toBe(23);
      expect(schedule.finalDecisionTime.getHours()).toBe(8);
      expect(schedule.finalDecisionTime.getMinutes()).toBe(30);

      // Cadence times: 3 intervals (45m, 30m, 15m before 08:30)
      // Cadence 0: 07:45
      // Cadence 1: 08:00
      // Cadence 2: 08:15
      expect(schedule.cadenceTimes).toHaveLength(3);

      expect(schedule.cadenceTimes[0].getHours()).toBe(7);
      expect(schedule.cadenceTimes[0].getMinutes()).toBe(45);

      expect(schedule.cadenceTimes[1].getHours()).toBe(8);
      expect(schedule.cadenceTimes[1].getMinutes()).toBe(0);

      expect(schedule.cadenceTimes[2].getHours()).toBe(8);
      expect(schedule.cadenceTimes[2].getMinutes()).toBe(15);
    });

    it('correctly adapts cadence for a 09:00 decision cutoff', () => {
      const schedule = calculatePlanScheduleTimes('2026-11-25', '09:30', '09:00');

      // Final decision at 09:00
      expect(schedule.finalDecisionTime.getHours()).toBe(9);
      expect(schedule.finalDecisionTime.getMinutes()).toBe(0);

      // Cadence: 08:15, 08:30, 08:45
      expect(schedule.cadenceTimes[0].getHours()).toBe(8);
      expect(schedule.cadenceTimes[0].getMinutes()).toBe(15);

      expect(schedule.cadenceTimes[1].getHours()).toBe(8);
      expect(schedule.cadenceTimes[1].getMinutes()).toBe(30);

      expect(schedule.cadenceTimes[2].getHours()).toBe(8);
      expect(schedule.cadenceTimes[2].getMinutes()).toBe(45);
    });

    it('schedules all 3 job types in pg-boss with proper singleton keys', async () => {
      const mockBoss = {
        send: vi.fn().mockImplementation((jobName: string) => Promise.resolve(`job-${jobName}-id`)),
      };

      const jobIds = await schedulePlanJobs(mockBoss, {
        id: 'plan-123',
        planDate: '2026-11-23',
        arriveByTime: '09:30',
        decisionTime: '08:30',
      });

      expect(mockBoss.send).toHaveBeenCalledTimes(5); // 1 baseline + 3 cadence + 1 final
      expect(jobIds).toHaveLength(5);

      // Check baseline call
      expect(mockBoss.send).toHaveBeenCalledWith(
        JOB_NAMES.BASELINE,
        expect.objectContaining({ planId: 'plan-123', jobType: JOB_NAMES.BASELINE }),
        expect.objectContaining({ singletonKey: 'baseline:plan-123' })
      );

      // Check final decision call
      expect(mockBoss.send).toHaveBeenCalledWith(
        JOB_NAMES.FINAL_DECISION,
        expect.objectContaining({ planId: 'plan-123', jobType: JOB_NAMES.FINAL_DECISION }),
        expect.objectContaining({ singletonKey: 'final:plan-123' })
      );
    });
  });

  // =========================================================================
  // 3. PLAN MODAL & SLACK UI HELPERS TESTS
  // =========================================================================
  describe('Plan Modal & Slack UI Helpers', () => {
    it('computes next weekday skipping Saturdays and Sundays', () => {
      // Friday Nov 20, 2026 -> next weekday is Monday Nov 23, 2026
      const friday = new Date(2026, 10, 20, 10, 0, 0);
      expect(getNextWeekday(friday)).toBe('2026-11-23');

      // Saturday Nov 21, 2026 -> next weekday is Monday Nov 23, 2026
      const saturday = new Date(2026, 10, 21, 10, 0, 0);
      expect(getNextWeekday(saturday)).toBe('2026-11-23');

      // Monday Nov 23, 2026 -> tomorrow is Tuesday Nov 24, 2026
      const monday = new Date(2026, 10, 23, 10, 0, 0);
      expect(getNextWeekday(monday)).toBe('2026-11-24');
    });

    it('strictly formats the announcement text according to specification', () => {
      const text = formatPlanAnnouncement('2026-11-23', 5);
      expect(text).toBe(
        'Office day planned for *2026-11-23*. 5 teammates currently opted in. If you haven\'t yet, run `/tripwire setup` to set your commute preference.'
      );
      // Privacy invariant: never mentions unconfigured or individual member names
      expect(text).not.toContain('unconfigured');
      expect(text).not.toContain('missing');
    });

    it('validates decision cutoff time must be earlier than arrive-by time', () => {
      expect(validatePlanTimes('09:30', '08:30').valid).toBe(true);
      expect(validatePlanTimes('09:30', '09:00').valid).toBe(true);

      const invalidTie = validatePlanTimes('09:30', '09:30');
      expect(invalidTie.valid).toBe(false);
      expect(invalidTie.error).toBe('Decision cutoff time must be earlier than target arrive-by time.');

      const invalidAfter = validatePlanTimes('09:30', '10:00');
      expect(invalidAfter.valid).toBe(false);
    });

    it('builds plan modal view with required input blocks', () => {
      const view = buildPlanModalView('2026-11-23');
      expect(view.type).toBe('modal');
      expect(view.callback_id).toBe('tripwire_plan_modal');
      expect(view.blocks).toHaveLength(5);
      expect(view.blocks.map((b: any) => b.block_id)).toEqual([
        'office_address_block',
        'plan_date_block',
        'arrive_by_block',
        'decision_time_block',
        'channel_block',
      ]);
    });

    it('geocodes office address with graceful fallback coordinates', async () => {
      const geo = await geocodeOfficeAddress('WeWork Galaxy Bengaluru');
      expect(geo.lat).toBeCloseTo(12.929, 2);
      expect(geo.lon).toBeCloseTo(77.676, 2);
      expect(geo.address).toBeTruthy();
    });
  });

  // =========================================================================
  // 4. IDEMPOTENCY GUARD & CHECK EXECUTION TESTS
  // =========================================================================
  describe('Idempotency Guard & Check Execution', () => {
    let mockPrisma: any;
    let mockRoutesProvider: any;
    let mockSlackClient: any;
    let mockFetchRain: any;
    let idempotencyGuard: IdempotencyGuard;

    const testPlanId = 'plan-test-001';
    const encryptedHsr = encryptCoords(12.91, 77.64);
    const encryptedIndiranagar = encryptCoords(12.97, 77.64);

    beforeEach(() => {
      idempotencyGuard = new IdempotencyGuard();
      resetPlanStateRegistry();

      mockFetchRain = vi.fn().mockResolvedValue({
        precipitationProbability: 10,
        rainfallMm: 0,
        maxRainfallMm: 0,
        isHeavyRain: false,
        status: 'ok',
        provenance: 'live',
        commuteWindow: { start: new Date(), end: new Date() },
        matchingSlotsCount: 2,
      });

      mockPrisma = {
        plan: {
          findUnique: vi.fn().mockResolvedValue({
            id: testPlanId,
            channelId: 'C12345678',
            officeLat: 12.929,
            officeLon: 77.676,
            planDate: new Date('2026-11-23T00:00:00Z'),
            arriveByTime: '09:30',
            decisionTime: new Date('2026-11-23T08:30:00Z'),
            status: 'PLANNED',
            attendees: [
              {
                id: 'att-1',
                hasSkipped: false,
                member: {
                  id: 'mem-1',
                  maxMinutes: 45,
                  travelMode: 'CAR',
                  encryptedCoords: encryptedHsr,
                },
              },
              {
                id: 'att-2',
                hasSkipped: false,
                member: {
                  id: 'mem-2',
                  maxMinutes: 45,
                  travelMode: 'CAR',
                  encryptedCoords: encryptedIndiranagar,
                },
              },
            ],
          }),
        },
        check: {
          findFirst: vi.fn().mockResolvedValue({ baselineSeconds: 2400 }), // 40 min baseline
          create: vi.fn().mockResolvedValue({ id: 'chk-1' }),
        },
      };

      mockRoutesProvider = {
        getCommute: vi.fn().mockResolvedValue({
          durationSeconds: 2100, // 35 min (normal, not affected)
          providerTimestamp: new Date(),
          status: 'ok',
          modeUsed: 'DRIVE',
        }),
      };

      mockSlackClient = {
        chat: {
          postMessage: vi.fn().mockResolvedValue({ ok: true }),
        },
      };
    });

    it('running the same job ID twice produces no duplicate checks or actions (strict idempotency)', async () => {
      const planId = 'plan-idempotency-test';
      const jobId = 'cadence:plan-idempotency-test:0';

      // First run
      const run1 = await executeCommuteCheckJob(planId, JOB_NAMES.MORNING_CADENCE, jobId, {
        prisma: mockPrisma,
        routesProvider: mockRoutesProvider,
        slackClient: mockSlackClient,
        fetchRainFn: mockFetchRain,
        idempotencyGuard,
      });

      expect(run1.skipped).toBe(false);
      expect(mockPrisma.check.create).toHaveBeenCalledTimes(2);

      // Clear mock call counts
      mockPrisma.check.create.mockClear();

      // Second run with the exact same jobId
      const run2 = await executeCommuteCheckJob(planId, JOB_NAMES.MORNING_CADENCE, jobId, {
        prisma: mockPrisma,
        routesProvider: mockRoutesProvider,
        slackClient: mockSlackClient,
        fetchRainFn: mockFetchRain,
        idempotencyGuard,
      });

      expect(run2.skipped).toBe(true);
      expect(run2.skipReason).toContain('idempotency enforced');
      // No duplicate DB writes!
      expect(mockPrisma.check.create).not.toHaveBeenCalled();
    });

    it('saves check records with provenance strictly labeled "live"', async () => {
      const planId = 'plan-live-provenance-test';
      await executeCommuteCheckJob(planId, JOB_NAMES.BASELINE, 'baseline:job-live-1', {
        prisma: mockPrisma,
        routesProvider: mockRoutesProvider,
        fetchRainFn: mockFetchRain,
        idempotencyGuard,
      });

      expect(mockPrisma.check.create).toHaveBeenCalled();
      const createCall = mockPrisma.check.create.mock.calls[0][0];

      expect(createCall.data.provenance).toBe('live');
      expect(createCall.data.planId).toBe(testPlanId);
    });

    it('transitions to CONFIRMING on first team spike without sending Slack alert card', async () => {
      const planId = 'plan-spike-1-test';
      // 100% of attendees affected: 60 min commute vs 45 min max
      mockRoutesProvider.getCommute.mockResolvedValue({
        durationSeconds: 3600, // 60 min
        providerTimestamp: new Date(),
        status: 'ok',
        modeUsed: 'DRIVE',
      });

      const result = await executeCommuteCheckJob(planId, JOB_NAMES.MORNING_CADENCE, 'cadence:spike-1', {
        prisma: mockPrisma,
        routesProvider: mockRoutesProvider,
        slackClient: mockSlackClient,
        fetchRainFn: mockFetchRain,
        idempotencyGuard,
      });

      expect(result.evaluation?.outcome).toBe('CONFIRMING');
      expect(result.evaluation?.newConsecutiveFlaggedChecks).toBe(1);
      // No recommendation card on check 1 of 2
      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();
      expect(result.alertSent).toBe(false);
    });

    it('transitions to RECOMMEND_REMOTE on second consecutive fresh breach and posts Block Kit card', async () => {
      const planId = 'plan-breach-2-test';
      // Severe traffic: 65 min commute
      mockRoutesProvider.getCommute.mockResolvedValue({
        durationSeconds: 3900, // 65 min
        providerTimestamp: new Date(),
        status: 'ok',
        modeUsed: 'DRIVE',
      });

      // Check 1: CONFIRMING
      const res1 = await executeCommuteCheckJob(planId, JOB_NAMES.MORNING_CADENCE, 'cadence:breach-1', {
        prisma: mockPrisma,
        routesProvider: mockRoutesProvider,
        slackClient: mockSlackClient,
        fetchRainFn: mockFetchRain,
        idempotencyGuard,
      });

      expect(res1.evaluation?.outcome).toBe('CONFIRMING');
      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();

      // Check 2: Second fresh check -> RECOMMEND_REMOTE
      const check2Time = new Date(Date.now() + 60 * 1000); // 1 minute later
      mockRoutesProvider.getCommute.mockResolvedValue({
        durationSeconds: 4000,
        providerTimestamp: check2Time,
        status: 'ok',
        modeUsed: 'DRIVE',
      });

      const result2 = await executeCommuteCheckJob(planId, JOB_NAMES.MORNING_CADENCE, 'cadence:breach-2', {
        prisma: mockPrisma,
        routesProvider: mockRoutesProvider,
        slackClient: mockSlackClient,
        fetchRainFn: mockFetchRain,
        idempotencyGuard,
        now: check2Time,
      });

      expect(result2.evaluation?.outcome).toBe('RECOMMEND_REMOTE');
      expect(result2.alertSent).toBe(true);
      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledTimes(1);

      const postCall = mockSlackClient.chat.postMessage.mock.calls[0][0];
      expect(postCall.channel).toBe('C12345678');
      expect(postCall.blocks).toBeDefined();

      // Ensure that a subsequent check does NOT repeat the alert card
      const check3Time = new Date(Date.now() + 120 * 1000);
      mockRoutesProvider.getCommute.mockResolvedValue({
        durationSeconds: 4100,
        providerTimestamp: check3Time,
        status: 'ok',
        modeUsed: 'DRIVE',
      });

      const result3 = await executeCommuteCheckJob(planId, JOB_NAMES.FINAL_DECISION, 'final:breach-3', {
        prisma: mockPrisma,
        routesProvider: mockRoutesProvider,
        slackClient: mockSlackClient,
        fetchRainFn: mockFetchRain,
        idempotencyGuard,
        now: check3Time,
      });

      expect(result3.alertSent).toBe(false);
      // Still only 1 message sent in total!
      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledTimes(1);
    });

    it('builds remote recommendation Block Kit card with lead decision buttons', () => {
      const blocks = buildRemoteRecommendationBlocks(
        'plan-xyz',
        {
          outcome: 'RECOMMEND_REMOTE',
          affectedCount: 3,
          totalEligibleCount: 5,
          affectedPercent: 60,
          reasons: ['Commute duration exceeds threshold for 3 attendees.'],
          privateHeadsUpMemberIds: [],
          newConsecutiveFlaggedChecks: 2,
        },
        createFallbackForecast(new Date(), new Date())
      );

      expect(blocks).toBeDefined();
      const actionsBlock = blocks.find(b => b.type === 'actions');
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock.elements).toHaveLength(3);

      const actionIds = actionsBlock.elements.map((el: any) => el.action_id);
      expect(actionIds).toContain('action_make_remote');
      expect(actionIds).toContain('action_keep_office');
      expect(actionIds).toContain('action_individual_decision');
    });

    it('idempotency guard maintains isolation between different plans', () => {
      const guard = new IdempotencyGuard();
      guard.markRun('job-1');
      guard.markAlerted('plan-A');

      expect(guard.hasRun('job-1')).toBe(true);
      expect(guard.hasRun('job-2')).toBe(false);

      expect(guard.hasAlerted('plan-A')).toBe(true);
      expect(guard.hasAlerted('plan-B')).toBe(false);

      guard.reset();
      expect(guard.hasRun('job-1')).toBe(false);
      expect(guard.hasAlerted('plan-A')).toBe(false);
    });

    it('calculates schedule correctly across month and year boundary (e.g. 2027-01-01)', () => {
      const sched = calculatePlanScheduleTimes('2027-01-01', '09:30', '08:30');
      // Baseline should be Dec 31, 2026 at 20:00
      expect(sched.baselineTime.getFullYear()).toBe(2026);
      expect(sched.baselineTime.getMonth()).toBe(11); // Dec is 11
      expect(sched.baselineTime.getDate()).toBe(31);
      expect(sched.baselineTime.getHours()).toBe(20);

      expect(sched.finalDecisionTime.getFullYear()).toBe(2027);
      expect(sched.finalDecisionTime.getMonth()).toBe(0); // Jan is 0
      expect(sched.finalDecisionTime.getDate()).toBe(1);
      expect(sched.finalDecisionTime.getHours()).toBe(8);
      expect(sched.finalDecisionTime.getMinutes()).toBe(30);
    });

    it('sanitizes null, NaN, and negative rain/probability values in Open-Meteo payload', () => {
      const dirtyPayload: OpenMeteoResponse = {
        latitude: 12.929,
        longitude: 77.676,
        utc_offset_seconds: 0,
        hourly: {
          time: ['2026-11-23T07:00', '2026-11-23T08:00'],
          precipitation_probability: [-10, 150] as any,
          rain: [null, -5] as any,
        },
      };

      const result = parseOpenMeteoResponse(
        dirtyPayload,
        new Date('2026-11-23T07:00:00Z'),
        new Date('2026-11-23T09:00:00Z')
      );

      expect(result.status).toBe('ok');
      // -10 clamped to 0, 150 clamped to 100
      expect(result.precipitationProbability).toBe(100);
      // null -> 0, -5 -> 0
      expect(result.rainfallMm).toBe(0);
    });
  });
});
