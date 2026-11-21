const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 950 });
    await page.goto('http://localhost:3000/pacts/pact_paytm_google_anantha', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    await new Promise(r => setTimeout(r, 1500));
    
    const title = await page.title();
    const alertBadge = await page.$eval('.stepper-state-badge', el => el.textContent.trim()).catch(() => 'N/A');
    const receiptHeading = await page.$eval('.receipt-alert-badge', el => el.textContent.trim()).catch(() => 'N/A');
    const buttons = await page.$$eval('.decision-buttons-row button', els => els.map(e => e.textContent.trim())).catch(() => []);
    const pactTitle = await page.$eval('.pact-main-title', el => el.textContent.trim()).catch(() => 'N/A');

    console.log('Page Title:', title);
    console.log('Pact Title:', pactTitle);
    console.log('Decision Line Stepper Badge:', alertBadge);
    console.log('Receipt Badge:', receiptHeading);
    console.log('Voting Buttons:', JSON.stringify(buttons));

    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots', { recursive: true });
    }
    await page.screenshot({ path: 'screenshots/pact_paytm_breach_fail_verified.png', fullPage: true });
    console.log('✓ Screenshot saved to screenshots/pact_paytm_breach_fail_verified.png');
    await browser.close();
  } catch (err) {
    console.error('Puppeteer verification failed:', err);
    process.exit(1);
  }
})();
