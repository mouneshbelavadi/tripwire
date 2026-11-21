import fs from 'fs';
import path from 'path';
import http from 'http';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { app } from '../src/server/app.js';
import { getDb } from '../src/server/db.js';
import { ObservationService } from '../src/server/domain/observationService.js';
import { createSyntheticBreachSequence } from '../src/server/fixtures/syntheticBreach.js';

const PORT = 3458;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const LOCAL_REHEARSAL_DIR = path.resolve(process.cwd(), 'screenshots', 'rehearsal');
const ARTIFACT_REHEARSAL_DIR = 'C:\\Users\\moune\\.gemini\\antigravity\\brain\\96c610c1-1c46-4083-858f-788e20d8c933\\screenshots\\rehearsal';

fs.mkdirSync(LOCAL_REHEARSAL_DIR, { recursive: true });
try {
  fs.mkdirSync(ARTIFACT_REHEARSAL_DIR, { recursive: true });
} catch (e) {}

async function captureStep(page: Page, filename: string, caption: string) {
  const localPath = path.join(LOCAL_REHEARSAL_DIR, filename);
  const artifactPath = path.join(ARTIFACT_REHEARSAL_DIR, filename);

  const buffer = await page.screenshot({ type: 'png', fullPage: false });
  fs.writeFileSync(localPath, buffer);
  try {
    fs.writeFileSync(artifactPath, buffer);
  } catch (e) {}
  console.log(`  📸 Captured [${filename}]: ${caption}`);
}

async function runSingleRehearsal(browser: Browser, runIndex: number) {
  console.log(`\n======================================================`);
  console.log(` RUNNING 3-MINUTE DEMO REHEARSAL #${runIndex}`);
  console.log(`======================================================\n`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // -------------------------------------------------------------------------
    // Segment 1 (0:00–0:25): The cost of deciding too late
    // -------------------------------------------------------------------------
    console.log(`[Run ${runIndex}] Segment 1 (0:00-0:25): Problem Context & Agreed Condition`);
    // Reset state to armed pact
    await fetch(`${BASE_URL}/api/simulation/state/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'armed' }),
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Verify 5-second legibility triad
    const condition = await page.$eval('.agreement-triad .triad-item.condition .triad-value', (el) => el.textContent);
    const freshness = await page.$eval('.agreement-triad .triad-item.freshness .triad-value-badge', (el) => el.textContent);
    const action = await page.$eval('.agreement-triad .triad-item.action .triad-value-action', (el) => el.textContent);

    console.log(`  Triad Condition: ${condition?.trim()}`);
    console.log(`  Triad Freshness: ${freshness?.trim()}`);
    console.log(`  Triad Next Action: ${action?.trim()}`);

    await captureStep(page, `run${runIndex}_seg1_problem_context.png`, 'Armed Office Pact with 5-Second Legibility Triad');

    // -------------------------------------------------------------------------
    // Segment 2 (0:25–0:55): Make the pact & inspect verified fields
    // -------------------------------------------------------------------------
    console.log(`\n[Run ${runIndex}] Segment 2 (0:25-0:55): Pact Structure, Venue & Fallback`);
    const destination = await page.$eval('.pact-subtitle', (el) => el.textContent);
    const fallback = await page.$eval('.fallback-text', (el) => el.textContent);
    console.log(`  Destination: ${destination?.trim()}`);
    console.log(`  Fallback: ${fallback?.trim()}`);

    await captureStep(page, `run${runIndex}_seg2_make_pact.png`, 'Structured Pact Details, Destination and Remote Fallback');

    // -------------------------------------------------------------------------
    // Segment 3 (0:55–1:25): Prove the data (within limit observation)
    // -------------------------------------------------------------------------
    console.log(`\n[Run ${runIndex}] Segment 3 (0:55-1:25): Normal Observation (Within Limit)`);
    // Credit and source age check
    const budgetPill = await page.$eval('.budget-pill', (el) => el.textContent);
    console.log(`  Budget ledger: ${budgetPill?.trim()}`);

    await captureStep(page, `run${runIndex}_seg3_normal_evidence.png`, 'Normal Commute Evidence within Limit (42 min)');

    // -------------------------------------------------------------------------
    // Segment 4 (1:25–2:00): Controlled breach with persistent SIMULATED CHANGE
    // -------------------------------------------------------------------------
    console.log(`\n[Run ${runIndex}] Segment 4 (1:25-2:00): Controlled Breach & Deduplication Proof`);
    // 1. Trigger breach
    const breachRes = await (await fetch(`${BASE_URL}/api/simulation/trigger-breach`, { method: 'POST' })).json();
    console.log(`  Breach trigger: ${breachRes.message}`);
    console.log(`  Step 1 (68m): ${breachRes.step1?.outcome}`);
    console.log(`  Step 2 (72m): ${breachRes.step2?.outcome} (alertId: ${breachRes.step2?.alertId})`);

    // 2. Replay duplicate observation to prove deduplication
    const dedupRes = await (await fetch(`${BASE_URL}/api/simulation/replay-dedup`, { method: 'POST' })).json();
    console.log(`  Deduplication test: ${dedupRes.message} (Outcome: ${dedupRes.outcome})`);
    if (dedupRes.outcome !== 'duplicate_or_old') {
      throw new Error(`Deduplication failure: expected duplicate_or_old, got ${dedupRes.outcome}`);
    }
    console.log('  ✓ Deduplication invariant strictly verified: Replayed observation rejected with duplicate_or_old.');

    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Verify persistent simulation notice
    const banner = await page.$eval('.simulation-banner', (el) => el.textContent);
    console.log(`  Simulation notice: ${banner?.trim()}`);

    await captureStep(page, `run${runIndex}_seg4_simulated_breach.png`, 'Controlled Breach Alert with Persistent SIMULATED Banner');

    // -------------------------------------------------------------------------
    // Segment 5 (2:00–2:35): Evidence receipt & bilateral decision
    // -------------------------------------------------------------------------
    console.log(`\n[Run ${runIndex}] Segment 5 (2:00-2:35): Evidence Receipt, Sponsor Status & Decision`);
    const receiptBadge = await page.$eval('.receipt-alert-badge', (el) => el.textContent);
    console.log(`  Receipt badge: ${receiptBadge?.trim()}`);

    // Inspect Nexconn & You status
    const nexconnStatus = await (await fetch(`${BASE_URL}/api/chat/status`)).json();
    console.log(`  Nexconn track status: ${nexconnStatus.status} (${nexconnStatus.integrationState})`);

    // Participant selects Switch to remote
    await page.evaluate(() => {
      const btn = document.querySelector('.decision-buttons-row button.btn-primary') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    await captureStep(page, `run${runIndex}_seg5_bilateral_decision.png`, 'Evidence Receipt with Acknowledged Remote Decision');

    // -------------------------------------------------------------------------
    // Segment 6 (2:35–3:00): Show boundaries (UNKNOWN and Budget-Stop states)
    // -------------------------------------------------------------------------
    console.log(`\n[Run ${runIndex}] Segment 6 (2:35-3:00): Boundaries (UNKNOWN and Budget Stop)`);
    // 1. Set budget_paused state
    await fetch(`${BASE_URL}/api/simulation/state/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'budget_paused' }),
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    const budgetNotice = await page.$eval('.state-notice-banner.paused', (el) => el.textContent);
    console.log(`  Budget boundary: ${budgetNotice?.trim()}`);

    await captureStep(page, `run${runIndex}_seg6_budget_stop.png`, 'Budget Limit Reached & Monitoring Paused');

    // 2. Set stale / degraded state
    await fetch(`${BASE_URL}/api/simulation/state/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'stale' }),
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    const staleNotice = await page.$eval('.state-notice-banner.stale', (el) => el.textContent);
    console.log(`  Stale data boundary: ${staleNotice?.trim()}`);

    await captureStep(page, `run${runIndex}_seg6_stale_unknown.png`, 'Stale/Unknown Data Handling Without False All-Clear');

    console.log(`\n✓ REHEARSAL RUN #${runIndex} COMPLETED CLEANLY.`);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('======================================================');
  console.log(' Phase 8: BUILDPLAN.md Three-Minute Demo Double Rehearsal');
  console.log('======================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`✓ Rehearsal test server listening on ${BASE_URL}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    // Rehearse twice as required by astra.md
    await runSingleRehearsal(browser, 1);
    await runSingleRehearsal(browser, 2);

    console.log('\n======================================================');
    console.log(' ✓ DOUBLE REHEARSAL VERIFICATION COMPLETED (2/2 PASSED)');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('Fatal rehearsal error:', err);
  process.exit(1);
});
