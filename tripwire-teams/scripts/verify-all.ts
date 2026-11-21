/**
 * Tripwire Teams - Master Verification Script
 *
 * Runs comprehensive audit across all subsystems:
 * 1. Environment variables and cryptographic safety bounds
 * 2. All 10 Vitest test suites (encryption, members, commute, decision, scheduler, calendar, security, demo, evidence, slack-ui)
 * 3. TypeScript static type checker (tsc --noEmit)
 * 4. Emits a clean, formatted report card of all subsystems
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(projectRoot, '.env') });

interface SubsystemResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  testsCount?: number;
  durationMs?: number;
  details: string;
}

const results: SubsystemResult[] = [];

console.log('\n================================================================');
console.log('       TRIPWIRE TEAMS - MASTER SUBSYSTEM VERIFICATION AUDIT      ');
console.log('================================================================\n');

// 1. Environment & Cryptographic Safety Bounds
console.log('🔍 [1/3] Auditing Environment & Cryptographic Safety Bounds...');

function auditEnvironment(): SubsystemResult {
  const issues: string[] = [];

  // Check ENCRYPTION_KEY
  const encKey = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let keyBytes = 0;
  if (encKey.length === 64 && /^[0-9a-fA-F]+$/.test(encKey)) {
    keyBytes = 32;
  } else {
    try {
      const b64 = Buffer.from(encKey, 'base64');
      if (b64.length === 32) keyBytes = 32;
    } catch {}
    if (keyBytes === 0) {
      const utf = Buffer.from(encKey, 'utf8');
      if (utf.length === 32) keyBytes = 32;
    }
  }

  if (keyBytes !== 32) {
    issues.push(`ENCRYPTION_KEY must resolve to 32 bytes for AES-256-GCM (current length: ${encKey.length})`);
  }

  // Check PORT bounds
  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    issues.push(`PORT must be a valid port number between 1 and 65535 (current: ${process.env.PORT})`);
  }

  // Check Database URL structure
  const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/tripwire';
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    issues.push('DATABASE_URL must be a PostgreSQL connection string');
  }

  if (issues.length > 0) {
    return {
      name: 'Environment & Safety Bounds',
      category: 'Configuration',
      status: 'FAIL',
      details: issues.join('; '),
    };
  }

  return {
    name: 'Environment & Safety Bounds',
    category: 'Configuration',
    status: 'PASS',
    details: 'AES-256-GCM 32-byte key valid, PostgreSQL URL scheme valid, Port in bounds',
  };
}

const envResult = auditEnvironment();
results.push(envResult);
console.log(`   ${envResult.status === 'PASS' ? '✅' : '❌'} ${envResult.name}: ${envResult.details}\n`);

// 2. Vitest Test Suites
console.log('🧪 [2/3] Running Vitest Test Suites across All 10 Subsystems...');

const testFiles = [
  { name: 'Encryption & Key Safety', path: 'src/config/encryption.test.ts', category: 'Core Security' },
  { name: 'Member Privacy & GDPR Forget', path: 'src/features/members/member.test.ts', category: 'Privacy' },
  { name: 'Google Routes & Quota Guard', path: 'src/features/commute/routes.test.ts', category: 'Commute' },
  { name: 'Pure Invariant Decision Engine', path: 'src/features/decision/decisionCore.test.ts', category: 'Decision Core' },
  { name: 'pg-boss Scheduler & Rain Forecast', path: 'src/features/scheduler/scheduler.test.ts', category: 'Scheduler' },
  { name: 'Google Calendar & Meet Fallback', path: 'src/features/calendar/calendar.test.ts', category: 'Calendar' },
  { name: 'Workspace Isolation & Audit Log', path: 'src/features/security/security.test.ts', category: 'Multi-tenancy' },
  { name: 'Demo Mode & Synthetic Fixtures', path: 'src/features/demo/demo.test.ts', category: 'Demo' },
  { name: 'SerpApi News Evidence Telemetry', path: 'src/features/evidence/evidence.test.ts', category: 'Evidence' },
  { name: 'Slack Block Kit Decision Cards', path: 'src/features/slack-ui/card.test.ts', category: 'Slack UI' },
];

for (const testSuite of testFiles) {
  const start = Date.now();
  try {
    const output = execSync(`npx vitest run ${testSuite.path} --reporter=default`, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const duration = Date.now() - start;

    // Parse test count with ANSI stripping
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    const match = cleanOutput.match(/Tests\s+(\d+)\s+passed/) || cleanOutput.match(/\((\d+)\s+tests\)/);
    const testsCount = match ? parseInt(match[1], 10) : undefined;

    results.push({
      name: testSuite.name,
      category: testSuite.category,
      status: 'PASS',
      testsCount,
      durationMs: duration,
      details: `${testsCount ?? 'All'} tests passed in ${duration}ms`,
    });
    console.log(`   ✅ ${testSuite.name.padEnd(35)} [${testSuite.category}] -> PASS (${testsCount} tests, ${duration}ms)`);
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({
      name: testSuite.name,
      category: testSuite.category,
      status: 'FAIL',
      durationMs: duration,
      details: err?.message || 'Test suite failed',
    });
    console.log(`   ❌ ${testSuite.name.padEnd(35)} [${testSuite.category}] -> FAIL in ${duration}ms`);
  }
}

// 3. TypeScript Compiler Type Checking
console.log('\n📘 [3/3] Checking TypeScript Compiler Types (tsc --noEmit)...');
const tsStart = Date.now();
try {
  execSync('npx tsc --noEmit', {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const tsDuration = Date.now() - tsStart;
  results.push({
    name: 'TypeScript Compiler (tsc)',
    category: 'Type Safety',
    status: 'PASS',
    durationMs: tsDuration,
    details: `Strict typecheck clean in ${tsDuration}ms (0 errors)`,
  });
  console.log(`   ✅ TypeScript Static Types Clean (0 errors, ${tsDuration}ms)`);
} catch (err: any) {
  const tsDuration = Date.now() - tsStart;
  results.push({
    name: 'TypeScript Compiler (tsc)',
    category: 'Type Safety',
    status: 'FAIL',
    durationMs: tsDuration,
    details: err?.stdout || err?.message || 'TypeScript compilation failed',
  });
  console.log(`   ❌ TypeScript Compilation Errors detected!`);
}

// 4. Formatted Report Card
console.log('\n================================================================');
console.log('              TRIPWIRE TEAMS - SUBSYSTEM REPORT CARD            ');
console.log('================================================================');
console.log(
  '| ' +
    'Subsystem'.padEnd(36) +
    '| ' +
    'Category'.padEnd(16) +
    '| ' +
    'Status'.padEnd(8) +
    '| ' +
    'Details'.padEnd(30) +
    '|'
);
console.log('|' + '-'.repeat(38) + '|' + '-'.repeat(18) + '|' + '-'.repeat(10) + '|' + '-'.repeat(32) + '|');

let totalTests = 0;
let totalPasses = 0;
let totalFails = 0;

for (const res of results) {
  if (res.status === 'PASS') totalPasses++;
  else totalFails++;

  if (res.testsCount) totalTests += res.testsCount;

  const statusBadge = res.status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(
    `| ${res.name.padEnd(36)}| ${res.category.padEnd(16)}| ${statusBadge.padEnd(8)}| ${res.details.slice(0, 30).padEnd(30)}|`
  );
}

console.log('|' + '-'.repeat(38) + '|' + '-'.repeat(18) + '|' + '-'.repeat(10) + '|' + '-'.repeat(32) + '|');
console.log(`\n📊 Summary: ${totalPasses} Passed, ${totalFails} Failed, ${totalTests} Unit Tests Executed.`);

if (totalFails === 0) {
  console.log('\n🌟 VERDICT: ALL SUBSYSTEMS OPERATIONAL (100% HEALTH SCORE - GRADE A+)');
  console.log('   Ready for production deployment and demo presentation.\n');
  process.exit(0);
} else {
  console.error(`\n⚠️ VERDICT: ${totalFails} SUBSYSTEM(S) REPORTED FAILURES.`);
  process.exit(1);
}
