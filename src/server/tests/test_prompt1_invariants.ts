import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db.js';
import { humanizeIncidentType, INCIDENT_TYPE_MAP } from '../../common/incidentTypes.js';
import { getDeadlineStatus } from '../../client/lib/time.js';
import { ContextService } from '../domain/contextService.js';
import { ReceiptService } from '../domain/receiptService.js';
import { WatchScheduler } from '../scheduler/watchScheduler.js';

console.log('--- Running Prompt 1 Data Consistency & Integrity Tests ---');

const db = getDb();

// =========================================================================
// Requirement 1: Zero occurrences of 'nexconn' in src/
// =========================================================================
function scanForForbiddenWord(dir: string, forbidden: string): string[] {
  const matches: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...scanForForbiddenWord(fullPath, forbidden));
    } else if (entry.isFile()) {
      if (entry.name === 'test_prompt1_invariants.ts') continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(forbidden.toLowerCase())) {
        matches.push(fullPath);
      }
    }
  }
  return matches;
}

const nexconnMatches = scanForForbiddenWord(path.resolve(process.cwd(), 'src'), 'nexconn');
assert.strictEqual(
  nexconnMatches.length,
  0,
  `Expected 0 occurrences of 'nexconn' in src/, found: ${nexconnMatches.join(', ')}`
);
console.log("✓ Requirement 1: Confirmed 0 occurrences of 'nexconn' across src/.");

// =========================================================================
// Requirement 7: Humanize raw incident enums
// =========================================================================
assert.strictEqual(humanizeIncidentType('road_closed'), 'Road closed');
assert.strictEqual(humanizeIncidentType('crash'), 'Crash');
assert.strictEqual(humanizeIncidentType('congestion'), 'Congestion');
assert.strictEqual(humanizeIncidentType('construction'), 'Construction');
assert.strictEqual(humanizeIncidentType('waterlogging'), 'Waterlogging');
assert.strictEqual(humanizeIncidentType('lane_closed'), 'Lane closed');
assert.strictEqual(humanizeIncidentType('custom_incident_type'), 'Custom Incident Type');
console.log('✓ Requirement 7: Incident enums humanized correctly according to INCIDENT_TYPE_MAP.');

// =========================================================================
// Requirement 3 & 4: Deadline-aware status helper & IST formatting
// =========================================================================
const now = new Date('2026-11-21T07:00:00.000Z');

// 1. Expired (past deadline)
const pastDeadline = new Date(now.getTime() - 1000 * 60).toISOString();
assert.strictEqual(getDeadlineStatus(pastDeadline, now), 'expired');

// 2. Closing soon (< 30 min remaining)
const closingSoonDeadline = new Date(now.getTime() + 1000 * 60 * 15).toISOString();
assert.strictEqual(getDeadlineStatus(closingSoonDeadline, now), 'closing_soon');

// 3. Upcoming (>= 30 min remaining)
const upcomingDeadline = new Date(now.getTime() + 1000 * 60 * 60).toISOString();
assert.strictEqual(getDeadlineStatus(upcomingDeadline, now), 'upcoming');

console.log("✓ Requirement 4: Deadline status helper accurately returns 'upcoming', 'closing_soon', and 'expired'.");

// Test that scheduler disables watches for expired pacts
const expPactId = 'pact_test_exp_' + Date.now();
db.prepare(`
  INSERT INTO pacts (
    id, team_id, title, version, status,
    destination_name, destination_place_id, destination_lat, destination_lon,
    decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
  ) VALUES (
    ?, 'team_office_pact', 'Expired Test Pact', 1, 'armed',
    'Bellandur Office', 'place_test', 12.929, 77.676,
    ?, '08:00 IST', 'Remote', 'user_maya', datetime('now'), datetime('now')
  )
`).run(expPactId, new Date(Date.now() - 60000).toISOString());

const expWatchId = `watch_exp_p1_${Date.now()}`;
db.prepare(`
  INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
  VALUES (?, ?, 'google_maps_directions', '{}', 'hash_exp_p1', datetime('now', '-5 minutes'), 300, 1, 1)
`).run(expWatchId, expPactId);

await WatchScheduler.tick();
const watchAfterTick = db.prepare('SELECT enabled FROM watches WHERE id = ?').get(expWatchId) as any;
assert.strictEqual(watchAfterTick.enabled, 0, 'Scheduler disabled watch for expired pact');
console.log('✓ Requirement 4: Expired pact watches stop evaluating in scheduler.');

// =========================================================================
// Requirement 6: Verified advisory without hardcoded fake quotes
// =========================================================================
assert.ok(INCIDENT_TYPE_MAP, 'INCIDENT_TYPE_MAP is defined');
const testAdvPactId = 'pact_adv_' + Date.now();
const testAlertId = 'alert_advisory_test_' + Date.now();

db.prepare(`
  INSERT INTO pacts (
    id, team_id, title, version, status,
    destination_name, destination_place_id, destination_lat, destination_lon,
    decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
  ) VALUES (
    ?, 'team_office_pact', 'Adv Test Pact', 1, 'armed',
    'Bellandur Office', 'place_test', 12.929, 77.676,
    datetime('now', '+2 hours'), '10:00 IST', 'Remote Google Meet', 'user_maya', datetime('now'), datetime('now')
  )
`).run(testAdvPactId);

db.prepare(`
  INSERT INTO alerts (id, pact_id, rule_version, episode_id, decision_status, created_at)
  VALUES (?, ?, 1, 'ep_adv_1', 'pending', datetime('now'))
`).run(testAlertId, testAdvPactId);

const advisoryContext = await ContextService.fetchPublicContext(testAlertId, 'Bellandur');
assert(!advisoryContext.answer.includes('Bangalore Traffic Police (BTP) issued an advisory'), 'No fake police quote');
assert(
  advisoryContext.status === 'synthetic' || advisoryContext.status === 'retrieved',
  'Advisory status valid'
);
if (advisoryContext.status === 'synthetic') {
  assert(advisoryContext.answer.includes('Sample advisory (demo data)'), 'Sample advisory clearly labeled demo data');
}
console.log('✓ Requirement 6: Public corridor advisory verified without fake organizational quotes.');

// =========================================================================
// Requirement 8: Bilateral team decision consensus
// =========================================================================
// Create test alert
const testConsensusPactId = 'pact_consensus_' + Date.now();
const testConsensusAlertId = 'alert_consensus_' + Date.now();

db.prepare(`
  INSERT INTO pacts (
    id, team_id, title, version, status,
    destination_name, destination_place_id, destination_lat, destination_lon,
    decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
  ) VALUES (
    ?, 'team_office_pact', 'Consensus Test Pact', 1, 'armed',
    'Bellandur Office', 'place_test', 12.929, 77.676,
    datetime('now', '+2 hours'), '10:00 IST', 'Remote Google Meet', 'user_maya', datetime('now'), datetime('now')
  )
`).run(testConsensusPactId);

db.prepare(`
  INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
  VALUES
    (?, ?, 'user_maya', 'Maya', 'Indiranagar', 12.9784, 77.6408, 3600, 1, datetime('now')),
    (?, ?, 'user_arjun', 'Arjun', 'HSR Layout', 12.9121, 77.6446, 3600, 1, datetime('now'))
`).run('part_m_' + testConsensusPactId, testConsensusPactId, 'part_a_' + testConsensusPactId, testConsensusPactId);

db.prepare(`
  INSERT INTO alerts (id, pact_id, rule_version, episode_id, decision_status, created_at)
  VALUES (?, ?, 1, 'ep_cons_1', 'pending', datetime('now'))
`).run(testConsensusAlertId, testConsensusPactId);

// 1. Differing choices: Maya chooses 'remote', Arjun chooses 'keep'
await ReceiptService.recordDecision(testConsensusAlertId, 'user_maya', 'remote');
const receiptAfterArjun = await ReceiptService.recordDecision(testConsensusAlertId, 'user_arjun', 'keep');

assert.strictEqual(
  receiptAfterArjun.currentDecisionStatus,
  'needs_discussion',
  'Status becomes needs_discussion when Maya and Arjun choose differing actions'
);
assert.strictEqual(receiptAfterArjun.consensus.needsDiscussion, true);
assert(receiptAfterArjun.consensus.warningBanner?.includes('Needs discussion'));

// Verify that summary message was inserted into in-app team channel
const teamMessage = db.prepare(`
  SELECT * FROM team_messages
  WHERE channel_id = 'group_office_pact' AND text LIKE '%Decision mismatch%'
  ORDER BY sent_time DESC LIMIT 1
`).get() as any;
assert(teamMessage, 'Mismatch summary message posted to team channel');
assert(teamMessage.text.includes('Decision mismatch'));

console.log('✓ Requirement 8: Differing choices trigger needs_discussion status and channel summary message.');

// 2. Unanimous choices: Both Maya and Arjun choose 'remote'
const receiptUnanimous = await ReceiptService.recordDecision(testConsensusAlertId, 'user_arjun', 'remote');
assert.strictEqual(
  receiptUnanimous.currentDecisionStatus,
  'remote_chosen',
  'Status is resolved/final (remote_chosen) when both choose remote'
);
assert.strictEqual(receiptUnanimous.consensus.isResolved, true);
assert.strictEqual(receiptUnanimous.consensus.resolvedAction, 'remote');

console.log('✓ Requirement 8: Bilateral unanimous choices resolve to final status.');

// Clean up test data
db.prepare('DELETE FROM team_messages WHERE channel_id = ? AND text LIKE ?').run('group_office_pact', '%Decision mismatch%');
db.prepare('DELETE FROM acknowledgements WHERE alert_id = ?').run(testConsensusAlertId);
db.prepare('DELETE FROM alerts WHERE id IN (?, ?)').run(testConsensusAlertId, testAlertId);
db.prepare('DELETE FROM watches WHERE pact_id IN (?, ?)').run(testConsensusPactId, expPactId);
db.prepare('DELETE FROM participants WHERE pact_id = ?').run(testConsensusPactId);
db.prepare('DELETE FROM pacts WHERE id IN (?, ?)').run(testConsensusPactId, expPactId);

console.log('--- ALL PROMPT 1 DATA CONSISTENCY & INTEGRITY INVARIANTS PASSED ---');
