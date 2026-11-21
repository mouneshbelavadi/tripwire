const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotDir = 'C:/Users/moune/.gemini/antigravity/brain/96c610c1-1c46-4083-858f-788e20d8c933/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Screenshot of default Active Pacts
  await page.screenshot({ path: path.join(screenshotDir, 'screen_1_active_pacts.png') });

  // 2. Click "Past" tab in the sidebar
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.tab-pill'));
    const pastTab = tabs.find(t => t.textContent.includes('Past'));
    if (pastTab) pastTab.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, 'screen_2_past_plans.png') });

  // 3. Click one of the past plans (e.g. Whitefield) to see its details
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.pact-item'));
    const whitefield = items.find(i => i.textContent.includes('Whitefield'));
    if (whitefield) whitefield.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, 'screen_3_past_plan_details.png') });

  // 4. Click "+ New" to see the Create Pact Modal
  await page.evaluate(() => {
    const newBtn = document.querySelector('.sidebar-header button');
    if (newBtn) newBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(screenshotDir, 'screen_4_create_modal.png') });

  await browser.close();
  console.log('All screenshots captured successfully.');
})();
