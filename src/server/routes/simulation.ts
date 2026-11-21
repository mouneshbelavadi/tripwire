import { Router } from 'express';
import { ObservationService } from '../domain/observationService.js';
import { createSyntheticBreachSequence } from '../fixtures/syntheticBreach.js';
import { getDb } from '../db.js';

export const simulationRouter = Router();

// GET /api/observations/pact/:pactId - Returns recent observations and rule states for a pact
simulationRouter.get('/pact/:pactId', (req, res) => {
  try {
    const db = getDb();
    const pactId = req.params.pactId;
    const observations = db
      .prepare(`
        SELECT o.*, w.engine, w.params_json
        FROM observations o
        JOIN watches w ON o.watch_id = w.id
        WHERE w.pact_id = ?
        ORDER BY o.received_at DESC
        LIMIT 30
      `)
      .all(pactId);

    const ruleStates = db
      .prepare(`
        SELECT rs.*, w.engine, w.params_json
        FROM rule_states rs
        JOIN watches w ON rs.watch_id = w.id
        WHERE w.pact_id = ?
      `)
      .all(pactId);

    res.json({ observations, ruleStates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulation/trigger-breach - Simulates 2 fresh breaches to trigger an alert receipt
simulationRouter.post('/trigger-breach', (req, res) => {
  try {
    const db = getDb();
    const pactId = req.body.pact_id || 'pact_bellandur_01';
    const userId = req.body.user_id || 'user_maya';

    // Verify pact exists
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      res.status(404).json({ error: 'Pact not found' });
      return;
    }

    // Ensure pact decision deadline is in the future
    const fourHoursLater = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    db.prepare("UPDATE pacts SET decision_deadline_utc = ? WHERE id = ?").run(fourHoursLater, pactId);
    pact.decision_deadline_utc = fourHoursLater;

    const participant = db
      .prepare('SELECT * FROM participants WHERE pact_id = ? AND user_id = ?')
      .get(pactId, userId) as any;

    if (!participant) {
      res.status(404).json({ error: 'Participant not found in pact' });
      return;
    }

    // Ensure watch exists for this participant
    const watchId = `watch_route_${pactId}_${userId}`;
    db.prepare(`
      INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
      VALUES (?, ?, 'google_maps_directions', ?, 'query_hash_demo', datetime('now'), 300, 1, 1)
      ON CONFLICT(id) DO NOTHING
    `).run(watchId, pactId, JSON.stringify({ start: participant.neighbourhood, end: pact.destination_name }));

    // Generate fresh synthetic breach sequence
    const nowSec = Math.floor(Date.now() / 1000);
    const { obs1, obs2 } = createSyntheticBreachSequence(nowSec);

    // 1. First breach observation (68 min)
    const result1 = ObservationService.processRouteObservation({
      watchId,
      pactId,
      participantId: participant.id,
      userId,
      rawPayload: obs1,
      sourceTimestampUtc: obs1.search_metadata.created_at,
      provenance: 'synthetic',
      limitSeconds: participant.max_duration_s,
      deadlineUtc: pact.decision_deadline_utc,
      pactVersion: pact.version,
      queryParams: { start_coords: `${participant.origin_lat},${participant.origin_lon}`, end_coords: `${pact.destination_lat},${pact.destination_lon}` },
    });

    // 2. Second breach observation (72 min) -> generates alert
    const result2 = ObservationService.processRouteObservation({
      watchId,
      pactId,
      participantId: participant.id,
      userId,
      rawPayload: obs2,
      sourceTimestampUtc: obs2.search_metadata.created_at,
      provenance: 'synthetic',
      limitSeconds: participant.max_duration_s,
      deadlineUtc: pact.decision_deadline_utc,
      pactVersion: pact.version,
      queryParams: { start_coords: `${participant.origin_lat},${participant.origin_lon}`, end_coords: `${pact.destination_lat},${pact.destination_lon}` },
    });

    res.json({
      message: 'Synthetic 2-breach sequence executed cleanly.',
      step1: {
        durationMinutes: Math.round(result1.fastestDrivingSeconds! / 60),
        outcome: result1.outcome, // 'confirming'
      },
      step2: {
        durationMinutes: Math.round(result2.fastestDrivingSeconds! / 60),
        outcome: result2.outcome, // 'alert'
        alertCreated: result2.alertCreated,
        alertId: result2.alertId,
      },
      ruleState: result2.ruleState,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulation/replay-dedup - Replays an identical observation to demonstrate duplicate rejection
simulationRouter.post('/replay-dedup', (req, res) => {
  try {
    const db = getDb();
    const pactId = req.body.pact_id || 'pact_bellandur_01';
    const userId = req.body.user_id || 'user_maya';
    const watchId = `watch_route_${pactId}_${userId}`;

    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    const participant = db.prepare('SELECT * FROM participants WHERE pact_id = ? AND user_id = ?').get(pactId, userId) as any;

    const nowSec = Math.floor(Date.now() / 1000);
    const { obs2 } = createSyntheticBreachSequence(nowSec);

    // Run once
    ObservationService.processRouteObservation({
      watchId,
      pactId,
      participantId: participant.id,
      userId,
      rawPayload: obs2,
      sourceTimestampUtc: obs2.search_metadata.created_at,
      provenance: 'synthetic',
      limitSeconds: participant.max_duration_s,
      deadlineUtc: pact.decision_deadline_utc,
      pactVersion: pact.version,
      queryParams: { start_coords: '12.9784,77.6408', end_coords: '12.9290,77.6760' },
    });

    // Replay with identical payload and timestamp
    const replayResult = ObservationService.processRouteObservation({
      watchId,
      pactId,
      participantId: participant.id,
      userId,
      rawPayload: obs2,
      sourceTimestampUtc: obs2.search_metadata.created_at,
      provenance: 'synthetic',
      limitSeconds: participant.max_duration_s,
      deadlineUtc: pact.decision_deadline_utc,
      pactVersion: pact.version,
      queryParams: { start_coords: '12.9784,77.6408', end_coords: '12.9290,77.6760' },
    });

    res.json({
      message: 'Replay completed.',
      outcome: replayResult.outcome, // 'duplicate_or_old'
      isRejected: replayResult.outcome === 'duplicate_or_old',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulation/state/set - Switch system state for Phase 7 visual audit
simulationRouter.post('/state/set', (req, res) => {
  try {
    const db = getDb();
    const pactId = req.body.pact_id || 'pact_bellandur_01';
    const targetState = req.body.state; // 'draft' | 'armed' | 'confirming' | 'alert' | 'stale' | 'budget_paused' | 'delivery_pending'

    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      res.status(404).json({ error: 'Pact not found' });
      return;
    }

    const mayaWatchId = `watch_route_${pactId}_user_maya`;
    const nowSec = Math.floor(Date.now() / 1000);

    // Clean test pacts and cascade to ensure pact_bellandur_01 is top and active
    db.prepare("DELETE FROM rule_states WHERE watch_id IN (SELECT id FROM watches WHERE pact_id != ?)").run(pactId);
    db.prepare("DELETE FROM observations WHERE watch_id IN (SELECT id FROM watches WHERE pact_id != ?)").run(pactId);
    db.prepare("DELETE FROM watches WHERE pact_id != ?").run(pactId);
    db.prepare("DELETE FROM acknowledgements WHERE alert_id IN (SELECT id FROM alerts WHERE pact_id != ?)").run(pactId);
    db.prepare("DELETE FROM outbox WHERE alert_id IN (SELECT id FROM alerts WHERE pact_id != ?)").run(pactId);
    db.prepare("DELETE FROM citation_contexts WHERE alert_id IN (SELECT id FROM alerts WHERE pact_id != ?)").run(pactId);
    db.prepare("DELETE FROM alerts WHERE pact_id != ?").run(pactId);
    db.prepare("DELETE FROM participants WHERE pact_id != ?").run(pactId);
    db.prepare("DELETE FROM pacts WHERE id != ?").run(pactId);
    const fourHoursLater = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    db.prepare("UPDATE pacts SET updated_at = datetime('now'), decision_deadline_utc = ? WHERE id = ?").run(fourHoursLater, pactId);

    // Clean alerts & outbox for pristine state rendering
    db.prepare('DELETE FROM outbox').run();
    db.prepare('DELETE FROM acknowledgements').run();
    db.prepare('DELETE FROM citation_contexts').run();
    db.prepare('DELETE FROM alerts WHERE pact_id = ?').run(pactId);

    // Clear budget when not testing budget pause
    if (targetState !== 'budget_paused') {
      db.prepare("DELETE FROM credit_attempts WHERE state = 'reserved' OR state = 'spent'").run();
    }

    // Ensure watch exists
    db.prepare(`
      INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
      VALUES (?, ?, 'google_maps_directions', '{}', 'query_hash_demo', datetime('now'), 300, 1, 1)
      ON CONFLICT(id) DO NOTHING
    `).run(mayaWatchId, pactId);

    if (targetState === 'draft') {
      db.prepare("UPDATE pacts SET status = 'draft' WHERE id = ?").run(pactId);
      db.prepare("UPDATE participants SET approval_version = NULL, approved_at = NULL, max_duration_s = 3600 WHERE pact_id = ?").run(pactId);
      db.prepare("DELETE FROM rule_states WHERE watch_id = ?").run(mayaWatchId);
    } else if (targetState === 'armed') {
      db.prepare("UPDATE pacts SET status = 'armed' WHERE id = ?").run(pactId);
      db.prepare("UPDATE participants SET approval_version = ?, approved_at = datetime('now'), max_duration_s = 3600 WHERE pact_id = ?").run(pact.version, pactId);
      db.prepare(`
        INSERT INTO rule_states (watch_id, pact_version, last_source_at, consecutive_breaches, active, episode_id, updated_at)
        VALUES (?, ?, ?, 0, 0, NULL, datetime('now'))
        ON CONFLICT(watch_id) DO UPDATE SET
          pact_version = excluded.pact_version,
          last_source_at = excluded.last_source_at,
          consecutive_breaches = 0,
          active = 0,
          episode_id = NULL,
          updated_at = excluded.updated_at
      `).run(mayaWatchId, pact.version, nowSec - 180);
    } else if (targetState === 'confirming') {
      db.prepare("UPDATE pacts SET status = 'armed' WHERE id = ?").run(pactId);
      db.prepare("UPDATE participants SET approval_version = ?, approved_at = datetime('now') WHERE pact_id = ?").run(pact.version, pactId);
      db.prepare(`
        INSERT INTO rule_states (watch_id, pact_version, last_source_at, consecutive_breaches, active, episode_id, updated_at)
        VALUES (?, ?, ?, 1, 0, NULL, datetime('now'))
        ON CONFLICT(watch_id) DO UPDATE SET
          pact_version = excluded.pact_version,
          last_source_at = excluded.last_source_at,
          consecutive_breaches = 1,
          active = 0,
          episode_id = NULL,
          updated_at = excluded.updated_at
      `).run(mayaWatchId, pact.version, nowSec - 60);
    } else if (targetState === 'alert' || targetState === 'delivery_pending') {
      db.prepare("UPDATE pacts SET status = 'armed' WHERE id = ?").run(pactId);
      db.prepare("UPDATE participants SET approval_version = ?, approved_at = datetime('now') WHERE pact_id = ?").run(pact.version, pactId);

      const alertId = `alert_${pactId}_audit`;
      const episodeId = `ep_audit_${nowSec}`;
      db.prepare(`
        INSERT INTO alerts (id, pact_id, rule_version, episode_id, decision_status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `).run(alertId, pactId, pact.version, episodeId);

      const outboxStatus = targetState === 'delivery_pending' ? 'pending' : 'delivered';
      const outboxReceipt = targetState === 'delivery_pending'
        ? 'Delivery pending: Nexconn unconfigured'
        : 'Delivered to group_office_pact: msg_delivered_demo';

      db.prepare(`
        INSERT INTO outbox (id, alert_id, status, attempts, provider_receipt, next_attempt_at, created_at)
        VALUES (?, ?, ?, 1, ?, datetime('now', '+30 seconds'), datetime('now'))
      `).run(`out_${alertId}`, alertId, outboxStatus, outboxReceipt);

      db.prepare(`
        INSERT INTO citation_contexts (alert_id, status, answer, citations_json, retrieved_at)
        VALUES (?, 'synthetic', 'Bellandur junction is experiencing severe waterlogging near Ecospace. Outer Ring Road inbound traffic is crawling.', '[{"url":"https://bangaloretrafficpolice.gov.in/advisories/orr-waterlogging","source":"Bangalore Traffic Police","excerpt":"Waterlogging reported near Bellandur Central Junction."}]', datetime('now'))
      `).run(alertId);

      db.prepare(`
        INSERT INTO rule_states (watch_id, pact_version, last_source_at, consecutive_breaches, active, episode_id, updated_at)
        VALUES (?, ?, ?, 2, 1, ?, datetime('now'))
        ON CONFLICT(watch_id) DO UPDATE SET
          pact_version = excluded.pact_version,
          last_source_at = excluded.last_source_at,
          consecutive_breaches = 2,
          active = 1,
          episode_id = excluded.episode_id,
          updated_at = excluded.updated_at
      `).run(mayaWatchId, pact.version, nowSec - 30, episodeId);
    } else if (targetState === 'stale') {
      db.prepare("UPDATE pacts SET status = 'armed' WHERE id = ?").run(pactId);
      db.prepare("UPDATE participants SET approval_version = ?, approved_at = datetime('now') WHERE pact_id = ?").run(pact.version, pactId);
      const staleTime = nowSec - 720; // 12 minutes ago
      db.prepare(`
        INSERT INTO rule_states (watch_id, pact_version, last_source_at, consecutive_breaches, active, episode_id, updated_at)
        VALUES (?, ?, ?, 0, 0, NULL, datetime('now', '-12 minutes'))
        ON CONFLICT(watch_id) DO UPDATE SET
          pact_version = excluded.pact_version,
          last_source_at = excluded.last_source_at,
          consecutive_breaches = 0,
          active = 0,
          episode_id = NULL,
          updated_at = excluded.updated_at
      `).run(mayaWatchId, pact.version, staleTime);
    } else if (targetState === 'budget_paused') {
      db.prepare("UPDATE pacts SET status = 'paused' WHERE id = ?").run(pactId);
      const existing = (db.prepare('SELECT COUNT(*) as count FROM credit_attempts').get() as any).count || 0;
      for (let i = existing; i < 40; i++) {
        db.prepare("INSERT INTO credit_attempts (phase, reserved_at, state) VALUES (?, datetime('now'), 'reserved')")
          .run(`audit_fill_${i}`);
      }
    }

    res.json({ message: `Simulated state set to "${targetState}" cleanly.`, state: targetState });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
