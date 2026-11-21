import crypto from 'crypto';

export type RuleEvaluationOutcome =
  | 'expired'
  | 'incomparable'
  | 'duplicate_or_old'
  | 'unknown'
  | 'stale'
  | 'confirming'
  | 'alert'
  | 'active'
  | 'recovered'
  | 'within_limit';

export interface RuleState {
  watchId: string;
  ruleVersion: number;
  queryHash: string;
  consecutive: number;
  active: boolean;
  lastSourceAt: number; // in seconds
  seenIds: Set<string>;
  episodeId: string | null;
}

export function createInitialRuleState(
  watchId: string,
  ruleVersion: number,
  queryHash: string
): RuleState {
  return {
    watchId,
    ruleVersion,
    queryHash,
    consecutive: 0,
    active: false,
    lastSourceAt: Number.NEGATIVE_INFINITY,
    seenIds: new Set<string>(),
    episodeId: null,
  };
}

/**
 * Deterministic fingerprint of an arbitrary object using sorted JSON keys.
 */
export function fingerprint(value: any): string {
  const jsonStr = JSON.stringify(value, Object.keys(value).sort(), 0);
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

/**
 * Canonical query hash excluding secrets and fetch-control flags (no_cache, async).
 */
export function canonicalQueryHash(
  engine: string,
  params: Record<string, string | number>
): string {
  const excludedKeys = new Set(['api_key', 'no_cache', 'async', 'output']);
  const cleanParams: Record<string, string> = {};

  for (const [k, v] of Object.entries(params)) {
    if (!excludedKeys.has(k) && v !== undefined && v !== null) {
      cleanParams[k] = String(v);
    }
  }

  const sortedPairs = Object.entries(cleanParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return crypto
    .createHash('sha256')
    .update(`engine=${engine}&${sortedPairs}`)
    .digest('hex');
}

/**
 * Extracts fastest valid driving duration in seconds from SerpApi Directions response.
 * Invariants:
 * - Requires search_metadata.status == 'Success' and no top-level error.
 * - Filters for travel_mode == 'Driving'.
 * - Must be finite positive number (rejects booleans, NaNs, <= 0).
 * - Independent of row reordering.
 */
export function fastestDriving(payload: any): number | null {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.search_metadata?.status !== 'Success' || payload.error) return null;

  const rows = payload.directions;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const validDurations: number[] = [];

  for (const r of rows) {
    if (
      r &&
      typeof r === 'object' &&
      r.travel_mode === 'Driving' &&
      typeof r.duration === 'number' &&
      typeof r.duration !== 'boolean' &&
      Number.isFinite(r.duration) &&
      r.duration > 0
    ) {
      validDurations.push(r.duration);
    }
  }

  return validDurations.length > 0 ? Math.min(...validDurations) : null;
}

/**
 * Extracts deterministic incident snapshot map { incident_id: type } from SerpApi Traffic response.
 * Invariants:
 * - Requires search_metadata.status == 'Success'.
 * - Deliberately excludes optional descriptions, geometry, or text to avoid false change events.
 * - Sorts keys deterministically.
 */
export function incidentSnapshot(payload: any): Record<string, string> | null {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.search_metadata?.status !== 'Success' || payload.error) return null;

  const rows = payload.traffic_incidents;
  if (!Array.isArray(rows)) return null;

  const map: Record<string, string> = {};

  for (const row of rows) {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.incident_id !== 'string' ||
      typeof row.type !== 'string'
    ) {
      return null;
    }
    map[row.incident_id] = row.type;
  }

  // Deterministically sort keys
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(map).sort()) {
    sorted[k] = map[k];
  }
  return sorted;
}

export interface EvaluateParams {
  observationId: string;
  sourceAt: number; // epoch seconds
  now: number; // epoch seconds
  deadline: number; // epoch seconds
  duration: number | null; // driving duration in seconds
  limit: number; // threshold in seconds
  queryHash: string;
  ruleVersion: number;
  maxAge?: number; // default 300s (5 minutes)
  resetMargin?: number; // default 300s (5 minutes hysteresis)
}

/**
 * Evaluates observation against rule state with exact deterministic invariants.
 */
export function evaluateRule(
  state: RuleState,
  params: EvaluateParams
): RuleEvaluationOutcome {
  const {
    observationId,
    sourceAt,
    now,
    deadline,
    duration,
    limit,
    queryHash,
    ruleVersion,
    maxAge = 300,
    resetMargin = 300,
  } = params;

  // 1. Deadline gate
  if (now >= deadline) {
    return 'expired';
  }

  // 2. Comparability gate: Query and rule version must match exactly
  if (ruleVersion !== state.ruleVersion || queryHash !== state.queryHash) {
    return 'incomparable';
  }

  // 3. Deduplication gate: Same observation ID or non-advancing source timestamp rejected
  if (state.seenIds.has(observationId) || sourceAt <= state.lastSourceAt) {
    return 'duplicate_or_old';
  }

  // 4. Validity gate: Missing or non-positive numerical data is UNKNOWN
  // Invariant: Unknown clears confirmation streak, but NEVER clears an active alert
  if (
    duration === null ||
    duration === undefined ||
    typeof duration !== 'number' ||
    typeof duration === 'boolean' ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    state.consecutive = 0;
    return 'unknown';
  }

  // 5. Freshness gate: Future timestamp or older than maxAge is STALE
  // Invariant: Stale data clears confirmation streak, but does not falsely clear active alert
  if (sourceAt > now || now - sourceAt > maxAge) {
    state.consecutive = 0;
    return 'stale';
  }

  // Record valid observation
  state.seenIds.add(observationId);
  state.lastSourceAt = sourceAt;

  // 6. Breach evaluation
  if (duration > limit) {
    state.consecutive += 1;
    // Exactly TWO fresh consecutive breaches required to alert
    if (state.consecutive >= 2 && !state.active) {
      state.active = true;
      state.episodeId = `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return 'alert';
    }
    return state.active ? 'active' : 'confirming';
  }

  // Duration is at or below limit
  state.consecutive = 0;

  // 7. Recovery hysteresis gate: Must recover at least resetMargin seconds below limit
  if (state.active && duration <= limit - resetMargin) {
    state.active = false;
    state.episodeId = null;
    return 'recovered';
  }

  return state.active ? 'active' : 'within_limit';
}

export type DeadlineStatus = 'upcoming' | 'closing_soon' | 'expired';

/**
 * Evaluates the status of a decision deadline.
 * Invariants:
 * - 'expired': now >= deadline
 * - 'closing_soon': deadline - now <= closingSoonWindowSeconds (default 30m / 1800s)
 * - 'upcoming': deadline - now > closingSoonWindowSeconds
 */
export function getDeadlineStatus(
  deadline: string | number | Date,
  nowInput?: string | number | Date,
  closingSoonWindowSeconds = 1800
): DeadlineStatus {
  const parseSeconds = (val: string | number | Date): number => {
    if (typeof val === 'number') {
      return val > 1e11 ? Math.floor(val / 1000) : Math.floor(val);
    }
    if (val instanceof Date) {
      return Math.floor(val.getTime() / 1000);
    }
    const ms = Date.parse(val);
    if (isNaN(ms)) {
      throw new Error(`Invalid deadline timestamp: ${val}`);
    }
    return Math.floor(ms / 1000);
  };

  const deadlineSec = parseSeconds(deadline);
  const nowSec = nowInput !== undefined ? parseSeconds(nowInput) : Math.floor(Date.now() / 1000);

  if (nowSec >= deadlineSec) {
    return 'expired';
  }
  if (deadlineSec - nowSec <= closingSoonWindowSeconds) {
    return 'closing_soon';
  }
  return 'upcoming';
}

export type TeamDecisionResolution =
  | 'unanimous_keep'
  | 'unanimous_remote'
  | 'needs_discussion'
  | 'pending';

export interface DecisionAcknowledgement {
  userId?: string;
  decision: 'keep' | 'remote' | 'discuss';
}

/**
 * Resolves collective team decision status from participant acknowledgements.
 * Invariants:
 * - 'pending' when no votes or partial quorum without disagreement
 * - 'unanimous_remote' when all participants choose 'remote'
 * - 'unanimous_keep' when all participants choose 'keep'
 * - 'needs_discussion' if any participant chooses 'discuss' or if votes are split (keep vs remote)
 */
export function resolveDecisionStatus(
  acknowledgements: DecisionAcknowledgement[],
  expectedCount = 2
): TeamDecisionResolution {
  if (!acknowledgements || acknowledgements.length === 0) {
    return 'pending';
  }

  // Any call for discussion immediately requires discussion
  const hasDiscuss = acknowledgements.some((a) => a.decision === 'discuss');
  if (hasDiscuss) {
    return 'needs_discussion';
  }

  // If quorum not yet reached
  if (acknowledgements.length < expectedCount) {
    return 'pending';
  }

  const allKeep = acknowledgements.every((a) => a.decision === 'keep');
  if (allKeep) {
    return 'unanimous_keep';
  }

  const allRemote = acknowledgements.every((a) => a.decision === 'remote');
  if (allRemote) {
    return 'unanimous_remote';
  }

  // Split votes (e.g., 1 keep, 1 remote)
  return 'needs_discussion';
}

export interface CreditEstimationParams {
  participantsCount: number;
  durationMinutes: number;
  routeIntervalMinutes?: number;
  trafficIntervalMinutes?: number;
  contingencyReserve?: number;
  budgetCap?: number;
}

export interface CreditEstimationResult {
  routeChecks: number;
  trafficChecks: number;
  totalEstimatedCredits: number;
  isWithinBudget: boolean;
  budgetCeiling: number;
}

/**
 * Estimates required SerpApi credits for a pact's observation lifecycle.
 * Invariants:
 * - Route checks: ceil(durationMinutes / routeIntervalMinutes) * participantsCount
 * - Traffic checks: ceil(durationMinutes / trafficIntervalMinutes)
 * - Total credits = routeChecks + trafficChecks + contingencyReserve
 * - isWithinBudget validates against planning ceiling (e.g. 40 or 60)
 */
export function estimateCreditRequirement(
  params: CreditEstimationParams
): CreditEstimationResult {
  const {
    participantsCount,
    durationMinutes,
    routeIntervalMinutes = 5,
    trafficIntervalMinutes = 15,
    contingencyReserve = 2,
    budgetCap = 40,
  } = params;

  if (durationMinutes <= 0 || participantsCount <= 0) {
    return {
      routeChecks: 0,
      trafficChecks: 0,
      totalEstimatedCredits: 0,
      isWithinBudget: true,
      budgetCeiling: budgetCap,
    };
  }

  const routeChecksPerParticipant = Math.ceil(durationMinutes / routeIntervalMinutes);
  const totalRouteChecks = participantsCount * routeChecksPerParticipant;
  const trafficChecks = Math.ceil(durationMinutes / trafficIntervalMinutes);
  const totalEstimatedCredits = totalRouteChecks + trafficChecks + contingencyReserve;

  return {
    routeChecks: totalRouteChecks,
    trafficChecks,
    totalEstimatedCredits,
    isWithinBudget: totalEstimatedCredits <= budgetCap,
    budgetCeiling: budgetCap,
  };
}
