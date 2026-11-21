import { getDb } from '../db.js';
import { WatchScheduler } from '../scheduler/watchScheduler.js';

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
  status: 'draft' | 'awaiting_approval' | 'armed' | 'paused' | 'closed';
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
      Boolean(currentUserPart) && !isCurrentUserApproved && pact.status !== 'closed';

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
   * Lists all pacts for a team after verifying membership.
   */
  static listPacts(teamId: string, userId: string): PactDetails[] {
    if (!this.verifyTeamMember(teamId, userId)) {
      throw new Error(`Forbidden: User ${userId} is not a member of team ${teamId}`);
    }
    const db = getDb();
    const rows = db.prepare('SELECT id FROM pacts WHERE team_id = ? ORDER BY updated_at DESC').all(teamId) as any[];
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

    return this.getPactDetails(pactId, userId);
  }
}
