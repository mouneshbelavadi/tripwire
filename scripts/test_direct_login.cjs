const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:/Users/moune/.gemini/antigravity/brain/96c610c1-1c46-4083-858f-788e20d8c933';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1000));

  // Type in employee name
  await page.type('input[placeholder*="Kabir Verma"]', 'Kabir Verma');
  await new Promise((r) => setTimeout(r, 300));

  // Click submit
  await page.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 2000));

  console.log('Current URL after typing and submit:', page.url());

  const topBarAdminBtn = await page.$('.topbar-admin-btn');
  console.log('TopBar Admin button present on Dashboard:', Boolean(topBarAdminBtn));

  const shotPath = path.join(ARTIFACT_DIR, 'verify_05_dashboard_logged_in.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('Saved dashboard screenshot:', shotPath);

  await browser.close();
}

run();
