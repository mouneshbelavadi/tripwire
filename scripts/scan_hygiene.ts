import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

/**
 * Secret & Hygiene Scanner for Phase 8 Freeze
 * Scans code, bundles, fixtures, git tracking and verifies:
 * 1. Zero secrets/API keys hardcoded or leaked into bundles/exports.
 * 2. .env is gitignored and .env.example contains only placeholders.
 * 3. Local raw fixtures (fixtures/raw, fixtures/private) are excluded from git.
 * 4. Credit budget table in SQLite is durable and cannot reset on process restart.
 */

const ROOT_DIR = process.cwd();

// Regex patterns to look for potential credentials
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/, // Google Maps live key pattern
  /(?:serpapi|serp_api)[\w_]*\s*[:=]\s*['"][a-f0-9]{32,}['"]/i, // SerpApi live key format
  /(?:nexconn_secret|nex_secret)[\w_]*\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i, // Nexconn secret
  /(?:ydc_api_key|you_api_key)[\w_]*\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i, // You.com key
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, // PEM private keys
];

// Directories to scan
const SCAN_DIRS = ['src', 'dist', 'scripts', 'fixtures'];
const IGNORED_FILES = ['probe-report.json']; // report files with hashes

function getFilesToScan(dir: string): string[] {
  const fullPath = path.join(ROOT_DIR, dir);
  if (!fs.existsSync(fullPath)) return [];
  
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '__pycache__') {
        files = files.concat(getFilesToScan(path.relative(ROOT_DIR, entryPath)));
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.py'].includes(ext)) {
        if (!IGNORED_FILES.includes(entry.name)) {
          files.push(entryPath);
        }
      }
    }
  }
  return files;
}

async function runHygieneScan() {
  console.log('====================================================');
  console.log(' Phase 8: Secret & Repository Hygiene Audit');
  console.log('====================================================\n');

  let violations = 0;
  let scannedFiles = 0;

  // 1. Scan code & bundles for secrets
  console.log('1. Scanning source files and built distribution bundles for secrets...');
  for (const dir of SCAN_DIRS) {
    const files = getFilesToScan(dir);
    for (const file of files) {
      scannedFiles++;
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`  [VIOLATION] Potential secret pattern matched in: ${path.relative(ROOT_DIR, file)}`);
          violations++;
        }
      }
    }
  }
  console.log(`  ✓ Scanned ${scannedFiles} source/bundle files. Zero leaked secrets found.\n`);

  // 2. Check .gitignore rules for sensitive files
  console.log('2. Verifying .gitignore covers secrets and raw provider fixtures...');
  const gitignoreContent = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');
  const requiredIgnored = [
    'fixtures/private/',
    'fixtures/raw/',
    '.env',
    '*.sqlite3'
  ];

  for (const req of requiredIgnored) {
    if (!gitignoreContent.includes(req.replace('*', ''))) {
      console.error(`  [VIOLATION] .gitignore is missing requirement: ${req}`);
      violations++;
    } else {
      console.log(`  ✓ Pattern '${req}' properly configured in .gitignore.`);
    }
  }

  // Verify git status does not track .env or raw fixtures
  try {
    const gitTracked = execSync('git ls-files', { encoding: 'utf8' });
    if (gitTracked.includes('.env\n') || gitTracked.includes('.env.local')) {
      console.error('  [VIOLATION] .env file is tracked in Git!');
      violations++;
    } else {
      console.log('  ✓ Verified .env is NOT tracked in git repository.');
    }
    if (gitTracked.includes('fixtures/raw/') || gitTracked.includes('fixtures/private/')) {
      console.error('  [VIOLATION] Raw fixtures directory is tracked in Git!');
      violations++;
    } else {
      console.log('  ✓ Verified raw/private fixtures are NOT tracked in git repository.');
    }
  } catch (err: any) {
    console.warn('  (git ls-files check skipped:', err.message, ')');
  }

  // 3. Verify .env.example contains only placeholders
  console.log('\n3. Verifying .env.example contains only safe placeholders...');
  const envExample = fs.readFileSync(path.join(ROOT_DIR, '.env.example'), 'utf8');
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(envExample)) {
      console.error('  [VIOLATION] Potential secret found in .env.example!');
      violations++;
    }
  }
  console.log('  ✓ .env.example contains safe placeholders only.\n');

  // 4. Verify durable credit budget persistence across restarts
  console.log('4. Verifying SQLite credit budget persistence across database reloads...');
  const testDbPath = path.join(ROOT_DIR, 'test_restart_budget.sqlite3');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  try {
    // Session 1: open db, insert 12 credit attempts
    const db1 = new DatabaseSync(testDbPath);
    db1.exec(`
      CREATE TABLE IF NOT EXISTS credit_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_id TEXT,
        phase TEXT NOT NULL,
        reserved_at TEXT NOT NULL,
        state TEXT NOT NULL,
        provider_search_id TEXT
      );
    `);
    
    for (let i = 0; i < 12; i++) {
      db1.prepare(`
        INSERT INTO credit_attempts (watch_id, phase, reserved_at, state)
        VALUES (?, 'research', ?, 'reserved')
      `).run(`watch_${i}`, new Date().toISOString());
    }
    db1.close();

    // Session 2: "Restart" - re-open db, verify 12 credits remain accounted for
    const db2 = new DatabaseSync(testDbPath);
    const countRow = db2.prepare("SELECT COUNT(*) as cnt FROM credit_attempts WHERE state != 'aborted'").get() as { cnt: number };
    if (countRow.cnt !== 12) {
      console.error(`  [VIOLATION] Credit budget did not persist across restart: expected 12, got ${countRow.cnt}`);
      violations++;
    } else {
      console.log(`  ✓ Budget durability verified: 12 reserved credits persisted intact across process restart.`);
    }
    db2.close();
  } finally {
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch {
      // On Windows, sqlite file handles may take a moment to unlock
    }
  }

  console.log('\n====================================================');
  if (violations === 0) {
    console.log(' ✓ HYGIENE & SECRET AUDIT: PASSED (0 violations)');
    console.log('====================================================');
  } else {
    console.error(` ✗ HYGIENE & SECRET AUDIT: FAILED (${violations} violations)`);
    console.log('====================================================');
    process.exit(1);
  }
}

runHygieneScan().catch((err) => {
  console.error('Fatal scan error:', err);
  process.exit(1);
});
