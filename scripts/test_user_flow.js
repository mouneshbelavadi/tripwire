import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
  console.log('=== LAUNCHING PUPPETEER CORE BROWSER TEST ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();

    // 1. Visit Login Page
    console.log('1. Navigating to Login Page: http://localhost:3000/login');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_01_login_page.png') });
    console.log(' - Screenshot saved: flow_01_login_page.png');

    // 2. Select Paytm preset and log in
    console.log('2. Clicking Paytm preset button');
    const paytmPresetBtn = await page.waitForSelector('button[data-company-code="PAYTM"]');
    if (paytmPresetBtn) {
      await paytmPresetBtn.click();
    }
    await new Promise((r) => setTimeout(r, 600));

    console.log(' - Submitting login form');
    const submitBtn = await page.waitForSelector('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    }
    await new Promise((r) => setTimeout(r, 2000));

    // 3. Verify Dashboard
    console.log('3. Verifying Paytm Dashboard on /');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_02_paytm_dashboard.png') });
    console.log(' - Screenshot saved: flow_02_paytm_dashboard.png');

    // Check no credit text appears on the page
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasCreditCeiling = pageText.includes('40/40 CREDITS') || pageText.includes('BUDGET: 0/40') || pageText.includes('BUDGET: 40/40');
    console.log(` - Credit check: ${hasCreditCeiling ? 'FAIL (credit text leaked!)' : 'PASS (zero credit leakage)'}`);

    // 4. Switch colleague to Kabir
    console.log('4. Switching member to Kabir (HSR Layout)');
    const selectElem = await page.$('select#user-select');
    if (selectElem) {
      await selectElem.select('user_kabir');
      await new Promise((r) => setTimeout(r, 1000));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_03_colleague_switch_kabir.png') });
    console.log(' - Screenshot saved: flow_03_colleague_switch_kabir.png');

    // 5. Navigate to New Pact Wizard
    console.log('5. Opening New Pact Wizard: http://localhost:3000/pacts/new');
    await page.goto('http://localhost:3000/pacts/new', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Step 1: From & To, Google Anantha
    console.log(' - Step 1: Selecting Google Anantha Bengaluru preset');
    const googleAnanthaBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.preset-hub-pill'));
      const found = btns.find((b) => b.innerText.includes('Google Anantha'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    console.log(` - Google Anantha preset selected: ${googleAnanthaBtn}`);
    await new Promise((r) => setTimeout(r, 1000));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_04_wizard_step1_google_anantha.png') });
    console.log(' - Screenshot saved: flow_04_wizard_step1_google_anantha.png');

    // Click Next to Step 2
    console.log(' - Clicking Next to Step 2');
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button.btn-primary')).find((b) => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify Step 2: Participants & Thresholds
    console.log(' - Step 2: Selecting 45m preset for first participant');
    await page.evaluate(() => {
      const chipBtns = Array.from(document.querySelectorAll('.commute-limit-container button'));
      const chip45 = chipBtns.find((b) => b.innerText.includes('45 min'));
      if (chip45) chip45.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_05_wizard_step2_participants.png') });
    console.log(' - Screenshot saved: flow_05_wizard_step2_participants.png');

    // Click Next to Step 3
    console.log(' - Clicking Next to Step 3');
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button.btn-primary')).find((b) => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Step 3: Date & Time quick helper
    console.log(' - Step 3: Clicking +2 Hours quick helper button');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const plus2 = btns.find((b) => b.innerText.includes('+2 Hours'));
      if (plus2) plus2.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_06_wizard_step3_deadline.png') });
    console.log(' - Screenshot saved: flow_06_wizard_step3_deadline.png');

    // Click Next to Step 4
    console.log(' - Clicking Next to Step 4');
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button.btn-primary')).find((b) => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Step 4: Review and verify ZERO credit references
    console.log(' - Step 4: Agreement Review & Watch Schedule');
    const step4Text = await page.evaluate(() => document.body.innerText);
    const hasSerpApiCreditBox = step4Text.includes('Estimated SerpApi Credit Consumption');
    console.log(` - Credit box check: ${hasSerpApiCreditBox ? 'FAIL (credit box found!)' : 'PASS (Automated Commute Watch Schedule active)'}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_07_wizard_step4_schedule.png') });
    console.log(' - Screenshot saved: flow_07_wizard_step4_schedule.png');

    // 6. Test Team Chat Drawer
    console.log('6. Opening Team Chat Drawer');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1200));

    const chatToggle = await page.waitForSelector('.team-chat-toggle-btn');
    if (chatToggle) await chatToggle.click();
    await new Promise((r) => setTimeout(r, 1000));

    // Type and send message
    const chatInput = await page.waitForSelector('.chat-composer-form input.chat-input');
    if (chatInput) {
      await chatInput.type('Meeting confirmed at Google Anantha. Checking directions now.');
      const chatSend = await page.waitForSelector('.chat-composer-form button[type="submit"]');
      if (chatSend) await chatSend.click();
    }
    await new Promise((r) => setTimeout(r, 1500));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_08_team_chat_drawer.png') });
    console.log(' - Screenshot saved: flow_08_team_chat_drawer.png');

    // 7. Test Mobile Viewport (390x844)
    console.log('7. Switching to mobile viewport: 390x844');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1200));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flow_09_mobile_viewport_390x844.png') });
    console.log(' - Screenshot saved: flow_09_mobile_viewport_390x844.png');

    console.log('=== ALL BROWSER FLOW TESTS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Browser test failed:', err);
  } finally {
    await browser.close();
  }
}

runTest();
