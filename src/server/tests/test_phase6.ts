import assert from 'assert';
import { ContextService } from '../domain/contextService.js';
import { ReceiptService } from '../domain/receiptService.js';
import { ObservationService } from '../domain/observationService.js';
import { createSyntheticBreachSequence } from '../fixtures/syntheticBreach.js';
import { getDb } from '../db.js';

console.log('--- Running Phase 6 Cited Context & Decision Receipt Tests ---');

const db = getDb();
const pactId = 'pact_bellandur_01';
const mayaId = 'user_maya';
const arjunId = 'user_arjun';

// 1. You query length boundary invariant
assert.rejects(
  async () => {
    // Generate corridor name that pushes query over 400 characters
    const giantCorridor = 'A'.repeat(380);
    await ContextService.fetchPublicContext('alert_fake', giantCorridor);
  },
  /exceeded 400 characters/,
  'Query exceeding 400 chars is rejected'
);
console.log('✓ test_you_query_length_boundary: 400 character limit strictly enforced.');

// 2. Trigger real breach to generate alert entity in SQLite
const watchId = `watch_route_${pactId}_${mayaId}`;
const futureDeadlineUtc = new Date(Date.now() + 7200 * 1000).toISOString();
db.prepare('UPDATE pacts SET decision_deadline_utc = ? WHERE id = ?').run(futureDeadlineUtc, pactId);
const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;

// Ensure watch row exists to satisfy foreign key constraint
db.prepare(`
  INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
  VALUES (?, ?, 'google_maps_directions', '{}', 'demo_hash', datetime('now'), 300, 1, 1)
  ON CONFLICT(id) DO NOTHING
`).run(watchId, pactId);

// Clean isolated state for this test watch
db.prepare('DELETE FROM rule_states WHERE watch_id = ?').run(watchId);
db.prepare('DELETE FROM observations WHERE watch_id = ?').run(watchId);

const nowSec = Math.floor(Date.now() / 1000);
const { obs1, obs2 } = createSyntheticBreachSequence(nowSec);

// Observation 1: 68 min -> confirming
const r1 = ObservationService.processRouteObservation({
  watchId,
  pactId,
  participantId: 'part_maya',
  userId: mayaId,
  rawPayload: obs1,
  sourceTimestampUtc: obs1.search_metadata.created_at,
  provenance: 'synthetic',
  limitSeconds: 3600,
  deadlineUtc: futureDeadlineUtc,
  pactVersion: pact.version,
  queryParams: { q: 'demo' },
});
assert.strictEqual(r1.outcome, 'confirming');

// Observation 2: 72 min -> alert
const r2 = ObservationService.processRouteObservation({
  watchId,
  pactId,
  participantId: 'part_maya',
  userId: mayaId,
  rawPayload: obs2,
  sourceTimestampUtc: obs2.search_metadata.created_at,
  provenance: 'synthetic',
  limitSeconds: 3600,
  deadlineUtc: futureDeadlineUtc,
  pactVersion: pact.version,
  queryParams: { q: 'demo' },
});
assert.strictEqual(r2.outcome, 'alert');
assert(r2.alertCreated, 'Alert created');
const alertId = r2.alertId!;

// 3. Public context retrieval invariant
const context = await ContextService.fetchPublicContext(alertId, 'Bellandur');
assert(context.answer.length > 0, 'Answer returned');
assert(['retrieved', 'synthetic', 'unavailable'].includes(context.status), 'Valid status');
for (const c of context.citations) {
  assert(c.url.startsWith('http://') || c.url.startsWith('https://'), 'Only http(s) links accepted');
}
console.log('✓ test_public_context: Cited context retrieved with validated http(s) links.');

// 4. Evidence receipt assembly test
const receipt = await ReceiptService.getReceipt(alertId);
assert.strictEqual(receipt.alertId, alertId);
assert.strictEqual(receipt.pactTitle, pact.title);
assert.strictEqual(receipt.participant.limitMinutes, 60);
assert.strictEqual(receipt.evidence.check1Minutes, 68);
assert.strictEqual(receipt.evidence.check2Minutes, 72);
assert.strictEqual(receipt.evidence.provenance, 'synthetic');
assert(receipt.publicContext.citations.length > 0, 'Public citations included');
console.log('✓ test_evidence_receipt_assembly: Full receipt contains two checks, freshness, citations, and provenance.');

// 5. Interactive authenticated decisions & cross-session acknowledgement
// Maya chooses 'remote'
let updatedReceipt = await ReceiptService.recordDecision(alertId, mayaId, 'remote');
assert.strictEqual(updatedReceipt.currentDecisionStatus, 'remote_chosen');
assert.strictEqual(updatedReceipt.acknowledgements.length, 1);
assert.strictEqual(updatedReceipt.acknowledgements[0].userId, mayaId);
assert.strictEqual(updatedReceipt.acknowledgements[0].decision, 'remote');

// Arjun chooses 'keep'
updatedReceipt = await ReceiptService.recordDecision(alertId, arjunId, 'keep');
assert.strictEqual(updatedReceipt.acknowledgements.length, 2);
const mayaAck = updatedReceipt.acknowledgements.find((a) => a.userId === mayaId);
const arjunAck = updatedReceipt.acknowledgements.find((a) => a.userId === arjunId);
assert.strictEqual(mayaAck?.decision, 'remote', 'Maya decision preserved as remote');
assert.strictEqual(arjunAck?.decision, 'keep', 'Arjun decision recorded as keep');
console.log('✓ test_cross_session_acknowledgement: Both users recorded decisions distinctly in application data.');

// 6. You failure preserves alert
const fakeAlertId = `alert_fake_${Date.now()}`;
db.prepare(`
  INSERT INTO alerts (id, pact_id, rule_version, episode_id, decision_status, created_at)
  VALUES (?, ?, 1, 'ep_fake', 'pending', datetime('now'))
`).run(fakeAlertId, pactId);

// Public context unavailable test
db.prepare(`
  INSERT INTO citation_contexts (alert_id, status, answer, citations_json, retrieved_at)
  VALUES (?, 'unavailable', 'Public context unavailable: request timed out.', '[]', datetime('now'))
`).run(fakeAlertId);

const degradedReceipt = await ReceiptService.getReceipt(fakeAlertId);
assert.strictEqual(degradedReceipt.publicContext.status, 'unavailable');
assert.strictEqual(degradedReceipt.currentDecisionStatus, 'pending', 'Alert remains valid despite context failure');
console.log('✓ test_you_failure_preserves_alert: Public context failure does not degrade or clear numerical alert.');

// Cleanup test fake alert
db.prepare('DELETE FROM citation_contexts WHERE alert_id = ?').run(fakeAlertId);
db.prepare('DELETE FROM alerts WHERE id = ?').run(fakeAlertId);

console.log('--- ALL PHASE 6 TESTS PASSED ---');
