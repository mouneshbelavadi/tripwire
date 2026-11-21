import assert from 'assert';
import http from 'http';
import { app } from '../app.js';
import { getDb } from '../db.js';
import { eventBus } from '../domain/eventBus.js';

console.log('--- Running Places Autocomplete & Server APIs Tests ---');

const server = http.createServer(app);

await new Promise<void>((resolve) => {
  server.listen(0, () => resolve());
});

const port = (server.address() as any).port;
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const db = getDb();

  // =========================================================================
  // 1. SQLite Places Cache & Autocomplete Tests
  // =========================================================================
  console.log('\n[1] Testing Places Autocomplete & SQLite Cache...');

  // Empty query
  const resEmpty = await fetch(`${baseUrl}/api/places/autocomplete?q=`);
  assert.strictEqual(resEmpty.status, 200);
  const dataEmpty = (await resEmpty.json()) as any;
  assert.deepStrictEqual(dataEmpty.places, []);
  console.log('✓ Empty autocomplete query returns empty places array.');

  // Pre-seed an entry in place_cache
  const testQuery = 'indiranagar hub';
  const preCachedPlaces = [
    {
      place_id: 'place_cached_01',
      title: 'Indiranagar Hub Co-working',
      address: '100ft Rd, Indiranagar, Bengaluru',
      gps_coordinates: { latitude: 12.9784, longitude: 77.6408 },
    },
  ];

  db.prepare(`
    INSERT INTO place_cache (query, results_json, cached_at)
    VALUES (?, ?, ?)
    ON CONFLICT(query) DO UPDATE SET results_json = excluded.results_json
  `).run(testQuery, JSON.stringify(preCachedPlaces), new Date().toISOString());

  // Count credit attempts before cache hit
  const creditsBefore = (db.prepare('SELECT COUNT(*) as count FROM credit_attempts').get() as any).count;

  // Query should hit cache and cost 0 credits
  const resHit = await fetch(`${baseUrl}/api/places/autocomplete?q=Indiranagar%20Hub`);
  assert.strictEqual(resHit.status, 200);
  const dataHit = (await resHit.json()) as any;
  assert.strictEqual(dataHit.cached, true, 'Result returned from SQLite place_cache');
  assert.strictEqual(dataHit.places.length, 1);
  assert.strictEqual(dataHit.places[0].place_id, 'place_cached_01');
  assert.strictEqual(dataHit.places[0].title, 'Indiranagar Hub Co-working');

  const creditsAfter = (db.prepare('SELECT COUNT(*) as count FROM credit_attempts').get() as any).count;
  assert.strictEqual(creditsAfter, creditsBefore, 'Identical cached query costs 0 credit reservations');
  console.log('✓ SQLite place_cache hit returned cached results immediately with 0 credit cost.');

  // Test credit budget ceiling friendly 429 warning
  // Explicitly ensure credit_attempts is at or above cap (40) for this assertion
  const currentCreditCount = (db.prepare('SELECT COUNT(*) as count FROM credit_attempts').get() as any).count;
  if (currentCreditCount < 40) {
    for (let i = currentCreditCount; i < 40; i++) {
      db.prepare("INSERT INTO credit_attempts (phase, reserved_at, state) VALUES ('test_fill', datetime('now'), 'reserved')").run();
    }
  }

  const uncachedQuery = 'brand_new_uncached_location_xyz';
  // Ensure not in cache
  db.prepare('DELETE FROM place_cache WHERE query = ?').run(uncachedQuery);

  const res429 = await fetch(`${baseUrl}/api/places/autocomplete?q=${uncachedQuery}`);
  assert.strictEqual(res429.status, 429, 'Expected 429 when budget ceiling reached');
  const data429 = (await res429.json()) as any;
  assert(data429.warning, 'Contains friendly warning message');
  assert(Array.isArray(data429.fallback), 'Contains fallback suggestions');
  assert.strictEqual(data429.places.length, 0, 'Places list is empty when budget is exhausted');
  console.log('✓ Credit exhaustion returns friendly 429 warning with empty list and fallback suggestion.');

  // Test cache insertion and normalization when credit is available
  // Temporarily delete a credit row to simulate headroom
  const deletedRow = db.prepare("SELECT id FROM credit_attempts WHERE phase = 'places_autocomplete' LIMIT 1").get() as any;
  if (!deletedRow) {
    db.prepare("INSERT INTO credit_attempts (phase, reserved_at, state) VALUES ('temp', datetime('now'), 'reserved')").run();
  }
  // Remove 2 entries to give headroom
  db.prepare("DELETE FROM credit_attempts WHERE id IN (SELECT id FROM credit_attempts ORDER BY id DESC LIMIT 2)").run();

  const freshQuery = 'koramangala workspace';
  db.prepare('DELETE FROM place_cache WHERE query = ?').run(freshQuery);

  const resFresh = await fetch(`${baseUrl}/api/places/autocomplete?q=${encodeURIComponent(freshQuery)}`);
  assert.strictEqual(resFresh.status, 200);
  const dataFresh = (await resFresh.json()) as any;
  assert.strictEqual(dataFresh.cached, false);
  assert(dataFresh.places.length > 0, 'Returned normalized places');

  // Verify normalization format: { place_id, title, address, gps_coordinates: { latitude, longitude } }
  for (const p of dataFresh.places) {
    assert(typeof p.place_id === 'string', 'place_id is string');
    assert(typeof p.title === 'string', 'title is string');
    assert(typeof p.address === 'string', 'address is string');
    assert(p.gps_coordinates && typeof p.gps_coordinates.latitude === 'number' && typeof p.gps_coordinates.longitude === 'number');
  }

  // Verify place was saved in place_cache table
  const cachedDbRow = db.prepare('SELECT results_json FROM place_cache WHERE query = ?').get(freshQuery) as any;
  assert(cachedDbRow, 'Query was cached in SQLite place_cache');
  console.log('✓ Places normalized and persisted to SQLite place_cache with valid gps_coordinates.');

  // =========================================================================
  // 2. Server-Sent Events (SSE) Stream Tests
  // =========================================================================
  console.log('\n[2] Testing Server-Sent Events (SSE) /api/stream...');

  let sseConnected = false;
  let receivedCustomEvent = false;

  const sseReq = http.request(`${baseUrl}/api/stream`, {
    headers: { Accept: 'text/event-stream' },
  }, (sseRes) => {
    assert.strictEqual(sseRes.statusCode, 200);
    assert.strictEqual(sseRes.headers['content-type'], 'text/event-stream');

    sseRes.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes('event: connected')) {
        sseConnected = true;
      }
      if (text.includes('event: approval') && text.includes('pact_test_stream')) {
        receivedCustomEvent = true;
      }
    });
  });

  sseReq.end();

  // Wait for initial SSE connection
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(sseConnected, true, 'SSE client received connected event');

  // Emit event on EventBus
  eventBus.emitEvent('approval', {
    pactId: 'pact_test_stream',
    userId: 'user_maya',
    status: 'armed',
  });

  // Wait for event delivery over SSE
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(receivedCustomEvent, true, 'SSE received approval event dispatched via EventBus');
  sseReq.destroy();
  console.log('✓ SSE endpoint /api/stream successfully connected and received live EventBus events.');

  // =========================================================================
  // 3. Alert & Decision Endpoints Tests (/api/alerts/:id and /decision)
  // =========================================================================
  console.log('\n[3] Testing Decision & Alert Endpoints...');

  // Set up an isolated test alert
  const testAlertId = `alert_test_${Date.now()}`;
  const testPactId = 'pact_bellandur_01';
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO alerts (id, pact_id, rule_version, episode_id, decision_status, created_at)
    VALUES (?, ?, 1, 'ep_test_01', 'pending', ?)
  `).run(testAlertId, testPactId, nowIso);

  // Clean acknowledgements for this test alert
  db.prepare('DELETE FROM acknowledgements WHERE alert_id = ?').run(testAlertId);

  // GET /api/alerts/:id for non-existent alert
  const res404 = await fetch(`${baseUrl}/api/alerts/non_existent_alert_xyz`);
  assert.strictEqual(res404.status, 404);
  console.log('✓ Non-existent alert returns 404.');

  // GET /api/alerts/:id for created alert
  const resGetAlert = await fetch(`${baseUrl}/api/alerts/${testAlertId}`);
  assert.strictEqual(resGetAlert.status, 200);
  const dataAlert = (await resGetAlert.json()) as any;
  assert.strictEqual(dataAlert.alert.id, testAlertId);
  assert.strictEqual(dataAlert.alert.pact_id, testPactId);
  assert(Array.isArray(dataAlert.participants), 'Participants array included');
  assert.strictEqual(dataAlert.participants.length, 2);
  assert(Array.isArray(dataAlert.breaching_observations), 'Breaching observations array included');
  assert(Array.isArray(dataAlert.decisions), 'Decisions array included');
  assert.strictEqual(dataAlert.consensus, 'pending');
  console.log('✓ GET /api/alerts/:id returns full immutable alert details, participants, observations, and decisions.');

  // POST /api/alerts/:id/decision - Reject non-participant
  const resForbidden = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'user_stranger',
    },
    body: JSON.stringify({ action: 'remote_fallback' }),
  });
  assert.strictEqual(resForbidden.status, 403, 'Non-participant rejected with 403');
  console.log('✓ Non-participant user rejected with 403 Forbidden.');

  // POST /api/alerts/:id/decision - Maya votes remote_fallback
  const resMayaVote1 = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'user_maya',
    },
    body: JSON.stringify({ action: 'remote_fallback' }),
  });
  assert.strictEqual(resMayaVote1.status, 200);
  const dataMayaVote1 = (await resMayaVote1.json()) as any;
  assert.strictEqual(dataMayaVote1.success, true);
  assert.strictEqual(dataMayaVote1.action, 'remote_fallback');
  assert.strictEqual(dataMayaVote1.is_final, false, 'Consensus not final until both participants vote');

  // Verify vote in database
  const acksCount1 = (db.prepare('SELECT COUNT(*) as count FROM acknowledgements WHERE alert_id = ?').get(testAlertId) as any).count;
  assert.strictEqual(acksCount1, 1);

  // POST /api/alerts/:id/decision - Maya repeats IDENTICAL vote (idempotency check)
  const resMayaVote2 = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'user_maya',
    },
    body: JSON.stringify({ action: 'remote_fallback' }),
  });
  assert.strictEqual(resMayaVote2.status, 200);
  const dataMayaVote2 = (await resMayaVote2.json()) as any;
  assert.strictEqual(dataMayaVote2.idempotent, true, 'Identified as idempotent repeat');

  const acksCount2 = (db.prepare('SELECT COUNT(*) as count FROM acknowledgements WHERE alert_id = ?').get(testAlertId) as any).count;
  assert.strictEqual(acksCount2, 1, 'No duplicate row inserted for repeated identical vote');
  console.log('✓ Idempotent decision recording: repeated identical vote returns 200 without duplicate row.');

  // POST /api/alerts/:id/decision - Arjun votes remote_fallback (same choice = final consensus)
  const resArjunVote = await fetch(`${baseUrl}/api/alerts/${testAlertId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'user_arjun',
    },
    body: JSON.stringify({ action: 'remote_fallback' }),
  });
  assert.strictEqual(resArjunVote.status, 200);
  const dataArjunVote = (await resArjunVote.json()) as any;
  assert.strictEqual(dataArjunVote.consensus, 'remote_fallback');
  assert.strictEqual(dataArjunVote.is_final, true, 'Same choice by all participants resolves final consensus');
  console.log('✓ Consensus resolution: unanimous agreement (same choice = final) verified.');

  // Test differing choices: Arjun changes vote to keep_plan -> differing choices = 'needs_discussion'
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
  assert.strictEqual(dataArjunDiff.consensus, 'needs_discussion');
  assert.strictEqual(dataArjunDiff.is_final, true);

  // Check alert row in DB updated to needs_discussion
  const updatedAlertRow = db.prepare('SELECT decision_status FROM alerts WHERE id = ?').get(testAlertId) as any;
  assert.strictEqual(updatedAlertRow.decision_status, 'needs_discussion');
  console.log("✓ Consensus resolution: differing choices resolves to 'needs_discussion'.");

  console.log('\n--- ALL PLACES & SERVER API TESTS PASSED SUCCESSFULLY! ---');
} finally {
  server.close();
}
