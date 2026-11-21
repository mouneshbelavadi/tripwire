/**
 * scripts/verify_release_isolated.ts
 *
 * Isolated Release Verification Test Suite for OfficePact TypeScript Core.
 *
 * STRICT SAFETY CONSTRAINTS:
 * - Operates entirely against a fresh disposable SQLite database in os.tmpdir().
 * - NEVER touches, modifies, or deletes the repo's officepact.sqlite3 (or -wal/-shm).
 * - Sets DATABASE_PATH and disables API keys before importing server modules (100% offline).
 * - Cleans up all disposable files on exit.
 * - Asserts the behavior implemented TODAY in TypeScript and honestly reports documentation mismatches.
 *
 * RUN COMMAND:
 *   npx tsx scripts/verify_release_isolated.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';

// Static import of pure domain kernel (NO DB or config dependencies)
import {
  evaluateRule,
  fastestDriving,
  incidentSnapshot,
  fingerprint,
  canonicalQueryHash,
  createInitialRuleState,
  getDeadlineStatus,
  resolveDecisionStatus,
  estimateCreditRequirement,
  type RuleState,
} from '../src/server/domain/tripwireCore.js';

// Setup isolated environment BEFORE importing DB-dependent modules
const tempDbPath = path.resolve(
  os.tmpdir(),
  `officepact_verify_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.sqlite3`
);

process.env.DATABASE_PATH = tempDbPath;
process.env.SERPAPI_API_KEY = '';
process.env.SERPAPI_KEY = '';
process.env.YDC_API_KEY = '';
process.env.YOU_API_KEY = '';
process.env.YOU_COM_API_KEY = '';
process.env.TEAM_CHANNEL_APP_KEY = '';
process.env.TEAM_CHANNEL_APP_SECRET = '';
process.env.TEAM_CHANNEL_API_BASE = '';
process.env.APP_MODE = 'SIMULATION';
process.env.NODE_ENV = 'test';

// Verify existing workspace database protection baseline
const repoDbPath = path.resolve(process.cwd(), 'officepact.sqlite3');
let initialRepoDbStat: fs.Stats | null = null;
if (fs.existsSync(repoDbPath)) {
  initialRepoDbStat = fs.statSync(repoDbPath);
}

// Test runner state
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testFailures: Array<{ name: string; error: any }> = [];
const docMismatches: Array<{ topic: string; documented: string; actual: string; implication: string }> = [];

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> | void {
  totalTests++;
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      return (result as Promise<void>)
        .then(() => {
          passedTests++;
          console.log(`  ✓ ${name}`);
        })
        .catch((err) => {
          failedTests++;
          testFailures.push({ name, error: err });
          console.error(`  ✗ ${name}`);
          console.error(`    Error: ${err.message || err}`);
        });
    } else {
      passedTests++;
      console.log(`  ✓ ${name}`);
    }
  } catch (err: any) {
    failedTests++;
    testFailures.push({ name, error: err });
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message || err}`);
  }
}

// Helper for pure evaluation
function evalObs(state: RuleState, overrides: Partial<any> = {}) {
  const defaults = {
    observationId: 'obs_a',
    sourceAt: 100,
    now: 110,
    deadline: 1000,
    duration: 3900, // 65 min
    limit: 3600, // 60 min
    queryHash: 'query_hash_valid',
    ruleVersion: 1,
    maxAge: 300,
    resetMargin: 300,
  };
  return evaluateRule(state, { ...defaults, ...overrides });
}

async function main() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('  OfficePact Isolated Release Verification Suite (TypeScript)');
  console.log('================================================================');
  console.log(`Isolated Temp DB : ${tempDbPath}`);
  console.log(`Network Mode     : OFFLINE (SIMULATION, API keys stripped)`);
  console.log(`Workspace DB     : ${repoDbPath} (${initialRepoDbStat ? 'Protected' : 'Not found'})`);
  console.log('----------------------------------------------------------------\n');

  // ============================================================================
  // SUITE 1: Pure Mathematical & Deterministic Invariants (tripwireCore.ts)
  // ============================================================================
  console.log('--- SUITE 1: Deterministic Tripwire Core Invariants ---');

  runTest('1.1 First fresh breach evaluated as confirming (1/2)', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    const outcome = evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110, duration: 3800, limit: 3600 });
    assert.strictEqual(outcome, 'confirming');
    assert.strictEqual(s.consecutive, 1);
    assert.strictEqual(s.active, false);
    assert.strictEqual(s.episodeId, null);
    assert.strictEqual(s.lastSourceAt, 100);
    assert(s.seenIds.has('obs_1'));
  });

  runTest('1.2 Second consecutive fresh breach triggers alert (2/2)', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110, duration: 3800, limit: 3600 });
    const outcome = evalObs(s, { observationId: 'obs_2', sourceAt: 120, now: 130, duration: 3900, limit: 3600 });
    assert.strictEqual(outcome, 'alert');
    assert.strictEqual(s.consecutive, 2);
    assert.strictEqual(s.active, true);
    assert(typeof s.episodeId === 'string' && s.episodeId.startsWith('ep_'), 'Episode ID must start with ep_');
    assert.strictEqual(s.lastSourceAt, 120);
    assert(s.seenIds.has('obs_2'));
  });

  runTest('1.3 Third consecutive breach while active stays active with preserved episodeId', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110 });
    evalObs(s, { observationId: 'obs_2', sourceAt: 120, now: 130 });
    const originalEpisodeId = s.episodeId;
    const outcome = evalObs(s, { observationId: 'obs_3', sourceAt: 140, now: 150, duration: 4100 });
    assert.strictEqual(outcome, 'active');
    assert.strictEqual(s.consecutive, 3);
    assert.strictEqual(s.active, true);
    assert.strictEqual(s.episodeId, originalEpisodeId, 'Episode ID must remain invariant across active alerts');
  });

  runTest('1.4 Repeated observation ID is rejected as duplicate_or_old without changing state', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110 });
    const outcome = evalObs(s, { observationId: 'obs_1', sourceAt: 120, now: 130 });
    assert.strictEqual(outcome, 'duplicate_or_old');
    assert.strictEqual(s.consecutive, 1, 'Streak must not increment on duplicate');
    assert.strictEqual(s.active, false);
  });

  runTest('1.5 Non-advancing identical source timestamp rejected as duplicate_or_old', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110 });
    const outcome = evalObs(s, { observationId: 'obs_diff_id', sourceAt: 100, now: 130 });
    assert.strictEqual(outcome, 'duplicate_or_old');
    assert.strictEqual(s.consecutive, 1);
    assert.strictEqual(s.active, false);
  });

  runTest('1.6 Regressing (older) source timestamp rejected as duplicate_or_old', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110 });
    const outcome = evalObs(s, { observationId: 'obs_2', sourceAt: 90, now: 130 });
    assert.strictEqual(outcome, 'duplicate_or_old');
    assert.strictEqual(s.consecutive, 1);
    assert.strictEqual(s.active, false);
  });

  runTest('1.7 Stale timestamp boundaries: default maxAge = 300s', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    // Boundary test: now - sourceAt = 300s -> NOT stale (condition is now - sourceAt > maxAge)
    assert.strictEqual(evalObs(s, { observationId: 'obs_edge', sourceAt: 100, now: 400 }), 'confirming');
    
    // now - sourceAt = 301s -> STALE
    const s2 = createInitialRuleState('w1', 1, 'query_hash_valid');
    assert.strictEqual(evalObs(s2, { observationId: 'obs_stale', sourceAt: 100, now: 401 }), 'stale');
    assert.strictEqual(s2.consecutive, 0, 'Stale resets consecutive breaches');
  });

  runTest('1.8 Discrepancy Check: Documented MAX_SOURCE_AGE_S = 600s vs Code default maxAge = 300s', () => {
    const sDefault = createInitialRuleState('w1', 1, 'query_hash_valid');
    // At age 450s (7.5 min):
    const resDefault = evaluateRule(sDefault, {
      observationId: 'obs_mid',
      sourceAt: 100,
      now: 550, // 450s age
      deadline: 1000,
      duration: 3800,
      limit: 3600,
      queryHash: 'query_hash_valid',
      ruleVersion: 1,
      // maxAge omitted -> defaults to 300
    });
    assert.strictEqual(resDefault, 'stale', 'Default maxAge is 300s, so 450s is stale in TS today');

    const sExplicit = createInitialRuleState('w1', 1, 'query_hash_valid');
    const resExplicit = evaluateRule(sExplicit, {
      observationId: 'obs_mid_exp',
      sourceAt: 100,
      now: 550, // 450s age
      deadline: 1000,
      duration: 3800,
      limit: 3600,
      queryHash: 'query_hash_valid',
      ruleVersion: 1,
      maxAge: 600, // Documented MAX_SOURCE_AGE_S
    });
    assert.strictEqual(resExplicit, 'confirming', 'Explicit maxAge=600 accepts 450s age');

    docMismatches.push({
      topic: 'Source Freshness Gate Default (maxAge vs MAX_SOURCE_AGE_S)',
      documented: 'PROJECT_CONTEXT.md:205 claims MAX_SOURCE_AGE_S = 600 (10 minutes)',
      actual: 'tripwireCore.ts line 177 defaults maxAge = 300 (5 minutes)',
      implication: 'Unspecified callers get a tighter 5-minute freshness gate instead of 10 minutes.',
    });
  });

  runTest('1.9 Future timestamps and Clock Skew tolerance verification', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    // Source timestamp 1s into future
    const res1 = evalObs(s, { observationId: 'obs_fut1', sourceAt: 101, now: 100 });
    assert.strictEqual(res1, 'stale', 'sourceAt > now is flagged as stale immediately');

    // Source timestamp 121s into future (> 120s clock skew)
    const resSkew = evalObs(s, { observationId: 'obs_fut121', sourceAt: 221, now: 100 });
    assert.strictEqual(resSkew, 'stale', 'Timestamp > 120s clock skew is rejected as stale');

    docMismatches.push({
      topic: 'Forward Clock Skew Tolerance',
      documented: 'Requirement mentions future timestamps (> 120s clock skew)',
      actual: 'tripwireCore.ts line 212 strictly tests "sourceAt > now || now - sourceAt > maxAge"',
      implication: 'Any forward clock skew (even +1s) is treated as stale. Zero forward clock skew is tolerated.',
    });
  });

  runTest('1.10 Invariant: Stale observation NEVER clears an active emergency alert', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110 });
    evalObs(s, { observationId: 'obs_2', sourceAt: 120, now: 130 });
    assert.strictEqual(s.active, true);
    const activeEp = s.episodeId;

    // Stale observation arrives
    const staleOutcome = evalObs(s, { observationId: 'obs_3', sourceAt: 140, now: 600 });
    assert.strictEqual(staleOutcome, 'stale');
    assert.strictEqual(s.consecutive, 0, 'Consecutive breaches reset to 0');
    assert.strictEqual(s.active, true, 'Active alert remains TRUE');
    assert.strictEqual(s.episodeId, activeEp, 'Episode ID preserved');
  });

  runTest('1.11 Invalid numeric durations (missing, negative, NaN, boolean, zero)', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    const invalidValues = [null, undefined, NaN, -1, -500, 0, Infinity, -Infinity, true, false, '4000'];
    for (const val of invalidValues) {
      const outcome = evalObs(s, { duration: val });
      assert.strictEqual(outcome, 'unknown', `Value ${val} (${typeof val}) must be unknown`);
      assert.strictEqual(s.consecutive, 0);
    }
  });

  runTest('1.12 Invariant: Unknown observation NEVER clears an active emergency alert', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110 });
    evalObs(s, { observationId: 'obs_2', sourceAt: 120, now: 130 });
    assert.strictEqual(s.active, true);
    const activeEp = s.episodeId;

    const unknownOutcome = evalObs(s, { observationId: 'obs_3', sourceAt: 140, now: 150, duration: null });
    assert.strictEqual(unknownOutcome, 'unknown');
    assert.strictEqual(s.consecutive, 0);
    assert.strictEqual(s.active, true, 'Active alert remains TRUE');
    assert.strictEqual(s.episodeId, activeEp);
  });

  runTest('1.13 Exact deadline boundary: now >= deadline is expired', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    // now = deadline - 1 with fresh sourceAt -> valid
    assert.strictEqual(
      evalObs(s, { observationId: 'obs_before', sourceAt: 990, now: 999, deadline: 1000 }),
      'confirming'
    );

    // now = deadline -> expired
    const s2 = createInitialRuleState('w1', 1, 'query_hash_valid');
    assert.strictEqual(
      evalObs(s2, { observationId: 'obs_at', sourceAt: 990, now: 1000, deadline: 1000 }),
      'expired'
    );

    // now = deadline + 1 -> expired
    const s3 = createInitialRuleState('w1', 1, 'query_hash_valid');
    assert.strictEqual(
      evalObs(s3, { observationId: 'obs_after', sourceAt: 990, now: 1001, deadline: 1000 }),
      'expired'
    );
  });

  runTest('1.14 Version change marks observation incomparable and preserves state', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110 });
    assert.strictEqual(s.consecutive, 1);

    const outcome = evalObs(s, { observationId: 'obs_2', sourceAt: 120, now: 130, ruleVersion: 2 });
    assert.strictEqual(outcome, 'incomparable');
    assert.strictEqual(s.consecutive, 1, 'State untouched');
    assert.strictEqual(s.lastSourceAt, 100);
  });

  runTest('1.15 Query hash change marks observation incomparable and preserves state', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110 });
    const outcome = evalObs(s, { observationId: 'obs_2', sourceAt: 120, now: 130, queryHash: 'query_different' });
    assert.strictEqual(outcome, 'incomparable');
    assert.strictEqual(s.consecutive, 1);
  });

  runTest('1.16 Threshold equality: duration == limit is NOT a breach; duration == limit + 1 IS a breach', () => {
    const s1 = createInitialRuleState('w1', 1, 'query_hash_valid');
    const resEqual = evalObs(s1, { duration: 3600, limit: 3600 });
    assert.strictEqual(resEqual, 'within_limit');
    assert.strictEqual(s1.consecutive, 0);

    const s2 = createInitialRuleState('w1', 1, 'query_hash_valid');
    const resPlusOne = evalObs(s2, { duration: 3601, limit: 3600 });
    assert.strictEqual(resPlusOne, 'confirming');
    assert.strictEqual(s2.consecutive, 1);
  });

  runTest('1.17 Active alert recovery-margin boundaries (300s hysteresis gate)', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110, duration: 4000, limit: 3600, resetMargin: 300 });
    evalObs(s, { observationId: 'obs_2', sourceAt: 120, now: 130, duration: 4100, limit: 3600, resetMargin: 300 });
    assert.strictEqual(s.active, true);

    // Limit = 3600, resetMargin = 300. Recovery requires duration <= 3300.
    // Case 1: Duration 3599 (below limit, but > 3300) -> stays 'active'
    const res1 = evalObs(s, { observationId: 'obs_3', sourceAt: 140, now: 150, duration: 3599, limit: 3600, resetMargin: 300 });
    assert.strictEqual(res1, 'active');
    assert.strictEqual(s.active, true);

    // Case 2: Duration 3301 (> 3300) -> stays 'active'
    const res2 = evalObs(s, { observationId: 'obs_4', sourceAt: 160, now: 170, duration: 3301, limit: 3600, resetMargin: 300 });
    assert.strictEqual(res2, 'active');
    assert.strictEqual(s.active, true);

    // Case 3: Duration 3300 (exactly limit - 300) -> recovers!
    const res3 = evalObs(s, { observationId: 'obs_5', sourceAt: 180, now: 190, duration: 3300, limit: 3600, resetMargin: 300 });
    assert.strictEqual(res3, 'recovered');
    assert.strictEqual(s.active, false);
    assert.strictEqual(s.episodeId, null);

    // Case 4: Duration well below (3100) -> remains within_limit
    const res4 = evalObs(s, { observationId: 'obs_6', sourceAt: 200, now: 210, duration: 3100, limit: 3600, resetMargin: 300 });
    assert.strictEqual(res4, 'within_limit');
    assert.strictEqual(s.active, false);
  });

  runTest('1.18 Pending breach recovery (single unconfirmed spike clearing)', () => {
    const s = createInitialRuleState('w1', 1, 'query_hash_valid');
    evalObs(s, { observationId: 'obs_1', sourceAt: 100, now: 110, duration: 3800, limit: 3600 });
    assert.strictEqual(s.consecutive, 1);
    assert.strictEqual(s.active, false);

    // Single spike drops to 3550 (below limit 3600, but NOT below limit - 300 = 3300)
    const outcome = evalObs(s, { observationId: 'obs_2', sourceAt: 120, now: 130, duration: 3550, limit: 3600 });
    assert.strictEqual(outcome, 'within_limit');
    assert.strictEqual(s.consecutive, 0, 'Consecutive breaches reset on <= limit');

    docMismatches.push({
      topic: 'Recovery Hysteresis Scope (Active Alert vs Pending Breach)',
      documented: 'PROJECT_CONTEXT.md:204 states "5-Minute Recovery Hysteresis: If traffic improves to at least 5 minutes under the limit within 5 minutes of a single spike, consecutive_breaches resets to 0"',
      actual: 'tripwireCore.ts line 234 resets consecutive = 0 whenever duration <= limit (no 300s drop required to clear a single spike)',
      implication: 'Hysteresis margin (limit - 300s) strictly gates recovering from ACTIVE alerts, while pending spikes clear immediately at limit.',
    });
  });

  runTest('1.19 fastestDriving payload extractor invariants', () => {
    const directions = [
      { travel_mode: 'Transit', duration: 1800 },
      { travel_mode: 'Driving', duration: 4200 },
      { travel_mode: 'Driving', duration: 3500 },
      { travel_mode: 'Walking', duration: 900 },
    ];
    const payloadA = { search_metadata: { status: 'Success' }, directions };
    const payloadB = { search_metadata: { status: 'Success' }, directions: [...directions].reverse() };

    assert.strictEqual(fastestDriving(payloadA), 3500);
    assert.strictEqual(fastestDriving(payloadB), 3500, 'Row order independence');

    // Invalid / empty payloads
    assert.strictEqual(fastestDriving(null), null);
    assert.strictEqual(fastestDriving({}), null);
    assert.strictEqual(fastestDriving({ search_metadata: { status: 'Error' }, directions }), null);
    assert.strictEqual(fastestDriving({ error: 'Over limit', directions }), null);
    assert.strictEqual(fastestDriving({ search_metadata: { status: 'Success' }, directions: [] }), null);
    assert.strictEqual(
      fastestDriving({ search_metadata: { status: 'Success' }, directions: [{ travel_mode: 'Driving', duration: -10 }] }),
      null
    );
    assert.strictEqual(
      fastestDriving({ search_metadata: { status: 'Success' }, directions: [{ travel_mode: 'Driving', duration: '3500' }] }),
      null
    );
  });

  runTest('1.20 incidentSnapshot determinism and key sorting', () => {
    const incsA = [
      { incident_id: 'inc_b', type: 'road_closed' },
      { incident_id: 'inc_a', type: 'congestion' },
    ];
    const trfA = { search_metadata: { status: 'Success' }, traffic_incidents: incsA };
    const trfB = { search_metadata: { status: 'Success' }, traffic_incidents: [...incsA].reverse() };

    const snapA = incidentSnapshot(trfA);
    const snapB = incidentSnapshot(trfB);
    assert.deepStrictEqual(snapA, { inc_a: 'congestion', inc_b: 'road_closed' });
    assert.strictEqual(fingerprint(snapA), fingerprint(snapB), 'Key order invariant');

    assert.strictEqual(incidentSnapshot(null), null);
    assert.strictEqual(incidentSnapshot({ search_metadata: { status: 'Error' } }), null);
  });

  runTest('1.21 canonicalQueryHash secret exclusion and key sorting', () => {
    const hash1 = canonicalQueryHash('google_maps_directions', {
      origin: 'Indiranagar',
      destination: 'Bellandur',
      api_key: 'secret_alpha',
      no_cache: 'true',
      async: 1,
      output: 'json',
    });
    const hash2 = canonicalQueryHash('google_maps_directions', {
      destination: 'Bellandur',
      origin: 'Indiranagar',
      api_key: 'secret_beta',
      no_cache: 'false',
    });
    assert.strictEqual(hash1, hash2, 'Hashes must match regardless of order or excluded flags');
  });

  runTest('1.22 getDeadlineStatus deadline boundaries', () => {
    const deadline = 10000;
    // Closing soon window default = 1800s
    assert.strictEqual(getDeadlineStatus(deadline, 8000), 'upcoming', '2000s left is upcoming');
    assert.strictEqual(getDeadlineStatus(deadline, 8200), 'closing_soon', 'Exactly 1800s left is closing_soon');
    assert.strictEqual(getDeadlineStatus(deadline, 9000), 'closing_soon', '1000s left is closing_soon');
    assert.strictEqual(getDeadlineStatus(deadline, 10000), 'expired', 'Exact deadline is expired');
    assert.strictEqual(getDeadlineStatus(deadline, 10050), 'expired', 'Past deadline is expired');
  });

  console.log('\n--- SUITE 2: Decision Resolution & Consensus Logic ---');

  runTest('2.1 Empty acknowledgements resolves to pending', () => {
    assert.strictEqual(resolveDecisionStatus([]), 'pending');
  });

  runTest('2.2 Partial quorum below expected count (1/2 remote) resolves to pending', () => {
    assert.strictEqual(resolveDecisionStatus([{ userId: 'u1', decision: 'remote' }], 2), 'pending');
  });

  runTest('2.3 Partial quorum below expected count (1/2 keep) resolves to pending', () => {
    assert.strictEqual(resolveDecisionStatus([{ userId: 'u1', decision: 'keep' }], 2), 'pending');
  });

  runTest('2.4 Partial quorum with discuss (1/2 discuss) immediately requires discussion', () => {
    assert.strictEqual(resolveDecisionStatus([{ userId: 'u1', decision: 'discuss' }], 2), 'needs_discussion');
  });

  runTest('2.5 Unanimous remote resolves to unanimous_remote', () => {
    const acks: any[] = [
      { userId: 'u1', decision: 'remote' },
      { userId: 'u2', decision: 'remote' },
    ];
    assert.strictEqual(resolveDecisionStatus(acks, 2), 'unanimous_remote');
  });

  runTest('2.6 Unanimous keep resolves to unanimous_keep', () => {
    const acks: any[] = [
      { userId: 'u1', decision: 'keep' },
      { userId: 'u2', decision: 'keep' },
    ];
    assert.strictEqual(resolveDecisionStatus(acks, 2), 'unanimous_keep');
  });

  runTest('2.7 Conflicting split votes (1 remote, 1 keep) resolves to needs_discussion', () => {
    const acks: any[] = [
      { userId: 'u1', decision: 'remote' },
      { userId: 'u2', decision: 'keep' },
    ];
    assert.strictEqual(resolveDecisionStatus(acks, 2), 'needs_discussion');
  });

  runTest('2.8 Conflicting split votes (1 keep, 1 remote) resolves to needs_discussion', () => {
    const acks: any[] = [
      { userId: 'u1', decision: 'keep' },
      { userId: 'u2', decision: 'remote' },
    ];
    assert.strictEqual(resolveDecisionStatus(acks, 2), 'needs_discussion');
  });

  runTest('2.9 Mixed votes with discuss resolves to needs_discussion', () => {
    const acks: any[] = [
      { userId: 'u1', decision: 'remote' },
      { userId: 'u2', decision: 'discuss' },
    ];
    assert.strictEqual(resolveDecisionStatus(acks, 2), 'needs_discussion');
  });

  runTest('2.10 Multi-party 3-person quorum resolution', () => {
    // 2/3 remote -> pending
    assert.strictEqual(
      resolveDecisionStatus([{ userId: 'u1', decision: 'remote' }, { userId: 'u2', decision: 'remote' }], 3),
      'pending'
    );
    // 3/3 remote -> unanimous_remote
    assert.strictEqual(
      resolveDecisionStatus(
        [{ userId: 'u1', decision: 'remote' }, { userId: 'u2', decision: 'remote' }, { userId: 'u3', decision: 'remote' }],
        3
      ),
      'unanimous_remote'
    );
    // 2/3 remote, 1/3 keep -> needs_discussion
    assert.strictEqual(
      resolveDecisionStatus(
        [{ userId: 'u1', decision: 'remote' }, { userId: 'u2', decision: 'remote' }, { userId: 'u3', decision: 'keep' }],
        3
      ),
      'needs_discussion'
    );
  });

  runTest('2.11 estimateCreditRequirement formula correctness', () => {
    // 2 participants, 60m duration (5m route, 15m traffic, 2 reserve, cap 40)
    // route = ceil(60/5) * 2 = 12 * 2 = 24
    // traffic = ceil(60/15) = 4
    // total = 24 + 4 + 2 = 30
    const est1 = estimateCreditRequirement({ participantsCount: 2, durationMinutes: 60, budgetCap: 40 });
    assert.strictEqual(est1.routeChecks, 24);
    assert.strictEqual(est1.trafficChecks, 4);
    assert.strictEqual(est1.totalEstimatedCredits, 30);
    assert.strictEqual(est1.isWithinBudget, true);

    // 2 participants, 90m duration -> route = 18*2 = 36, traffic = 6, total = 44 (> 40 cap)
    const est2 = estimateCreditRequirement({ participantsCount: 2, durationMinutes: 90, budgetCap: 40 });
    assert.strictEqual(est2.totalEstimatedCredits, 44);
    assert.strictEqual(est2.isWithinBudget, false);

    // Non-positive inputs
    const estZero = estimateCreditRequirement({ participantsCount: 0, durationMinutes: 0 });
    assert.strictEqual(estZero.totalEstimatedCredits, 0);
    assert.strictEqual(estZero.isWithinBudget, true);
  });

  // ============================================================================
  // SUITE 3: Stateful Observation & Receipt Lifecycles in Disposable SQLite
  // ============================================================================
  console.log('\n--- SUITE 3: Stateful Tripwire & Decision Lifecycle (Disposable DB) ---');

  // Dynamic import of DB and Services with isolated DATABASE_PATH
  const { getDb } = await import('../src/server/db.js');
  const { config } = await import('../src/server/config.js');
  const { ObservationService } = await import('../src/server/domain/observationService.js');
  const { ReceiptService } = await import('../src/server/domain/receiptService.js');
  const { PactService } = await import('../src/server/domain/pactService.js');

  const db = getDb();

  runTest('3.1 Verify disposable database initialization and offline safety', () => {
    assert.strictEqual(config.databasePath, tempDbPath, 'DB path must be isolated temp file');
    assert.strictEqual(config.serpApi.isConfigured, false, 'SerpApi must NOT be configured');
    assert.strictEqual(config.mode, 'SIMULATION', 'Mode must be SIMULATION');
    const row = db.prepare('SELECT COUNT(*) as count FROM companies').get() as any;
    assert(row.count >= 2, 'Disposable database seeded companies successfully');
  });

  const testPactId = 'pact_bellandur_01';
  const routeWatchId = `watch_iso_route_${Date.now()}`;
  let generatedAlertId: string = '';

  runTest('3.2 ObservationService.processRouteObservation stateful 2-breach alert & recovery', () => {
    // 1. Arm a route watch in disposable DB
    db.prepare(`
      INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
      VALUES (?, ?, 'google_maps_directions', '{}', 'query_hash_valid', datetime('now'), 300, 1, 1)
    `).run(routeWatchId, testPactId);

    const now = Date.now();
    const source1 = new Date(now - 60000).toISOString();
    const deadlineUtc = new Date(now + 3600000).toISOString();

    // Observation 1: Breach 1 (Duration 4200 > Limit 3600)
    const payload1 = {
      search_metadata: { id: 'search_iso_1', status: 'Success', created_at: source1 },
      directions: [{ travel_mode: 'Driving', duration: 4200 }],
    };
    const res1 = ObservationService.processRouteObservation({
      watchId: routeWatchId,
      pactId: testPactId,
      participantId: 'part_maya',
      userId: 'user_maya',
      rawPayload: payload1,
      sourceTimestampUtc: source1,
      provenance: 'synthetic',
      limitSeconds: 3600,
      deadlineUtc,
      pactVersion: 1,
      queryParams: { q: 'test' },
    });
    assert.strictEqual(res1.outcome, 'confirming');
    assert.strictEqual(res1.alertCreated, false);
    assert.strictEqual(res1.ruleState.consecutive, 1);
    assert.strictEqual(res1.ruleState.active, false);

    // Verify DB rule_states row
    const stateRow1 = db.prepare('SELECT * FROM rule_states WHERE watch_id = ?').get(routeWatchId) as any;
    assert.strictEqual(stateRow1.consecutive_breaches, 1);
    assert.strictEqual(stateRow1.active, 0);

    // Observation 2: Breach 2 (Duration 4300, advancing timestamp) -> TRIPS ALERT!
    const source2 = new Date(now - 30000).toISOString();
    const payload2 = {
      search_metadata: { id: 'search_iso_2', status: 'Success', created_at: source2 },
      directions: [{ travel_mode: 'Driving', duration: 4300 }],
    };
    const res2 = ObservationService.processRouteObservation({
      watchId: routeWatchId,
      pactId: testPactId,
      participantId: 'part_maya',
      userId: 'user_maya',
      rawPayload: payload2,
      sourceTimestampUtc: source2,
      provenance: 'synthetic',
      limitSeconds: 3600,
      deadlineUtc,
      pactVersion: 1,
      queryParams: { q: 'test' },
    });
    assert.strictEqual(res2.outcome, 'alert');
    assert.strictEqual(res2.alertCreated, true);
    assert(Boolean(res2.alertId), 'Alert ID must be generated');
    assert.strictEqual(res2.ruleState.consecutive, 2);
    assert.strictEqual(res2.ruleState.active, true);
    generatedAlertId = res2.alertId!;

    // Verify DB alert and outbox entries
    const alertRow = db.prepare('SELECT * FROM alerts WHERE id = ?').get(generatedAlertId) as any;
    assert.strictEqual(alertRow.decision_status, 'pending');
    assert.strictEqual(alertRow.pact_id, testPactId);

    const outboxRow = db.prepare('SELECT * FROM outbox WHERE alert_id = ?').get(generatedAlertId) as any;
    assert.strictEqual(outboxRow.status, 'pending');

    // Observation 3: Duplicate observation rejected
    const resDup = ObservationService.processRouteObservation({
      watchId: routeWatchId,
      pactId: testPactId,
      participantId: 'part_maya',
      userId: 'user_maya',
      rawPayload: payload2,
      sourceTimestampUtc: source2,
      provenance: 'synthetic',
      limitSeconds: 3600,
      deadlineUtc,
      pactVersion: 1,
      queryParams: { q: 'test' },
    });
    assert.strictEqual(resDup.outcome, 'duplicate_or_old');

    // Observation 4: Non-advancing timestamp rejected
    const payloadNonAdv = {
      search_metadata: { id: 'search_iso_diff_id', status: 'Success', created_at: source2 },
      directions: [{ travel_mode: 'Driving', duration: 4400 }],
    };
    const resNonAdv = ObservationService.processRouteObservation({
      watchId: routeWatchId,
      pactId: testPactId,
      participantId: 'part_maya',
      userId: 'user_maya',
      rawPayload: payloadNonAdv,
      sourceTimestampUtc: source2,
      provenance: 'synthetic',
      limitSeconds: 3600,
      deadlineUtc,
      pactVersion: 1,
      queryParams: { q: 'test' },
    });
    assert.strictEqual(resNonAdv.outcome, 'duplicate_or_old');

    // Observation 5: Recovery observation (Duration 3200 <= 3600 - 300)
    const sourceRec = new Date(now - 10000).toISOString();
    const payloadRec = {
      search_metadata: { id: 'search_iso_rec', status: 'Success', created_at: sourceRec },
      directions: [{ travel_mode: 'Driving', duration: 3200 }],
    };
    const resRec = ObservationService.processRouteObservation({
      watchId: routeWatchId,
      pactId: testPactId,
      participantId: 'part_maya',
      userId: 'user_maya',
      rawPayload: payloadRec,
      sourceTimestampUtc: sourceRec,
      provenance: 'synthetic',
      limitSeconds: 3600,
      deadlineUtc,
      pactVersion: 1,
      queryParams: { q: 'test' },
    });
    assert.strictEqual(resRec.outcome, 'recovered');
    assert.strictEqual(resRec.ruleState.active, false);

    const stateRowRec = db.prepare('SELECT * FROM rule_states WHERE watch_id = ?').get(routeWatchId) as any;
    assert.strictEqual(stateRowRec.active, 0);
  });

  runTest('3.3 ObservationService.processTrafficObservation incident discovery', () => {
    const trafficWatchId = `watch_iso_traffic_${Date.now()}`;
    db.prepare(`
      INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
      VALUES (?, ?, 'google_maps_traffic', '{}', 'query_hash_traffic', datetime('now'), 900, 1, 1)
    `).run(trafficWatchId, testPactId);

    // Initial snapshot: 1 incident
    const payload1 = {
      search_metadata: { id: 'trf_1', status: 'Success', created_at: new Date().toISOString() },
      traffic_incidents: [{ incident_id: 'inc_iso_01', type: 'road_closed' }],
    };
    const trf1 = ObservationService.processTrafficObservation({
      watchId: trafficWatchId,
      pactId: testPactId,
      rawPayload: payload1,
      sourceTimestampUtc: payload1.search_metadata.created_at,
      provenance: 'synthetic',
      bboxParams: { bbox: '12.97,77.64,12.90,77.71' },
    });
    assert.strictEqual(trf1.validity, 'valid');
    assert.strictEqual(trf1.totalIncidents, 1);
    assert.deepStrictEqual(trf1.newIncidentIds, ['inc_iso_01']);
    assert.strictEqual(trf1.requestsRouteRecheck, true);

    // Same snapshot again: 0 new incidents
    const trf2 = ObservationService.processTrafficObservation({
      watchId: trafficWatchId,
      pactId: testPactId,
      rawPayload: payload1,
      sourceTimestampUtc: payload1.search_metadata.created_at,
      provenance: 'synthetic',
      bboxParams: { bbox: '12.97,77.64,12.90,77.71' },
    });
    assert.strictEqual(trf2.totalIncidents, 1);
    assert.deepStrictEqual(trf2.newIncidentIds, []);
    assert.strictEqual(trf2.requestsRouteRecheck, false);

    // New incident discovered
    const payload3 = {
      search_metadata: { id: 'trf_3', status: 'Success', created_at: new Date().toISOString() },
      traffic_incidents: [
        { incident_id: 'inc_iso_01', type: 'road_closed' },
        { incident_id: 'inc_iso_02', type: 'accident' },
      ],
    };
    const trf3 = ObservationService.processTrafficObservation({
      watchId: trafficWatchId,
      pactId: testPactId,
      rawPayload: payload3,
      sourceTimestampUtc: payload3.search_metadata.created_at,
      provenance: 'synthetic',
      bboxParams: { bbox: '12.97,77.64,12.90,77.71' },
    });
    assert.strictEqual(trf3.totalIncidents, 2);
    assert.deepStrictEqual(trf3.newIncidentIds, ['inc_iso_02']);
    assert.strictEqual(trf3.requestsRouteRecheck, true);
  });

  await runTest('3.4 ReceiptService Bilateral Voting & Consensus State Machine', async () => {
    assert(Boolean(generatedAlertId), 'Alert ID must be present from 3.2');

    // 1. Initial receipt check: Pending status
    const initReceipt = await ReceiptService.getReceipt(generatedAlertId);
    assert.strictEqual(initReceipt.currentDecisionStatus, 'pending');
    assert.strictEqual(initReceipt.consensus.status, 'pending');
    assert.strictEqual(initReceipt.consensus.isResolved, false);

    // 2. User 1 (user_maya) selects 'remote'
    const receiptAfterMaya = await ReceiptService.recordDecision(generatedAlertId, 'user_maya', 'remote');
    assert.strictEqual(receiptAfterMaya.currentDecisionStatus, 'remote_chosen');
    assert.strictEqual(receiptAfterMaya.consensus.status, 'pending', 'Quorum 2 not reached yet');
    assert(receiptAfterMaya.consensus.warningBanner?.includes('Awaiting counterpart'));

    // 3. User 2 (user_arjun) selects 'keep' -> SPLIT / CONFLICT!
    const receiptAfterConflict = await ReceiptService.recordDecision(generatedAlertId, 'user_arjun', 'keep');
    assert.strictEqual(receiptAfterConflict.currentDecisionStatus, 'needs_discussion');
    assert.strictEqual(receiptAfterConflict.consensus.status, 'needs_discussion');
    assert.strictEqual(receiptAfterConflict.consensus.needsDiscussion, true);
    assert(receiptAfterConflict.consensus.warningBanner?.includes('Needs discussion'));
    assert(Boolean(receiptAfterConflict.consensus.prefilledChat));

    // Verify system discussion message was logged in team_messages table
    const discussionMsg = db.prepare(`
      SELECT * FROM team_messages WHERE channel_id = 'group_office_pact' AND text LIKE '%Decision mismatch%'
    `).get() as any;
    assert(Boolean(discussionMsg), 'Mismatch discussion message must be written to team chat');

    // 4. User 2 (user_arjun) changes vote to 'remote' -> UNANIMOUS CONSENSUS!
    const receiptResolved = await ReceiptService.recordDecision(generatedAlertId, 'user_arjun', 'remote');
    assert.strictEqual(receiptResolved.currentDecisionStatus, 'remote_chosen');
    assert.strictEqual(receiptResolved.consensus.status, 'resolved');
    assert.strictEqual(receiptResolved.consensus.isResolved, true);
    assert.strictEqual(receiptResolved.consensus.resolvedAction, 'remote');

    // Verify consensus resolution message was logged in team_messages table
    const resolvedMsg = db.prepare(`
      SELECT * FROM team_messages WHERE channel_id = 'group_office_pact' AND text LIKE '%Team consensus reached%'
    `).get() as any;
    assert(Boolean(resolvedMsg), 'Consensus resolution message must be written to team chat');
  });

  // ============================================================================
  // SUITE 4: Multi-Tenant Filtering, Admin Telemetry & Security Gates
  // ============================================================================
  console.log('\n--- SUITE 4: Multi-Tenant Filtering & Security Gates (Isolated DB) ---');

  runTest('4.1 Multi-tenant pact segregation in PactService.listPacts', () => {
    // Paytm listing: returns only comp_paytm pacts
    const paytmPacts = PactService.listPacts('team_office_pact', 'user_ananya', 'comp_paytm');
    assert(paytmPacts.length > 0);
    for (const p of paytmPacts) {
      const dbRow = db.prepare('SELECT company_id FROM pacts WHERE id = ?').get(p.id) as any;
      assert.strictEqual(dbRow.company_id, 'comp_paytm', 'Paytm listing must only include Paytm pacts');
    }

    // Acme listing: returns only comp_acme pacts
    const acmePacts = PactService.listPacts('team_office_pact', 'user_maya', 'comp_acme');
    assert(acmePacts.length > 0);
    for (const p of acmePacts) {
      const dbRow = db.prepare('SELECT company_id FROM pacts WHERE id = ?').get(p.id) as any;
      assert.strictEqual(dbRow.company_id, 'comp_acme', 'Acme listing must only include Acme pacts');
    }
  });

  runTest('4.2 Team membership authorization gate in PactService.getPactDetails', () => {
    // Valid member
    const validDetails = PactService.getPactDetails('pact_bellandur_01', 'user_maya');
    assert.strictEqual(validDetails.id, 'pact_bellandur_01');

    // Unauthorized outsider (not in team_members)
    assert.throws(
      () => {
        PactService.getPactDetails('pact_bellandur_01', 'user_unauthorized_attacker');
      },
      /Forbidden: User user_unauthorized_attacker is not a member of team/,
      'Must reject unauthorized user'
    );
  });

  runTest('4.3 Admin Overview Telemetry verification in isolated DB', () => {
    const compCount = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as any)?.count || 0;
    const empCount = (db.prepare('SELECT COUNT(*) as count FROM team_members').get() as any)?.count || 0;
    const pactCount = (db.prepare('SELECT COUNT(*) as count FROM pacts').get() as any)?.count || 0;
    const watchCount = (db.prepare('SELECT COUNT(*) as count FROM watches WHERE enabled = 1').get() as any)?.count || 0;

    assert(compCount >= 2, 'Companies count must be >= 2');
    assert(empCount >= 4, 'Team members count must be >= 4');
    assert(pactCount >= 2, 'Pacts count must be >= 2');
    assert(watchCount >= 1, 'Active watches count must be >= 1');
  });

  runTest('4.4 Corporate Entity lookup resolution by code and corporate_id', () => {
    const compByCode = db.prepare('SELECT * FROM companies WHERE UPPER(code) = ?').get('PAYTM') as any;
    assert(Boolean(compByCode), 'Lookup by code PAYTM');
    assert.strictEqual(compByCode.id, 'comp_paytm');

    const compByCorpId = db.prepare('SELECT * FROM companies WHERE UPPER(corporate_id) = ?').get('PAYTM-CORP-01') as any;
    assert(Boolean(compByCorpId), 'Lookup by corporate_id PAYTM-CORP-01');
    assert.strictEqual(compByCorpId.id, 'comp_paytm');
  });

  // ============================================================================
  // SUITE 5: Isolation & Teardown Verification
  // ============================================================================
  console.log('\n--- SUITE 5: Isolation & Teardown Verification ---');

  runTest('5.1 Verify repo workspace database was NEVER written to or touched', () => {
    if (initialRepoDbStat) {
      assert(fs.existsSync(repoDbPath), 'Workspace officepact.sqlite3 must still exist');
      const currentStat = fs.statSync(repoDbPath);
      assert.strictEqual(
        currentStat.mtimeMs,
        initialRepoDbStat.mtimeMs,
        'Workspace officepact.sqlite3 mtimeMs must remain identical'
      );
      assert.strictEqual(
        currentStat.size,
        initialRepoDbStat.size,
        'Workspace officepact.sqlite3 size must remain identical'
      );
    }
  });

  // Teardown disposable DB
  try {
    db.close();
  } catch (err) {
    console.warn('Note: DB close warning:', err);
  }

  runTest('5.2 Disposable SQLite cleanup: removing temp files', () => {
    for (const ext of ['', '-wal', '-shm']) {
      const p = tempDbPath + ext;
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    }
    assert(!fs.existsSync(tempDbPath), 'Disposable DB file must be deleted');
    assert(!fs.existsSync(tempDbPath + '-wal'), 'Disposable DB wal file must be deleted');
    assert(!fs.existsSync(tempDbPath + '-shm'), 'Disposable DB shm file must be deleted');
  });

  // Summary and Exit reporting
  const durationMs = Date.now() - startTime;
  console.log('\n================================================================');
  console.log('  Isolated Verification Summary');
  console.log('================================================================');
  console.log(`Total Invariant Checks : ${totalTests}`);
  console.log(`Passed Checks          : ${passedTests}`);
  console.log(`Failed Checks          : ${failedTests}`);
  console.log(`Execution Time         : ${(durationMs / 1000).toFixed(2)}s`);

  if (docMismatches.length > 0) {
    console.log('\n----------------------------------------------------------------');
    console.log('  Honest Implementation vs Documentation Findings:');
    console.log('----------------------------------------------------------------');
    docMismatches.forEach((m, idx) => {
      console.log(`[Mismatch ${idx + 1}] ${m.topic}`);
      console.log(`  Documented : ${m.documented}`);
      console.log(`  Actual     : ${m.actual}`);
      console.log(`  Detail     : ${m.implication}\n`);
    });
  }

  console.log('----------------------------------------------------------------');
  console.log('Regression Risk Statement:');
  console.log('  Regression risk is MINIMIZED across all tested TS tripwire invariants,');
  console.log('  decision resolution paths, and tenant boundaries, but regression risk');
  console.log('  is NEVER zero in complex distributed multi-tenant systems.');
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error(`Verification FAILED with ${failedTests} failure(s).`);
    process.exit(1);
  } else {
    console.log('Verification PASSED completely in isolated clean sandbox.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal unhandled error during verification:', err);
  // Guarantee cleanup even on fatal error
  for (const ext of ['', '-wal', '-shm']) {
    try {
      if (fs.existsSync(tempDbPath + ext)) {
        fs.unlinkSync(tempDbPath + ext);
      }
    } catch {}
  }
  process.exit(1);
});
