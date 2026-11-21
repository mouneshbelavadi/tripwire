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

  // 1. Dashboard View
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(screenshotDir, 'v2_dashboard_view.png') });
  console.log('Captured v2_dashboard_view.png');

  // 2. Pact Details with Plan Switcher
  await page.goto('http://localhost:3000/pacts/pact_bellandur_01', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(screenshotDir, 'v2_pact_detail.png') });
  console.log('Captured v2_pact_detail.png');

  // 3. Open Edit Agreement Modal to verify threshold inputs (no leading zero) and future deadline helpers
  await page.evaluate(() => {
    // Click "More ▾"
    const moreBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('More'));
    if (moreBtn) moreBtn.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Edit agreement'));
    if (editBtn) editBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(screenshotDir, 'v2_edit_modal.png') });
  console.log('Captured v2_edit_modal.png');

  // 4. History Page (/history)
  await page.goto('http://localhost:3000/history', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(screenshotDir, 'v2_history_view.png') });
  console.log('Captured v2_history_view.png');

  // 5. Usage Page (/usage)
  await page.goto('http://localhost:3000/usage', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(screenshotDir, 'v2_usage_view.png') });
  console.log('Captured v2_usage_view.png');

  await browser.close();
  console.log('All screenshots captured successfully.');
})().catch(err => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
