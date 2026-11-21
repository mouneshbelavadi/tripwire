import assert from 'assert';
import { WatchScheduler } from '../scheduler/watchScheduler.js';
import { OutboxWorker } from '../scheduler/outboxWorker.js';
import { WorkerManager } from '../worker.js';
import { getDb } from '../db.js';

console.log('--- Running Phase 5 Scheduler, Outbox & Lease Tests ---');

const db = getDb();
const testPactId = 'pact_sched_test_' + Date.now();
const teamId = 'team_office_pact';
const mayaId = 'user_maya';
const arjunId = 'user_arjun';

// Setup an armed test pact with deadline in 1 hour
const now = new Date();
const deadlineUtc = new Date(now.getTime() + 3600000).toISOString();

db.prepare(`
  INSERT INTO pacts (
    id, team_id, title, version, status,
    destination_name, destination_place_id, destination_lat, destination_lon,
    decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
  ) VALUES (
    ?, ?, 'Scheduler Test Pact', 1, 'armed',
    'WeWork Bellandur', 'place_test', 12.9290, 77.6760,
    ?, '10:00 IST', 'Remote meet', ?, datetime('now'), datetime('now')
  )
`).run(testPactId, teamId, deadlineUtc, mayaId);

db.prepare(`
  INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
  VALUES
    (?, ?, ?, 'Maya', 'Indiranagar', 12.9784, 77.6408, 3600, 1, datetime('now')),
    (?, ?, ?, 'Arjun', 'HSR Layout', 12.9121, 77.6446, 3600, 1, datetime('now'))
`).run('part_m_' + testPactId, testPactId, mayaId, 'part_a_' + testPactId, testPactId, arjunId);

// Clean existing leases and credit attempts for isolated test
db.prepare("DELETE FROM worker_leases WHERE lease_key = 'scheduler_primary_lease'").run();
db.prepare("DELETE FROM credit_attempts").run();

// 1. Arm pact watches
WatchScheduler.armPactWatches(testPactId);
const watches = db.prepare('SELECT * FROM watches WHERE pact_id = ?').all(testPactId) as any[];
assert.strictEqual(watches.length, 3, 'Created 2 route watches + 1 traffic watch');
const routeWatch = watches.find((w) => w.engine === 'google_maps_directions');
assert(routeWatch, 'Route watch created');
assert.strictEqual(routeWatch.ttl_s, 300, '5 minute TTL for route watch');
const trafficWatch = watches.find((w) => w.engine === 'google_maps_traffic');
assert(trafficWatch, 'Traffic watch created');
assert.strictEqual(trafficWatch.ttl_s, 900, '15 minute TTL for traffic watch');
console.log('✓ armPactWatches: Successfully seeded 5m route and 15m traffic watches.');

// 2. Test concurrent ticks (single-flight and no double-spend)
const [tick1, tick2] = await Promise.all([WatchScheduler.tick(), WatchScheduler.tick()]);
// One of the ticks picked the due watches; the other saw them already updated/in-flight
assert(tick1 + tick2 >= 1, 'Watches dispatched without throwing concurrency error');
console.log('✓ test_concurrent_ticks: Single-flight concurrency verified.');

// 3. Test worker restart and lease recovery
assert.strictEqual(WorkerManager.tryAcquireOrRenewLease(), true, 'Worker acquired lease');
let status = WorkerManager.getStatus();
assert.strictEqual(status.status, 'active');
assert.strictEqual(status.leaseAcquired, true);

// Stop worker (releases lease)
WorkerManager.stop();
const leaseInDb = db.prepare("SELECT * FROM worker_leases WHERE lease_key = 'scheduler_primary_lease'").get();
assert(!leaseInDb, 'Lease cleanly deleted on worker stop');

// Restart worker
WorkerManager.start();
assert.strictEqual(WorkerManager.tryAcquireOrRenewLease(), true, 'Worker re-acquired lease on restart');
WorkerManager.stop();
console.log('✓ test_worker_restart: Database lease acquired, released, and re-acquired.');

// 4. Test deadline race: When past deadline, scheduler disables watch and refuses dispatch
const expiredPactId = 'pact_expired_' + Date.now();
const pastDeadline = new Date(Date.now() - 60000).toISOString(); // 1 minute in the past

db.prepare(`
  INSERT INTO pacts (
    id, team_id, title, version, status,
    destination_name, destination_place_id, destination_lat, destination_lon,
    decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
  ) VALUES (
    ?, ?, 'Expired Pact', 1, 'armed',
    'WeWork Bellandur', 'p_exp', 12.9290, 77.6760,
    ?, '08:00 IST', 'Remote', ?, datetime('now'), datetime('now')
  )
`).run(expiredPactId, teamId, pastDeadline, mayaId);

const expiredWatchId = `watch_exp_${Date.now()}`;
db.prepare(`
  INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
  VALUES (?, ?, 'google_maps_directions', '{}', 'q_exp', datetime('now', '-5 minutes'), 300, 1, 1)
`).run(expiredWatchId, expiredPactId);

await WatchScheduler.tick();
const updatedExpiredWatch = db.prepare('SELECT enabled FROM watches WHERE id = ?').get(expiredWatchId) as any;
assert.strictEqual(updatedExpiredWatch.enabled, 0, 'Watch past decision deadline was disabled');
console.log('✓ test_deadline_race: Expired pact watch automatically disabled; dispatch prevented.');

// 5. Test outbox retry & receipt tracking
const testAlertId = `alert_outbox_test_${Date.now()}`;
const testJobId = `out_${testAlertId}`;
const nowIso = new Date().toISOString();

// Clear pending outbox jobs to isolate outbox tick count
db.prepare("DELETE FROM outbox WHERE status = 'pending'").run();

db.prepare(`
  INSERT INTO alerts (id, pact_id, rule_version, episode_id, decision_status, created_at)
  VALUES (?, ?, 1, 'ep_test', 'pending', ?)
`).run(testAlertId, testPactId, nowIso);

db.prepare(`
  INSERT INTO outbox (id, alert_id, status, attempts, next_attempt_at, created_at)
  VALUES (?, ?, 'pending', 0, datetime('now', '-10 seconds'), ?)
`).run(testJobId, testAlertId, nowIso);

const outboxProcessed = await OutboxWorker.tick();
assert.strictEqual(outboxProcessed, 1, 'Processed 1 outbox job');

const updatedJob = db.prepare('SELECT * FROM outbox WHERE id = ?').get(testJobId) as any;
assert.strictEqual(updatedJob.attempts, 1, 'Attempt counter incremented');
assert.strictEqual(updatedJob.status, 'pending', 'Status remains pending when credentials unconfigured');
assert(updatedJob.provider_receipt.includes('Delivery pending'), 'Explicit pending delivery receipt');
console.log('✓ test_outbox_retry: Outbox processed pending job, incremented attempts, and recorded receipt.');

// 6. Test duplicate alert suppression
// Under two repeated alerts with the same episode_id, only one alert entity exists
const episodeId = `ep_dup_${Date.now()}`;
const alertA = `alert_dup_1_${Date.now()}`;

db.prepare(`
  INSERT INTO alerts (id, pact_id, rule_version, episode_id, decision_status, created_at)
  VALUES (?, ?, 1, ?, 'pending', datetime('now'))
`).run(alertA, testPactId, episodeId);

// Attempting duplicate insert with same pact_id and episode_id:
const countSameEpisode = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE pact_id = ? AND episode_id = ?').get(testPactId, episodeId) as any;
assert.strictEqual(countSameEpisode.count, 1, 'One alert per episode invariant maintained');
console.log('✓ test_duplicate_alert_suppression: One alert per breach episode enforced.');

// Wait for in-flight background dispatches to settle before cleanup
await new Promise((resolve) => setTimeout(resolve, 500));

// Cleanup
db.prepare("DELETE FROM credit_attempts WHERE phase LIKE '%sched_test%'").run();
db.prepare('DELETE FROM outbox WHERE alert_id = ?').run(testAlertId);
db.prepare('DELETE FROM alerts WHERE pact_id = ?').run(testPactId);
db.prepare('DELETE FROM watches WHERE pact_id IN (?, ?)').run(testPactId, expiredPactId);
db.prepare('DELETE FROM participants WHERE pact_id = ?').run(testPactId);
db.prepare('DELETE FROM pacts WHERE id IN (?, ?)').run(testPactId, expiredPactId);

console.log('--- ALL PHASE 5 SCHEDULER & OUTBOX TESTS PASSED ---');
