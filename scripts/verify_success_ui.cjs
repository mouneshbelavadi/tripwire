const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/moune/.gemini/antigravity/brain/7d3dd9fe-3b79-4d16-977b-b2066b9c1140';

async function verify() {
  console.log('Verifying http://localhost:3000 dashboard...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2000));

  // Check stat cards
  const stats = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.stat-card'));
    return cards.map((c) => ({
      label: c.querySelector('.stat-card-label')?.textContent?.trim(),
      value: c.querySelector('.stat-card-value')?.textContent?.trim(),
      badge: c.querySelector('.stat-indicator-badge')?.textContent?.trim(),
    }));
  });
  console.log('Dashboard Stat Cards:', JSON.stringify(stats, null, 2));

  // Check All Clear Card
  const allClearText = await page.evaluate(() => {
    const el = document.querySelector('.all-clear-card');
    return el ? el.textContent.trim() : null;
  });
  console.log('All Clear banner text found:', Boolean(allClearText));
  console.log('Banner snippet:', allClearText?.substring(0, 100));

  // Check Active Pacts list
  const activePactTitles = await page.evaluate(() => {
    const pactCards = Array.from(document.querySelectorAll('.pact-card, .pact-row, .pact-list-item, h3, h2'));
    return pactCards.map((p) => p.textContent.trim()).filter((t) => t.includes('Paytm') || t.includes('Google Anantha'));
  });
  console.log('Matching Pact Text on Page:', activePactTitles);

  const screenshotPath = path.join(ARTIFACT_DIR, 'success_dashboard_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Saved verification screenshot to ${screenshotPath}`);

  await browser.close();
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
