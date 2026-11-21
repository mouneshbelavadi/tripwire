import { Router } from 'express';
import { getDb } from '../db.js';
import { getActiveUserId } from './session.js';
import { eventBus } from '../domain/eventBus.js';
import { writeRateLimiter } from '../middleware/rateLimiter.js';
import { ReceiptService } from '../domain/receiptService.js';

export const alertsRouter = Router();

// GET /api/alerts - List all alerts or filter by pact_id
alertsRouter.get('/', (req, res) => {
  try {
    const db = getDb();
    const pactId = req.query.pact_id as string | undefined;
    const rows = pactId
      ? db.prepare('SELECT * FROM alerts WHERE pact_id = ? ORDER BY created_at DESC').all(pactId)
      : db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50').all();
    res.json({ alerts: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list alerts' });
  }
});

// GET /api/alerts/:id - Full immutable alert details, participants, breaching observations, and decisions
alertsRouter.get('/:id', async (req, res) => {
  try {
    const alertId = req.params.id;
    const db = getDb();

    // 1. Alert row
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;
    if (!alert) {
      res.status(404).json({ error: `Alert not found: ${alertId}` });
      return;
    }

    // 2. Pact details
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(alert.pact_id) as any;

    // 3. Participants
    const participants = db
      .prepare('SELECT id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s FROM participants WHERE pact_id = ? ORDER BY user_id ASC')
      .all(alert.pact_id) as any[];

    // 4. Breaching observations
    const obsRows = db.prepare(`
      SELECT o.* FROM observations o
      JOIN watches w ON o.watch_id = w.id
      WHERE w.pact_id = ?
      ORDER BY o.received_at DESC
      LIMIT 10
    `).all(alert.pact_id) as any[];

    const breachingObservations = obsRows.map((obs) => {
      let parsedNormalized: any = null;
      try {
        parsedNormalized = JSON.parse(obs.normalized_json);
      } catch {
        // ignore parse error
      }
      return {
        id: obs.id,
        watch_id: obs.watch_id,
        received_at: obs.received_at,
        provider_created_at: obs.provider_created_at,
        provider_search_id: obs.provider_search_id,
        validity: obs.validity,
        provenance: obs.provenance,
        normalized: parsedNormalized,
        duration_minutes: parsedNormalized?.fastestDuration
          ? Math.round(parsedNormalized.fastestDuration / 60)
          : null,
      };
    });

    // 5. Decisions / Acknowledgements
    const ackRows = db.prepare(`
      SELECT a.id, a.alert_id, a.user_id, a.decision as action, a.created_at, tm.user_name
      FROM acknowledgements a
      LEFT JOIN team_members tm ON a.user_id = tm.user_id
      WHERE a.alert_id = ?
      ORDER BY a.created_at ASC
    `).all(alertId) as any[];

    const decisions = ackRows.map((r) => ({
      userId: r.user_id,
      userName: r.user_name || r.user_id,
      action: r.action,
      decision: r.action,
      createdAt: r.created_at,
    }));

    // 6. Consensus resolution:
    // (same choice = final; differing choices = 'needs_discussion')
    const actions = decisions.map((d) => d.action);
    const uniqueActions = Array.from(new Set(actions));
    const totalParticipants = participants.length;

    let consensus: string;
    let isFinal: boolean;

    if (uniqueActions.length === 0) {
      consensus = 'pending';
      isFinal = false;
    } else if (uniqueActions.length > 1) {
      consensus = 'needs_discussion';
      isFinal = true;
    } else {
      const singleAction = uniqueActions[0];
      if (decisions.length >= totalParticipants) {
        consensus = singleAction;
        isFinal = true;
      } else {
        consensus = singleAction;
        isFinal = false;
      }
    }

    // Attempt to load receipt for full context/compatibility
    let receipt: any = null;
    try {
      receipt = await ReceiptService.getReceipt(alertId);
    } catch {
      // Receipt might not exist yet if context hasn't fetched
    }

    res.json({
      ...(receipt || {}),
      alert: {
        id: alert.id,
        pact_id: alert.pact_id,
        rule_version: alert.rule_version,
        episode_id: alert.episode_id,
        before_observation_id: alert.before_observation_id,
        after_observation_id: alert.after_observation_id,
        decision_status: alert.decision_status,
        created_at: alert.created_at,
      },
      pact,
      participants,
      breaching_observations: breachingObservations,
      observations: breachingObservations,
      decisions,
      acknowledgements: decisions,
      consensus,
      is_final: isFinal,
      receipt,
    });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message || 'Failed to fetch alert details' });
  }
});

// POST /api/alerts/:id/decision - Accepts { action: 'remote_fallback' | 'keep_plan' | 'discuss' },
// validates user, records vote idempotently, resolves consensus
alertsRouter.post('/:id/decision', (req, res, next) => writeRateLimiter(req, res, next), (req, res) => {
  try {
    const alertId = req.params.id;
    const db = getDb();

    // 1. Alert lookup
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;
    if (!alert) {
      res.status(404).json({ error: `Alert not found: ${alertId}` });
      return;
    }

    // 2. Normalize and validate action
    const rawAction = req.body.action || req.body.decision;
    if (!rawAction) {
      res.status(400).json({
        error: 'Missing action. Must be remote_fallback, keep_plan, or discuss.',
      });
      return;
    }

    let action = String(rawAction).trim();
    if (action === 'remote') action = 'remote_fallback';
    if (action === 'keep') action = 'keep_plan';

    if (!['remote_fallback', 'keep_plan', 'discuss'].includes(action)) {
      res.status(400).json({
        error: `Invalid action "${action}". Must be remote_fallback, keep_plan, or discuss.`,
      });
      return;
    }

    // 3. User validation against pact participants
    const userId = (req.headers['x-user-id'] as string) || req.body.userId || req.body.user_id || getActiveUserId();
    const participants = db
      .prepare('SELECT user_id, user_name FROM participants WHERE pact_id = ?')
      .all(alert.pact_id) as any[];

    const isParticipant = participants.some((p) => p.user_id === userId);
    if (!isParticipant) {
      res.status(403).json({
        error: `Forbidden: User ${userId} is not a participant in this pact.`,
      });
      return;
    }

    // 4. Record vote idempotently
    // Repeated identical vote returns 200 without creating a duplicate row
    const existing = db
      .prepare('SELECT id, decision FROM acknowledgements WHERE alert_id = ? AND user_id = ?')
      .get(alertId, userId) as any;

    let isIdempotentRepeat = false;

    if (existing && existing.decision === action) {
      isIdempotentRepeat = true;
    } else {
      const ackId = existing?.id || `ack_${alertId}_${userId}`;
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO acknowledgements (id, alert_id, user_id, decision, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          decision = excluded.decision,
          created_at = excluded.created_at
      `).run(ackId, alertId, userId, action, nowIso);
    }

    // 5. Consensus resolution:
    // (same choice = final; differing choices = 'needs_discussion')
    const currentAcks = db.prepare(`
      SELECT a.id, a.alert_id, a.user_id, a.decision as action, a.created_at, tm.user_name
      FROM acknowledgements a
      LEFT JOIN team_members tm ON a.user_id = tm.user_id
      WHERE a.alert_id = ?
      ORDER BY a.created_at ASC
    `).all(alertId) as any[];

    const actions = currentAcks.map((a) => a.action);
    const uniqueActions = Array.from(new Set(actions));
    const totalParticipants = participants.length;

    let consensus: string;
    let isFinal: boolean;

    if (uniqueActions.length > 1) {
      // Differing choices: consensus = 'needs_discussion'
      consensus = 'needs_discussion';
      isFinal = true;
    } else if (currentAcks.length >= totalParticipants && uniqueActions.length === 1) {
      // All participants voted identically: final consensus
      consensus = uniqueActions[0];
      isFinal = true;
    } else {
      // Single choice so far, awaiting remaining participants
      consensus = uniqueActions[0] || 'pending';
      isFinal = false;
    }

    // Update alert status
    db.prepare('UPDATE alerts SET decision_status = ? WHERE id = ?').run(consensus, alertId);

    // Log resolution to activity and team messages if consensus is resolved
    if (isFinal && (consensus === 'remote_fallback' || consensus === 'keep_plan')) {
      const pactRow = db.prepare('SELECT title FROM pacts WHERE id = ?').get(alert.pact_id) as any;
      const resolutionMsg = consensus === 'remote_fallback'
        ? `[CONSENSUS RESOLVED] Team consensus reached: Switch to remote Google Meet and cancel cab for pact "${pactRow?.title || alert.pact_id}".`
        : `[CONSENSUS RESOLVED] Team consensus reached: Maintain office plan for pact "${pactRow?.title || alert.pact_id}".`;

      const existingMsg = db
        .prepare('SELECT id FROM team_messages WHERE channel_id = ? AND text = ?')
        .get('group_office_pact', resolutionMsg);

      if (!existingMsg) {
        const msgId = `msg_res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        db.prepare(`
          INSERT INTO team_messages (id, channel_id, user_id, user_name, text, sent_time)
          VALUES (?, 'group_office_pact', 'system', 'Tripwire Consensus Engine', ?, ?)
        `).run(msgId, resolutionMsg, Date.now());
      }
    }

    // 6. Emit event to EventBus
    eventBus.emitEvent('decision', {
      alertId,
      userId,
      action,
      consensus,
      isFinal,
      decisions: currentAcks,
    });

    // 7. Clean JSON response
    res.status(200).json({
      success: true,
      idempotent: isIdempotentRepeat,
      alertId,
      userId,
      action,
      decision: action,
      consensus,
      is_final: isFinal,
      decisions: currentAcks,
      status: consensus,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to record decision' });
  }
});
