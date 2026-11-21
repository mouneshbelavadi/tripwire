import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { WatchScheduler } from '../scheduler/watchScheduler.js';
import { eventBus } from './eventBus.js';

export interface ParticipantRecord {
  id: string;
  pact_id: string;
  user_id: string;
  user_name: string;
  neighbourhood: string;
  origin_lat: number;
  origin_lon: number;
  max_duration_s: number;
  approval_version: number | null;
  approved_at: string | null;
  is_approved: boolean; // calculated against current pact version
}

export interface PactDetails {
  id: string;
  team_id: string;
  title: string;
  version: number;
  status: 'draft' | 'awaiting_approval' | 'armed' | 'paused' | 'closed' | 'completed';
  destination_name: string;
  destination_place_id: string;
  destination_lat: number;
  destination_lon: number;
  destination_address?: string;
  decision_deadline_utc: string;
  decision_deadline_ist: string;
  fallback_text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants: ParticipantRecord[];
  all_approved: boolean;
  can_current_user_approve: boolean;
  is_current_user_approved: boolean;
  consecutive_breaches?: number;
  is_alert_active?: boolean;
  latest_source_at?: number | null;
}

export interface ParticipantInput {
  user_id: string;
  user_name?: string;
  neighbourhood?: string;
  origin_lat?: number;
  origin_lon?: number;
  max_duration_s: number;
}

export interface CreatePactInput {
  team_id?: string;
  title?: string;
  destination_name?: string;
  destination_place_id?: string;
  destination_lat?: number;
  destination_lon?: number;
  destination_address?: string;
  decision_deadline_utc?: string;
  decision_deadline_ist?: string;
  fallback_text?: string;
  status?: 'draft' | 'awaiting_approval' | 'armed' | 'paused' | 'closed' | 'completed';
  request_approvals?: boolean;
  participant_limits?: ParticipantInput[];
  participants?: ParticipantInput[];
}

export class PactService {
  /**
   * Enforces server-side team membership check.
   */
  static verifyTeamMember(teamId: string, userId: string): boolean {
    const db = getDb();
    const row = db
      .prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, userId);
    return Boolean(row);
  }

  /**
   * Retrieves pact with all participants, evaluating versioned approvals.
   */
  static getPactDetails(pactId: string, requestingUserId: string): PactDetails {
    const db = getDb();
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      throw new Error(`Pact not found: ${pactId}`);
    }

    if (!this.verifyTeamMember(pact.team_id, requestingUserId)) {
      throw new Error(`Forbidden: User ${requestingUserId} is not a member of team ${pact.team_id}`);
    }

    const rawParticipants = db
      .prepare('SELECT * FROM participants WHERE pact_id = ? ORDER BY user_id ASC')
      .all(pactId) as any[];

    const participants: ParticipantRecord[] = rawParticipants.map((p) => {
      const isApproved = p.approval_version === pact.version;
      return {
        id: p.id,
        pact_id: p.pact_id,
        user_id: p.user_id,
        user_name: p.user_name,
        neighbourhood: p.neighbourhood,
        origin_lat: p.origin_lat,
        origin_lon: p.origin_lon,
        max_duration_s: p.max_duration_s,
        approval_version: p.approval_version,
        approved_at: p.approved_at,
        is_approved: isApproved,
      };
    });

    const allApproved =
      participants.length > 0 && participants.every((p) => p.is_approved);

    const currentUserPart = participants.find((p) => p.user_id === requestingUserId);
    const isCurrentUserApproved = currentUserPart?.is_approved ?? false;
    const canCurrentUserApprove =
      Boolean(currentUserPart) && !isCurrentUserApproved && pact.status !== 'closed' && pact.status !== 'completed';

    // Query active rule state and breach status across watches for this pact
    const ruleStateRow = db
      .prepare(`
        SELECT MAX(rs.consecutive_breaches) as max_consecutive,
               MAX(rs.active) as any_active,
               MAX(rs.last_source_at) as latest_source_at
        FROM rule_states rs
        JOIN watches w ON rs.watch_id = w.id
        WHERE w.pact_id = ?
      `)
      .get(pactId) as any;

    const maxConsecutive = ruleStateRow ? Number(ruleStateRow.max_consecutive || 0) : 0;
    const isAlertActive = ruleStateRow ? Boolean(ruleStateRow.any_active) : false;
    const latestSourceAt = ruleStateRow?.latest_source_at ? Number(ruleStateRow.latest_source_at) : null;

    return {
      ...pact,
      participants,
      all_approved: allApproved,
      can_current_user_approve: canCurrentUserApprove,
      is_current_user_approved: isCurrentUserApproved,
      consecutive_breaches: maxConsecutive,
      is_alert_active: isAlertActive,
      latest_source_at: latestSourceAt,
    };
  }

  /**
   * Lists all pacts for a team / company.
   */
  static listPacts(teamId: string, userId: string, companyId?: string): PactDetails[] {
    const db = getDb();
    let rows: any[] = [];
    if (companyId) {
      rows = db.prepare('SELECT id FROM pacts WHERE company_id = ? ORDER BY updated_at DESC').all(companyId) as any[];
    }
    if (rows.length === 0) {
      rows = db.prepare('SELECT id FROM pacts WHERE team_id = ? ORDER BY updated_at DESC').all(teamId) as any[];
    }
    if (rows.length === 0) {
      rows = db.prepare('SELECT id FROM pacts ORDER BY updated_at DESC').all() as any[];
    }
    return rows.map((r) => this.getPactDetails(r.id, userId));
  }

  /**
   * Updates pact rules and thresholds.
   * INVARIANT: Any modification increments version, invalidates all prior approvals,
   * and returns status to draft.
   */
  static updatePactRules(
    pactId: string,
    userId: string,
    updates: {
      title?: string;
      destination_name?: string;
      destination_place_id?: string;
      destination_lat?: number;
      destination_lon?: number;
      destination_address?: string;
      decision_deadline_ist?: string;
      decision_deadline_utc?: string;
      fallback_text?: string;
      participant_limits?: { user_id: string; max_duration_s: number }[];
    }
  ): PactDetails {
    const db = getDb();
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      throw new Error(`Pact not found: ${pactId}`);
    }

    if (!this.verifyTeamMember(pact.team_id, userId)) {
      throw new Error(`Forbidden: User ${userId} is not a member of team ${pact.team_id}`);
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      const newVersion = pact.version + 1;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE pacts SET
          title = COALESCE(?, title),
          destination_name = COALESCE(?, destination_name),
          destination_place_id = COALESCE(?, destination_place_id),
          destination_lat = COALESCE(?, destination_lat),
          destination_lon = COALESCE(?, destination_lon),
          destination_address = COALESCE(?, destination_address),
          decision_deadline_ist = COALESCE(?, decision_deadline_ist),
          decision_deadline_utc = COALESCE(?, decision_deadline_utc),
          fallback_text = COALESCE(?, fallback_text),
          version = ?,
          status = 'draft',
          updated_at = ?
        WHERE id = ?
      `).run(
        updates.title ?? null,
        updates.destination_name ?? null,
        updates.destination_place_id ?? null,
        updates.destination_lat ?? null,
        updates.destination_lon ?? null,
        updates.destination_address ?? null,
        updates.decision_deadline_ist ?? null,
        updates.decision_deadline_utc ?? null,
        updates.fallback_text ?? null,
        newVersion,
        now,
        pactId
      );

      // Invalidate all prior approvals because pact version has advanced
      db.prepare(`
        UPDATE participants SET
          approval_version = NULL,
          approved_at = NULL
        WHERE pact_id = ?
      `).run(pactId);

      // Update participant individual limits if provided
      if (updates.participant_limits) {
        for (const limit of updates.participant_limits) {
          db.prepare(`
            UPDATE participants SET max_duration_s = ? WHERE pact_id = ? AND user_id = ?
          `).run(limit.max_duration_s, pactId, limit.user_id);
        }
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return this.getPactDetails(pactId, userId);
  }

  /**
   * Approves the pact for the authenticated user.
   * INVARIANT: Tied to exact pact version. Only when ALL participants approve the current
   * version does the pact become 'armed'.
   */
  static approvePact(pactId: string, userId: string): PactDetails {
    const db = getDb();
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      throw new Error(`Pact not found: ${pactId}`);
    }

    if (!this.verifyTeamMember(pact.team_id, userId)) {
      throw new Error(`Forbidden: User ${userId} is not a member of team ${pact.team_id}`);
    }

    const participant = db
      .prepare('SELECT id, approval_version FROM participants WHERE pact_id = ? AND user_id = ?')
      .get(pactId, userId) as any;

    if (!participant) {
      throw new Error(`Forbidden: User ${userId} is not a participant in this pact.`);
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      const now = new Date().toISOString();
      // Record approval for the current version
      db.prepare(`
        UPDATE participants SET
          approval_version = ?,
          approved_at = ?
        WHERE id = ?
      `).run(pact.version, now, participant.id);

      // Check if all participants have now approved this version
      const allParts = db
        .prepare('SELECT user_id, approval_version FROM participants WHERE pact_id = ?')
        .all(pactId) as any[];

      const allApproved =
        allParts.length > 0 && allParts.every((p) => p.approval_version === pact.version);

      if (allApproved) {
        db.prepare(`
          UPDATE pacts SET
            status = 'armed',
            updated_at = ?
          WHERE id = ?
        `).run(now, pactId);
      } else {
        db.prepare(`
          UPDATE pacts SET
            status = 'awaiting_approval',
            updated_at = ?
          WHERE id = ?
        `).run(now, pactId);
      }

      db.exec('COMMIT');

      if (allApproved) {
        WatchScheduler.armPactWatches(pactId);
      }
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const pactDetails = this.getPactDetails(pactId, userId);
    eventBus.emitEvent('approval', {
      pactId,
      userId,
      version: pactDetails.version,
      status: pactDetails.status,
      allApproved: pactDetails.all_approved,
      pact: pactDetails,
    });
    return pactDetails;
  }

  /**
   * Creates a brand new pact with UUID, adds Maya and Arjun as participants with
   * initial default thresholds, and attaches default watches.
   */
  static createPact(teamId: string, userId: string, input: CreatePactInput): PactDetails {
    if (!this.verifyTeamMember(teamId, userId)) {
      throw new Error(`Forbidden: User ${userId} is not a member of team ${teamId}`);
    }

    const db = getDb();
    const pactId = 'pact_' + crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();

    const defaultDeadlineDate = new Date(now.getTime() + 4 * 3600 * 1000);
    const deadlineUtc = input.decision_deadline_utc || defaultDeadlineDate.toISOString();
    const deadlineIst = input.decision_deadline_ist || (
      defaultDeadlineDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST'
    );

    const title = input.title?.trim() || 'Office Meetup';
    const destinationName = input.destination_name?.trim() || 'WeWork Bellandur';
    const destinationPlaceId = input.destination_place_id?.trim() || 'ChIJk7Q3BqcUrzsR-q3Qe-place-01';
    const destinationLat = input.destination_lat ?? 12.9290;
    const destinationLon = input.destination_lon ?? 77.6760;
    const destinationAddress = input.destination_address || 'Outer Ring Rd, Bellandur, Bengaluru';
    const fallbackText = input.fallback_text?.trim() || 'Switch to remote Google Meet / Slack huddle';

    let members = db.prepare('SELECT * FROM team_members WHERE team_id = ? ORDER BY user_id ASC').all(teamId) as any[];
    if (!members || members.length === 0) {
      members = [
        { user_id: 'user_maya', user_name: 'Maya', neighbourhood: 'Indiranagar', origin_lat: 12.9784, origin_lon: 77.6408 },
        { user_id: 'user_arjun', user_name: 'Arjun', neighbourhood: 'HSR Layout', origin_lat: 12.9121, origin_lon: 77.6446 },
      ];
    }

    const initialStatus = (input.status === 'awaiting_approval' || input.request_approvals)
      ? 'awaiting_approval'
      : (input.status || 'draft');

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        INSERT INTO pacts (
          id, team_id, title, version, status,
          destination_name, destination_place_id, destination_lat, destination_lon, destination_address,
          decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 1, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `).run(
        pactId,
        teamId,
        title,
        initialStatus,
        destinationName,
        destinationPlaceId,
        destinationLat,
        destinationLon,
        destinationAddress,
        deadlineUtc,
        deadlineIst,
        fallbackText,
        userId,
        nowIso,
        nowIso
      );

      const participantLimits = input.participant_limits || input.participants;

      for (const m of members) {
        const participantId = `part_${pactId}_${m.user_id}`;
        const limitConfig = participantLimits?.find((l: any) => l.user_id === m.user_id || l.user_name?.toLowerCase() === m.user_name?.toLowerCase());
        const maxDurationS = limitConfig?.max_duration_s ?? 3600;
        const neighbourhood = limitConfig?.neighbourhood || m.neighbourhood;
        const originLat = limitConfig?.origin_lat ?? m.origin_lat;
        const originLon = limitConfig?.origin_lon ?? m.origin_lon;
        const userName = limitConfig?.user_name || m.user_name;

        db.prepare(`
          INSERT INTO participants (
            id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        `).run(
          participantId,
          pactId,
          m.user_id,
          userName,
          neighbourhood,
          originLat,
          originLon,
          maxDurationS
        );
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Attach default watches for the new pact
    WatchScheduler.armPactWatches(pactId);

    return this.getPactDetails(pactId, userId);
  }

  /**
   * Pauses an active pact and disables its watches.
   */
  static pausePact(pactId: string, userId: string): PactDetails {
    const db = getDb();
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      throw new Error(`Pact not found: ${pactId}`);
    }

    if (!this.verifyTeamMember(pact.team_id, userId)) {
      throw new Error(`Forbidden: User ${userId} is not a member of team ${pact.team_id}`);
    }

    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        UPDATE pacts SET
          status = 'paused',
          updated_at = ?
        WHERE id = ?
      `).run(now, pactId);

      db.prepare('UPDATE watches SET enabled = 0 WHERE pact_id = ?').run(pactId);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return this.getPactDetails(pactId, userId);
  }

  /**
   * Marks a pact as completed/closed and disables active watches.
   */
  static closePact(pactId: string, userId: string, targetStatus: 'completed' | 'closed' = 'completed'): PactDetails {
    const db = getDb();
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      throw new Error(`Pact not found: ${pactId}`);
    }

    if (!this.verifyTeamMember(pact.team_id, userId)) {
      throw new Error(`Forbidden: User ${userId} is not a member of team ${pact.team_id}`);
    }

    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        UPDATE pacts SET
          status = ?,
          updated_at = ?
        WHERE id = ?
      `).run(targetStatus, now, pactId);

      // Disable any active watches for this completed pact
      db.prepare('UPDATE watches SET enabled = 0 WHERE pact_id = ?').run(pactId);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return this.getPactDetails(pactId, userId);
  }
}
