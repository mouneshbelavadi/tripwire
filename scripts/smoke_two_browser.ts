import http from 'http';
import puppeteer, { Browser } from 'puppeteer-core';
import { app } from '../src/server/app.js';
import { getDb } from '../src/server/db.js';

const PORT = 3457;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runTwoBrowserSmokeTest() {
  console.log('====================================================');
  console.log(' Phase 8: Two-Browser End-to-End Smoke Test');
  console.log('====================================================\n');

  // 1. Start Server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`✓ Ephemeral test server listening on ${BASE_URL}`);

  let browser: Browser | null = null;

  try {
    // 2. Test Server-Side Authorization Invariants
    console.log('\n--- Step 1: Server-Side Authorization Enforcement ---');
    
    // Test unauthenticated/spoofed identity on /api/pacts
    const hackPactsRes = await fetch(`${BASE_URL}/api/pacts`, {
      headers: { 'x-user-id': 'unauthorized_stranger' },
    });
    if (hackPactsRes.status !== 403) {
      throw new Error(`Expected 403 for unauthorized stranger on /api/pacts, got ${hackPactsRes.status}`);
    }
    console.log('✓ Rejected unauthorized stranger on /api/pacts with 403 Forbidden.');

    // Test unauthenticated/spoofed identity on /api/chat/token
    const hackTokenRes = await fetch(`${BASE_URL}/api/chat/token`, {
      method: 'POST',
      headers: { 'x-user-id': 'unauthorized_stranger' },
    });
    if (hackTokenRes.status !== 403) {
      throw new Error(`Expected 403 for unauthorized stranger on /api/chat/token, got ${hackTokenRes.status}`);
    }
    console.log('✓ Rejected unauthorized stranger on /api/chat/token with 403 Forbidden.');

    // Test unauthorized approval attempt
    const hackApproveRes = await fetch(`${BASE_URL}/api/pacts/pact_bellandur_01/approve`, {
      method: 'POST',
      headers: { 'x-user-id': 'unauthorized_stranger' },
    });
    if (hackApproveRes.status !== 403) {
      throw new Error(`Expected 403 for unauthorized approve attempt, got ${hackApproveRes.status}`);
    }
    console.log('✓ Rejected unauthorized approve attempt with 403 Forbidden.');

    // 3. Launch Headless Chrome
    console.log('\n--- Step 2: Launching Two Separate Browser Sessions ---');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });

    const pageMaya = await browser.newPage();
    const pageArjun = await browser.newPage();

    await pageMaya.setViewport({ width: 1440, height: 900 });
    await pageArjun.setViewport({ width: 1440, height: 900 });

    // Reset pact state to draft for clean test
    await fetch(`${BASE_URL}/api/simulation/state/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'draft' }),
    });

    // 4. Load Maya's session
    console.log('\n--- Step 3: Maya (Indiranagar) Draft Session ---');
    await pageMaya.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await pageMaya.select('#user-select', 'user_maya');
    await new Promise((r) => setTimeout(r, 600));

    const mayaSelectedUser = await pageMaya.$eval('#user-select', (el: any) => el.value);
    console.log(`✓ Session A active identity: ${mayaSelectedUser}`);

    // Maya approves pact v1
    console.log('  Maya clicking primary approve button...');
    await pageMaya.evaluate(() => {
      const btn = document.querySelector('button.btn-primary') as HTMLButtonElement;
      if (btn) btn.click();
    });
    console.log('  Maya clicked button, waiting 1000ms...');
    await new Promise((r) => setTimeout(r, 1000));

    // Verify Maya's approval recorded and pact is in 'awaiting_approval'
    console.log('  Checking pact status from API...');
    const res = await fetch(`${BASE_URL}/api/pacts/pact_bellandur_01`, {
      headers: { 'x-user-id': 'user_maya' },
    });
    console.log('  API response received, parsing json...');
    const pactStateAfterMaya = await res.json();
    console.log('  Pact status after Maya approve:', pactStateAfterMaya.pact?.status);
    if (pactStateAfterMaya.pact.status !== 'awaiting_approval') {
      throw new Error(`Expected pact status awaiting_approval, got ${pactStateAfterMaya.pact.status}`);
    }
    console.log('✓ Maya approval recorded. Status: awaiting_approval (1/2 approvals).');

    // 5. Load Arjun's session
    console.log('\n--- Step 4: Arjun (HSR Layout) Approves Pact ---');
    await pageArjun.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await pageArjun.select('#user-select', 'user_arjun');
    await new Promise((r) => setTimeout(r, 600));

    const arjunSelectedUser = await pageArjun.$eval('#user-select', (el: any) => el.value);
    console.log(`✓ Session B active identity: ${arjunSelectedUser}`);

    // Arjun sees Maya has approved v1
    const mayaApprovalBadge = await pageArjun.$$eval('.participant-card', (cards) => {
      const mayaCard = cards.find((c) => c.textContent?.includes('Maya'));
      return mayaCard ? mayaCard.querySelector('.approval-tag')?.textContent : null;
    });
    console.log(`✓ Arjun sees Maya approval status: "${mayaApprovalBadge?.trim()}"`);

    // Arjun approves pact v1
    console.log('  Arjun clicking primary approve button...');
    await pageArjun.evaluate(() => {
      const btn = document.querySelector('button.btn-primary') as HTMLButtonElement;
      if (btn) btn.click();
    });
    console.log('  Arjun clicked button, waiting 1000ms...');
    await new Promise((r) => setTimeout(r, 1000));

    // Verify pact is now ARMED
    const armedPactRes = await fetch(`${BASE_URL}/api/pacts/pact_bellandur_01`, {
      headers: { 'x-user-id': 'user_arjun' },
    });
    const armedPact = await armedPactRes.json();
    if (armedPact.pact.status !== 'armed') {
      throw new Error(`Expected pact status armed, got ${armedPact.pact.status}`);
    }
    console.log('✓ Both participants approved version 1. Pact is now ARMED.');

    // 6. Controlled Breach Simulation & Alert Receipt
    console.log('\n--- Step 5: Controlled Breach Simulation & Receipt Inspection ---');
    const breachRes = await (await fetch(`${BASE_URL}/api/simulation/trigger-breach`, { method: 'POST' })).json();
    console.log(`✓ Breach triggered: ${breachRes.message}`);
    console.log(`  Breach result: step1=${breachRes.step1?.outcome}, step2=${breachRes.step2?.outcome}, alertId=${breachRes.step2?.alertId}`);

    // Reload both browser sessions to receive fresh state
    await pageMaya.reload({ waitUntil: 'networkidle0' });
    await pageArjun.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Verify Evidence Receipt with BREACH RECEIPT badge appears in both browsers
    const mayaReceiptBadge = await pageMaya.$eval('.receipt-alert-badge', (el) => el.textContent);
    const arjunReceiptBadge = await pageArjun.$eval('.receipt-alert-badge', (el) => el.textContent);
    console.log(`✓ Session A Receipt Badge: ${mayaReceiptBadge?.trim()}`);
    console.log(`✓ Session B Receipt Badge: ${arjunReceiptBadge?.trim()}`);

    if (!mayaReceiptBadge?.includes('BREACH')) {
      throw new Error(`Maya receipt did not display breach badge, was: ${mayaReceiptBadge}`);
    }

    // 7. Cross-Session Decision Synchronization
    console.log('\n--- Step 6: Cross-Session Bilateral Decision ---');
    // In Arjun's browser, Arjun selects "Switch to Remote"
    console.log('  Arjun clicking "Switch to Remote" button...');
    const arjunRemoteClicked = await pageArjun.evaluate(() => {
      const btn = document.querySelector('.decision-buttons-row button.btn-primary') as HTMLButtonElement;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!arjunRemoteClicked) {
      throw new Error('Arjun could not find "Switch to Remote" button in .decision-buttons-row');
    }
    await new Promise((r) => setTimeout(r, 1200));
    console.log('✓ Arjun clicked "Switch to Remote". Decision recorded.');

    // Reload Maya's page to observe Arjun's recorded decision
    await pageMaya.reload({ waitUntil: 'networkidle0' });
    await pageMaya.select('#user-select', 'user_maya');
    await new Promise((r) => setTimeout(r, 800));

    const arjunDecisionInMayaView = await pageMaya.$eval('.acknowledgements-table', (el) => el.textContent);
    console.log(`✓ Maya views acknowledgements table: "${arjunDecisionInMayaView?.trim()}"`);

    if (!arjunDecisionInMayaView?.includes('Arjun') || !arjunDecisionInMayaView?.includes('Remote')) {
      throw new Error(`Arjun decision not visible in Maya session: ${arjunDecisionInMayaView}`);
    }

    // In Maya's browser, Maya also selects "Switch to Remote"
    console.log('  Maya clicking "Switch to Remote" button...');
    const mayaRemoteClicked = await pageMaya.evaluate(() => {
      const btn = document.querySelector('.decision-buttons-row button.btn-primary') as HTMLButtonElement;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (mayaRemoteClicked) {
      await new Promise((r) => setTimeout(r, 1200));
      console.log('✓ Maya clicked "Switch to Remote". Bilateral remote consensus reached.');
    }

    // Verify decisions in SQLite DB
    const db = getDb();
    const acks = db.prepare('SELECT user_id, decision FROM acknowledgements').all() as any[];
    console.log(`✓ Database records ${acks.length} bilateral decision entries:`, acks);
    if (acks.length < 2) {
      throw new Error(`Expected at least 2 bilateral acknowledgements, found ${acks.length}`);
    }

    console.log('\n====================================================');
    console.log(' ✓ TWO-BROWSER SMOKE TEST PASSED (All assertions met)');
    console.log('====================================================');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTwoBrowserSmokeTest().catch((err) => {
  console.error('Fatal two-browser smoke test error:', err);
  process.exit(1);
});
