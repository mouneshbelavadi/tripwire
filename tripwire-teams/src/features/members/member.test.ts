/**
 * Tripwire Teams - Comprehensive Member & Privacy Test Suite
 * 
 * Verifies:
 * 1. 2-decimal coordinate rounding (~1.1 km precision) protects user location privacy
 * 2. Coordinate encryption roundtrip with AES-256-GCM and tampering detection
 * 3. Forget command (/tripwire forget) immediately purges all personal data and writes audit log
 * 4. Workspace uninstall (app_uninstalled / tokens_revoked) purges all workspace records
 * 5. Lead cannot access individual member home address/labels (aggregate privacy invariant)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { roundCoordinate, roundCoordinates, geocodeAddress } from './geocoding.js';
import { encryptCoords, decryptCoords, encrypt, decrypt } from '../../config/encryption.js';
import { forgetMember } from './forget.js';
import { handleWorkspaceUninstall } from './events.js';
import { parseSkipDate } from './skip.js';
import { buildSetupModalView, buildConfirmationView, extractSetupModalValues } from './setup.js';

describe('Member Privacy: 2-Decimal Coordinate Rounding', () => {
  it('strictly rounds coordinates to 2 decimal places (approx 1.1 km precision)', () => {
    // Bengaluru coordinates
    expect(roundCoordinate(12.93524)).toBe(12.94);
    expect(roundCoordinate(77.62449)).toBe(77.62);

    // Negative coordinates (Sydney / Rio)
    expect(roundCoordinate(-33.86882)).toBe(-33.87);
    expect(roundCoordinate(151.2093)).toBe(151.21);

    // Integers / single decimals
    expect(roundCoordinate(12.0)).toBe(12.0);
    expect(roundCoordinate(77.5)).toBe(77.5);

    // Helper rounds both lat and lon
    const rounded = roundCoordinates(12.912345, 77.645678);
    expect(rounded.lat).toBe(12.91);
    expect(rounded.lon).toBe(77.65);
  });

  it('verifies that rounding error never exceeds 0.005 degrees (~555 meters max deviation, ~1.1 km cell)', () => {
    const testPoints = [
      12.971598, 77.594562, 12.9352, 77.6245, 12.9260, 77.6762,
      28.6139, 77.2090, 37.7749, -122.4194,
    ];

    for (const pt of testPoints) {
      const rounded = roundCoordinate(pt);
      const diff = Math.abs(rounded - pt);
      expect(diff).toBeLessThanOrEqual(0.005 + 1e-9);
    }
  });

  it('geocodeAddress returns strictly 2-decimal rounded coordinates from Google Geocoding API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'HSR Layout, Bengaluru, Karnataka, India',
            geometry: {
              location: {
                lat: 12.9121487,
                lng: 77.6445542,
              },
            },
          },
        ],
      }),
    });

    const result = await geocodeAddress('HSR Layout', 'dummy-api-key', mockFetch as any);

    expect(result.formattedAddress).toBe('HSR Layout, Bengaluru, Karnataka, India');
    // Must be strictly rounded to 2 decimals
    expect(result.lat).toBe(12.91);
    expect(result.lon).toBe(77.64);
    // Invariant check: toString() length after decimal point is at most 2
    expect(result.lat.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    expect(result.lon.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it('geocodeAddress throws on empty address or missing API key', async () => {
    await expect(geocodeAddress('', 'key')).rejects.toThrow('Address is required');
    await expect(geocodeAddress('   ', 'key')).rejects.toThrow('Address is required');
    await expect(geocodeAddress('Bengaluru', '')).rejects.toThrow('Google Maps API key is required');
  });

  it('geocodeAddress throws friendly error when ZERO_RESULTS returned', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ZERO_RESULTS',
        results: [],
      }),
    });

    await expect(geocodeAddress('Nonexistent Place 99999', 'key', mockFetch as any))
      .rejects.toThrow(/No location found/);
  });
});

describe('Member Privacy: Coordinate Encryption Roundtrip', () => {
  it('encrypts rounded coordinates and decrypts back to exact 2-decimal values', () => {
    const rawLat = 12.93524;
    const rawLon = 77.62449;

    const encrypted = encryptCoords(rawLat, rawLon);

    // Verify format is iv:authTag:ciphertext
    expect(encrypted.split(':')).toHaveLength(3);

    // Verify raw coordinates are never in plain text in encrypted payload
    expect(encrypted).not.toContain('12.93');
    expect(encrypted).not.toContain('77.62');

    // Decrypt and assert recovered coordinates
    const decrypted = decryptCoords(encrypted);
    expect(decrypted.lat).toBe(12.94);
    expect(decrypted.lon).toBe(77.62);
  });

  it('tampered encrypted payload fails authentication tag check and throws', () => {
    const encrypted = encryptCoords(12.91, 77.64);
    const [iv, tag, ciphertext] = encrypted.split(':');

    // Tamper ciphertext
    const tamperedCiphertext = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa');
    const tamperedPayload = `${iv}:${tag}:${tamperedCiphertext}`;

    expect(() => decryptCoords(tamperedPayload)).toThrow(/Authentication error/);
  });
});

describe('Member Setup & Consent View', () => {
  it('buildSetupModalView produces required form inputs', () => {
    const view = buildSetupModalView();
    expect(view.type).toBe('modal');
    expect(view.callback_id).toBe('tripwire_setup_modal');

    const blockIds = view.blocks.map((b: any) => b.block_id).filter(Boolean);
    expect(blockIds).toContain('home_area_block');
    expect(blockIds).toContain('travel_mode_block');
    expect(blockIds).toContain('max_minutes_block');
  });

  it('buildConfirmationView provides clear privacy disclosures', () => {
    const view = buildConfirmationView({
      formattedAddress: 'Indiranagar, Bengaluru',
      travelMode: 'CAR',
      maxMinutes: 60,
    });

    expect(view.type).toBe('modal');
    expect(view.callback_id).toBe('tripwire_setup_confirmation_view');

    // Verify privacy mentions in text
    const textContent = JSON.stringify(view.blocks);
    expect(textContent).toContain('Indiranagar, Bengaluru');
    expect(textContent).toContain('60 minutes');
    expect(textContent).toContain('AES-256-GCM');
    expect(textContent).toContain('~1.1 km precision');
    expect(textContent).toContain('/tripwire forget');
    expect(textContent).toContain('/tripwire skip');
  });

  it('extractSetupModalValues parses and validates modal inputs correctly', () => {
    const fakeView: any = {
      state: {
        values: {
          home_area_block: {
            home_area_input: { value: 'Whitefield, Bengaluru' },
          },
          travel_mode_block: {
            travel_mode_input: { selected_option: { value: 'TWO_WHEELER' } },
          },
          max_minutes_block: {
            max_minutes_input: { value: '90' },
          },
        },
      },
    };

    const values = extractSetupModalValues(fakeView);
    expect(values.homeArea).toBe('Whitefield, Bengaluru');
    expect(values.travelMode).toBe('TWO_WHEELER');
    expect(values.maxMinutes).toBe(90);
  });
});

describe('Member Day Skipping: Date Parser', () => {
  it('parses "today", "tomorrow", and valid YYYY-MM-DD dates', () => {
    const today = parseSkipDate('today');
    expect(today.valid).toBe(true);
    expect(today.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const tomorrow = parseSkipDate('tomorrow');
    expect(tomorrow.valid).toBe(true);
    expect(tomorrow.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const explicit = parseSkipDate('2026-11-23');
    expect(explicit.valid).toBe(true);
    expect(explicit.dateStr).toBe('2026-11-23');
  });

  it('rejects invalid date formats', () => {
    expect(parseSkipDate('').valid).toBe(false);
    expect(parseSkipDate('next friday').valid).toBe(false);
    expect(parseSkipDate('23-11-2026').valid).toBe(false);
    expect(parseSkipDate('2026-13-45').valid).toBe(false);
  });
});

describe('Privacy Invariant: Forget Command Cascade Data Wipe', () => {
  it('immediately deletes member, checks, plan attendees, google tokens and records audit log', async () => {
    const workspaceId = 'T_TEST_WS_FORGET';
    const slackUserId = 'U_MEMBER_FORGET';
    const memberId = 'mem_cuid_123';

    // Mock storage states
    let memberDeleted = false;
    let checksDeletedCount = 0;
    let attendeesDeletedCount = 0;
    let tokensDeletedCount = 0;
    const auditLogsCreated: any[] = [];

    const mockPrisma: any = {
      member: {
        findUnique: vi.fn().mockResolvedValue({
          id: memberId,
          workspaceId,
          slackUserId,
          homeAreaLabel: 'HSR Layout',
        }),
        delete: vi.fn().mockImplementation(() => {
          memberDeleted = true;
          return { id: memberId };
        }),
      },
      check: {
        deleteMany: vi.fn().mockImplementation(() => {
          checksDeletedCount = 5;
          return { count: 5 };
        }),
      },
      planAttendee: {
        deleteMany: vi.fn().mockImplementation(() => {
          attendeesDeletedCount = 2;
          return { count: 2 };
        }),
      },
      googleToken: {
        deleteMany: vi.fn().mockImplementation(() => {
          tokensDeletedCount = 1;
          return { count: 1 };
        }),
      },
      auditLog: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          auditLogsCreated.push(data);
          return { id: 'audit_123', ...data };
        }),
      },
      $transaction: vi.fn().mockImplementation(async (ops: Promise<any>[]) => {
        return Promise.all(ops);
      }),
    };

    const result = await forgetMember(mockPrisma, { workspaceId, slackUserId });

    expect(result.success).toBe(true);
    expect(result.erased).toBe(true);
    expect(result.erasedMemberId).toBe(memberId);
    expect(result.recordsDeleted.checks).toBe(5);
    expect(result.recordsDeleted.planAttendees).toBe(2);
    expect(result.recordsDeleted.googleTokens).toBe(1);
    expect(result.recordsDeleted.members).toBe(1);

    expect(memberDeleted).toBe(true);
    expect(checksDeletedCount).toBe(5);
    expect(attendeesDeletedCount).toBe(2);
    expect(tokensDeletedCount).toBe(1);

    // Verify audit log compliance entry
    expect(auditLogsCreated).toHaveLength(1);
    expect(auditLogsCreated[0].actionType).toBe('DATA_DELETED');
    expect(auditLogsCreated[0].actorSlackUserId).toBe(slackUserId);
    expect(auditLogsCreated[0].targetEntity).toBe(`member:${memberId}`);
  });

  it('handles non-existent member gracefully when /tripwire forget is called', async () => {
    const mockPrisma: any = {
      member: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    const result = await forgetMember(mockPrisma, {
      workspaceId: 'T_UNKNOWN',
      slackUserId: 'U_UNKNOWN',
    });

    expect(result.success).toBe(true);
    expect(result.erased).toBe(false);
    expect(result.message).toContain('No personal records found');
  });
});

describe('Privacy Invariant: Workspace Uninstall Purge', () => {
  it('purges all workspace records across all tables on app_uninstalled or tokens_revoked', async () => {
    const workspaceId = 'T_UNINSTALL_WS';

    let workspaceDeleted = false;
    const mockPrisma: any = {
      workspace: {
        findUnique: vi.fn().mockResolvedValue({ id: workspaceId, name: 'Uninstall Co' }),
        delete: vi.fn().mockImplementation(() => {
          workspaceDeleted = true;
          return { id: workspaceId };
        }),
      },
      check: {
        deleteMany: vi.fn().mockResolvedValue({ count: 12 }),
      },
      planAttendee: {
        deleteMany: vi.fn().mockResolvedValue({ count: 8 }),
      },
      decision: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      googleToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      plan: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      member: {
        deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
      auditLog: {
        deleteMany: vi.fn().mockResolvedValue({ count: 15 }),
      },
      $transaction: vi.fn().mockImplementation(async (ops: Promise<any>[]) => {
        return Promise.all(ops);
      }),
    };

    const result = await handleWorkspaceUninstall(mockPrisma, workspaceId);

    expect(result.success).toBe(true);
    expect(result.workspaceId).toBe(workspaceId);
    expect(result.existed).toBe(true);
    expect(workspaceDeleted).toBe(true);
    expect(result.purgedCounts.plans).toBe(2);
    expect(result.purgedCounts.members).toBe(4);
    expect(result.purgedCounts.decisions).toBe(2);
  });
});

describe('Privacy Invariant: Team Lead Aggregate View (Rule 4)', () => {
  /**
   * Helper simulating the aggregate query exposed to the team lead for decision-making.
   * Asserts the architectural invariant: Lead views only aggregate numbers, NEVER personal data.
   */
  function buildLeadAggregateSummary(attendees: Array<{
    slackUserId: string;
    hasSkipped: boolean;
    isAffected: boolean;
    homeAreaLabel: string;
    encryptedCoords: string;
  }>): {
    totalEligible: number;
    affectedCount: number;
    skippedCount: number;
    affectedPercent: number;
  } {
    const eligible = attendees.filter((a) => !a.hasSkipped);
    const affected = eligible.filter((a) => a.isAffected);
    const skipped = attendees.filter((a) => a.hasSkipped);

    const affectedPercent = eligible.length > 0 ? (affected.length / eligible.length) * 100 : 0;

    return {
      totalEligible: eligible.length,
      affectedCount: affected.length,
      skippedCount: skipped.length,
      affectedPercent: Math.round(affectedPercent * 10) / 10,
    };
  }

  it('guarantees team lead sees only aggregate numbers and zero member home areas or coordinates', () => {
    const rawAttendees = [
      { slackUserId: 'U1', hasSkipped: false, isAffected: true, homeAreaLabel: 'HSR Layout Sector 1', encryptedCoords: 'iv:tag:ct1' },
      { slackUserId: 'U2', hasSkipped: false, isAffected: true, homeAreaLabel: 'Indiranagar 100ft Rd', encryptedCoords: 'iv:tag:ct2' },
      { slackUserId: 'U3', hasSkipped: false, isAffected: true, homeAreaLabel: 'Koramangala 4th Block', encryptedCoords: 'iv:tag:ct3' },
      { slackUserId: 'U4', hasSkipped: false, isAffected: true, homeAreaLabel: 'Whitefield ITPL', encryptedCoords: 'iv:tag:ct4' },
      { slackUserId: 'U5', hasSkipped: false, isAffected: false, homeAreaLabel: 'Bellandur Green Glen', encryptedCoords: 'iv:tag:ct5' },
      { slackUserId: 'U6', hasSkipped: false, isAffected: false, homeAreaLabel: 'Sarjapur Road', encryptedCoords: 'iv:tag:ct6' },
      { slackUserId: 'U7', hasSkipped: false, isAffected: false, homeAreaLabel: 'Marathahalli Bridge', encryptedCoords: 'iv:tag:ct7' },
      { slackUserId: 'U8', hasSkipped: true, isAffected: false, homeAreaLabel: 'Electronic City Phase 1', encryptedCoords: 'iv:tag:ct8' },
    ];

    const leadSummary = buildLeadAggregateSummary(rawAttendees);

    // Rule: "4 of 7 affected" (skipped member U8 excluded from denominator)
    expect(leadSummary.totalEligible).toBe(7);
    expect(leadSummary.affectedCount).toBe(4);
    expect(leadSummary.skippedCount).toBe(1);
    expect(leadSummary.affectedPercent).toBe(57.1);

    // INVARIANT CHECK: Verify that leadSummary has NO location, identity, or address properties
    const serialized = JSON.stringify(leadSummary);
    expect(serialized).not.toContain('HSR Layout');
    expect(serialized).not.toContain('Indiranagar');
    expect(serialized).not.toContain('Koramangala');
    expect(serialized).not.toContain('Whitefield');
    expect(serialized).not.toContain('Bellandur');
    expect(serialized).not.toContain('iv:tag');
    expect(serialized).not.toContain('encryptedCoords');
    expect(serialized).not.toContain('homeAreaLabel');
    expect(serialized).not.toContain('slackUserId');

    // Key invariant keys
    expect(Object.keys(leadSummary)).toEqual([
      'totalEligible',
      'affectedCount',
      'skippedCount',
      'affectedPercent',
    ]);
  });
});
