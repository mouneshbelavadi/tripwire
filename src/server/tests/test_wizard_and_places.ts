import assert from 'assert';
import http from 'http';
import { app } from '../app.js';
import { createPactSchema } from '../schemas/pactValidation.js';
import {
  destinationStepSchema,
  participantsStepSchema,
  rulesStepSchema,
  fullWizardSchema,
} from '../../client/schemas/wizardValidation.js';

console.log('--- Running Wizard & Places Autocomplete Integration Tests ---');

// 1. Test Client Zod Schemas
console.log('1. Testing Client Zod Schemas...');

const validDestination = {
  title: 'Bellandur In-Person Session',
  destination_name: 'WeWork Bellandur',
  destination_place_id: 'ChIJk7Q3BqcUrzsR-q3Qe-place-01',
  destination_address: 'Outer Ring Rd, Bellandur, Bengaluru',
  destination_lat: 12.9290,
  destination_lon: 77.6760,
};
const destResult = destinationStepSchema.safeParse(validDestination);
assert.strictEqual(destResult.success, true, 'Valid destination passes client schema');

const invalidDestLat = {
  ...validDestination,
  destination_lat: 120.0, // Invalid latitude (> 90)
};
const invalidDestResult = destinationStepSchema.safeParse(invalidDestLat);
assert.strictEqual(invalidDestResult.success, false, 'Invalid latitude (>90) rejected by client schema');

const validParticipants = {
  participants: [
    {
      user_id: 'user_maya',
      user_name: 'Maya',
      neighbourhood: 'Indiranagar',
      origin_lat: 12.9784,
      origin_lon: 77.6408,
      commute_limit_min: 60,
    },
    {
      user_id: 'user_arjun',
      user_name: 'Arjun',
      neighbourhood: 'HSR Layout',
      origin_lat: 12.9121,
      origin_lon: 77.6446,
      commute_limit_min: 45,
    },
  ],
};
const partResult = participantsStepSchema.safeParse(validParticipants);
assert.strictEqual(partResult.success, true, 'Valid participants pass client schema');

// Commute limit must be 20 to 120 and step 5
const invalidLimit = {
  participants: [
    {
      user_id: 'user_maya',
      user_name: 'Maya',
      neighbourhood: 'Indiranagar',
      origin_lat: 12.9784,
      origin_lon: 77.6408,
      commute_limit_min: 15, // < 20 min
    },
  ],
};
assert.strictEqual(participantsStepSchema.safeParse(invalidLimit).success, false, 'Limit < 20 min rejected');

const nonStep5Limit = {
  participants: [
    {
      user_id: 'user_maya',
      user_name: 'Maya',
      neighbourhood: 'Indiranagar',
      origin_lat: 12.9784,
      origin_lon: 77.6408,
      commute_limit_min: 47, // not multiple of 5
    },
  ],
};
assert.strictEqual(participantsStepSchema.safeParse(nonStep5Limit).success, false, 'Non-step-5 limit rejected');

// Future deadline validation
const futureDate = new Date(Date.now() + 24 * 3600 * 1000);
const futureIso = futureDate.toISOString();
const validRules = {
  deadline_date: futureIso.split('T')[0],
  deadline_time: '09:30',
  decision_deadline_ist: '09:30 IST · Tomorrow',
  decision_deadline_utc: futureIso,
  fallback_text: 'Switch to Google Meet',
};
assert.strictEqual(rulesStepSchema.safeParse(validRules).success, true, 'Future rules deadline passes');

const pastIso = new Date(Date.now() - 3600 * 1000).toISOString();
const pastRules = {
  ...validRules,
  decision_deadline_utc: pastIso,
};
assert.strictEqual(rulesStepSchema.safeParse(pastRules).success, false, 'Past deadline rejected by client schema');

// Full wizard schema
const fullPayload = {
  ...validDestination,
  ...validParticipants,
  ...validRules,
};
assert.strictEqual(fullWizardSchema.safeParse(fullPayload).success, true, 'Full wizard schema passes');
console.log('✓ All Client Zod schemas verified.');

// 2. Test Server Zod Schemas
console.log('2. Testing Server Zod Schemas...');
const serverValidPact = {
  title: 'Sarjapur Office Meetup',
  destination_name: 'WeWork Bellandur',
  destination_lat: 12.9290,
  destination_lon: 77.6760,
  fallback_text: 'Switch to Google Meet',
  participant_limits: [
    { user_id: 'user_maya', max_duration_s: 3600 },
    { user_id: 'user_arjun', max_duration_s: 2700 },
  ],
};
assert.strictEqual(createPactSchema.safeParse(serverValidPact).success, true, 'Server createPactSchema accepts valid pact');

const serverInvalidLat = {
  ...serverValidPact,
  destination_lat: 100, // Invalid lat
};
assert.strictEqual(createPactSchema.safeParse(serverInvalidLat).success, false, 'Server createPactSchema rejects invalid lat');
console.log('✓ All Server Zod schemas verified.');

// 3. Test HTTP Endpoints on Server
const server = http.createServer(app);
server.listen(3099, async () => {
  try {
    console.log('3. Testing GET /api/places/autocomplete...');
    const autoRes = await fetch('http://localhost:3099/api/places/autocomplete?q=bellandur');
    // When credits are exhausted (cap >= 40), it returns 429 with fallback; otherwise 200 with places
    if (autoRes.status === 429) {
      const autoData = (await autoRes.json()) as any;
      assert.strictEqual(autoData.budgetExhausted, true, 'Budget exhausted flag is true on 429');
      assert(Array.isArray(autoData.fallback), 'Fallback suggestions array returned');
      assert(autoData.fallback.length > 0, 'Fallback list has verified places');
      assert(typeof autoData.fallback[0].gps_coordinates.latitude === 'number', 'Coordinates present in fallback');
      console.log(`✓ GET /api/places/autocomplete budget guard triggered (429 with ${autoData.fallback.length} fallback suggestions).`);
    } else {
      assert.strictEqual(autoRes.status, 200, 'GET /api/places/autocomplete returns 200');
      const autoData = (await autoRes.json()) as any;
      assert(Array.isArray(autoData.places), 'Returns places array');
      assert(autoData.places.length > 0, 'Contains places');
      console.log(`✓ GET /api/places/autocomplete returned ${autoData.places.length} results.`);
    }

    // Test POST /api/pacts validation failure on invalid coordinates
    console.log('4. Testing server validation errors...');
    const invalidReq = await fetch('http://localhost:3099/api/pacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_maya',
      },
      body: JSON.stringify({
        title: 'Bad Coordinates Pact',
        destination_name: 'Out of Range Hub',
        destination_lat: 150.0, // > 90
        destination_lon: 200.0, // > 180
      }),
    });
    assert.strictEqual(invalidReq.status, 400, 'Invalid coordinates return 400 Bad Request');
    const errData = (await invalidReq.json()) as any;
    assert.strictEqual(errData.error, 'Validation failed');
    assert(Array.isArray(errData.details), 'Details contain zod issues');
    console.log('✓ Server Zod validation correctly rejected invalid coordinates with 400 Bad Request.');

    // Test POST /api/pacts with "request_approvals: true"
    console.log('5. Testing Wizard Pact Creation (request_approvals: true)...');
    const wizardReq = await fetch('http://localhost:3099/api/pacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_maya',
      },
      body: JSON.stringify({
        title: 'Bellandur Friday Strategy',
        destination_name: 'WeWork Bellandur (Prestige Tech Park)',
        destination_place_id: 'ChIJk7Q3BqcUrzsR-q3Qe-place-01',
        destination_address: 'Prestige Tech Park, Bellandur, Bengaluru',
        destination_lat: 12.9290,
        destination_lon: 77.6760,
        decision_deadline_ist: '09:30 IST · Tomorrow',
        decision_deadline_utc: futureIso,
        fallback_text: 'Switch to Google Meet',
        request_approvals: true,
        participant_limits: [
          {
            user_id: 'user_maya',
            user_name: 'Maya',
            neighbourhood: 'Indiranagar',
            origin_lat: 12.9784,
            origin_lon: 77.6408,
            max_duration_s: 3600,
          },
          {
            user_id: 'user_arjun',
            user_name: 'Arjun',
            neighbourhood: 'HSR Layout',
            origin_lat: 12.9121,
            origin_lon: 77.6446,
            max_duration_s: 3000,
          },
        ],
      }),
    });

    assert.strictEqual(wizardReq.status, 201, 'POST /api/pacts returns 201 Created');
    const wizardData = (await wizardReq.json()) as any;
    assert.strictEqual(wizardData.pact.status, 'awaiting_approval', 'Pact status is awaiting_approval when requested');
    assert.strictEqual(wizardData.pact.participants.length, 2);
    const mayaP = wizardData.pact.participants.find((p: any) => p.user_id === 'user_maya');
    const arjunP = wizardData.pact.participants.find((p: any) => p.user_id === 'user_arjun');
    assert.strictEqual(mayaP.max_duration_s, 3600);
    assert.strictEqual(arjunP.max_duration_s, 3000);
    console.log('✓ Wizard pact created with awaiting_approval status and custom limits.');

    console.log('\n--- ALL WIZARD & PLACES AUTOCOMPLETE TESTS PASSED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Test failure:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
