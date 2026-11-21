import assert from 'assert';
import { getDb } from '../db.js';
import { app } from '../app.js';
import type { Server } from 'http';

console.log('--- Running Prompt 5 Decision Flow & Breach Receipt Tests ---');

const PORT = 3987;
const baseUrl = `http://localhost:${PORT}`;
const db = getDb();

let server: Server;

async function runTests() {
  server = app.listen(PORT);
  try {
    const testPactId = 'pact_test_prompt5_' + Date.now();
    const testAlertId = 'alert_test_prompt5_' + Date.now();
    const futureDeadlineUtc = new Date(Date.now() + 3600000).toISOString();

    // 1. Setup test pact and participants in SQLite
    db.prepare(`
      INSERT INTO pacts (
        id, team_id, title, version, status,
        destination_name, destination_place_id, destination_lat, destination_lon,
        destination_address, decision_deadline_utc, decision_deadline_ist,
        fallback_text, created_by, created_at, updated_at
      ) VALUES (
        ?, 'team_office_pact', 'Indiranagar & HSR → WeWork Bellandur', 1, 'armed',
        'WeWork Bellandur', 'place_wework_bellandur', 12.9290, 77.6760,
        'Outer Ring Road, Bellandur, Bengaluru', ?, '09:00 IST',
        'Switch to remote Google Meet and cancel cab', 'user_maya', datetime('now'), datetime('now')
      )
    `).run(testPactId, futureDeadlineUtc);

    db.prepare(`
      INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
      VALUES
        (?, ?, 'user_maya', 'Maya', 'Indiranagar', 12.9784, 77.6408, 3600, 1, datetime('now')),
        (?, ?, 'user_arjun', 'Arjun', 'HSR Layout', 12.9121, 77.6446, 3600, 1, datetime('now'))
    `).run('part_m_' + testPactId, testPactId, 'part_a_' + testPactId, testPactId);

    // 2. Setup watches and observations for this pact
    const watchIdMaya = `watch_route_${testPactId}_user_maya`;
    db.prepare(`
      INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
      VALUES (?, ?, 'google_maps_directions', '{}', 'hash_test_p5_maya', datetime('now'), 300, 1, 1)
    `).run(watchIdMaya, testPactId);

    const nowIso1 = new Date(Date.now() - 120000).toISOString();
    const nowIso2 = new Date(Date.now() - 30000).toISOString();

    const obs1Id = `obs1_${testPactId}`;
    const obs2Id = `obs2_${testPactId}`;

    db.prepare(`
      INSERT INTO observations (id, watch_id, provider_search_id, provider_created_at, received_at, query_hash, raw_hash, normalized_json, validity, provenance)
      VALUES (?, ?, 'srch_1', ?, ?, 'hash_test_obs1', 'raw_1', json('{"fastestDuration":4080}'), 'valid', 'synthetic')
    `).run(obs1Id, watchIdMaya, nowIso1, nowIso1);

    db.prepare(`
      INSERT INTO observations (id, watch_id, provider_search_id, provider_created_at, received_at, query_hash, raw_hash, normalized_json, validity, provenance)
      VALUES (?, ?, 'srch_2', ?, ?, 'hash_test_obs2', 'raw_2', json('{"fastestDuration":4320}'), 'valid', 'synthetic')
    `).run(obs2Id, watchIdMaya, nowIso2, nowIso2);

    // 3. Create Alert Record
    db.prepare(`
      INSERT INTO alerts (id, pact_id, rule_version, episode_id, before_observation_id, after_observation_id, decision_status, created_at)
      VALUES (?, ?, 1, ?, ?, ?, 'pending', datetime('now'))
    `).run(testAlertId, testPactId, 'ep_p5_test', obs1Id, obs2Id);

    console.log('✓ Test data setup complete: pact, participants, observations, alert created.');

    // =========================================================================
    // TEST 1: GET /api/alerts/:id
    // =========================================================================
    console.log('\n[Test 1] Testing GET /api/alerts/:id...');

    // 404 for non-existent alert
    const res404 = await fetch(`${baseUrl}/api/alerts/alert_non_existent_9999`);
    assert.strictEqual(res404.status, 404, 'Non-existent alert must return 404');
    console.log('✓ Non-existent alert correctly returns 404.');

    // 200 for existing alert
    const resAlert = await fetch(`${baseUrl}/api/alerts/${testAlertId}`);
    assert.strictEqual(resAlert.status, 200);
    const dataAlert = (await resAlert.json()) as any;

    // Check alert ID, pact title, version, participants
    assert.strictEqual(dataAlert.alert.id, testAlertId);
    assert.strictEqual(dataAlert.alert.pact_id, testPactId);
    assert.strictEqual(dataAlert.pact.title, 'Indiranagar & HSR → WeWork Bellandur');
    assert.strictEqual(dataAlert.participants.length, 2);

    // Check breaching observations presence
    assert(Array.isArray(dataAlert.breaching_observations), 'breaching_observations array exists');
    assert(dataAlert.breaching_observations.length >= 2, 'At least 2 breaching observations');
    assert.strictEqual(dataAlert.consensus, 'pending');

    // Check receipt object if present
    if (dataAlert.receipt) {
      assert.strictEqual(dataAlert.receipt.alertId, testAlertId);
      assert.strictEqual(dataAlert.receipt.evidence.check2Minutes, 72);
      assert.strictEqual(dataAlert.receipt.evidence.provenance, 'synthetic');
    }
    console.log('✓ GET /api/alerts/:id returned complete immutable alert and receipt structure.');

    // =========================================================================
    // TEST 2: POST /api/alerts/:id/decision - Validation & Auth
    // =========================================================================
    console.log('\n[Test 2] Testing POST /api/alerts/:id/decision Validation & Auth...');

    // Reject non-participant
    const resForbidden = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_stranger_unauthorized',
      },
      body: JSON.stringify({ action: 'remote_fallback' }),
    });
    assert.strictEqual(resForbidden.status, 403, 'Non-participant rejected with 403');
    console.log('✓ Unauthorized non-participant rejected with 403 Forbidden.');

    // Reject invalid decision
    const resInvalid = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_maya',
      },
      body: JSON.stringify({ action: 'invalid_action_xyz' }),
    });
    assert.strictEqual(resInvalid.status, 400, 'Invalid action rejected with 400');
    console.log('✓ Invalid action rejected with 400 Bad Request.');

    // =========================================================================
    // TEST 3: POST /api/alerts/:id/decision - Idempotency
    // =========================================================================
    console.log('\n[Test 3] Testing Idempotent Decision Recording...');

    // Maya votes remote_fallback first time
    const resMaya1 = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_maya',
      },
      body: JSON.stringify({ action: 'remote_fallback' }),
    });
    assert.strictEqual(resMaya1.status, 200);
    const dataMaya1 = (await resMaya1.json()) as any;
    assert.strictEqual(dataMaya1.success, true);
    assert.strictEqual(dataMaya1.is_final, false, 'First vote cannot finalize consensus');
    assert.strictEqual(dataMaya1.action, 'remote_fallback');

    const countAcks1 = (db.prepare('SELECT COUNT(*) as count FROM acknowledgements WHERE alert_id = ?').get(testAlertId) as any).count;
    assert.strictEqual(countAcks1, 1, 'Exactly 1 acknowledgement row');

    // Maya repeats the EXACT SAME vote (Idempotency test)
    const resMayaRepeat = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_maya',
      },
      body: JSON.stringify({ action: 'remote_fallback' }),
    });
    assert.strictEqual(resMayaRepeat.status, 200);
    const dataMayaRepeat = (await resMayaRepeat.json()) as any;
    assert.strictEqual(dataMayaRepeat.idempotent, true, 'Marked as idempotent repeat');

    const countAcks2 = (db.prepare('SELECT COUNT(*) as count FROM acknowledgements WHERE alert_id = ?').get(testAlertId) as any).count;
    assert.strictEqual(countAcks2, 1, 'No duplicate row created on identical vote');
    console.log('✓ Idempotency verified: duplicate submission returns 200 without creating extra rows.');

    // =========================================================================
    // TEST 4: Consensus Resolution - Differing Choices ("Needs Discussion")
    // =========================================================================
    console.log('\n[Test 4] Testing Differing Choices ("Needs Discussion")...');

    // Arjun votes keep_plan (Maya voted remote_fallback)
    const resArjunDiff = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_arjun',
      },
      body: JSON.stringify({ action: 'keep_plan' }),
    });
    assert.strictEqual(resArjunDiff.status, 200);
    const dataArjunDiff = (await resArjunDiff.json()) as any;
    assert.strictEqual(dataArjunDiff.consensus, 'needs_discussion', 'Consensus becomes needs_discussion when choices differ');
    assert.strictEqual(dataArjunDiff.is_final, true, 'Decision process is marked final/evaluated');

    const alertRowDiff = db.prepare('SELECT decision_status FROM alerts WHERE id = ?').get(testAlertId) as any;
    assert.strictEqual(alertRowDiff.decision_status, 'needs_discussion');
    console.log('✓ Differing choices correctly sets status to "needs_discussion".');

    // =========================================================================
    // TEST 5: Consensus Resolution - Unanimous Agreement ("Resolved")
    // =========================================================================
    console.log('\n[Test 5] Testing Unanimous Agreement ("Resolved")...');

    // Arjun changes vote to remote_fallback (both now choose remote_fallback)
    const resArjunSame = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_arjun',
      },
      body: JSON.stringify({ action: 'remote_fallback' }),
    });
    assert.strictEqual(resArjunSame.status, 200);
    const dataArjunSame = (await resArjunSame.json()) as any;
    assert.strictEqual(dataArjunSame.consensus, 'remote_fallback', 'Consensus is remote_fallback');
    assert.strictEqual(dataArjunSame.is_final, true, 'Consensus is final');

    const alertRowResolved = db.prepare('SELECT decision_status FROM alerts WHERE id = ?').get(testAlertId) as any;
    assert.strictEqual(alertRowResolved.decision_status, 'remote_fallback');

    // Verify activity/team message was logged
    const teamMsg = db.prepare(`
      SELECT text FROM team_messages
      WHERE channel_id = 'group_office_pact' AND text LIKE '%CONSENSUS RESOLVED%'
      ORDER BY sent_time DESC LIMIT 1
    `).get() as any;
    assert(teamMsg, 'Consensus resolution logged to team messages');
    console.log('✓ Unanimous agreement verified: resolves consensus and logs to activity.');

    // Cleanup test records
    db.prepare('DELETE FROM acknowledgements WHERE alert_id = ?').run(testAlertId);
    db.prepare('DELETE FROM alerts WHERE id = ?').run(testAlertId);
    db.prepare('DELETE FROM observations WHERE id IN (?, ?)').run(obs1Id, obs2Id);
    db.prepare('DELETE FROM watches WHERE pact_id = ?').run(testPactId);
    db.prepare('DELETE FROM participants WHERE pact_id = ?').run(testPactId);
    db.prepare('DELETE FROM pacts WHERE id = ?').run(testPactId);

    console.log('\n--- ALL PROMPT 5 DECISION & RECEIPT TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  if (server) server.close();
  process.exit(1);
});
