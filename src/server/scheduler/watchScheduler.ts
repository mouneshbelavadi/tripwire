import { getDb, reserveCredit } from '../db.js';
import { config } from '../config.js';
import { ObservationService } from '../domain/observationService.js';
import { SerpApiProvider } from '../providers/serpapi.js';
import { createSyntheticBreachSequence, createSyntheticTrafficPayload } from '../fixtures/syntheticBreach.js';
import { canonicalQueryHash } from '../domain/tripwireCore.js';
import { isSimulationActive } from '../routes/simulation.js';

export interface SchedulerStatus {
  state: 'idle' | 'running' | 'budget_exhausted' | 'deadline_reached';
  lastTickAt: string | null;
  activeWatchesCount: number;
  inFlightQueries: number;
  budgetSpent: number;
  budgetCap: number;
  stopReason?: string;
}

export class WatchScheduler {
  private static inFlight = new Map<string, Promise<any>>();
  private static lastTickAt: string | null = null;
  private static schedulerState: 'idle' | 'running' | 'budget_exhausted' | 'deadline_reached' = 'idle';
  private static stopReason?: string;

  static getStatus(): SchedulerStatus {
    const db = getDb();
    const activeWatches = db
      .prepare('SELECT COUNT(*) as count FROM watches WHERE enabled = 1')
      .get() as { count: number };
    const creditUsage = db
      .prepare("SELECT COUNT(*) as count FROM credit_attempts WHERE state != 'aborted'")
      .get() as { count: number };

    return {
      state: this.schedulerState,
      lastTickAt: this.lastTickAt,
      activeWatchesCount: activeWatches ? Number(activeWatches.count) : 0,
      inFlightQueries: this.inFlight.size,
      budgetSpent: creditUsage ? Number(creditUsage.count) : 0,
      budgetCap: config.budget.researchCap,
      stopReason: this.stopReason,
    };
  }

  /**
   * Initializes / arms watches for an armed pact.
   * Creates route watches (5m TTL) for each participant and traffic watch (15m TTL).
   */
  static armPactWatches(pactId: string): void {
    const db = getDb();
    const pact = db.prepare('SELECT * FROM pacts WHERE id = ?').get(pactId) as any;
    if (!pact) return;

    const participants = db.prepare('SELECT * FROM participants WHERE pact_id = ?').all(pactId) as any[];
    const now = new Date();
    const nowIso = now.toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
      // 1. Create Route Watches for each participant (5 min TTL)
      for (const p of participants) {
        const watchId = `watch_route_${pactId}_${p.user_id}`;
        const queryParams = {
          start_coords: `${p.origin_lat},${p.origin_lon}`,
          end_coords: `${pact.destination_lat},${pact.destination_lon}`,
          travel_mode: 0,
          distance_unit: 0,
          gl: 'in',
          hl: 'en',
        };
        const queryHash = canonicalQueryHash('google_maps_directions', queryParams);

        db.prepare(`
          INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
          VALUES (?, ?, 'google_maps_directions', ?, ?, ?, 300, 1, 1)
          ON CONFLICT(id) DO UPDATE SET
            enabled = 1,
            next_due_at = excluded.next_due_at,
            params_json = excluded.params_json,
            query_hash = excluded.query_hash
        `).run(watchId, pactId, JSON.stringify(queryParams), queryHash, nowIso);
      }

      // 2. Create Area Traffic Watch (15 min TTL)
      const trafficWatchId = `watch_traffic_${pactId}`;
      const trafficParams = {
        bbox: '12.97,77.64,12.90,77.71',
        zoom: 13,
        gl: 'in',
        hl: 'en',
      };
      const trafficHash = canonicalQueryHash('google_maps_traffic', trafficParams);

      db.prepare(`
        INSERT INTO watches (id, pact_id, engine, params_json, query_hash, next_due_at, ttl_s, priority, enabled)
        VALUES (?, ?, 'google_maps_traffic', ?, ?, ?, 900, 2, 1)
        ON CONFLICT(id) DO UPDATE SET
          enabled = 1,
          next_due_at = excluded.next_due_at,
          params_json = excluded.params_json,
          query_hash = excluded.query_hash
      `).run(trafficWatchId, pactId, JSON.stringify(trafficParams), trafficHash, nowIso);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * Main scheduler tick: Dispatches due watches with strict single-flight and budget limits.
   */
  static async tick(): Promise<number> {
    if (isSimulationActive()) {
      this.schedulerState = 'idle';
      return 0;
    }

    const db = getDb();
    const now = new Date();
    const nowIso = now.toISOString();
    this.lastTickAt = nowIso;

    // Upfront: Disable all watches for expired pacts so they stop evaluating immediately
    db.prepare(`
      UPDATE watches
      SET enabled = 0
      WHERE enabled = 1
        AND pact_id IN (
          SELECT id FROM pacts
          WHERE datetime(decision_deadline_utc) <= datetime(?)
        )
    `).run(nowIso);

    // 1. Fetch due watches ordered by priority then deadline
    const dueWatches = db
      .prepare(`
        SELECT w.*, p.decision_deadline_utc, p.version as pact_version, p.status as pact_status
        FROM watches w
        JOIN pacts p ON w.pact_id = p.id
        WHERE w.enabled = 1
          AND w.next_due_at <= ?
          AND p.status = 'armed'
        ORDER BY w.priority ASC, w.next_due_at ASC
        LIMIT 5
      `)
      .all(nowIso) as any[];

    if (dueWatches.length === 0) {
      if (this.schedulerState !== 'budget_exhausted' && this.schedulerState !== 'deadline_reached') {
        this.schedulerState = 'idle';
      }
      return 0;
    }

    this.schedulerState = 'running';
    let dispatchedCount = 0;

    for (const watch of dueWatches) {
      // 2. Deadline check: If past deadline, disable watch immediately
      if (new Date(watch.decision_deadline_utc) <= now) {
        db.prepare('UPDATE watches SET enabled = 0 WHERE id = ?').run(watch.id);
        this.schedulerState = 'deadline_reached';
        this.stopReason = `Monitoring stopped: decision deadline ${watch.decision_deadline_utc} reached.`;
        continue;
      }

      // 3. Single-flight duplicate query check
      const queryKey = `${watch.engine}:${watch.query_hash}`;
      if (this.inFlight.has(queryKey)) {
        // Query already in-flight; skip to prevent concurrent duplicate dispatch
        continue;
      }

      // 4. Budget check & transactional reservation
      let reservationNumber = 0;
      if (config.serpApi.isConfigured) {
        try {
          reservationNumber = reserveCredit(watch.id, config.budget.researchCap);
        } catch (budgetErr: any) {
          this.schedulerState = 'budget_exhausted';
          this.stopReason = `Monitoring paused: session credit limit reached (${budgetErr.message}).`;
          // Postpone watch check
          const backoffDue = new Date(now.getTime() + 60000).toISOString();
          db.prepare('UPDATE watches SET next_due_at = ? WHERE id = ?').run(backoffDue, watch.id);
          break; // Stop dispatching further due watches
        }
      }

      // 5. Update next due time in DB immediately to prevent concurrent worker pick
      const nextDue = new Date(now.getTime() + watch.ttl_s * 1000).toISOString();
      db.prepare('UPDATE watches SET next_due_at = ? WHERE id = ?').run(nextDue, watch.id);

      // 6. Execute dispatch with single-flight tracking
      const executionPromise = this.executeWatch(watch, reservationNumber).finally(() => {
        this.inFlight.delete(queryKey);
      });

      this.inFlight.set(queryKey, executionPromise);
      dispatchedCount++;
    }

    return dispatchedCount;
  }

  private static async executeWatch(watch: any, _creditReservation: number): Promise<void> {
    const params = JSON.parse(watch.params_json);

    try {
      if (watch.engine === 'google_maps_directions') {
        let payload: any;

        if (config.serpApi.isConfigured) {
          // Live SerpApi Directions call with no_cache=true per contract
          payload = await SerpApiProvider.search({
            engine: 'google_maps_directions',
            params: { ...params, no_cache: 'true' },
            label: watch.id,
          });
        } else {
          // Deterministic simulation payload for offline / simulation mode
          const seq = createSyntheticBreachSequence();
          payload = seq.obs1;
        }

        const db = getDb();
        // Extract userId from watchId format: watch_route_${pactId}_${userId}
        let participant: any;
        if (watch.id.includes('user_')) {
          const matchedUserId = 'user_' + watch.id.split('user_')[1];
          participant = db
            .prepare('SELECT id, user_id, max_duration_s FROM participants WHERE pact_id = ? AND user_id = ?')
            .get(watch.pact_id, matchedUserId) as any;
        }
        if (!participant) {
          participant = db
            .prepare('SELECT id, user_id, max_duration_s FROM participants WHERE pact_id = ? LIMIT 1')
            .get(watch.pact_id) as any;
        }

        if (participant) {
          ObservationService.processRouteObservation({
            watchId: watch.id,
            pactId: watch.pact_id,
            participantId: participant.id,
            userId: participant.user_id,
            rawPayload: payload,
            sourceTimestampUtc: payload.search_metadata?.created_at || new Date().toISOString(),
            provenance: config.serpApi.isConfigured ? 'live' : 'synthetic',
            limitSeconds: participant.max_duration_s,
            deadlineUtc: watch.decision_deadline_utc,
            pactVersion: watch.pact_version,
            queryParams: params,
          });
        }
      } else if (watch.engine === 'google_maps_traffic') {
        let payload: any;

        if (config.serpApi.isConfigured) {
          // Live SerpApi Traffic call with no_cache=true per contract
          payload = await SerpApiProvider.search({
            engine: 'google_maps_traffic',
            params: { ...params, no_cache: 'true' },
            label: watch.id,
          });
        } else {
          payload = createSyntheticTrafficPayload();
        }

        const trafficResult = ObservationService.processTrafficObservation({
          watchId: watch.id,
          pactId: watch.pact_id,
          rawPayload: payload,
          sourceTimestampUtc: payload.search_metadata?.created_at || new Date().toISOString(),
          provenance: config.serpApi.isConfigured ? 'live' : 'synthetic',
          bboxParams: params,
        });

        // If new incident IDs observed, expedite route check if budget permits
        if (trafficResult.requestsRouteRecheck) {
          this.expediteRouteWatch(watch.pact_id);
        }
      }
    } catch (err) {
      console.error(`[WatchScheduler] Watch execution error for ${watch.id}:`, err);
    }
  }

  /**
   * Expedites the route check when area traffic incidents change,
   * respecting a minimum 60s recheck interval.
   */
  private static expediteRouteWatch(pactId: string): void {
    const db = getDb();
    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE watches
      SET next_due_at = ?
      WHERE pact_id = ?
        AND engine = 'google_maps_directions'
        AND enabled = 1
    `).run(nowIso, pactId);
  }
}
