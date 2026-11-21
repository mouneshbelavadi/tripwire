import assert from 'assert';
import { app } from '../app.js';
import http from 'http';

console.log('--- Running Phase 3 In-App Team Channel Auth & Contract Tests ---');

const server = http.createServer(app);

server.listen(3097, async () => {
  try {
    // 1. Status endpoint check
    const statusRes = await fetch('http://localhost:3097/api/chat/status');
    const statusData = (await statusRes.json()) as any;
    assert.strictEqual(statusData.packageVersions.chat, '26.5.1');
    assert.strictEqual(statusData.packageVersions.engine, '26.5.1');
    assert.strictEqual(statusData.channelId, 'group_office_pact');
    assert.strictEqual(statusData.configured, false, 'Honest unconfigured status');
    assert.strictEqual(statusData.integrationState, 'incomplete_credentials_missing');
    console.log('✓ /api/chat/status verified: Reports exact package versions and incomplete sponsor track.');

    // 2. Authorization check: Stranger rejected
    const strangerRes = await fetch('http://localhost:3097/api/chat/token', {
      method: 'POST',
      headers: { 'x-user-id': 'user_stranger' },
    });
    assert.strictEqual(strangerRes.status, 403);
    const strangerData = (await strangerRes.json()) as any;
    assert(strangerData.error.includes('Forbidden'));
    console.log('✓ /api/chat/token: Unauthorized user rejected with 403 Forbidden.');

    // 3. Authorized user with unconfigured keys check
    const mayaRes = await fetch('http://localhost:3097/api/chat/token', {
      method: 'POST',
      headers: { 'x-user-id': 'user_maya' },
    });
    // Invariant: Missing credentials MUST return 503 incomplete; never fake a token
    assert.strictEqual(mayaRes.status, 503);
    const mayaData = (await mayaRes.json()) as any;
    assert.strictEqual(mayaData.status, 'incomplete');
    assert.strictEqual(mayaData.sponsorIntegration, 'incomplete');
    assert.strictEqual(mayaData.configured, false);
    assert.strictEqual(mayaData.member.user_id, 'user_maya');
    assert.strictEqual(mayaData.member.nex_user_id, 'nex_maya');
    console.log('✓ /api/chat/token: Missing credentials honest failure verified (sponsorIntegration: incomplete).');

    // 4. Arjun identity check
    const arjunRes = await fetch('http://localhost:3097/api/chat/token', {
      method: 'POST',
      headers: { 'x-user-id': 'user_arjun' },
    });
    assert.strictEqual(arjunRes.status, 503);
    const arjunData = (await arjunRes.json()) as any;
    assert.strictEqual(arjunData.member.user_id, 'user_arjun');
    assert.strictEqual(arjunData.member.nex_user_id, 'nex_arjun');
    console.log('✓ /api/chat/token: Arjun identity derived cleanly from server session.');

    console.log('--- ALL IN-APP TEAM CHANNEL AUTH & CONTRACT TESTS PASSED ---');
    server.close();
  } catch (err) {
    console.error('Test failure:', err);
    server.close();
    process.exitCode = 1;
  }
});
