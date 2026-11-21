import crypto from 'crypto';
import { getDb } from '../db.js';
import {
  evaluateRule,
  fastestDriving,
  incidentSnapshot,
  canonicalQueryHash,
  type RuleState,
  type RuleEvaluationOutcome,
} from './tripwireCore.js';

export interface RouteObservationInput {
  watchId: string;
  pactId: string;
  participantId: string;
  userId: string;
  rawPayload: any;
  sourceTimestampUtc: string; // ISO string from search_metadata.created_at
  receivedAt?: string;
  provenance: 'live' | 'replay' | 'synthetic';
  limitSeconds: number;
  deadlineUtc: string;
  pactVersion: number;
  queryParams: Record<string, any>;
}

export interface ObservationProcessResult {
  observationId: string;
  outcome: RuleEvaluationOutcome;
  fastestDrivingSeconds: number | null;
  ruleState: {
    active: boolean;
    consecutive: number;
    lastSourceAt: number;
    episodeId: string | null;
  };
  alertCreated: boolean;
  alertId?: string;
}

export interface TrafficObservationInput {
  watchId: string;
  pactId: string;
  rawPayload: any;
  sourceTimestampUtc: string;
  provenance: 'live' | 'replay' | 'synthetic';
  bboxParams: Record<string, any>;
}

export interface TrafficProcessResult {
  observationId: string;
  validity: 'valid' | 'unknown' | 'empty';
  totalIncidents: number;
  newIncidentIds: string[];
  requestsRouteRecheck: boolean;
}

export class ObservationService {
  /**
   * Processes a route observation (from SerpApi Directions or synthetic fixture)
   * transactionally updating SQLite observations and rule_states.
   */
  static processRouteObservation(
    input: RouteObservationInput
  ): ObservationProcessResult {
    const db = getDb();
    const nowEpoch = Math.floor(Date.now() / 1000);
    const sourceEpoch = Math.floor(new Date(input.sourceTimestampUtc).getTime() / 1000);
    const deadlineEpoch = Math.floor(new Date(input.deadlineUtc).getTime() / 1000);

    const queryHash = canonicalQueryHash('google_maps_directions', input.queryParams);
    const rawJsonStr = JSON.stringify(input.rawPayload);
    const rawHash = crypto.createHash('sha256').update(rawJsonStr).digest('hex');

    const fastestDuration = fastestDriving(input.rawPayload);
    const validity = fastestDuration !== null ? 'valid' : 'unknown';
    const observationId = `obs_dir_${crypto.randomUUID().substring(0, 12)}`;
    const receivedAt = input.receivedAt || new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
      // 1. Record observation entity
      db.prepare(`
        INSERT INTO observations (
          id, watch_id, provider_search_id, provider_created_at, received_at,
          query_hash, raw_hash, normalized_json, validity, provenance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        observationId,
        input.watchId,
        input.rawPayload?.search_metadata?.id || null,
        input.sourceTimestampUtc,
        receivedAt,
        queryHash,
        rawHash,
        JSON.stringify({ fastestDuration, limit: input.limitSeconds }),
        validity,
        input.provenance
      );

      // 2. Fetch existing rule state from database
      const existingStateRow = db
        .prepare('SELECT * FROM rule_states WHERE watch_id = ?')
        .get(input.watchId) as any;

      // In-memory reconstruction of rule state
      // Per domain invariants: A change in pact_version establishes a clean new baseline
      const isSameVersion = existingStateRow && existingStateRow.pact_version === input.pactVersion;
      const seenIds = new Set<string>();
      if (isSameVersion) {
        // Load recent seen IDs from previous observations for this watch (excluding current observation)
        const recentObs = db
          .prepare('SELECT id FROM observations WHERE watch_id = ? AND id != ? ORDER BY received_at DESC LIMIT 50')
          .all(input.watchId, observationId) as any[];
        for (const row of recentObs) {
          seenIds.add(row.id);
        }
      }

      const ruleState: RuleState = isSameVersion
        ? {
            watchId: input.watchId,
            ruleVersion: existingStateRow.pact_version,
            queryHash: queryHash,
            consecutive: existingStateRow.consecutive_breaches,
            active: Boolean(existingStateRow.active),
            lastSourceAt: existingStateRow.last_source_at ?? Number.NEGATIVE_INFINITY,
            seenIds,
            episodeId: existingStateRow.episode_id,
          }
        : {
            watchId: input.watchId,
            ruleVersion: input.pactVersion,
            queryHash: queryHash,
            consecutive: 0,
            active: false,
            lastSourceAt: Number.NEGATIVE_INFINITY,
            seenIds,
            episodeId: null,
          };

      // 3. Deterministic rule evaluation
      const outcome = evaluateRule(ruleState, {
        observationId,
        sourceAt: sourceEpoch,
        now: nowEpoch,
        deadline: deadlineEpoch,
        duration: fastestDuration,
        limit: input.limitSeconds,
        queryHash,
        ruleVersion: input.pactVersion,
      });

      // 4. Update rule state in database
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO rule_states (watch_id, pact_version, last_source_at, consecutive_breaches, active, episode_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(watch_id) DO UPDATE SET
          pact_version = excluded.pact_version,
          last_source_at = excluded.last_source_at,
          consecutive_breaches = excluded.consecutive_breaches,
          active = excluded.active,
          episode_id = excluded.episode_id,
          updated_at = excluded.updated_at
      `).run(
        input.watchId,
        input.pactVersion,
        ruleState.lastSourceAt,
        ruleState.consecutive,
        ruleState.active ? 1 : 0,
        ruleState.episodeId,
        nowIso
      );

      // 5. If outcome is 'alert', generate alert and outbox records
      let alertCreated = false;
      let alertId: string | undefined;

      if (outcome === 'alert' && ruleState.episodeId) {
        alertId = `alert_${crypto.randomUUID().substring(0, 12)}`;
        alertCreated = true;

        db.prepare(`
          INSERT INTO alerts (
            id, pact_id, rule_version, episode_id, after_observation_id, decision_status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `).run(alertId, input.pactId, input.pactVersion, ruleState.episodeId, observationId, nowIso);

        // Put alert into delivery outbox
        db.prepare(`
          INSERT INTO outbox (id, alert_id, status, attempts, next_attempt_at, created_at)
          VALUES (?, ?, 'pending', 0, ?, ?)
        `).run(`out_${alertId}`, alertId, nowIso, nowIso);
      }

      db.exec('COMMIT');

      return {
        observationId,
        outcome,
        fastestDrivingSeconds: fastestDuration,
        ruleState: {
          active: ruleState.active,
          consecutive: ruleState.consecutive,
          lastSourceAt: ruleState.lastSourceAt,
          episodeId: ruleState.episodeId,
        },
        alertCreated,
        alertId,
      };
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * Processes a traffic incident observation.
   * Invariant: Discovers new incident IDs and may request an expedited route check;
   * CANNOT assert route blockage or satisfy numerical commute threshold.
   */
  static processTrafficObservation(
    input: TrafficObservationInput
  ): TrafficProcessResult {
    const db = getDb();
    const queryHash = canonicalQueryHash('google_maps_traffic', input.bboxParams);
    const rawJsonStr = JSON.stringify(input.rawPayload);
    const rawHash = crypto.createHash('sha256').update(rawJsonStr).digest('hex');

    const incidents = incidentSnapshot(input.rawPayload);
    const validity = incidents === null ? 'unknown' : Object.keys(incidents).length > 0 ? 'valid' : 'empty';
    const observationId = `obs_trf_${crypto.randomUUID().substring(0, 12)}`;
    const receivedAt = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
      // 1. Fetch previous traffic snapshot for this watch
      const prevObs = db
        .prepare(`
          SELECT normalized_json FROM observations
          WHERE watch_id = ? AND validity = 'valid'
          ORDER BY received_at DESC LIMIT 1
        `)
        .get(input.watchId) as any;

      let prevIncidentIds = new Set<string>();
      if (prevObs) {
        try {
          const parsed = JSON.parse(prevObs.normalized_json);
          if (parsed && typeof parsed === 'object') {
            prevIncidentIds = new Set(Object.keys(parsed));
          }
        } catch (e) {
          // Ignore json parse error
        }
      }

      const currentIds = incidents ? Object.keys(incidents) : [];
      const newIds = currentIds.filter((id) => !prevIncidentIds.has(id));

      // 2. Insert observation
      db.prepare(`
        INSERT INTO observations (
          id, watch_id, provider_search_id, provider_created_at, received_at,
          query_hash, raw_hash, normalized_json, validity, provenance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        observationId,
        input.watchId,
        input.rawPayload?.search_metadata?.id || null,
        input.sourceTimestampUtc,
        receivedAt,
        queryHash,
        rawHash,
        JSON.stringify(incidents || {}),
        validity,
        input.provenance
      );

      db.exec('COMMIT');

      return {
        observationId,
        validity,
        totalIncidents: currentIds.length,
        newIncidentIds: newIds,
        requestsRouteRecheck: newIds.length > 0,
      };
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
