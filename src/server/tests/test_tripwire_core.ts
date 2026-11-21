import assert from 'assert';
import {
  evaluateRule,
  fastestDriving,
  incidentSnapshot,
  fingerprint,
  canonicalQueryHash,
  createInitialRuleState,
  type RuleState,
} from '../domain/tripwireCore.js';
import { ObservationService } from '../domain/observationService.js';
import { getDb } from '../db.js';

console.log('--- Running Phase 4 Deterministic Rule & Invariant Tests ---');

// Helper to evaluate with defaults
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

// 1. Two fresh breaches test
let s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s), 'confirming', 'First breach is confirming');
assert.strictEqual(
  evalObs(s, { observationId: 'obs_b', sourceAt: 120, now: 130 }),
  'alert',
  'Second fresh breach triggers alert'
);
assert.strictEqual(s.active, true, 'Rule state is active');
assert(s.episodeId !== null, 'Episode ID generated');
console.log('✓ test_two_fresh_breaches passed.');

// 2. Replay cannot confirm
s = createInitialRuleState('w1', 1, 'query_hash_valid');
evalObs(s);
assert.strictEqual(evalObs(s), 'duplicate_or_old', 'Exact same observation rejected as duplicate');
assert.strictEqual(s.active, false, 'Replay did not confirm alert');
console.log('✓ test_replay_cannot_confirm passed.');

// 3. Same cached timestamp cannot confirm
s = createInitialRuleState('w1', 1, 'query_hash_valid');
evalObs(s);
assert.strictEqual(
  evalObs(s, { observationId: 'obs_diff_id', sourceAt: 100 }),
  'duplicate_or_old',
  'Same source timestamp cannot confirm'
);
console.log('✓ test_same_cached_timestamp_cannot_confirm passed.');

// 4. Stale cannot alert
s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { now: 900 }), 'stale', 'Observation older than 300s is stale');
assert.strictEqual(s.consecutive, 0, 'Stale resets consecutive streak');
console.log('✓ test_stale_cannot_alert passed.');

// 5. Future timestamp rejected
s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { sourceAt: 200, now: 100 }), 'stale', 'Future source timestamp rejected');
console.log('✓ test_future_timestamp_rejected passed.');

// 6. Missing cannot be zero (unknown)
s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { duration: null }), 'unknown', 'Missing duration is unknown');
assert.strictEqual(evalObs(s, { duration: undefined }), 'unknown', 'Undefined duration is unknown');
console.log('✓ test_missing_cannot_be_zero passed.');

// 7. Invalid numerics
s = createInitialRuleState('w1', 1, 'query_hash_valid');
for (const val of [true, false, NaN, -1, 0, Infinity]) {
  assert.strictEqual(evalObs(s, { duration: val }), 'unknown', `Invalid value ${val} evaluates to unknown`);
}
console.log('✓ test_invalid_numeric passed.');

// 8. Unknown does not clear an active alert
s = createInitialRuleState('w1', 1, 'query_hash_valid');
evalObs(s);
evalObs(s, { observationId: 'obs_b', sourceAt: 120, now: 130 });
assert.strictEqual(s.active, true, 'Active alert established');
// Unknown observation arrives:
assert.strictEqual(
  evalObs(s, { observationId: 'obs_c', sourceAt: 140, now: 150, duration: null }),
  'unknown',
  'Malformed check is unknown'
);
assert.strictEqual(s.active, true, 'Unknown observation MUST NOT clear an active alert');
console.log('✓ test_unknown_does_not_clear_active_alert passed.');

// 9. Deadline expiration
s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { now: 1000, deadline: 1000 }), 'expired', 'Expired at exact deadline');
assert.strictEqual(evalObs(s, { now: 1001, deadline: 1000 }), 'expired', 'Expired past deadline');
console.log('✓ test_deadline passed.');

// 10. Query change
s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { queryHash: 'query_hash_different' }), 'incomparable', 'Query change is incomparable');
console.log('✓ test_query_change passed.');

// 11. Rule version change
s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { ruleVersion: 2 }), 'incomparable', 'Version change is incomparable');
console.log('✓ test_rule_change passed.');

// 12. Recovery hysteresis (5 minute margin)
s = createInitialRuleState('w1', 1, 'query_hash_valid');
evalObs(s);
evalObs(s, { observationId: 'obs_b', sourceAt: 120, now: 130 }); // triggers alert
assert.strictEqual(s.active, true);

// Duration drops to 3500s (below limit 3600, but NOT below 3600 - 300 = 3300)
assert.strictEqual(
  evalObs(s, { observationId: 'obs_c', sourceAt: 140, now: 150, duration: 3500 }),
  'active',
  'Within 300s hysteresis margin stays active'
);
assert.strictEqual(s.active, true);

// Duration drops to 3300s (<= limit - 300s) -> recovers!
assert.strictEqual(
  evalObs(s, { observationId: 'obs_d', sourceAt: 160, now: 170, duration: 3300 }),
  'recovered',
  'At or below limit - 300s recovers'
);
assert.strictEqual(s.active, false);
console.log('✓ test_recovery_hysteresis passed.');

// 13. Route reorder does not change result
const row1 = { travel_mode: 'Driving', duration: 4200 };
const row2 = { travel_mode: 'Driving', duration: 3500 };
const payloadA = { search_metadata: { status: 'Success' }, directions: [row1, row2] };
const payloadB = { search_metadata: { status: 'Success' }, directions: [row2, row1] };
assert.strictEqual(fastestDriving(payloadA), 3500);
assert.strictEqual(fastestDriving(payloadB), 3500);
assert.strictEqual(fastestDriving(payloadA), fastestDriving(payloadB));
console.log('✓ test_route_reorder_not_change passed.');

// 14. Empty route returns null
assert.strictEqual(fastestDriving({ search_metadata: { status: 'Success' }, directions: [] }), null);
console.log('✓ test_empty_route_unknown passed.');

// 15. Incident reordering produces exact same fingerprint
const inc1 = { incident_id: 'inc_b', type: 'construction' };
const inc2 = { incident_id: 'inc_a', type: 'road_closed' };
const trfA = { search_metadata: { status: 'Success' }, traffic_incidents: [inc1, inc2] };
const trfB = { search_metadata: { status: 'Success' }, traffic_incidents: [inc2, inc1] };
assert.strictEqual(fingerprint(incidentSnapshot(trfA)), fingerprint(incidentSnapshot(trfB)));
console.log('✓ test_incident_reordering passed.');

// 16. Threshold equality: exact limit is not a breach; limit + 1 is
s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { duration: 3600, limit: 3600 }), 'within_limit', 'Exact limit is within limit');
s = createInitialRuleState('w1', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { duration: 3601, limit: 3600 }), 'confirming', 'Limit + 1 is a breach');
console.log('✓ test_threshold_equality passed.');

// 17. Different participant limits
s = createInitialRuleState('w1', 1, 'query_hash_valid');
// Maya limit = 3600s (60 min); Arjun limit = 4500s (75 min)
const durationObs = 4000; // ~66.6 min
assert.strictEqual(evalObs(s, { duration: durationObs, limit: 3600 }), 'confirming', 'Breaches Maya limit');
s = createInitialRuleState('w2', 1, 'query_hash_valid');
assert.strictEqual(evalObs(s, { duration: durationObs, limit: 4500 }), 'within_limit', 'Within Arjun limit');
console.log('✓ test_different_participant_limits passed.');

// 18. Missing nested fields & error responses
assert.strictEqual(fastestDriving(null), null);
assert.strictEqual(fastestDriving({ error: 'Over query limit' }), null);
assert.strictEqual(fastestDriving({ search_metadata: { status: 'Error' } }), null);
assert.strictEqual(incidentSnapshot(null), null);
assert.strictEqual(incidentSnapshot({ error: 'Over query limit' }), null);
console.log('✓ test_missing_nested_fields and test_error_responses passed.');

// 19. Canonical query hash excludes secrets and fetch control flags
const hashA = canonicalQueryHash('google_maps_directions', {
  start_coords: '12.9784,77.6408',
  end_coords: '12.9290,77.6760',
  travel_mode: 0,
  no_cache: 'true',
  api_key: 'secret_1',
});
const hashB = canonicalQueryHash('google_maps_directions', {
  start_coords: '12.9784,77.6408',
  end_coords: '12.9290,77.6760',
  travel_mode: 0,
  no_cache: 'false',
  api_key: 'secret_2',
});
assert.strictEqual(hashA, hashB, 'Hashes match regardless of api_key or no_cache flag');
console.log('✓ canonicalQueryHash invariants passed.');

// 20. Restart persistence in SQLite via ObservationService
const db = getDb();
const testWatchId = `watch_persist_test_${Date.now()}`;
const testPactId = 'pact_bellandur_01'; // exists in seeded pacts

db.prepare(`
  INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
  VALUES (?, ?, 'google_maps_directions', '{}', 'query_hash_valid', datetime('now'), 300, 1, 1)
`).run(testWatchId, testPactId);

const payload1 = {
  search_metadata: { id: 'search_1', status: 'Success', created_at: new Date(Date.now() - 60000).toISOString() },
  directions: [{ travel_mode: 'Driving', duration: 4200 }],
};
const res1 = ObservationService.processRouteObservation({
  watchId: testWatchId,
  pactId: testPactId,
  participantId: 'p1',
  userId: 'user_maya',
  rawPayload: payload1,
  sourceTimestampUtc: payload1.search_metadata.created_at,
  provenance: 'synthetic',
  limitSeconds: 3600,
  deadlineUtc: new Date(Date.now() + 3600000).toISOString(),
  pactVersion: 1,
  queryParams: { q: 'test' },
});
assert.strictEqual(res1.outcome, 'confirming');

// Check that SQLite persisted rule_states table record
const stateRow = db.prepare('SELECT * FROM rule_states WHERE watch_id = ?').get(testWatchId) as any;
assert.strictEqual(stateRow.consecutive_breaches, 1);
assert.strictEqual(stateRow.active, 0);

// Clean up test watch
db.prepare('DELETE FROM observations WHERE watch_id = ?').run(testWatchId);
db.prepare('DELETE FROM rule_states WHERE watch_id = ?').run(testWatchId);
db.prepare('DELETE FROM watches WHERE id = ?').run(testWatchId);
console.log('✓ test_restart_persistence passed.');

// 21. Traffic incident recheck flag
const trafficWatchId = `watch_traffic_test_${Date.now()}`;
db.prepare(`
  INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
  VALUES (?, ?, 'google_maps_traffic', '{}', 'query_hash_traffic', datetime('now'), 900, 1, 1)
`).run(trafficWatchId, testPactId);

const trafficPayload = {
  search_metadata: { id: 'search_trf_1', status: 'Success', created_at: new Date().toISOString() },
  traffic_incidents: [{ incident_id: 'inc_new_01', type: 'road_closed' }],
};
const trfRes = ObservationService.processTrafficObservation({
  watchId: trafficWatchId,
  pactId: testPactId,
  rawPayload: trafficPayload,
  sourceTimestampUtc: trafficPayload.search_metadata.created_at,
  provenance: 'synthetic',
  bboxParams: { bbox: '12.97,77.64,12.90,77.71' },
});
assert.strictEqual(trfRes.requestsRouteRecheck, true, 'New incident requests route recheck');
assert.strictEqual(trfRes.newIncidentIds.length, 1);

db.prepare('DELETE FROM observations WHERE watch_id = ?').run(trafficWatchId);
db.prepare('DELETE FROM watches WHERE id = ?').run(trafficWatchId);
console.log('✓ test_traffic_incident_recheck_flag passed.');

console.log('--- ALL PHASE 4 DETERMINISTIC TESTS PASSED ---');
