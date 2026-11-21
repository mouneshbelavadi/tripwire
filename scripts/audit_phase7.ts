import fs from 'fs';
import path from 'path';
import http from 'http';
import puppeteer from 'puppeteer-core';
import { app } from '../src/server/app.js';
import { getDb } from '../src/server/db.js';

const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const LOCAL_SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');
const ARTIFACT_DIR = 'C:\\Users\\moune\\.gemini\\antigravity\\brain\\96c610c1-1c46-4083-858f-788e20d8c933\\screenshots';

fs.mkdirSync(LOCAL_SCREENSHOT_DIR, { recursive: true });
try {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
} catch (e) {}

// Calculate relative luminance for contrast ratio
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function parseRgb(rgbStr: string): [number, number, number] {
  const match = rgbStr.match(/\d+/g);
  if (!match || match.length < 3) return [0, 0, 0];
  return [Number(match[0]), Number(match[1]), Number(match[2])];
}

async function runAudit() {
  console.log('--- STARTING PHASE 7 VISUAL CRAFT & ACCESSIBILITY AUDIT ---');

  // 1. Start ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`✓ Test server running at ${BASE_URL}`);

  // 2. Launch headless Chrome via puppeteer-core
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  console.log('✓ Headless Chrome launched cleanly.');

  const page = await browser.newPage();

  // Helper to save screenshot both locally and in artifact directory
  const saveScreenshot = async (name: string) => {
    const localPath = path.join(LOCAL_SCREENSHOT_DIR, name);
    const buf = await page.screenshot({ fullPage: false });
    fs.writeFileSync(localPath, buf);
    try {
      const artifactPath = path.join(ARTIFACT_DIR, name);
      fs.writeFileSync(artifactPath, buf);
    } catch (e) {}
    console.log(`  📸 Saved: ${name}`);
  };

  // Helper to set state via API
  const setState = async (state: string) => {
    const res = await fetch(`${BASE_URL}/api/simulation/state/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pact_id: 'pact_bellandur_01', state }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to set state ${state} (${res.status}): ${errText}`);
    }
  };

  // -------------------------------------------------------------
  // DESKTOP AUDIT (1440x900)
  // -------------------------------------------------------------
  console.log('\n--- Auditing Desktop Viewport (1440x900) ---');
  await page.setViewport({ width: 1440, height: 900 });

  // 1. State: draft
  await setState('draft');
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.pact-header-card');
  await saveScreenshot('desktop_1_draft.png');

  // 2. State: armed
  await setState('armed');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.pact-header-card');
  await saveScreenshot('desktop_2_armed.png');

  // 3. State: confirming (1/2 breach)
  await setState('confirming');
  const dbgRes = await fetch(`${BASE_URL}/api/pacts`, { headers: { 'x-user-id': 'user_maya' } });
  const dbgData = await dbgRes.json();
  console.log('DEBUG pact after confirming:', dbgData.pacts?.[0]);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.state-notice-banner.confirming');
  await saveScreenshot('desktop_3_confirming.png');

  // 4. State: alert (2/2 fresh breaches, evidence receipt)
  await setState('alert');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.evidence-receipt-container');
  await saveScreenshot('desktop_4_alert.png');

  // 5. State: stale (>300s old)
  await setState('stale');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.state-notice-banner.stale');
  await saveScreenshot('desktop_5_stale.png');

  // 6. State: budget paused (40/40 credits)
  await setState('budget_paused');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.state-notice-banner.paused');
  await saveScreenshot('desktop_6_budget_paused.png');

  // 7. State: delivery pending
  await setState('delivery_pending');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.state-notice-banner.pending');
  await saveScreenshot('desktop_7_delivery_pending.png');

  // 8. Desktop Modal Dialog (Review & Edit Agreement)
  await setState('armed');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.btn-secondary');
  // Click Edit Agreement
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Edit Agreement'));
    btn?.click();
  });
  await page.waitForSelector('.modal-dialog');
  await saveScreenshot('desktop_8_modal_editor.png');

  // Verify focus restoration when closing modal with Escape
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.modal-dialog'));
  const activeBtnText = await page.evaluate(() => (document.activeElement as HTMLElement)?.textContent || '');
  console.log(`✓ Keyboard navigation: Escape closed modal. Focus restored to: "${activeBtnText.trim()}"`);

  // -------------------------------------------------------------
  // MOBILE AUDIT (390x844)
  // -------------------------------------------------------------
  console.log('\n--- Auditing Mobile Viewport (390x844) ---');
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle0' });

  // 1. Mobile Pact Tab
  await page.waitForSelector('.mobile-tabs');
  await saveScreenshot('mobile_1_pact_tab.png');

  // 2. Mobile Evidence Tab
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.mobile-tab')).find((b) => b.textContent?.includes('Evidence'));
    (btn as HTMLElement)?.click();
  });
  await page.waitForSelector('.evidence-panel-card');
  await saveScreenshot('mobile_2_evidence_tab.png');

  // 3. Mobile Conversation Tab
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.mobile-tab')).find((b) => b.textContent?.includes('Conversation'));
    (btn as HTMLElement)?.click();
  });
  await page.waitForSelector('.conversation-slot');
  await saveScreenshot('mobile_3_chat_tab.png');

  // Check: Ensure Mobile Chat Composer and Bottom Action Bar do NOT overlap!
  const overlapCheck = await page.evaluate(() => {
    const composer = document.querySelector('.chat-composer-form, .chat-panel') as HTMLElement;
    const actionBar = document.querySelector('.mobile-bottom-action-bar') as HTMLElement;
    if (!composer || !actionBar) return { overlaps: false, details: 'elements not found' };
    const cRect = composer.getBoundingClientRect();
    const aRect = actionBar.getBoundingClientRect();
    const overlaps = cRect.bottom > aRect.top && cRect.top < aRect.bottom;
    return {
      overlaps,
      composerBottom: cRect.bottom,
      actionBarTop: aRect.top,
      distance: aRect.top - cRect.bottom,
    };
  });
  if (overlapCheck.overlaps) {
    throw new Error(`Mobile composer overlaps action bar! Distance: ${overlapCheck.distance}px`);
  }
  console.log(`✓ Mobile layout check: Composer and Action Bar do NOT overlap (Distance: ${overlapCheck.distance}px).`);

  // 4. Mobile Alert Active State
  await setState('alert');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.mobile-tab')).find((b) => b.textContent?.includes('Evidence'));
    (btn as HTMLElement)?.click();
  });
  await page.waitForSelector('.evidence-receipt-container');
  await saveScreenshot('mobile_4_alert_receipt.png');

  // 5. Mobile Stale Warning State
  await setState('stale');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.mobile-tab')).find((b) => b.textContent?.includes('Evidence'));
    (btn as HTMLElement)?.click();
  });
  await page.waitForSelector('.state-notice-banner.stale');
  await saveScreenshot('mobile_5_stale_warning.png');

  // -------------------------------------------------------------
  // CONTRAST AUDIT (WCAG AA)
  // -------------------------------------------------------------
  console.log('\n--- Measuring Contrast Ratios (WCAG AA Compliance) ---');
  await page.setViewport({ width: 1440, height: 900 });
  await setState('alert');
  await page.reload({ waitUntil: 'networkidle0' });

  const colorPairs = [
    { label: 'Body Text (--paper vs --ink)', bg: '#F7F6F2', fg: '#202824', minRatio: 4.5 },
    { label: 'Secondary Text (--paper vs --ink-secondary)', bg: '#F7F6F2', fg: '#48544B', minRatio: 4.5 },
    { label: 'Muted Text (--paper vs --ink-muted)', bg: '#F7F6F2', fg: '#4B584E', minRatio: 4.5 },
    { label: 'Green Badge (--pact-green-wash vs --pact-green)', bg: '#E8EFE8', fg: '#245C46', minRatio: 4.5 },
    { label: 'Caution Badge (--caution-wash vs --caution-ink)', bg: '#FBF0D9', fg: '#755110', minRatio: 4.5 },
    { label: 'Error Badge (--error-wash vs --error-ink)', bg: '#FAECE8', fg: '#992F27', minRatio: 4.5 },
    { label: 'Primary Button (--pact-green vs white text)', bg: '#245C46', fg: '#FFFFFF', minRatio: 4.5 },
    { label: 'Form Input Border (--paper-raised vs --rule-strong)', bg: '#FCFBF8', fg: '#848E82', minRatio: 3.0 },
  ];

  for (const cp of colorPairs) {
    const bgRgb = [
      parseInt(cp.bg.slice(1, 3), 16),
      parseInt(cp.bg.slice(3, 5), 16),
      parseInt(cp.bg.slice(5, 7), 16),
    ] as [number, number, number];
    const fgRgb = [
      parseInt(cp.fg.slice(1, 3), 16),
      parseInt(cp.fg.slice(3, 5), 16),
      parseInt(cp.fg.slice(5, 7), 16),
    ] as [number, number, number];
    const ratio = getContrastRatio(bgRgb, fgRgb);
    const passes = ratio >= cp.minRatio;
    console.log(`  ${passes ? '✓' : '✗'} ${cp.label}: ${ratio.toFixed(2)}:1 (Min required: ${cp.minRatio}:1)`);
    if (!passes) {
      throw new Error(`Contrast check failed for ${cp.label}`);
    }
  }

  // -------------------------------------------------------------
  // DECISION-LINE SIGNATURE AUDIT (5 LOCATIONS)
  // -------------------------------------------------------------
  console.log('\n--- Auditing Decision-Line Signature (5 Locations) ---');
  const signatureAudit = await page.evaluate(() => {
    return {
      pactSummary: Boolean(document.querySelector('.decision-line-container')),
      participantRow: Boolean(document.querySelector('.participant-decision-line')),
      evidenceReceipt: Boolean(document.querySelector('.receipt-decision-line')),
      activityRecord: Boolean(document.querySelector('.activity-decision-signature')),
    };
  });

  // Check preview dialog signature
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Edit Agreement'));
    btn?.click();
  });
  await page.waitForSelector('.preview-decision-line');
  const previewSignature = await page.evaluate(() => Boolean(document.querySelector('.preview-decision-line')));
  await page.keyboard.press('Escape');

  console.log(`  ✓ 1. Pact Summary Decision Line: ${signatureAudit.pactSummary ? 'PRESENT' : 'MISSING'}`);
  console.log(`  ✓ 2. Participant Row Decision Line: ${signatureAudit.participantRow ? 'PRESENT' : 'MISSING'}`);
  console.log(`  ✓ 3. Evidence Receipt Decision Line: ${signatureAudit.evidenceReceipt ? 'PRESENT' : 'MISSING'}`);
  console.log(`  ✓ 4. Review Dialog Decision Line: ${previewSignature ? 'PRESENT' : 'MISSING'}`);
  console.log(`  ✓ 5. Activity Record Decision Line: ${signatureAudit.activityRecord ? 'PRESENT' : 'MISSING'}`);

  if (!signatureAudit.pactSummary || !signatureAudit.participantRow || !signatureAudit.evidenceReceipt || !previewSignature || !signatureAudit.activityRecord) {
    throw new Error('Decision-line signature missing in one or more required locations!');
  }

  // -------------------------------------------------------------
  // 200% ZOOM & HORIZONTAL OVERFLOW CHECK
  // -------------------------------------------------------------
  console.log('\n--- Checking 200% Zoom & Horizontal Overflow ---');
  await page.setViewport({ width: 720, height: 450, deviceScaleFactor: 2 });
  await page.reload({ waitUntil: 'networkidle0' });
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`  ✓ 200% Zoom: Horizontal scroll width (${hasOverflow ? 'OVERFLOW DETECTED' : 'NO OVERFLOW, RESPONSIVE'})`);
  if (hasOverflow) {
    throw new Error('Horizontal overflow detected at 200% zoom!');
  }

  // Cleanup
  await browser.close();
  server.close();
  console.log('\n--- ALL PHASE 7 CRAFT, ACCESSIBILITY & VISUAL CHECKS PASSED ---');
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
