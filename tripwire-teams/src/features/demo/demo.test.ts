import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isDemoModeEnabled,
  assertDemoMode,
  DemoModeDisabledError,
  formatDemoSlackMessage,
  injectSimulatedDisruption,
  simulateHysteresisSequence,
  SIMULATED_BANNER,
  SIMULATED_BANNER_RAW,
} from './demoMode.js';
import {
  BENGALURU_TECH_CORRIDORS,
  BENGALURU_RAIN_NORMAL,
  BENGALURU_RAIN_DISRUPTED,
  getSimulatedAttendeeReadings,
  generateSimulatedDbCheckRecords,
} from './demoFixtures.js';
import {
  executePlanPreview,
  buildPreviewSlackResponse,
  OfficePlanInfo,
} from './preview.js';

describe('Tripwire Teams: Demo Mode & Simulation Engine', () => {
  const originalEnvDemoMode = process.env.DEMO_MODE;

  beforeEach(() => {
    // Reset to demo mode enabled by default for demo tests
    process.env.DEMO_MODE = 'true';
  });

  afterEach(() => {
    process.env.DEMO_MODE = originalEnvDemoMode;
  });

  describe('1. Non-negotiable Safety Guard: DEMO_MODE Disabled Checks', () => {
    it('isDemoModeEnabled() returns false when DEMO_MODE is not "true"', () => {
      process.env.DEMO_MODE = 'false';
      expect(isDemoModeEnabled()).toBe(false);

      process.env.DEMO_MODE = '0';
      expect(isDemoModeEnabled()).toBe(false);

      delete process.env.DEMO_MODE;
      expect(isDemoModeEnabled()).toBe(false);
    });

    it('assertDemoMode() throws DemoModeDisabledError when DEMO_MODE is false or unset', () => {
      process.env.DEMO_MODE = 'false';
      expect(() => assertDemoMode()).toThrow(DemoModeDisabledError);

      delete process.env.DEMO_MODE;
      expect(() => assertDemoMode()).toThrow(
        /Simulated injection is impossible: DEMO_MODE is not enabled/
      );
    });

    it('injectSimulatedDisruption() refuses to execute when DEMO_MODE is false', async () => {
      process.env.DEMO_MODE = 'false';

      await expect(
        injectSimulatedDisruption({
          planId: 'plan-prod-safe',
          stage: 'first_breach',
        })
      ).rejects.toThrow(DemoModeDisabledError);
    });

    it('simulateHysteresisSequence() refuses to execute when DEMO_MODE is false', async () => {
      process.env.DEMO_MODE = 'false';

      await expect(
        simulateHysteresisSequence({
          planId: 'plan-prod-safe',
        })
      ).rejects.toThrow(DemoModeDisabledError);
    });

    it('executes successfully when DEMO_MODE is strictly "true"', async () => {
      process.env.DEMO_MODE = 'true';
      expect(isDemoModeEnabled()).toBe(true);
      expect(() => assertDemoMode()).not.toThrow();

      const result = await injectSimulatedDisruption({
        planId: 'plan-test-demo',
        stage: 'normal',
      });
      expect(result.provenance).toBe('simulated');
      expect(result.checks.length).toBe(5);
    });
  });

  describe('2. Strict Provenance Tagging (Rule 1: No Fake Data Presented as Live)', () => {
    it('every corridor fixture in BENGALURU_TECH_CORRIDORS is tagged with provenance="simulated"', () => {
      expect(BENGALURU_TECH_CORRIDORS.length).toBe(5);
      for (const corridor of BENGALURU_TECH_CORRIDORS) {
        expect(corridor.provenance).toBe('simulated');
      }
    });

    it('getSimulatedAttendeeReadings() marks 100% of generated readings as provenance="simulated"', () => {
      const normalReadings = getSimulatedAttendeeReadings('normal');
      expect(normalReadings.length).toBe(5);
      for (const r of normalReadings) {
        expect(r.provenance).toBe('simulated');
      }

      const breachReadings = getSimulatedAttendeeReadings('first_breach');
      expect(breachReadings.length).toBe(5);
      for (const r of breachReadings) {
        expect(r.provenance).toBe('simulated');
      }
    });

    it('generateSimulatedDbCheckRecords() marks 100% of database check rows as provenance="simulated"', () => {
      const records = generateSimulatedDbCheckRecords('plan-xyz', 'second_breach');
      expect(records.length).toBe(5);
      for (const row of records) {
        expect(row.provenance).toBe('simulated');
        expect(row.status).toBe('ok');
        expect(row.planId).toBe('plan-xyz');
      }
    });

    it('injectSimulatedDisruption() result strictly preserves provenance="simulated"', async () => {
      const res = await injectSimulatedDisruption({
        planId: 'plan-blr-test',
        stage: 'first_breach',
      });

      expect(res.provenance).toBe('simulated');
      for (const chk of res.checks) {
        expect(chk.provenance).toBe('simulated');
      }
    });
  });

  describe('3. Bold Simulated Labeling on Slack Messages', () => {
    it('formatDemoSlackMessage() prepends the bold SIMULATED disclaimer to text', () => {
      const rawText = 'Outer Ring Road delay alert';
      const formatted = formatDemoSlackMessage(rawText);

      expect(formatted.text).toContain(SIMULATED_BANNER);
      expect(formatted.text.startsWith(SIMULATED_BANNER)).toBe(true);
    });

    it('formatDemoSlackMessage() inserts a prominent banner block into blocks array', () => {
      const initialBlocks = [
        { type: 'section', text: { type: 'mrkdwn', text: 'Some content' } },
      ];
      const formatted = formatDemoSlackMessage('Alert', initialBlocks);

      expect(formatted.blocks.length).toBe(2);
      expect(formatted.blocks[0].text.text).toBe(SIMULATED_BANNER);
    });

    it('injectSimulatedDisruption() produces Slack message with bold SIMULATED label', async () => {
      const res = await injectSimulatedDisruption({
        planId: 'plan-blr-label-check',
        stage: 'first_breach',
      });

      expect(res.slackMessage.text).toContain(SIMULATED_BANNER);
      expect(res.slackMessage.blocks[0].text.text).toBe(SIMULATED_BANNER);
    });
  });

  describe('4. Bengaluru Tech Corridors & 2-Breach Hysteresis Invariant', () => {
    it('validates 5 canonical corridors: ORR, Silk Board, Whitefield, Indiranagar, HSR Layout', () => {
      const names = BENGALURU_TECH_CORRIDORS.map((c) => c.corridorName);
      expect(names).toEqual([
        'Outer Ring Road (Bellandur - Sarjapur)',
        'Central Silk Board (BTM - HSR Junction)',
        'Whitefield (Kundalahalli - ITPL)',
        'Indiranagar (100ft Road - Domlur / EGL)',
        'HSR Layout (Sector 5 - Koramangala)',
      ]);

      // All coordinates are rounded to 2 decimals (~1.1 km)
      for (const corridor of BENGALURU_TECH_CORRIDORS) {
        const latDecimals = (corridor.originCoords.lat.toString().split('.')[1] || '').length;
        const lonDecimals = (corridor.originCoords.lon.toString().split('.')[1] || '').length;
        expect(latDecimals).toBeLessThanOrEqual(2);
        expect(lonDecimals).toBeLessThanOrEqual(2);
      }
    });

    it('evaluates stage="normal": 0 affected attendees -> outcome GO', async () => {
      const result = await injectSimulatedDisruption({
        planId: 'plan-blr-normal',
        stage: 'normal',
        rainForecast: BENGALURU_RAIN_NORMAL,
      });

      expect(result.evaluation.outcome).toBe('GO');
      expect(result.evaluation.affectedCount).toBe(0);
      expect(result.evaluation.totalEligibleCount).toBe(5);
      expect(result.evaluation.affectedPercent).toBe(0);
      expect(result.evaluation.newConsecutiveFlaggedChecks).toBe(0);
    });

    it('evaluates stage="first_breach": 3 of 5 affected (60%) -> outcome CONFIRMING (1 of 2 required)', async () => {
      const result = await injectSimulatedDisruption({
        planId: 'plan-blr-breach1',
        stage: 'first_breach',
        rainForecast: BENGALURU_RAIN_DISRUPTED,
      });

      // 3 of 5 affected: ORR (78m > 45m), Silk Board (68m > 40m), Whitefield (95m > 55m)
      expect(result.evaluation.affectedCount).toBe(3);
      expect(result.evaluation.totalEligibleCount).toBe(5);
      expect(result.evaluation.affectedPercent).toBe(60);
      expect(result.evaluation.outcome).toBe('CONFIRMING');
      expect(result.evaluation.newConsecutiveFlaggedChecks).toBe(1);
    });

    it('runs simulateHysteresisSequence() demonstrating 2-breach hysteresis and replay safety', async () => {
      const seq = await simulateHysteresisSequence({
        planId: 'plan-hysteresis-eval',
        baseTime: new Date('2026-11-22T08:00:00Z'),
      });

      // Step 1: First breach -> CONFIRMING (consecutive = 1)
      expect(seq.step1FirstBreach.evaluation.outcome).toBe('CONFIRMING');
      expect(seq.step1FirstBreach.evaluation.newConsecutiveFlaggedChecks).toBe(1);

      // Step 2: Replay of same timestamp -> Duplicate ignored, consecutive remains 1
      expect(seq.step2DuplicateTimestampReplay.isDuplicateIgnored).toBe(true);
      expect(
        seq.step2DuplicateTimestampReplay.evaluation.newConsecutiveFlaggedChecks
      ).toBe(1);

      // Step 3: Second consecutive breach with advancing timestamp -> RECOMMEND_REMOTE (consecutive = 2)
      expect(seq.step3SecondBreachConfirmed.evaluation.outcome).toBe('RECOMMEND_REMOTE');
      expect(seq.step3SecondBreachConfirmed.evaluation.newConsecutiveFlaggedChecks).toBe(2);

      // Invariant summary verification
      expect(seq.invariantVerification.firstBreachRequiresConfirmation).toBe(true);
      expect(seq.invariantVerification.replayDoesNotAdvanceCheck).toBe(true);
      expect(seq.invariantVerification.secondBreachTriggersRecommendation).toBe(true);
    });
  });

  describe('5. /tripwire preview (Live Dry-Run & Privacy Invariants)', () => {
    const mockPlan: OfficePlanInfo = {
      id: 'plan-preview-test',
      workspaceId: 'T12345678',
      channelId: 'C_ENG',
      ownerSlackUserId: 'U_LEAD_ALICE',
      officeAddress: 'Bagmane Tech Park, Bellandur, Bengaluru',
      officeCoords: { lat: 12.97, lon: 77.70 },
      planDate: new Date('2026-11-22T09:30:00Z'),
      arriveByTime: '09:30',
      attendees: [
        { memberId: 'm1', slackUserId: 'U_M1', hasSkipped: false, personalMaxMinutes: 45 },
        { memberId: 'm2', slackUserId: 'U_M2', hasSkipped: false, personalMaxMinutes: 40 },
        { memberId: 'm3', slackUserId: 'U_M3', hasSkipped: false, personalMaxMinutes: 55 },
        { memberId: 'm4', slackUserId: 'U_M4', hasSkipped: false, personalMaxMinutes: 35 },
        { memberId: 'm5', slackUserId: 'U_M5', hasSkipped: true, personalMaxMinutes: 40 }, // 1 skipped
      ],
    };

    it('enforces single decision maker / ownership guard: non-owner is denied access', async () => {
      const preview = await executePlanPreview({
        plan: mockPlan,
        callingSlackUserId: 'U_RANDOM_BOB', // Not the owner
      });

      expect(preview.isAuthorized).toBe(false);
      expect(preview.slackResponse.response_type).toBe('ephemeral');
      expect(preview.slackResponse.text).toContain('Access denied: Only the plan owner');
    });

    it('authorized owner receives ephemeral response (posts nothing publicly)', async () => {
      const preview = await executePlanPreview({
        plan: mockPlan,
        callingSlackUserId: 'U_LEAD_ALICE', // Legitimate owner
      });

      expect(preview.isAuthorized).toBe(true);
      expect(preview.channelPrivacyPreserved).toBe(true);
      expect(preview.slackResponse.response_type).toBe('ephemeral');
      expect(preview.slackResponse.text).toContain('Private Live Preview for Tomorrow');
    });

    it('returns aggregate metrics without exposing individual home areas or coordinates', async () => {
      const preview = await executePlanPreview({
        plan: mockPlan,
        callingSlackUserId: 'U_LEAD_ALICE',
      });

      // High level aggregates
      expect(preview.totalAttendeesCount).toBe(5);
      expect(preview.activeEligibleCount).toBe(4); // 5 - 1 skipped
      expect(preview.skippedCount).toBe(1);

      // Verify that coordinates and individual home locations are not leaked
      expect(preview.slackResponse.text).not.toContain('12.97');
      expect(preview.slackResponse.text).not.toContain('77.70');
      expect(preview.slackResponse.text).not.toContain('lat');
      expect(preview.slackResponse.text).not.toContain('lon');

      // Contains aggregate sentence
      expect(preview.slackResponse.text).toMatch(
        /Currently \*?\d+ of 4\*? eligible teammates are projected to face delays/
      );
    });

    it('includes weather projection and current recommendation preview', async () => {
      const preview = await executePlanPreview({
        plan: mockPlan,
        callingSlackUserId: 'U_LEAD_ALICE',
        rainForecast: { precipitationProbability: 75, rainfallMm: 8.5 },
      });

      expect(preview.weatherSummary).toContain('75% rain probability');
      expect(preview.weatherSummary).toContain('8.5mm expected');
      expect(preview.slackResponse.text).toContain('Weather Projection:');
      expect(preview.slackResponse.text).toContain('Current Recommendation Preview:');
    });

    it('buildPreviewSlackResponse includes bold SIMULATED label when isDemo is true', () => {
      const response = buildPreviewSlackResponse({
        planId: 'plan-preview-123',
        ownerSlackUserId: 'U_LEAD_ALICE',
        isAuthorized: true,
        totalAttendeesCount: 5,
        activeEligibleCount: 5,
        skippedCount: 0,
        delayedCount: 2,
        delayedPercent: 40,
        weatherSummary: '15% rain',
        recommendationPreview: 'GO - within normal bounds',
        evaluation: {
          outcome: 'GO',
          affectedCount: 2,
          totalEligibleCount: 5,
          affectedPercent: 40,
          reasons: ['Commute within normal limits'],
          privateHeadsUpMemberIds: [],
          newConsecutiveFlaggedChecks: 0,
        },
        isDemo: true,
      });

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain(SIMULATED_BANNER);
      expect(response.blocks[0].text.text).toBe(SIMULATED_BANNER);
    });
  });
});
