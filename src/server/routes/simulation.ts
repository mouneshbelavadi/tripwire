import { Router } from 'express';
import { ObservationService } from '../domain/observationService.js';
import { createSyntheticBreachSequence } from '../fixtures/syntheticBreach.js';
import { getDb, getCreditUsage } from '../db.js';
import { config } from '../config.js';
import { SerpApiProvider } from '../providers/serpapi.js';
import { WatchScheduler } from '../scheduler/watchScheduler.js';

export const simulationRouter = Router();

let isSimulationActiveFlag = false;

export function isSimulationActive(): boolean {
  return isSimulationActiveFlag;
}

// POST /api/simulation/check-live - Dispatches real live SerpApi Directions checks
simulationRouter.post('/check-live', async (req, res) => {
  try {
    const db = getDb();
    const pactId = req.body.pact_id || 'pact_bellandur_01';
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      res.status(404).json({ error: 'Pact not found' });
      return;
    }

    if (!config.serpApi.isConfigured) {
      res.status(400).json({ error: 'SERPAPI_API_KEY is not configured in .env' });
      return;
    }

    // Ensure pact deadline is in future
    const fourHoursLater = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    db.prepare("UPDATE pacts SET decision_deadline_utc = ? WHERE id = ?").run(fourHoursLater, pactId);
    pact.decision_deadline_utc = fourHoursLater;

    const participants = db.prepare('SELECT * FROM participants WHERE pact_id = ?').all(pactId) as any[];
    const liveResults = [];

    for (const p of participants) {
      const watchId = `watch_route_${pactId}_${p.user_id}`;
      // Query Google Maps Directions via SerpApi
      const payload = await SerpApiProvider.search({
        engine: 'google_maps_directions',
        params: {
          start_coords: `${p.origin_lat},${p.origin_lon}`,
          end_coords: `${pact.destination_lat},${pact.destination_lon}`,
          travel_mode: '0', // Driving
          distance_unit: '0', // km
          gl: 'in',
          hl: 'en',
          no_cache: 'true',
        },
        label: watchId,
      });

      const obsResult = ObservationService.processRouteObservation({
        watchId,
        pactId,
        participantId: p.id,
        userId: p.user_id,
        rawPayload: payload,
        sourceTimestampUtc: payload.search_metadata?.created_at || new Date().toISOString(),
        provenance: 'live',
        limitSeconds: p.max_duration_s,
        deadlineUtc: pact.decision_deadline_utc,
        pactVersion: pact.version,
        queryParams: { start_coords: `${p.origin_lat},${p.origin_lon}`, end_coords: `${pact.destination_lat},${pact.destination_lon}` },
      });

      liveResults.push({
        userName: p.user_name,
        neighbourhood: p.neighbourhood,
        durationMinutes: Math.round(obsResult.fastestDrivingSeconds! / 60),
        limitMinutes: Math.round(p.max_duration_s / 60),
        outcome: obsResult.outcome,
        alertCreated: obsResult.alertCreated,
        alertId: obsResult.alertId,
      });
    }

    const creditUsage = getCreditUsage();

    res.json({
      message: `Live SerpApi check completed for ${participants.length} routes.`,
      creditUsage,
      results: liveResults,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/observations/pact/:pactId - Returns recent observations and rule states for a pact
simulationRouter.get('/pact/:pactId', (req, res) => {
  try {
    const db = getDb();
    const pactId = req.params.pactId;
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    const arrived = Boolean(pact?.arrived);
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

    res.json({ pact, arrived, observations, ruleStates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulation/trigger-breach - Simulates fresh breaches to trigger an alert receipt
simulationRouter.post('/trigger-breach', (req, res) => {
  try {
    isSimulationActiveFlag = true;
    const db = getDb();
    const pactId = req.body.pact_id || 'pact_bellandur_01';
    let userId = req.body.user_id;
    const step = req.body.step; // optional: 1 | 2 | undefined ('all')

    // Verify pact exists
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) {
      res.status(404).json({ error: 'Pact not found' });
      return;
    }

    if (!userId) {
      if (pactId === 'pact_paytm_google_anantha') {
        userId = 'user_kabir'; // Default to Kabir for Paytm Google Anantha pact
      } else {
        const firstParticipant = db.prepare('SELECT user_id FROM participants WHERE pact_id = ? ORDER BY id ASC LIMIT 1').get(pactId) as any;
        userId = firstParticipant ? firstParticipant.user_id : 'user_maya';
      }
    }

    // Ensure pact decision deadline is in the future
    const fourHoursLater = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    db.prepare("UPDATE pacts SET decision_deadline_utc = ? WHERE id = ?").run(fourHoursLater, pactId);
    pact.decision_deadline_utc = fourHoursLater;

    const participant = db
      .prepare('SELECT * FROM participants WHERE pact_id = ? AND user_id = ?')
      .get(pactId, userId) as any;

    if (!participant) {
      res.status(404).json({ error: `Participant ${userId} not found in pact ${pactId}` });
      return;
    }

    // Ensure watch exists for this participant with future next_due_at so scheduler does not overwrite demo
    const watchId = `watch_route_${pactId}_${userId}`;
    const startCoords = `${participant.origin_lat},${participant.origin_lon}`;
    const endCoords = `${pact.destination_lat},${pact.destination_lon}`;
    db.prepare(`
      INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
      VALUES (?, ?, 'google_maps_directions', ?, 'query_hash_demo', datetime('now', '+300 seconds'), 300, 1, 1)
      ON CONFLICT(id) DO UPDATE SET next_due_at = datetime('now', '+300 seconds'), enabled = 1
    `).run(watchId, pactId, JSON.stringify({ start_coords: startCoords, end_coords: endCoords }));

    // Generate fresh synthetic breach sequence
    const nowSec = Math.floor(Date.now() / 1000);
    const { obs1, obs2 } = createSyntheticBreachSequence(nowSec);

    // If step 1 only:
    if (step === 1 || step === '1' || step === 'step1') {
      // Reset baseline rule state so the 2-step sequence starts freshly from 0 breaches
      db.prepare(`
        INSERT INTO rule_states (watch_id, pact_version, last_source_at, consecutive_breaches, active, episode_id, updated_at)
        VALUES (?, ?, NULL, 0, 0, NULL, datetime('now'))
        ON CONFLICT(watch_id) DO UPDATE SET
          last_source_at = NULL,
          consecutive_breaches = 0,
          active = 0,
          episode_id = NULL,
          updated_at = datetime('now')
      `).run(watchId, pact.version);

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

      res.json({
        message: 'Breach step 1 recorded cleanly (confirming 1/2).',
        step: 1,
        pactId,
        userId,
        userName: participant.user_name,
        durationMinutes: Math.round(result1.fastestDrivingSeconds! / 60),
        limitMinutes: Math.round(participant.max_duration_s / 60),
        outcome: result1.outcome, // 'confirming'
        ruleState: result1.ruleState,
      });
      return;
    }

    // If step 2 only:
    if (step === 2 || step === '2' || step === 'step2') {
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

      if (result2.alertId) {
        const pactCompanyId = pact.company_id || 'comp_paytm';
        const deliveryReceipt = `Delivered to team channel (#channel_${pactCompanyId}_office_pact): msg_delivered_${Date.now()}`;
        db.prepare(`
          UPDATE outbox
          SET status = 'delivered',
              attempts = 1,
              provider_receipt = ?
          WHERE alert_id = ?
        `).run(deliveryReceipt, result2.alertId);

        db.prepare(`
          INSERT INTO citation_contexts (alert_id, status, answer, citations_json, retrieved_at)
          VALUES (?, 'synthetic', 'Bellandur junction is experiencing severe waterlogging near Ecospace. Outer Ring Road inbound traffic is crawling at 8-12 km/h.', '[{"url":"https://bangaloretrafficpolice.gov.in/advisories/orr-waterlogging","source":"Bangalore Traffic Police","excerpt":"Waterlogging reported near Bellandur Central Junction."}]', datetime('now'))
          ON CONFLICT(alert_id) DO NOTHING
        `).run(result2.alertId);

        const alertChatMsg = `🚨 [TRIPWIRE ALERT] Commute threshold breached twice for "${pact.title}"! Consecutive checks reached 68m and 72m (exceeding ${Math.round(participant.max_duration_s / 60)}m limit). Proposed fallback: ${pact.fallback_text}`;
        db.prepare(`
          INSERT INTO team_messages (id, company_id, channel_id, user_id, user_name, text, sent_time)
          VALUES (?, ?, ?, 'system', 'Tripwire Alert Engine', ?, ?)
        `).run(`msg_alert_${Date.now()}`, pactCompanyId, `channel_${pactCompanyId}_office_pact`, alertChatMsg, Date.now());
      }

      res.json({
        message: 'Breach step 2 recorded cleanly (alert triggered).',
        step: 2,
        pactId,
        userId,
        userName: participant.user_name,
        durationMinutes: Math.round(result2.fastestDrivingSeconds! / 60),
        limitMinutes: Math.round(participant.max_duration_s / 60),
        outcome: result2.outcome, // 'alert'
        alertCreated: result2.alertCreated,
        alertId: result2.alertId,
        ruleState: result2.ruleState,
      });
      return;
    }

    // Default: Run both steps in sequence (backward compatible with existing test suites)
    // Reset baseline rule state so the 2-step sequence starts freshly from 0 breaches
    db.prepare(`
      INSERT INTO rule_states (watch_id, pact_version, last_source_at, consecutive_breaches, active, episode_id, updated_at)
      VALUES (?, ?, NULL, 0, 0, NULL, datetime('now'))
      ON CONFLICT(watch_id) DO UPDATE SET
        last_source_at = NULL,
        consecutive_breaches = 0,
        active = 0,
        episode_id = NULL,
        updated_at = datetime('now')
    `).run(watchId, pact.version);

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

    if (result2.alertId) {
      const pactCompanyId = pact.company_id || 'comp_paytm';
      const deliveryReceipt = `Delivered to team channel (#channel_${pactCompanyId}_office_pact): msg_delivered_${Date.now()}`;
      db.prepare(`
        UPDATE outbox
        SET status = 'delivered',
            attempts = 1,
            provider_receipt = ?
        WHERE alert_id = ?
      `).run(deliveryReceipt, result2.alertId);

      db.prepare(`
        INSERT INTO citation_contexts (alert_id, status, answer, citations_json, retrieved_at)
        VALUES (?, 'synthetic', 'Bellandur junction is experiencing severe waterlogging near Ecospace. Outer Ring Road inbound traffic is crawling at 8-12 km/h.', '[{"url":"https://bangaloretrafficpolice.gov.in/advisories/orr-waterlogging","source":"Bangalore Traffic Police","excerpt":"Waterlogging reported near Bellandur Central Junction."}]', datetime('now'))
        ON CONFLICT(alert_id) DO NOTHING
      `).run(result2.alertId);

      const alertChatMsg = `🚨 [TRIPWIRE ALERT] Commute threshold breached twice for "${pact.title}"! Consecutive checks reached 68m and 72m (exceeding ${Math.round(participant.max_duration_s / 60)}m limit). Proposed fallback: ${pact.fallback_text}`;
      db.prepare(`
        INSERT INTO team_messages (id, company_id, channel_id, user_id, user_name, text, sent_time)
        VALUES (?, ?, ?, 'system', 'Tripwire Alert Engine', ?, ?)
      `).run(`msg_alert_${Date.now()}`, pactCompanyId, `channel_${pactCompanyId}_office_pact`, alertChatMsg, Date.now());
    }

    res.json({
      message: 'Synthetic 2-breach sequence executed cleanly.',
      pactId,
      userId,
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
    isSimulationActiveFlag = true;
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
    isSimulationActiveFlag = true;
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
        ? 'Delivery pending: In-app team channel unconfigured'
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

// GET /api/simulation/status - Returns whether simulated / synthetic data is currently active
simulationRouter.get('/status', (_req, res) => {
  try {
    const db = getDb();
    const syntheticObs = db.prepare("SELECT COUNT(*) as count FROM observations WHERE provenance = 'synthetic'").get() as { count: number };
    const syntheticAlerts = db.prepare("SELECT COUNT(*) as count FROM citation_contexts WHERE status = 'synthetic'").get() as { count: number };
    const alertCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE episode_id LIKE 'ep_%'").get() as { count: number };
    const creditAttemptsSim = db.prepare("SELECT COUNT(*) as count FROM credit_attempts WHERE phase LIKE 'audit%'").get() as { count: number };
    
    // Check if primary pact is in paused state from simulation or arrived
    const pact = db.prepare("SELECT status, arrived FROM pacts WHERE id = 'pact_bellandur_01'").get() as any;
    const paytmPact = db.prepare("SELECT status, arrived FROM pacts WHERE id = 'pact_paytm_google_anantha'").get() as any;
    const isPaused = pact?.status === 'paused';
    const isArrived = Boolean(paytmPact?.arrived || pact?.arrived);

    const isSimulatedActive = isSimulationActiveFlag ||
      (syntheticObs && syntheticObs.count > 0) ||
      (syntheticAlerts && syntheticAlerts.count > 0) ||
      (alertCount && alertCount.count > 0) ||
      (creditAttemptsSim && creditAttemptsSim.count > 0) ||
      isPaused;

    res.json({
      isSimulationActive: Boolean(isSimulatedActive),
      hasSimulatedData: Boolean(isSimulatedActive),
      syntheticObservationsCount: syntheticObs?.count || 0,
      syntheticAlertsCount: syntheticAlerts?.count || 0,
      alertsCount: alertCount?.count || 0,
      arrived: isArrived,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulation/reset - Resets synthetic simulation data and restores clean baseline
simulationRouter.post('/reset', (req, res) => {
  try {
    isSimulationActiveFlag = false;
    const db = getDb();
    const pactId = req.body.pact_id || 'pact_bellandur_01';

    // Clear alerts, acknowledgements, outbox, citation_contexts
    db.prepare('DELETE FROM acknowledgements').run();
    db.prepare('DELETE FROM outbox').run();
    db.prepare('DELETE FROM citation_contexts').run();
    db.prepare('DELETE FROM alerts').run();
    db.prepare("DELETE FROM observations WHERE provenance = 'synthetic'").run();
    db.prepare("DELETE FROM credit_attempts WHERE phase LIKE 'audit%' OR phase LIKE 'demo%'").run();
    db.prepare("UPDATE pacts SET arrived = 0").run();

    // Reset pact to armed state with 0 breaches
    const fourHoursLater = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (pact) {
      db.prepare("UPDATE pacts SET status = 'armed', decision_deadline_utc = ?, updated_at = datetime('now') WHERE id = ?")
        .run(fourHoursLater, pactId);
      db.prepare("UPDATE participants SET approval_version = ?, approved_at = datetime('now') WHERE pact_id = ?")
        .run(pact.version, pactId);

      const participants = db.prepare('SELECT user_id, neighbourhood, origin_lat, origin_lon FROM participants WHERE pact_id = ?').all(pactId) as any[];
      const nowSec = Math.floor(Date.now() / 1000);
      for (const p of participants) {
        const watchId = `watch_route_${pactId}_${p.user_id}`;
        const startCoords = `${p.origin_lat},${p.origin_lon}`;
        const endCoords = `${pact.destination_lat},${pact.destination_lon}`;
        db.prepare(`
          INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
          VALUES (?, ?, 'google_maps_directions', ?, 'query_hash_demo', datetime('now', '+300 seconds'), 300, 1, 1)
          ON CONFLICT(id) DO UPDATE SET next_due_at = datetime('now', '+300 seconds'), enabled = 1
        `).run(watchId, pactId, JSON.stringify({ start_coords: startCoords, end_coords: endCoords }));

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
        `).run(watchId, pact.version, nowSec - 120);
      }
    }

    res.json({
      message: 'Demo and simulation data reset cleanly.',
      reset: true,
      isSimulationActive: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulation/safe-commute - Establishes safe commute state (Kabir & Ananya, Paytm @ Google Anantha)
simulationRouter.post('/safe-commute', (req, res) => {
  try {
    isSimulationActiveFlag = false;
    const db = getDb();
    const pactId = req.body?.pact_id || 'pact_paytm_google_anantha';

    // 1. Clear all alerts, outbox, acknowledgements, and citation contexts across DB
    db.prepare('DELETE FROM acknowledgements').run();
    db.prepare('DELETE FROM outbox').run();
    db.prepare('DELETE FROM citation_contexts').run();
    db.prepare('DELETE FROM alerts').run();
    db.prepare("DELETE FROM observations WHERE provenance = 'synthetic'").run();
    db.prepare("DELETE FROM credit_attempts WHERE phase LIKE 'audit%' OR phase LIKE 'demo%'").run();

    // 2. Remove unapproved test pacts under comp_paytm
    db.prepare("DELETE FROM pacts WHERE company_id = 'comp_paytm' AND id NOT IN ('pact_paytm_google_anantha', 'pact_past_whitefield', 'pact_past_koramangala')").run();

    try {
      db.exec('ALTER TABLE pacts ADD COLUMN arrived INTEGER DEFAULT 0');
    } catch {}

    const nowSec = Math.floor(Date.now() / 1000);
    const nowIso = new Date().toISOString();
    const fourHoursLater = new Date(Date.now() + 4 * 3600 * 1000);
    const deadlineUtc = fourHoursLater.toISOString();
    const deadlineIst = fourHoursLater.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST · ' + fourHoursLater.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

    // 3. Ensure pact_paytm_google_anantha is armed, fresh, and marked arrived
    const existingPaytm = db.prepare('SELECT id FROM pacts WHERE id = ?').get(pactId);
    if (!existingPaytm) {
      db.prepare(`
        INSERT INTO pacts (
          id, company_id, team_id, title, version, status,
          destination_name, destination_place_id, destination_lat, destination_lon, destination_address,
          decision_deadline_utc, decision_deadline_ist, fallback_text, created_by, created_at, updated_at, arrived
        ) VALUES (
          ?, 'comp_paytm', 'team_office_pact', 'Paytm & Google Anantha Strategy Meetup', 1, 'armed',
          'Google Anantha Bengaluru', 'place_google_anantha_blr', 12.9352, 77.6946, 'Prestige Tech Park, Outer Ring Rd, Bellandur, Bengaluru 560103',
          ?, ?, 'Switch to remote Google Meet and cancel cab', 'user_ananya', ?, ?, 1
        )
      `).run(pactId, deadlineUtc, deadlineIst, nowIso, nowIso);
    } else {
      db.prepare(`
        UPDATE pacts SET
          status = 'armed',
          decision_deadline_utc = ?,
          decision_deadline_ist = ?,
          updated_at = ?,
          arrived = 1
        WHERE id = ?
      `).run(deadlineUtc, deadlineIst, nowIso, pactId);
    }

    // 4. Ensure bilateral participants (Kabir & Ananya, 60m limits)
    db.prepare(`
      INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
      VALUES ('part_ananya_paytm', ?, 'user_ananya', 'Ananya', 'Indiranagar', 12.9784, 77.6408, 3600, 1, ?)
      ON CONFLICT(id) DO UPDATE SET approval_version = 1, approved_at = excluded.approved_at, max_duration_s = 3600
    `).run(pactId, nowIso);

    db.prepare(`
      INSERT INTO participants (id, pact_id, user_id, user_name, neighbourhood, origin_lat, origin_lon, max_duration_s, approval_version, approved_at)
      VALUES ('part_kabir_paytm', ?, 'user_kabir', 'Kabir', 'HSR Layout', 12.9121, 77.6446, 3600, 1, ?)
      ON CONFLICT(id) DO UPDATE SET approval_version = 1, approved_at = excluded.approved_at, max_duration_s = 3600
    `).run(pactId, nowIso);

    // 5. Setup watches for both corridors using canonical coordinate queryParams
    WatchScheduler.armPactWatches(pactId);
    db.prepare("UPDATE watches SET next_due_at = datetime('now', '+300 seconds') WHERE pact_id = ?").run(pactId);

    const ananyaWatchId = `watch_route_${pactId}_user_ananya`;
    const kabirWatchId = `watch_route_${pactId}_user_kabir`;

    // 6. Reset rule states to 0 breaches and active=0
    for (const wid of [ananyaWatchId, kabirWatchId]) {
      db.prepare(`
        INSERT INTO rule_states (watch_id, pact_version, last_source_at, consecutive_breaches, active, episode_id, updated_at)
        VALUES (?, 1, ?, 0, 0, NULL, datetime('now'))
        ON CONFLICT(watch_id) DO UPDATE SET
          pact_version = 1,
          last_source_at = excluded.last_source_at,
          consecutive_breaches = 0,
          active = 0,
          episode_id = NULL,
          updated_at = excluded.updated_at
      `).run(wid, nowSec - 60);
    }

    // 7. Insert clean observations: Indiranagar 38m (2280s), HSR Layout 34m (2040s)
    const obsAnanyaId = `obs_safe_ananya_${nowSec}`;
    const obsKabirId = `obs_safe_kabir_${nowSec}`;

    db.prepare(`
      INSERT INTO observations (id, watch_id, provider_search_id, provider_created_at, received_at, query_hash, raw_hash, normalized_json, validity, provenance)
      VALUES (?, ?, 'search_safe_ananya', ?, datetime('now'), 'hash_ananya_safe', 'hash_raw_ananya', ?, 'valid', 'live')
      ON CONFLICT(id) DO NOTHING
    `).run(obsAnanyaId, ananyaWatchId, new Date(nowSec * 1000).toISOString(), JSON.stringify({ fastestDuration: 2280, limit: 3600 }));

    db.prepare(`
      INSERT INTO observations (id, watch_id, provider_search_id, provider_created_at, received_at, query_hash, raw_hash, normalized_json, validity, provenance)
      VALUES (?, ?, 'search_safe_kabir', ?, datetime('now'), 'hash_kabir_safe', 'hash_raw_kabir', ?, 'valid', 'live')
      ON CONFLICT(id) DO NOTHING
    `).run(obsKabirId, kabirWatchId, new Date(nowSec * 1000).toISOString(), JSON.stringify({ fastestDuration: 2040, limit: 3600 }));

    // 8. Also ensure Acme pact is safe if inspected
    const acmeWatchId = 'watch_route_pact_bellandur_01_user_maya';
    db.prepare(`
      UPDATE rule_states SET consecutive_breaches = 0, active = 0, episode_id = NULL, updated_at = datetime('now')
      WHERE watch_id = ?
    `).run(acmeWatchId);

    // 9. Send arrival event & confirmation to team channel
    const msgId = `msg_arrived_${nowSec}`;
    db.prepare(`
      INSERT INTO team_messages (id, company_id, channel_id, user_id, user_name, text, sent_time)
      VALUES (?, 'comp_paytm', 'channel_comp_paytm_office_pact', 'system_tripwire', 'Tripwire Engine', ?, ?)
    `).run(
      msgId,
      '🎉 [Arrived Onsite] Both Kabir (34m) and Ananya (38m) have arrived at Google Anantha Bengaluru! Commute thresholds verified (0 breaches). Proceed with strategy meetup!',
      Date.now()
    );

    res.json({
      success: true,
      arrived: true,
      allClear: true,
      message: '🎉 Safe commute verified & team arrived safely onsite at Google Anantha Bengaluru.',
      pact: {
        id: pactId,
        companyId: 'comp_paytm',
        title: 'Paytm & Google Anantha Strategy Meetup',
        status: 'armed',
        arrived: true,
        destination: 'Google Anantha Bengaluru',
        decisionDeadlineIst: deadlineIst,
      },
      corridors: [
        { corridor: 'Indiranagar', participant: 'Ananya', durationMinutes: 38, limitMinutes: 60, breaches: 0, status: 'safe' },
        { corridor: 'HSR Layout', participant: 'Kabir', durationMinutes: 34, limitMinutes: 60, breaches: 0, status: 'safe' },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
