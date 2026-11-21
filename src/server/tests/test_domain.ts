import assert from 'assert';
import { PactService } from '../domain/pactService.js';
import { VenueService } from '../domain/venueService.js';
import { getDb } from '../db.js';

console.log('--- Running Phase 2 Domain Model & Invariant Tests ---');

const db = getDb();
const pactId = 'test_pact_phase2_' + Date.now();
const teamId = 'team_office_pact';
const mayaId = 'user_maya';
const arjunId = 'user_arjun';
const strangerId = 'user_stranger';

// 1. Authorization check
assert.strictEqual(PactService.verifyTeamMember(teamId, mayaId), true, 'Maya is team member');
assert.strictEqual(PactService.verifyTeamMember(teamId, arjunId), true, 'Arjun is team member');
assert.strictEqual(PactService.verifyTeamMember(teamId, strangerId), false, 'Stranger is NOT team member');

// Setup clean isolated test pact
const now = new Date().toISOString();
db.prepare(`
  INSERT INTO pacts (
    id, team_id, title, version, status,
    destination_name, destination_place_id, destination_lat, destination_lon, destination_address,
    decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
  ) VALUES (
    ?, ?, 'Test Meetup', 1, 'draft',
    'WeWork Bellandur', 'place_test_01', 12.9290, 77.6760, 'Bellandur, Bengaluru',
    '2026-11-21T03:30:00.000Z', '09:00 IST · 21 Nov 2026', 'Switch to remote', ?, ?, ?
  )
`).run(pactId, teamId, mayaId, now, now);

db.prepare(`
  INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
  VALUES
    (?, ?, ?, 'Maya', 'Indiranagar', 12.9784, 77.6408, 3600, NULL, NULL),
    (?, ?, ?, 'Arjun', 'HSR Layout', 12.9121, 77.6446, 3600, NULL, NULL)
`).run('part_m_' + pactId, pactId, mayaId, 'part_a_' + pactId, pactId, arjunId);

assert.throws(() => {
  PactService.getPactDetails(pactId, strangerId);
}, /Forbidden/, 'Stranger cannot access pact');

// 2. Initial state check
let pact = PactService.getPactDetails(pactId, mayaId);
assert.strictEqual(pact.id, pactId);
assert.strictEqual(pact.status, 'draft');
assert.strictEqual(pact.version, 1);
assert.strictEqual(pact.participants.length, 2);
assert.strictEqual(pact.all_approved, false);
console.log('✓ Initial pact state and team authorization verified.');

// 3. Bilateral approval test
// Maya approves version 1
pact = PactService.approvePact(pactId, mayaId);
assert.strictEqual(pact.status, 'awaiting_approval', 'Status after 1 approval is awaiting_approval');
assert.strictEqual(pact.is_current_user_approved, true, 'Maya shows approved');
assert.strictEqual(pact.all_approved, false, 'Not all approved yet');
console.log('✓ First participant approval verified (status: awaiting_approval).');

// Arjun approves version 1 -> should arm the pact
pact = PactService.approvePact(pactId, arjunId);
assert.strictEqual(pact.status, 'armed', 'Pact transitions to armed when all participants approve');
assert.strictEqual(pact.all_approved, true, 'all_approved is now true');
console.log('✓ Second participant approval arms the pact.');

// 4. Invariant: Editing pact rules increments version and invalidates prior approvals
const updated = PactService.updatePactRules(pactId, mayaId, {
  fallback_text: 'Switch to remote Google Meet and cancel cab',
  participant_limits: [
    { user_id: mayaId, max_duration_s: 4200 }, // 70 min
    { user_id: arjunId, max_duration_s: 3600 },
  ],
});

assert.strictEqual(updated.version, 2, 'Version incremented to 2');
assert.strictEqual(updated.status, 'draft', 'Status reverted to draft after rule change');
assert.strictEqual(updated.all_approved, false, 'Approvals invalidated');

const mayaUpdated = updated.participants.find((p) => p.user_id === mayaId);
const arjunUpdated = updated.participants.find((p) => p.user_id === arjunId);
assert(mayaUpdated, 'Maya participant exists');
assert(arjunUpdated, 'Arjun participant exists');
assert.strictEqual(mayaUpdated.max_duration_s, 4200, 'Maya limit updated');
assert.strictEqual(arjunUpdated.max_duration_s, 3600, 'Arjun limit preserved');
assert.strictEqual(mayaUpdated.approval_version, null, 'Maya approval cleared');
assert.strictEqual(arjunUpdated.approval_version, null, 'Arjun approval cleared');
console.log('✓ Rule edit successfully incremented version, reset status, and invalidated all approvals.');

// Cleanup test pact
db.prepare('DELETE FROM pacts WHERE id = ?').run(pactId);

// 5. Venue search contract test
const venues = await VenueService.searchVenues('Bellandur');
assert(venues.length > 0, 'Venues found');
for (const v of venues) {
  assert(typeof v.title === 'string', 'Title exists');
  assert(typeof v.place_id === 'string', 'place_id exists');
  assert(typeof v.gps_coordinates.latitude === 'number', 'Latitude is valid number');
  assert(typeof v.gps_coordinates.longitude === 'number', 'Longitude is valid number');
  assert(!('available_desks' in v), 'Never claims desk inventory');
  assert(!('wifi_speed' in v), 'Never claims wifi inventory');
}
console.log('✓ Venue search conforms to field contract with valid coordinates and no fake availability.');

console.log('--- ALL DOMAIN INVARIANT TESTS PASSED ---');
