import assert from 'assert';
import { app } from '../app.js';
import http from 'http';

async function testPrompt7() {
  console.log('--- Starting Prompt 7 Requirements Verification ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3099, resolve));

  const baseUrl = 'http://localhost:3099';

  try {
    // 1. Verify /api/usage/summary
    console.log('1. Testing GET /api/usage/summary...');
    const usageRes = await fetch(`${baseUrl}/api/usage/summary`);
    assert.strictEqual(usageRes.status, 200, 'Usage endpoint status 200');
    const usageData = (await usageRes.json()) as any;

    assert(usageData.budget, 'Budget data exists');
    assert.strictEqual(usageData.budget.ceiling, 40, 'Budget ceiling is 40');
    assert(typeof usageData.budget.spent === 'number', 'Spent is number');
    assert(typeof usageData.budget.remaining === 'number', 'Remaining is number');

    assert(usageData.projection, 'Projection data exists');
    assert(typeof usageData.projection.totalProjected24h === 'number', 'Projected 24h is number');
    assert(Array.isArray(usageData.projection.breakdown), 'Projection breakdown is array');

    assert(usageData.worker, 'Worker data exists');
    assert(['ACTIVE', 'EXPIRED', 'IDLE'].includes(usageData.worker.leaseStatus), 'Worker lease status valid');
    assert(usageData.worker.holderId, 'Worker holder ID exists');

    assert(usageData.serpApiAccount, 'SerpApi account status exists');
    assert(usageData.serpApiAccount.configured, 'SerpApi is configured');
    assert(typeof usageData.serpApiAccount.totalSearchesLeft === 'number', 'Total searches remaining is number');

    assert(Array.isArray(usageData.ledger), 'Credit ledger is array');
    assert(Array.isArray(usageData.outboxLog), 'Outbox log is array');
    console.log('✓ /api/usage/summary verified successfully:');
    console.log(`  - Spent: ${usageData.budget.spent}/40 credits`);
    console.log(`  - Projected 24h: ${usageData.projection.totalProjected24h} credits across ${usageData.projection.activeWatchesCount} watches`);
    console.log(`  - Worker Lease: ${usageData.worker.leaseStatus} (ID: ${usageData.worker.holderId.slice(0, 15)}...)`);
    console.log(`  - SerpApi Searches Left: ${usageData.serpApiAccount.totalSearchesLeft} (${usageData.serpApiAccount.planName})`);
    console.log(`  - Ledger entries: ${usageData.ledger.length}, Outbox rows: ${usageData.outboxLog.length}`);

    // 2. Verify /api/notifications
    console.log('\n2. Testing GET /api/notifications...');
    const notifsRes = await fetch(`${baseUrl}/api/notifications`);
    assert.strictEqual(notifsRes.status, 200, 'Notifications endpoint status 200');
    const notifsData = (await notifsRes.json()) as any;
    assert(Array.isArray(notifsData.notifications), 'Notifications is array');
    console.log(`✓ /api/notifications verified successfully: returned ${notifsData.notifications.length} notifications`);

    // 3. Verify /api/simulation/status
    console.log('\n3. Testing GET /api/simulation/status...');
    const simStatusRes = await fetch(`${baseUrl}/api/simulation/status`);
    assert.strictEqual(simStatusRes.status, 200, 'Simulation status 200');
    const simStatus = (await simStatusRes.json()) as any;
    assert('isSimulationActive' in simStatus, 'isSimulationActive field present');
    console.log(`✓ /api/simulation/status verified: isSimulationActive = ${simStatus.isSimulationActive}`);

    // 4. Trigger Synthetic 2-Breach in Demo Lab
    console.log('\n4. Testing POST /api/simulation/trigger-breach...');
    const breachRes = await fetch(`${baseUrl}/api/simulation/trigger-breach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pact_id: 'pact_bellandur_01', user_id: 'user_maya' }),
    });
    assert.strictEqual(breachRes.status, 200, 'Trigger breach status 200');
    const breachData = (await breachRes.json()) as any;
    assert.strictEqual(breachData.step1.outcome, 'confirming', 'Step 1 outcome is confirming (1/2)');
    assert.strictEqual(breachData.step2.outcome, 'alert', 'Step 2 outcome is alert (2/2)');
    assert.strictEqual(breachData.step2.alertCreated, true, 'Alert created is true');
    console.log('✓ 2-breach sequence generated alert cleanly:');
    console.log(`  - Step 1: ${breachData.step1.durationMinutes}m -> ${breachData.step1.outcome}`);
    console.log(`  - Step 2: ${breachData.step2.durationMinutes}m -> ${breachData.step2.outcome} (AlertId: ${breachData.step2.alertId})`);

    // 5. Test Duplicate Replay
    console.log('\n5. Testing POST /api/simulation/replay-dedup...');
    const replayRes = await fetch(`${baseUrl}/api/simulation/replay-dedup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pact_id: 'pact_bellandur_01', user_id: 'user_maya' }),
    });
    assert.strictEqual(replayRes.status, 200, 'Replay status 200');
    const replayData = (await replayRes.json()) as any;
    assert.strictEqual(replayData.outcome, 'duplicate_or_old', 'Duplicate rejected as duplicate_or_old');
    console.log(`✓ Duplicate replay rejected as expected: outcome = ${replayData.outcome}`);

    // 6. Test Simulation Status after Breach
    console.log('\n6. Checking simulation status after synthetic breach...');
    const simStatusAfter = (await (await fetch(`${baseUrl}/api/simulation/status`)).json()) as any;
    assert.strictEqual(simStatusAfter.isSimulationActive, true, 'isSimulationActive is true after breach');
    console.log('✓ isSimulationActive is true, amber banner will be visible globally.');

    // 7. Test Reset Demo Data
    console.log('\n7. Testing POST /api/simulation/reset...');
    const resetRes = await fetch(`${baseUrl}/api/simulation/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pact_id: 'pact_bellandur_01' }),
    });
    assert.strictEqual(resetRes.status, 200, 'Reset status 200');
    const resetData = (await resetRes.json()) as any;
    assert.strictEqual(resetData.isSimulationActive, false, 'Reset clears isSimulationActive');

    const simStatusAfterReset = (await (await fetch(`${baseUrl}/api/simulation/status`)).json()) as any;
    assert.strictEqual(simStatusAfterReset.isSimulationActive, false, 'Status after reset is false');
    console.log('✓ Demo data reset cleanly, isSimulationActive is false, amber banner dismissed.');

    console.log('\n--- ALL PROMPT 7 BACKEND & API TESTS PASSED! ---');
  } finally {
    server.close();
  }
}

testPrompt7().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
