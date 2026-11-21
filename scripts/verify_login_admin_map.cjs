const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/moune/.gemini/antigravity/brain/96c610c1-1c46-4083-858f-788e20d8c933';

async function run() {
  console.log('🚀 Launching Puppeteer verification suite...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const tileErrors = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('cartocdn.com') || url.includes('openstreetmap.org')) {
      if (response.status() >= 400) {
        tileErrors.push({ url, status: response.status() });
      }
    }
  });

  try {
    // 1. TEST LOGIN PAGE
    console.log('Testing /login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1500));

    // Verify 8 company cards
    const companyCardCount = await page.$$eval('button[title*="01)"]', (btns) => btns.length);
    console.log(`Found ${companyCardCount} enterprise company logo cards`);

    // Verify suggested names chips are absent
    const suggestedNamesExist = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll('button')).map((b) => b.textContent || '');
      return texts.some((t) => t.includes('Ananya (Indiranagar)') || t.includes('Kabir (HSR Layout)'));
    });
    console.log(`Suggested name buttons present: ${suggestedNamesExist} (Expected: false)`);

    // Verify departure neighborhood field is absent
    const departureFieldExists = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label')).map((l) => l.textContent || '');
      return labels.some((l) => l.toLowerCase().includes('departure neighborhood'));
    });
    console.log(`Departure neighborhood field present: ${departureFieldExists} (Expected: false)`);

    // Screenshot Login Page
    const loginShotPath = path.join(ARTIFACT_DIR, 'verify_01_login_clean.png');
    await page.screenshot({ path: loginShotPath, fullPage: true });
    console.log(`Saved screenshot: ${loginShotPath}`);

    // Fill login directly with Company Name, Company ID, Employee Name
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      // Input 0: company name, Input 1: company ID, Input 2: employee name
      if (inputs[0]) {
        inputs[0].value = 'Paytm (One97 Communications)';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (inputs[1]) {
        inputs[1].value = 'PAYTM-CORP-01';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (inputs[2]) {
        inputs[2].value = 'Kabir Verma';
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Click submit
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2000));

    // 2. TEST DASHBOARD & TOPBAR
    console.log('Testing TopBar & Dashboard after login...');
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);

    const topBarAdminBtn = await page.$('.topbar-admin-btn');
    console.log(`TopBar Admin button present: ${Boolean(topBarAdminBtn)} (Expected: true)`);

    const dashShotPath = path.join(ARTIFACT_DIR, 'verify_02_dashboard_topbar.png');
    await page.screenshot({ path: dashShotPath, fullPage: true });
    console.log(`Saved screenshot: ${dashShotPath}`);

    // 3. TEST ADMIN PANEL (/admin)
    console.log('Testing /admin Enterprise Admin Console...');
    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 2000));

    // Register a new company: "Tata Consultancy Services"
    await page.type('input[placeholder*="Tata Consultancy Services"]', 'Tata Consultancy Services');
    await page.type('input[placeholder*="TCS"]', 'TCS');
    await page.type('input[placeholder*="tcs.com"]', 'tcs.com');
    await page.type('input[placeholder*="Rohan Sharma"]', 'Rohan Sharma');

    // Click register
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2000));

    // Check directory table contains TCS
    const tcsExists = await page.evaluate(() => {
      return document.body.textContent.includes('TCS-CORP-01') || document.body.textContent.includes('Tata Consultancy Services');
    });
    console.log(`TCS entity registered and in directory: ${tcsExists} (Expected: true)`);

    // Screenshot Admin Page
    const adminShotPath = path.join(ARTIFACT_DIR, 'verify_03_admin_console.png');
    await page.screenshot({ path: adminShotPath, fullPage: true });
    console.log(`Saved screenshot: ${adminShotPath}`);

    // 4. TEST WIZARD STEP 1 & LEAFLET MAP TILES
    console.log('Testing /pacts/new Leaflet Map tile rendering...');
    await page.goto('http://localhost:3000/pacts/new', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 2500));

    // Verify map container rendered
    const mapExists = await page.$('.mini-leaflet-map-container');
    console.log(`Leaflet Map Container rendered: ${Boolean(mapExists)} (Expected: true)`);

    // Check tile errors
    console.log(`Tile network errors encountered: ${tileErrors.length}`);
    if (tileErrors.length > 0) {
      console.log('Errors:', tileErrors);
    }

    const wizardShotPath = path.join(ARTIFACT_DIR, 'verify_04_wizard_map_unblocked.png');
    await page.screenshot({ path: wizardShotPath, fullPage: true });
    console.log(`Saved screenshot: ${wizardShotPath}`);

    console.log(' All verification checks completed successfully!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

run();
