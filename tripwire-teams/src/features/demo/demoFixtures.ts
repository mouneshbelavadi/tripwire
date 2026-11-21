/**
 * Tripwire Teams - Bengaluru Tech Corridor Commute Fixtures
 *
 * Synthetic commute sequences modeled after realistic peak-hour traffic conditions
 * across Bengaluru's primary tech corridors:
 * 1. Outer Ring Road (Marathahalli - Bellandur - Sarjapur)
 * 2. Central Silk Board (BTM Layout - HSR - Silk Board Junction)
 * 3. Whitefield (Kundalahalli - ITPL - Hope Farm)
 * 4. Indiranagar (100ft Road - Old Airport Road - Domlur / EGL)
 * 5. HSR Layout (Sector 1 / Sector 5 - Hosur Road)
 *
 * NON-NEGOTIABLE SAFETY INVARIANT:
 * All synthetic readings MUST be clearly tagged with provenance: 'simulated'.
 * Coordinates are rounded to 2 decimal places (~1.1 km) adhering to Privacy by Design.
 */

import { AttendeeReading, RainForecast } from '../decision/types.js';

export interface CorridorFixture {
  id: string;
  corridorName: string;
  memberId: string;
  originLabel: string;
  originCoords: { lat: number; lon: number };
  destinationLabel: string;
  destinationCoords: { lat: number; lon: number };
  travelMode: 'DRIVE' | 'TWO_WHEELER' | 'TRANSIT';
  personalMaxMinutes: number;
  baselineSeconds: number; // Evening-before baseline
  normalSeconds: number;   // Normal commute duration
  breach1Seconds: number;  // Disruption Check 1 duration (severe delay)
  breach2Seconds: number;  // Disruption Check 2 duration (persistent delay)
  provenance: 'simulated';
}

/**
 * 5 Canonical Bengaluru Tech Corridor Fixtures
 */
export const BENGALURU_TECH_CORRIDORS: readonly CorridorFixture[] = [
  {
    id: 'corridor-orr-bellandur',
    corridorName: 'Outer Ring Road (Bellandur - Sarjapur)',
    memberId: 'mem_blr_orr_01',
    originLabel: 'Sarjapur Road / Bellandur',
    originCoords: { lat: 12.93, lon: 77.68 },
    destinationLabel: 'Bagmane Constellation Park / Marathahalli',
    destinationCoords: { lat: 12.97, lon: 77.70 },
    travelMode: 'DRIVE',
    personalMaxMinutes: 45,
    baselineSeconds: 2520, // 42 min baseline
    normalSeconds: 2600,   // ~43 min normal
    breach1Seconds: 4680,  // 78 min (+85% spike over baseline, > 45m max) -> AFFECTED
    breach2Seconds: 4920,  // 82 min (+95% spike over baseline, > 45m max) -> AFFECTED
    provenance: 'simulated',
  },
  {
    id: 'corridor-silkboard-btm',
    corridorName: 'Central Silk Board (BTM - HSR Junction)',
    memberId: 'mem_blr_silkboard_02',
    originLabel: 'BTM Layout 2nd Stage',
    originCoords: { lat: 12.92, lon: 77.60 },
    destinationLabel: 'Hosur Road Tech Park',
    destinationCoords: { lat: 12.91, lon: 77.64 },
    travelMode: 'TWO_WHEELER',
    personalMaxMinutes: 40,
    baselineSeconds: 2100, // 35 min baseline
    normalSeconds: 2150,   // ~36 min normal
    breach1Seconds: 4080,  // 68 min (+94% spike, gridlock at Silk Board flyover) -> AFFECTED
    breach2Seconds: 4320,  // 72 min (+105% spike) -> AFFECTED
    provenance: 'simulated',
  },
  {
    id: 'corridor-whitefield-itpl',
    corridorName: 'Whitefield (Kundalahalli - ITPL)',
    memberId: 'mem_blr_whitefield_03',
    originLabel: 'Kundalahalli Gate',
    originCoords: { lat: 12.96, lon: 77.72 },
    destinationLabel: 'ITPL Main Road Whitefield',
    destinationCoords: { lat: 12.99, lon: 77.75 },
    travelMode: 'DRIVE',
    personalMaxMinutes: 55,
    baselineSeconds: 3000, // 50 min baseline
    normalSeconds: 3100,   // ~52 min normal
    breach1Seconds: 5700,  // 95 min (+90% spike, waterlogging near Hope Farm) -> AFFECTED
    breach2Seconds: 5880,  // 98 min (+96% spike) -> AFFECTED
    provenance: 'simulated',
  },
  {
    id: 'corridor-indiranagar-egl',
    corridorName: 'Indiranagar (100ft Road - Domlur / EGL)',
    memberId: 'mem_blr_indiranagar_04',
    originLabel: 'Indiranagar 100ft Road',
    originCoords: { lat: 12.98, lon: 77.64 },
    destinationLabel: 'Embassy GolfLinks (EGL) Domlur',
    destinationCoords: { lat: 12.95, lon: 77.65 },
    travelMode: 'TRANSIT',
    personalMaxMinutes: 35,
    baselineSeconds: 1500, // 25 min baseline
    normalSeconds: 1450,   // ~24 min normal
    breach1Seconds: 1620,  // 27 min (+8% change, transit running smoothly) -> OK
    breach2Seconds: 1650,  // 27.5 min -> OK
    provenance: 'simulated',
  },
  {
    id: 'corridor-hsr-koramangala',
    corridorName: 'HSR Layout (Sector 5 - Koramangala)',
    memberId: 'mem_blr_hsr_05',
    originLabel: 'HSR Layout Sector 5',
    originCoords: { lat: 12.91, lon: 77.65 },
    destinationLabel: 'Koramangala 80ft Road',
    destinationCoords: { lat: 12.93, lon: 77.63 },
    travelMode: 'TWO_WHEELER',
    personalMaxMinutes: 40,
    baselineSeconds: 1680, // 28 min baseline
    normalSeconds: 1700,   // ~28 min normal
    breach1Seconds: 1800,  // 30 min (+7% change, internal link roads clear) -> OK
    breach2Seconds: 1860,  // 31 min -> OK
    provenance: 'simulated',
  },
] as const;

/**
 * Realistic Weather Scenarios for Bengaluru
 */
export const BENGALURU_RAIN_NORMAL: RainForecast = {
  precipitationProbability: 15,
  rainfallMm: 0.0,
};

export const BENGALURU_RAIN_DISRUPTED: RainForecast = {
  precipitationProbability: 85,
  rainfallMm: 14.5, // Heavy monsoon downpour causing localized underpass waterlogging on ORR & Silk Board
};

export type SimulationStage = 'normal' | 'first_breach' | 'second_breach';

export interface SimulatedCheckDbRecord {
  id: string;
  planId: string;
  memberId: string;
  checkedAt: Date;
  providerTimestamp: Date;
  durationSeconds: number;
  baselineSeconds: number;
  status: 'ok' | 'unknown';
  provenance: 'simulated';
  corridorName: string;
}

/**
 * Generate simulated attendee readings for decision engine evaluation.
 * Every reading returned is strictly marked with `provenance: 'simulated'`.
 */
export function getSimulatedAttendeeReadings(
  stage: SimulationStage = 'normal',
  providerTimestamp: Date = new Date(),
  corridors: readonly CorridorFixture[] = BENGALURU_TECH_CORRIDORS
): (AttendeeReading & { provenance: 'simulated' })[] {
  return corridors.map((corridor) => {
    let durationSeconds: number;
    if (stage === 'normal') {
      durationSeconds = corridor.normalSeconds;
    } else if (stage === 'first_breach') {
      durationSeconds = corridor.breach1Seconds;
    } else {
      durationSeconds = corridor.breach2Seconds;
    }

    return {
      memberId: corridor.memberId,
      durationSeconds,
      baselineSeconds: corridor.baselineSeconds,
      personalMaxMinutes: corridor.personalMaxMinutes,
      status: 'ok',
      providerTimestamp,
      hasSkipped: false,
      provenance: 'simulated',
    };
  });
}

/**
 * Generate simulated database check records to be stored in PostgreSQL / SQLite.
 * Every record has `provenance: 'simulated'` and `status: 'ok'`.
 */
export function generateSimulatedDbCheckRecords(
  planId: string,
  stage: SimulationStage = 'first_breach',
  checkedAt: Date = new Date(),
  providerTimestamp: Date = new Date(),
  corridors: readonly CorridorFixture[] = BENGALURU_TECH_CORRIDORS
): SimulatedCheckDbRecord[] {
  return corridors.map((corridor, idx) => {
    let durationSeconds: number;
    if (stage === 'normal') {
      durationSeconds = corridor.normalSeconds;
    } else if (stage === 'first_breach') {
      durationSeconds = corridor.breach1Seconds;
    } else {
      durationSeconds = corridor.breach2Seconds;
    }

    return {
      id: `sim_chk_${stage}_${idx + 1}_${checkedAt.getTime()}`,
      planId,
      memberId: corridor.memberId,
      checkedAt,
      providerTimestamp,
      durationSeconds,
      baselineSeconds: corridor.baselineSeconds,
      status: 'ok',
      provenance: 'simulated',
      corridorName: corridor.corridorName,
    };
  });
}
