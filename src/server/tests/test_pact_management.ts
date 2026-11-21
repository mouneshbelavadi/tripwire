import assert from 'assert';
import http from 'http';
import { app } from '../app.js';
import { PactService } from '../domain/pactService.js';
import { getDb } from '../db.js';

console.log('--- Running Pact Creation, Multiple Pacts & Past Pacts Tests ---');

const db = getDb();
const teamId = 'team_office_pact';
const mayaId = 'user_maya';
const arjunId = 'user_arjun';

// 1. Verify Seeded Past Pacts
const pastWhitefield = PactService.getPactDetails('pact_past_whitefield', mayaId);
assert.strictEqual(pastWhitefield.title, 'Whitefield Client Sync');
assert.strictEqual(pastWhitefield.status, 'completed');
assert.strictEqual(pastWhitefield.participants.length, 2);
assert.strictEqual(pastWhitefield.can_current_user_approve, false, 'Completed pact cannot be approved');
console.log('✓ Seeded past pact 1 (Whitefield Client Sync) verified with status completed.');

const pastKoramangala = PactService.getPactDetails('pact_past_koramangala', arjunId);
assert.strictEqual(pastKoramangala.title, 'Koramangala Standup');
assert.strictEqual(pastKoramangala.status, 'completed');
assert.strictEqual(pastKoramangala.participants.length, 2);
assert.strictEqual(pastKoramangala.can_current_user_approve, false, 'Completed pact cannot be approved');
console.log('✓ Seeded past pact 2 (Koramangala Standup) verified with status completed.');

// 2. Test PactService.createPact directly
const newPact = PactService.createPact(teamId, mayaId, {
  title: 'Sarjapur Strategy Sync',
  destination_name: 'WeWork Sarjapur',
  destination_lat: 12.9100,
  destination_lon: 77.6800,
  fallback_text: 'Switch to remote Google Meet',
  participant_limits: [
    { user_id: mayaId, max_duration_s: 3000 },
    { user_id: arjunId, max_duration_s: 3600 },
  ],
});

assert(newPact.id.startsWith('pact_'), 'Pact ID has pact_ prefix with UUID');
assert.strictEqual(newPact.title, 'Sarjapur Strategy Sync');
assert.strictEqual(newPact.status, 'draft');
assert.strictEqual(newPact.version, 1);
assert.strictEqual(newPact.participants.length, 2);

const mayaPart = newPact.participants.find((p) => p.user_id === mayaId);
const arjunPart = newPact.participants.find((p) => p.user_id === arjunId);
assert.strictEqual(mayaPart?.max_duration_s, 3000);
assert.strictEqual(arjunPart?.max_duration_s, 3600);

// Check default watches were attached in the watches table
const watches = db.prepare('SELECT * FROM watches WHERE pact_id = ?').all(newPact.id) as any[];
assert(watches.length >= 2, `Expected at least 2 watches (route + traffic), found ${watches.length}`);
const engines = watches.map((w) => w.engine);
assert(engines.includes('google_maps_directions'), 'Contains route directions watch');
assert(engines.includes('google_maps_traffic'), 'Contains traffic watch');
console.log('✓ PactService.createPact created pact with UUID, Maya/Arjun participants, custom thresholds, and default watches.');

// 3. Test HTTP routes: POST /api/pacts and POST /api/pacts/:id/close
const server = http.createServer(app);
server.listen(3098, async () => {
  try {
    // Test POST /api/pacts
    const createRes = await fetch('http://localhost:3098/api/pacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_maya',
      },
      body: JSON.stringify({
        title: 'Indiranagar Brainstorm',
        destination_name: 'Third Wave Coffee Indiranagar',
        destination_lat: 12.9716,
        destination_lon: 77.6412,
        destination_address: '100 Feet Rd, Indiranagar',
        fallback_text: 'Remote Meet',
      }),
    });

    assert.strictEqual(createRes.status, 201, 'POST /api/pacts returns 201 Created');
    const createData = (await createRes.json()) as any;
    assert(createData.pact.id.startsWith('pact_'));
    assert.strictEqual(createData.pact.status, 'draft');
    assert.strictEqual(createData.pact.participants.length, 2);
    const createdPactId = createData.pact.id;
    console.log('✓ POST /api/pacts endpoint verified.');

    // Test POST /api/pacts/:id/close
    const closeRes = await fetch(`http://localhost:3098/api/pacts/${createdPactId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_maya',
      },
    });

    assert.strictEqual(closeRes.status, 200, 'POST /api/pacts/:id/close returns 200 OK');
    const closeData = (await closeRes.json()) as any;
    assert.strictEqual(closeData.pact.status, 'completed', 'Pact status updated to completed');

    // Verify watches were disabled
    const disabledWatches = db.prepare('SELECT enabled FROM watches WHERE pact_id = ?').all(createdPactId) as any[];
    for (const w of disabledWatches) {
      assert.strictEqual(w.enabled, 0, 'Watch is disabled upon close');
    }
    console.log('✓ POST /api/pacts/:id/close endpoint verified: marks completed and disables watches.');

    // Clean up created test pacts
    db.prepare('DELETE FROM pacts WHERE id IN (?, ?)').run(newPact.id, createdPactId);

    console.log('--- ALL PACT CREATION & PAST PLANS TESTS PASSED ---');
    server.close();
  } catch (err) {
    console.error('Test failed:', err);
    server.close();
    process.exitCode = 1;
  }
});
