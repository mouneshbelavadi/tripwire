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
  await page.screenshot({ path: path.join(screenshotDir, 'verified_live_ui.png') });

  // Click Edit Agreement to see the modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const editBtn = btns.find(b => b.textContent.includes('Edit Agreement'));
    if (editBtn) editBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(screenshotDir, 'verified_edit_modal.png') });

  await browser.close();
  console.log('Screenshots captured successfully.');
})();
