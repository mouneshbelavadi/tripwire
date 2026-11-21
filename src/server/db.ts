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

  db.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'creator' | 'participant'
      neighbourhood TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lon REAL NOT NULL,
      nex_user_id TEXT NOT NULL,
      nex_group_id TEXT NOT NULL,
      UNIQUE(team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pacts (
      id TEXT PRIMARY KEY,
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
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS worker_leases (
      lease_key TEXT PRIMARY KEY,
      holder_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      heartbeat_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      text TEXT NOT NULL,
      sent_time INTEGER NOT NULL
    );
  `);
}

export function seedInitialData(db: DatabaseSync): void {
  // Seed team members: Maya and Arjun
  const teamId = 'team_office_pact';
  const existingMembers = db.prepare('SELECT COUNT(*) as count FROM team_members WHERE team_id = ?').get(teamId) as { count: number };
  
  if (existingMembers && existingMembers.count === 0) {
    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, user_name, role, neighbourhood, origin_lat, origin_lon, nex_user_id, nex_group_id)
      VALUES 
        ('m_maya', ?, 'user_maya', 'Maya', 'creator', 'Indiranagar', 12.9784, 77.6408, 'nex_maya', 'group_office_pact'),
        ('m_arjun', ?, 'user_arjun', 'Arjun', 'participant', 'HSR Layout', 12.9121, 77.6446, 'nex_arjun', 'group_office_pact')
    `).run(teamId, teamId);
  }

  // Seed initial team messages if none exist
  const existingMsgs = db.prepare('SELECT COUNT(*) as count FROM team_messages').get() as { count: number };
  if (existingMsgs && existingMsgs.count === 0) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO team_messages (id, channel_id, user_id, user_name, text, sent_time)
      VALUES
        ('msg_init_1', 'group_office_pact', 'user_maya', 'Maya', 'Hey Arjun! Set up our Bellandur pact with a 60m threshold. Let us check commute estimates before leaving.', ?),
        ('msg_init_2', 'group_office_pact', 'user_arjun', 'Arjun', 'Sounds good Maya! Outer Ring Road can crawl in the morning. If estimates exceed 60m, let us switch to remote.', ?)
    `).run(now - 120000, now - 60000);
  }

  // Seed initial draft pact if none exists
  const existingPacts = db.prepare('SELECT COUNT(*) as count FROM pacts WHERE team_id = ?').get(teamId) as { count: number };
  if (existingPacts && existingPacts.count === 0) {
    const pactId = 'pact_bellandur_01';
    const now = new Date();
    const deadlineDate = new Date(now.getTime() + 4 * 3600 * 1000);
    const deadlineUtc = deadlineDate.toISOString();
    const deadlineIst = deadlineDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';
    const nowIso = now.toISOString();

    db.prepare(`
      INSERT INTO pacts (
        id, team_id, title, version, status,
        destination_name, destination_place_id, destination_lat, destination_lon, destination_address,
        decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
      ) VALUES (
        ?, ?, 'Bellandur office meetup', 1, 'draft',
        'WeWork Bellandur', 'ChIJk7Q3BqcUrzsR-q3Qe-place-01', 12.9290, 77.6760, 'Outer Ring Rd, Bellandur, Bengaluru',
        ?, ?, 'Switch to remote Google Meet / Slack huddle', 'user_maya', ?, ?
      )
    `).run(pactId, teamId, deadlineUtc, deadlineIst, nowIso, nowIso);

    db.prepare(`
      INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
      VALUES
        ('part_maya', ?, 'user_maya', 'Maya', 'Indiranagar', 12.9784, 77.6408, 3600, NULL, NULL),
        ('part_arjun', ?, 'user_arjun', 'Arjun', 'HSR Layout', 12.9121, 77.6446, 3600, NULL, NULL)
    `).run(pactId, pactId);
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
        ?, ?, 'Whitefield Client Sync', 1, 'completed',
        'Prestige Shantiniketan, Whitefield', 'ChIJ_whitefield_psn_01', 12.9899, 77.7289, 'Whitefield Main Rd, Bengaluru',
        ?, '09:30 IST · 19 Nov 2026', 'Switch to Google Meet and reschedule onsite to Friday', 'user_maya', ?, ?
      )
    `).run(past1Id, teamId, twoDaysAgoIso, twoDaysAgoIso, twoDaysAgoIso);

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
        ?, ?, 'Koramangala Standup', 1, 'completed',
        'Third Wave Coffee, Koramangala 4th Block', 'ChIJ_koramangala_twc_02', 12.9345, 77.6265, '80 Feet Rd, Koramangala 4th Block, Bengaluru',
        ?, '10:00 IST · 20 Nov 2026', 'Switch to Slack huddle and work from home', 'user_arjun', ?, ?
      )
    `).run(past2Id, teamId, oneDayAgoIso, oneDayAgoIso, oneDayAgoIso);

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
export function reserveCredit(label: string, cap: number = 40): number {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM credit_attempts WHERE state != 'aborted'").get() as { count: number };
    const count = row ? Number(row.count) : 0;
    if (count >= cap) {
      throw new Error(`SerpApi credit ceiling reached: ${count} >= ${cap}`);
    }
    const now = new Date().toISOString();
    db.prepare('INSERT INTO credit_attempts (phase, reserved_at, state) VALUES (?, ?, ?)')
      .run(label, now, 'reserved');
    db.exec('COMMIT');
    return count + 1;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
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
