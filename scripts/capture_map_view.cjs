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
  await page.setViewport({ width: 1280, height: 1100 });

  await page.goto('http://localhost:3000/pacts/new', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2500));

  // Scroll down to the map
  await page.evaluate(() => {
    const mapEl = document.querySelector('.destination-preview-card');
    if (mapEl) mapEl.scrollIntoView();
  });
  await new Promise((r) => setTimeout(r, 1500));

  const mapShotPath = path.join(ARTIFACT_DIR, 'verify_06_leaflet_map_tiles_rendered.png');
  await page.screenshot({ path: mapShotPath });
  console.log('Saved map view screenshot:', mapShotPath);

  await browser.close();
}

run();
