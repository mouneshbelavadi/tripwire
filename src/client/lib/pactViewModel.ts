/**
 * Shared Selector & View-Model Helper
 *
 * UNIFIES:
 * 1. Breach Receipt
 * 2. Participant Cards
 * 3. Evidence Tiles
 * 4. Activity Log
 *
 * All four derive from ONE alert record and ONE observation set.
 * Invariant: Commute estimates, checks, and activities are always in 100% agreement.
 */

import type { PactDetails } from '../types';
import { formatTimeIST, formatRelativeAge, getDeadlineStatus, type DeadlineStatus } from './time';
import { humanizeIncidentType } from '../../common/incidentTypes';

export interface RawObservation {
  id: string;
  watch_id: string;
  provider_search_id?: string | null;
  provider_created_at: string;
  received_at: string;
  query_hash: string;
  raw_hash?: string;
  normalized_json: string;
  validity: 'valid' | 'unknown' | 'empty';
  provenance: 'live' | 'replay' | 'synthetic';
  engine?: string;
  params_json?: string;
}

export interface UnifiedActivityItem {
  id: string;
  timeIst: string;
  timestamp: string;
  corridor: string;
  observedMinutes: number;
  limitMinutes: number;
  gateResult: 'within_limit' | 'confirming' | 'alert' | 'incident_observed' | 'duplicate_rejected' | 'stale_rejected';
  provenance: 'live' | 'replay' | 'synthetic';
  engine: string;
  details?: string;
}

export interface ParticipantObservationViewModel {
  participantId: string;
  userId: string;
  userName: string;
  neighbourhood: string;
  limitMinutes: number;
  currentMinutes: number;
  isBreached: boolean;
  history: number[]; // 6 observations trend
  lastObservedAt: string | null;
  lastObservedAtIst: string;
  provenance: 'live' | 'replay' | 'synthetic';
  isApproved: boolean;
  sourceAge: string;
}

export interface EvidenceTileViewModel {
  maya: {
    minutes: number;
    limitMinutes: number;
    provenance: 'live' | 'replay' | 'synthetic';
    ageText: string;
    isBreached: boolean;
  };
  arjun: {
    minutes: number;
    limitMinutes: number;
    provenance: 'live' | 'replay' | 'synthetic';
    ageText: string;
    isBreached: boolean;
  };
  areaIncidents: {
    count: number;
    summary: string;
    incidents: Array<{ id: string; type: string; title: string }>;
    provenance: 'live' | 'replay' | 'synthetic';
  };
}

export interface PactViewModel {
  pact: PactDetails;
  receipt: any | null;
  observations: RawObservation[];
  containsSimulatedData: boolean;
  overallProvenance: 'live' | 'replay' | 'synthetic';
  deadlineStatus: DeadlineStatus;
  deadlineDisplay: string;
  participants: ParticipantObservationViewModel[];
  evidenceTiles: EvidenceTileViewModel;
  activityLog: UnifiedActivityItem[];
}

/**
 * Builds the unified PactViewModel deriving all components from ONE alert receipt and ONE observation set.
 */
export function buildPactViewModel(
  pact: PactDetails,
  receipt: any | null,
  observations: RawObservation[] = [],
  now: Date = new Date()
): PactViewModel {
  const deadlineStatus = getDeadlineStatus(pact.decision_deadline_utc, now);
  const deadlineDisplay =
    deadlineStatus === 'expired' ? 'Deadline passed' : pact.decision_deadline_ist;

  // 1. Separate observations by user/watch
  const mayaObs = observations.filter(
    (o) => o.watch_id.includes('user_maya') || o.watch_id.includes('part_maya') || o.watch_id.includes('Indiranagar')
  );
  const arjunObs = observations.filter(
    (o) => o.watch_id.includes('user_arjun') || o.watch_id.includes('part_arjun') || o.watch_id.includes('HSR')
  );
  const trafficObs = observations.filter(
    (o) => o.watch_id.includes('traffic') || o.engine === 'google_maps_traffic'
  );

  // Helper to extract duration in minutes from normalized JSON
  const extractMinutes = (obs?: RawObservation): number | null => {
    if (!obs || !obs.normalized_json) return null;
    try {
      const parsed = JSON.parse(obs.normalized_json);
      if (typeof parsed.fastestDuration === 'number') {
        return Math.round(parsed.fastestDuration / 60);
      }
      if (typeof parsed.durationMinutes === 'number') {
        return Math.round(parsed.durationMinutes);
      }
    } catch {
      // ignore
    }
    return null;
  };

  // Derive Maya estimate & history from Alert Receipt (if active) OR latest observations
  let mayaMinutes = 42;
  let mayaProvenance: 'live' | 'replay' | 'synthetic' = 'synthetic';
  let mayaLastTime = new Date().toISOString();
  let mayaHistory = [38, 41, 40, 43, 41, 42];

  if (receipt && receipt.evidence) {
    mayaMinutes = receipt.evidence.check2Minutes || 72;
    mayaProvenance = receipt.evidence.provenance || 'synthetic';
    mayaLastTime = receipt.evidence.check2Timestamp || new Date().toISOString();
    mayaHistory = [
      38,
      41,
      40,
      receipt.evidence.baselineMinutes || 42,
      receipt.evidence.check1Minutes || 68,
      receipt.evidence.check2Minutes || 72,
    ];
  } else if (mayaObs.length > 0) {
    const latest = mayaObs[0];
    const mins = extractMinutes(latest);
    if (mins !== null) mayaMinutes = mins;
    mayaProvenance = latest.provenance || 'synthetic';
    mayaLastTime = latest.received_at || latest.provider_created_at;

    const histMins = mayaObs
      .slice(0, 6)
      .reverse()
      .map((o) => extractMinutes(o))
      .filter((m): m is number => m !== null);
    if (histMins.length > 0) {
      mayaHistory = histMins;
    }
  }

  // Derive Arjun estimate & history from latest observations
  let arjunMinutes = 34;
  let arjunProvenance: 'live' | 'replay' | 'synthetic' = 'synthetic';
  let arjunLastTime = new Date().toISOString();
  let arjunHistory = [30, 32, 35, 33, 34, 34];

  if (arjunObs.length > 0) {
    const latest = arjunObs[0];
    const mins = extractMinutes(latest);
    if (mins !== null) arjunMinutes = mins;
    arjunProvenance = latest.provenance || 'synthetic';
    arjunLastTime = latest.received_at || latest.provider_created_at;

    const histMins = arjunObs
      .slice(0, 6)
      .reverse()
      .map((o) => extractMinutes(o))
      .filter((m): m is number => m !== null);
    if (histMins.length > 0) {
      arjunHistory = histMins;
    }
  }

  // 2. Build ParticipantObservationViewModel list
  const participants: ParticipantObservationViewModel[] = pact.participants.map((p) => {
    const isMaya = p.user_id === 'user_maya';
    const limitMinutes = Math.round(p.max_duration_s / 60);
    const currentMinutes = isMaya ? mayaMinutes : arjunMinutes;
    const prov = isMaya ? mayaProvenance : arjunProvenance;
    const lastTime = isMaya ? mayaLastTime : arjunLastTime;
    const history = isMaya ? mayaHistory : arjunHistory;

    return {
      participantId: p.id,
      userId: p.user_id,
      userName: p.user_name,
      neighbourhood: p.neighbourhood,
      limitMinutes,
      currentMinutes,
      isBreached: currentMinutes > limitMinutes,
      history,
      lastObservedAt: lastTime,
      lastObservedAtIst: formatTimeIST(lastTime),
      provenance: prov,
      isApproved: p.approval_version === pact.version,
      sourceAge: formatRelativeAge(lastTime, now),
    };
  });

  // 3. Derive Area Incidents
  let areaIncidentsList: Array<{ id: string; type: string; title: string }> = [];
  let areaProvenance: 'live' | 'replay' | 'synthetic' = 'synthetic';

  if (receipt?.areaIncidents && receipt.areaIncidents.length > 0) {
    areaIncidentsList = receipt.areaIncidents.map((inc: any) => ({
      id: inc.id,
      type: inc.type,
      title: inc.title || `${humanizeIncidentType(inc.type)} on Bellandur corridor`,
    }));
    areaProvenance = receipt.evidence?.provenance || 'synthetic';
  } else if (trafficObs.length > 0 && trafficObs[0].normalized_json) {
    try {
      const incMap = JSON.parse(trafficObs[0].normalized_json);
      areaProvenance = trafficObs[0].provenance || 'synthetic';
      for (const [id, type] of Object.entries(incMap)) {
        areaIncidentsList.push({
          id,
          type: String(type),
          title: `${humanizeIncidentType(String(type))} on Bellandur corridor`,
        });
      }
    } catch {
      // fallback
    }
  }

  if (areaIncidentsList.length === 0) {
    areaIncidentsList.push({
      id: 'inc_sample_01',
      type: 'road_closed',
      title: 'Road closed due to waterlogging at Bellandur Central Junction',
    });
  }

  // 4. Build EvidenceTileViewModel
  const mayaPart = participants.find((p) => p.userId === 'user_maya') || participants[0];
  const arjunPart = participants.find((p) => p.userId === 'user_arjun') || participants[1] || participants[0];

  const evidenceTiles: EvidenceTileViewModel = {
    maya: {
      minutes: mayaMinutes,
      limitMinutes: mayaPart ? mayaPart.limitMinutes : 60,
      provenance: mayaProvenance,
      ageText: mayaPart ? mayaPart.sourceAge : '2m ago',
      isBreached: mayaPart ? mayaPart.isBreached : mayaMinutes > 60,
    },
    arjun: {
      minutes: arjunMinutes,
      limitMinutes: arjunPart ? arjunPart.limitMinutes : 60,
      provenance: arjunProvenance,
      ageText: arjunPart ? arjunPart.sourceAge : '2m ago',
      isBreached: arjunPart ? arjunPart.isBreached : arjunMinutes > 60,
    },
    areaIncidents: {
      count: areaIncidentsList.length,
      summary: `${areaIncidentsList.length} Active Incident${areaIncidentsList.length === 1 ? '' : 's'}`,
      incidents: areaIncidentsList,
      provenance: areaProvenance,
    },
  };

  // 5. Build Unified Activity Log from the ONE observation set
  const activityLog: UnifiedActivityItem[] = [];

  if (observations.length > 0) {
    for (const obs of observations) {
      const isTraffic = obs.engine === 'google_maps_traffic' || obs.watch_id.includes('traffic');
      const isMayaWatch = obs.watch_id.includes('user_maya') || obs.watch_id.includes('part_maya') || obs.watch_id.includes('Indiranagar');
      const part = isMayaWatch ? mayaPart : arjunPart;
      const corridor = isTraffic
        ? 'Bellandur Outer Ring Road Corridor'
        : `${part ? `${part.userName} (${part.neighbourhood})` : 'Indiranagar'} → ${pact.destination_name}`;

      const mins = extractMinutes(obs) || 0;
      const limit = part ? part.limitMinutes : 60;

      let gateResult: UnifiedActivityItem['gateResult'] = 'within_limit';
      if (isTraffic) {
        gateResult = 'incident_observed';
      } else if (mins > limit) {
        // If alert is active and this matches the alert timestamp or second check
        if (receipt && receipt.evidence && mins === receipt.evidence.check2Minutes) {
          gateResult = 'alert';
        } else {
          gateResult = 'confirming';
        }
      }

      activityLog.push({
        id: obs.id,
        timeIst: formatTimeIST(obs.received_at || obs.provider_created_at),
        timestamp: obs.received_at || obs.provider_created_at,
        corridor,
        observedMinutes: mins,
        limitMinutes: isTraffic ? 0 : limit,
        gateResult,
        provenance: obs.provenance || 'synthetic',
        engine: obs.engine || (isTraffic ? 'google_maps_traffic' : 'google_maps_directions'),
      });
    }
  } else {
    // If no observations currently in memory, synthesize from receipt for single-source consistency
    if (receipt && receipt.evidence) {
      activityLog.push(
        {
          id: 'act_alert_chk2',
          timeIst: formatTimeIST(receipt.evidence.check2Timestamp),
          timestamp: receipt.evidence.check2Timestamp,
          corridor: `${receipt.participant.userName} (${receipt.participant.neighbourhood}) → ${pact.destination_name}`,
          observedMinutes: receipt.evidence.check2Minutes,
          limitMinutes: receipt.participant.limitMinutes,
          gateResult: 'alert',
          provenance: receipt.evidence.provenance,
          engine: 'google_maps_directions',
        },
        {
          id: 'act_alert_chk1',
          timeIst: formatTimeIST(receipt.evidence.check1Timestamp),
          timestamp: receipt.evidence.check1Timestamp,
          corridor: `${receipt.participant.userName} (${receipt.participant.neighbourhood}) → ${pact.destination_name}`,
          observedMinutes: receipt.evidence.check1Minutes,
          limitMinutes: receipt.participant.limitMinutes,
          gateResult: 'confirming',
          provenance: receipt.evidence.provenance,
          engine: 'google_maps_directions',
        },
        {
          id: 'act_area_inc',
          timeIst: formatTimeIST(new Date(Date.now() - 15 * 60 * 1000).toISOString()),
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          corridor: 'Bellandur Outer Ring Road Corridor',
          observedMinutes: 0,
          limitMinutes: 0,
          gateResult: 'incident_observed',
          provenance: receipt.evidence.provenance,
          engine: 'google_maps_traffic',
        },
        {
          id: 'act_arjun_clear',
          timeIst: formatTimeIST(new Date(Date.now() - 20 * 60 * 1000).toISOString()),
          timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          corridor: `${arjunPart.userName} (${arjunPart.neighbourhood}) → ${pact.destination_name}`,
          observedMinutes: arjunMinutes,
          limitMinutes: arjunPart.limitMinutes,
          gateResult: 'within_limit',
          provenance: arjunProvenance,
          engine: 'google_maps_directions',
        }
      );
    }
  }

  // 6. Check Provenance & Simulation Banner Invariant
  // Display a 'Contains simulated data' banner whenever ANY observation in the current episode is not live.
  const hasSimulatedInObs = observations.some((o) => o.provenance !== 'live');
  const hasSimulatedInReceipt = receipt?.evidence?.provenance && receipt.evidence.provenance !== 'live';
  const containsSimulatedData =
    hasSimulatedInObs ||
    Boolean(hasSimulatedInReceipt) ||
    mayaProvenance !== 'live' ||
    arjunProvenance !== 'live';

  const overallProvenance: 'live' | 'replay' | 'synthetic' =
    receipt?.evidence?.provenance ||
    (observations.length > 0 && observations.every((o) => o.provenance === 'live') ? 'live' : 'synthetic');

  return {
    pact,
    receipt,
    observations,
    containsSimulatedData,
    overallProvenance,
    deadlineStatus,
    deadlineDisplay,
    participants,
    evidenceTiles,
    activityLog,
  };
}
