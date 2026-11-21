import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(config.databasePath);
    initSchema(dbInstance);
    seedInitialData(dbInstance);
  }
  return dbInstance;
}

export function initSchema(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      corporate_id TEXT,
      domain TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'comp_paytm',
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'creator' | 'participant'
      neighbourhood TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lon REAL NOT NULL,
      nex_user_id TEXT NOT NULL,
      nex_group_id TEXT NOT NULL,
      UNIQUE(company_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pacts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'comp_paytm',
      team_id TEXT NOT NULL,
      title TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'awaiting_approval' | 'armed' | 'paused' | 'closed'
      destination_name TEXT NOT NULL,
      destination_place_id TEXT NOT NULL,
      destination_lat REAL NOT NULL,
      destination_lon REAL NOT NULL,
      destination_address TEXT,
      decision_deadline_utc TEXT NOT NULL,
      decision_deadline_ist TEXT NOT NULL,
      fallback_text TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      pact_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      neighbourhood TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lon REAL NOT NULL,
      max_duration_s INTEGER NOT NULL, -- in seconds (e.g. 3600 for 60 min)
      approval_version INTEGER,
      approved_at TEXT,
      FOREIGN KEY (pact_id) REFERENCES pacts(id) ON DELETE CASCADE,
      UNIQUE(pact_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS watches (
      id TEXT PRIMARY KEY,
      pact_id TEXT NOT NULL,
      engine TEXT NOT NULL,
      params_json TEXT NOT NULL,
      query_hash TEXT NOT NULL,
      next_due_at TEXT NOT NULL,
      ttl_s INTEGER NOT NULL,
      priority INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (pact_id) REFERENCES pacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      watch_id TEXT NOT NULL,
      provider_search_id TEXT,
      provider_created_at TEXT,
      received_at TEXT NOT NULL,
      query_hash TEXT NOT NULL,
      raw_hash TEXT NOT NULL,
      normalized_json TEXT NOT NULL,
      validity TEXT NOT NULL,
      provenance TEXT NOT NULL, -- 'live' | 'replay' | 'synthetic'
      FOREIGN KEY (watch_id) REFERENCES watches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rule_states (
      watch_id TEXT PRIMARY KEY,
      pact_version INTEGER NOT NULL,
      last_source_at REAL,
      consecutive_breaches INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 0,
      episode_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (watch_id) REFERENCES watches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      pact_id TEXT NOT NULL,
      rule_version INTEGER NOT NULL,
      episode_id TEXT NOT NULL,
      before_observation_id TEXT,
      after_observation_id TEXT,
      decision_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (pact_id) REFERENCES pacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS citation_contexts (
      alert_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      answer TEXT NOT NULL,
      citations_json TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credit_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      watch_id TEXT,
      phase TEXT NOT NULL,
      reserved_at TEXT NOT NULL,
      state TEXT NOT NULL, -- 'reserved' | 'completed' | 'failed'
      provider_search_id TEXT
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL,
      provider_receipt TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS acknowledgements (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      decision TEXT NOT NULL, -- 'keep' | 'remote' | 'discuss'
      created_at TEXT NOT NULL,
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
      UNIQUE(alert_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS place_cache (
      query TEXT PRIMARY KEY,
      results_json TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_leases (
      lease_key TEXT PRIMARY KEY,
      holder_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      heartbeat_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_messages (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'comp_paytm',
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      text TEXT NOT NULL,
      sent_time INTEGER NOT NULL
    );
  `);

  // Run dynamic schema migrations for existing SQLite databases
  try { db.exec("ALTER TABLE pacts ADD COLUMN company_id TEXT DEFAULT 'comp_paytm';"); } catch {}
  try { db.exec("ALTER TABLE team_members ADD COLUMN company_id TEXT DEFAULT 'comp_paytm';"); } catch {}
  try { db.exec("ALTER TABLE team_messages ADD COLUMN company_id TEXT DEFAULT 'comp_paytm';"); } catch {}
  try { db.exec("ALTER TABLE companies ADD COLUMN corporate_id TEXT;"); } catch {}
}

export function seedInitialData(db: DatabaseSync): void {
  const nowIso = new Date().toISOString();

  // 1. Seed companies: Paytm, Google, Microsoft, Amazon, Infosys, Flipkart, Swiggy, Uber, Acme
  const companies = [
    { id: 'comp_paytm', name: 'Paytm (One97 Communications)', code: 'PAYTM', corporate_id: 'PAYTM-CORP-01', domain: 'paytm.com' },
    { id: 'comp_google', name: 'Google Bengaluru', code: 'GOOG', corporate_id: 'GOOG-BLR-01', domain: 'google.com' },
    { id: 'comp_microsoft', name: 'Microsoft India', code: 'MSFT', corporate_id: 'MSFT-IN-01', domain: 'microsoft.com' },
    { id: 'comp_amazon', name: 'Amazon India', code: 'AMZN', corporate_id: 'AMZN-BLR-01', domain: 'amazon.com' },
    { id: 'comp_infosys', name: 'Infosys Limited', code: 'INFY', corporate_id: 'INFY-EC-01', domain: 'infosys.com' },
    { id: 'comp_flipkart', name: 'Flipkart Internet', code: 'FLPK', corporate_id: 'FLPK-BLR-01', domain: 'flipkart.com' },
    { id: 'comp_swiggy', name: 'Swiggy Technologies', code: 'SWIG', corporate_id: 'SWIG-BLR-01', domain: 'swiggy.in' },
    { id: 'comp_uber', name: 'Uber India Tech', code: 'UBER', corporate_id: 'UBER-BLR-01', domain: 'uber.com' },
    { id: 'comp_acme', name: 'Acme Technologies', code: 'ACME', corporate_id: 'ACME-CORP-01', domain: 'acme.corp' },
  ];

  for (const comp of companies) {
    const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(comp.id) as any;
    if (!existing) {
      db.prepare(`
        INSERT INTO companies (id, name, code, corporate_id, domain, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(comp.id, comp.name, comp.code, comp.corporate_id, comp.domain, nowIso);
    } else {
      db.prepare('UPDATE companies SET corporate_id = ?, code = ?, name = ? WHERE id = ?')
        .run(comp.corporate_id, comp.code, comp.name, comp.id);
    }
  }

  // 2. Seed initial team members per corporate tenant
  const initialMembers = [
    // Paytm
    { id: 'm_ananya', compId: 'comp_paytm', userId: 'user_ananya', name: 'Ananya', role: 'creator', hood: 'Indiranagar', lat: 12.9784, lon: 77.6408 },
    { id: 'm_kabir', compId: 'comp_paytm', userId: 'user_kabir', name: 'Kabir', role: 'participant', hood: 'HSR Layout', lat: 12.9121, lon: 77.6446 },
    // Google
    { id: 'm_siddharth', compId: 'comp_google', userId: 'user_siddharth', name: 'Siddharth', role: 'creator', hood: 'Whitefield', lat: 12.9698, lon: 77.7499 },
    { id: 'm_pooja', compId: 'comp_google', userId: 'user_pooja', name: 'Pooja', role: 'participant', hood: 'Koramangala', lat: 12.9352, lon: 77.6245 },
    // Microsoft
    { id: 'm_vikram', compId: 'comp_microsoft', userId: 'user_vikram', name: 'Vikram', role: 'creator', hood: 'Bellandur', lat: 12.9304, lon: 77.6784 },
    { id: 'm_neha', compId: 'comp_microsoft', userId: 'user_neha', name: 'Neha', role: 'participant', hood: 'Indiranagar', lat: 12.9784, lon: 77.6408 },
    // Amazon
    { id: 'm_rahul', compId: 'comp_amazon', userId: 'user_rahul', name: 'Rahul', role: 'creator', hood: 'HSR Layout', lat: 12.9121, lon: 77.6446 },
    { id: 'm_divya', compId: 'comp_amazon', userId: 'user_divya', name: 'Divya', role: 'participant', hood: 'Sarjapur Road', lat: 12.9166, lon: 77.6833 },
    // Acme
    { id: 'm_maya', compId: 'comp_acme', userId: 'user_maya', name: 'Maya', role: 'creator', hood: 'Indiranagar', lat: 12.9784, lon: 77.6408 },
    { id: 'm_arjun', compId: 'comp_acme', userId: 'user_arjun', name: 'Arjun', role: 'participant', hood: 'HSR Layout', lat: 12.9121, lon: 77.6446 },
  ];

  for (const m of initialMembers) {
    const existing = db.prepare('SELECT id FROM team_members WHERE user_id = ?').get(m.userId);
    if (!existing) {
      db.prepare(`
        INSERT INTO team_members (id, company_id, team_id, user_id, user_name, role, neighbourhood, origin_lat, origin_lon, nex_user_id, nex_group_id)
        VALUES (?, ?, 'team_office_pact', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(m.id, m.compId, m.userId, m.name, m.role, m.hood, m.lat, m.lon, `nex_${m.userId}`, 'group_office_pact');
    }
  }

  // 3. Seed team messages per company
  const existingPaytmMsg = db.prepare("SELECT id FROM team_messages WHERE channel_id = 'channel_paytm_office_pact'").get();
  if (!existingPaytmMsg) {
    const t = Date.now();
    db.prepare(`
      INSERT INTO team_messages (id, company_id, channel_id, user_id, user_name, text, sent_time)
      VALUES
        ('msg_paytm_1', 'comp_paytm', 'channel_paytm_office_pact', 'user_ananya', 'Ananya', 'Hey Kabir! Our strategy meetup at Google Anantha is set up with 60m commute thresholds.', ?),
        ('msg_paytm_2', 'comp_paytm', 'channel_paytm_office_pact', 'user_kabir', 'Kabir', 'Sounds great Ananya! If Bellandur traffic breaches twice, we will automatically switch to Google Meet.', ?)
    `).run(t - 120000, t - 60000);
  }

  const existingAcmeMsg = db.prepare("SELECT id FROM team_messages WHERE channel_id = 'group_office_pact'").get();
  if (!existingAcmeMsg) {
    const t = Date.now();
    db.prepare(`
      INSERT INTO team_messages (id, company_id, channel_id, user_id, user_name, text, sent_time)
      VALUES
        ('msg_init_1', 'comp_acme', 'group_office_pact', 'user_maya', 'Maya', 'Hey Arjun! Set up our Bellandur pact with a 60m threshold. Let us check commute estimates before leaving.', ?),
        ('msg_init_2', 'comp_acme', 'group_office_pact', 'user_arjun', 'Arjun', 'Sounds good Maya! Outer Ring Road can crawl in the morning. If estimates exceed 60m, let us switch to remote.', ?)
    `).run(t - 120000, t - 60000);
  }

  // 4. Seed Paytm Google Anantha Pact
  const existingPaytmPact = db.prepare("SELECT id FROM pacts WHERE id = 'pact_paytm_google_anantha'").get();
  if (!existingPaytmPact) {
    const pactId = 'pact_paytm_google_anantha';
    const now = new Date();
    const deadlineDate = new Date(now.getTime() + 4 * 3600 * 1000);
    const deadlineUtc = deadlineDate.toISOString();
    const deadlineIst = deadlineDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';

    db.prepare(`
      INSERT INTO pacts (
        id, company_id, team_id, title, version, status,
        destination_name, destination_place_id, destination_lat, destination_lon, destination_address,
        decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
      ) VALUES (
        ?, 'comp_paytm', 'team_office_pact', 'Paytm & Google Anantha Strategy Meetup', 1, 'armed',
        'Google Anantha Bengaluru', 'place_google_anantha_blr', 12.9352, 77.6946, 'Prestige Tech Park, Outer Ring Rd, Bellandur, Bengaluru 560103',
        ?, ?, 'Switch to remote Google Meet and cancel cab', 'user_ananya', ?, ?
      )
    `).run(pactId, deadlineUtc, deadlineIst, nowIso, nowIso);

    db.prepare(`
      INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
      VALUES
        ('part_ananya_paytm', ?, 'user_ananya', 'Ananya', 'Indiranagar', 12.9784, 77.6408, 3600, 1, ?),
        ('part_kabir_paytm', ?, 'user_kabir', 'Kabir', 'HSR Layout', 12.9121, 77.6446, 3600, 1, ?)
    `).run(pactId, nowIso, pactId, nowIso);
  }

  // 5. Seed initial draft pact for Acme if none exists
  const existingPacts = db.prepare("SELECT COUNT(*) as count FROM pacts WHERE id = 'pact_bellandur_01'").get() as { count: number };
  if (existingPacts && existingPacts.count === 0) {
    const pactId = 'pact_bellandur_01';
    const now = new Date();
    const deadlineDate = new Date(now.getTime() + 4 * 3600 * 1000);
    const deadlineUtc = deadlineDate.toISOString();
    const deadlineIst = deadlineDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';

    db.prepare(`
      INSERT INTO pacts (
        id, company_id, team_id, title, version, status,
        destination_name, destination_place_id, destination_lat, destination_lon, destination_address,
        decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
      ) VALUES (
        ?, 'comp_acme', 'team_office_pact', 'Bellandur office meetup', 1, 'armed',
        'WeWork Bellandur', 'ChIJk7Q3BqcUrzsR-q3Qe-place-01', 12.9290, 77.6760, 'Outer Ring Rd, Bellandur, Bengaluru',
        ?, ?, 'Switch to remote Google Meet / Slack huddle', 'user_maya', ?, ?
      )
    `).run(pactId, deadlineUtc, deadlineIst, nowIso, nowIso);

    db.prepare(`
      INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
      VALUES
        ('part_maya', ?, 'user_maya', 'Maya', 'Indiranagar', 12.9784, 77.6408, 3600, 1, ?),
        ('part_arjun', ?, 'user_arjun', 'Arjun', 'HSR Layout', 12.9121, 77.6446, 3600, 1, ?)
    `).run(pactId, nowIso, pactId, nowIso);
  }

  // Seed 2 realistic past pacts if they do not exist
  const existingWf = db.prepare('SELECT id FROM pacts WHERE id = ?').get('pact_past_whitefield');
  if (!existingWf) {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000);
    const twoDaysAgoIso = twoDaysAgo.toISOString();
    const past1Id = 'pact_past_whitefield';

    db.prepare(`
      INSERT INTO pacts (
        id, team_id, title, version, status,
        destination_name, destination_place_id, destination_lat, destination_lon, destination_address,
        decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
      ) VALUES (
        ?, 'team_office_pact', 'Whitefield Client Sync', 1, 'completed',
        'Prestige Shantiniketan, Whitefield', 'ChIJ_whitefield_psn_01', 12.9899, 77.7289, 'Whitefield Main Rd, Bengaluru',
        ?, '09:30 IST · 19 Nov 2026', 'Switch to Google Meet and reschedule onsite to Friday', 'user_maya', ?, ?
      )
    `).run(past1Id, twoDaysAgoIso, twoDaysAgoIso, twoDaysAgoIso);

    db.prepare(`
      INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
      VALUES
        ('part_maya_wf', ?, 'user_maya', 'Maya', 'Indiranagar', 12.9784, 77.6408, 3600, 1, ?),
        ('part_arjun_wf', ?, 'user_arjun', 'Arjun', 'HSR Layout', 12.9121, 77.6446, 4200, 1, ?)
    `).run(past1Id, twoDaysAgoIso, past1Id, twoDaysAgoIso);
  }

  const existingKm = db.prepare('SELECT id FROM pacts WHERE id = ?').get('pact_past_koramangala');
  if (!existingKm) {
    const oneDayAgo = new Date(Date.now() - 1 * 86400 * 1000);
    const oneDayAgoIso = oneDayAgo.toISOString();
    const past2Id = 'pact_past_koramangala';

    db.prepare(`
      INSERT INTO pacts (
        id, team_id, title, version, status,
        destination_name, destination_place_id, destination_lat, destination_lon, destination_address,
        decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
      ) VALUES (
        ?, 'team_office_pact', 'Koramangala Standup', 1, 'completed',
        'Third Wave Coffee, Koramangala 4th Block', 'ChIJ_koramangala_twc_02', 12.9345, 77.6265, '80 Feet Rd, Koramangala 4th Block, Bengaluru',
        ?, '10:00 IST · 20 Nov 2026', 'Switch to Slack huddle and work from home', 'user_arjun', ?, ?
      )
    `).run(past2Id, oneDayAgoIso, oneDayAgoIso, oneDayAgoIso);

    db.prepare(`
      INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
      VALUES
        ('part_maya_km', ?, 'user_maya', 'Maya', 'Indiranagar', 12.9784, 77.6408, 2700, 1, ?),
        ('part_arjun_km', ?, 'user_arjun', 'Arjun', 'HSR Layout', 12.9121, 77.6446, 2700, 1, ?)
    `).run(past2Id, oneDayAgoIso, past2Id, oneDayAgoIso);
  }
}

/**
 * Reserve a SerpApi credit transactionally before dispatch.
 */
export function reserveCredit(label: string, _cap: number = 250): number {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM credit_attempts WHERE state != 'aborted'").get() as { count: number };
    const count = row ? Number(row.count) : 0;
    const now = new Date().toISOString();
    db.prepare('INSERT INTO credit_attempts (phase, reserved_at, state) VALUES (?, ?, ?)')
      .run(label, now, 'reserved');
    db.exec('COMMIT');
    return count + 1;
  } catch (err) {
    db.exec('ROLLBACK');
    return 1;
  }
}

export function getCreditUsage(): { researchSpent: number; researchCap: number; devSpent: number } {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM credit_attempts').get() as { count: number };
  const spent = row ? Number(row.count) : 0;
  return {
    researchSpent: spent,
    researchCap: config.budget.researchCap,
    devSpent: 0,
  };
}
