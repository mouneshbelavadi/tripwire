/**
 * Explicitly labelled synthetic test fixtures for controlled demo and invariant proofs.
 * INVARIANT: Never modify real provider response timestamps. Provenance is permanently 'synthetic'.
 */

export interface SyntheticDirectionsPayload {
  search_metadata: {
    id: string;
    status: string;
    created_at: string;
  };
  directions: Array<{
    travel_mode: string;
    duration: number; // in seconds
    distance: number;
    formatted_duration: string;
    formatted_distance: string;
  }>;
}

export interface SyntheticTrafficPayload {
  search_metadata: {
    id: string;
    status: string;
    created_at: string;
  };
  traffic_incidents: Array<{
    incident_id: string;
    type: string;
    title: string;
    gps_coordinates: {
      latitude: number;
      longitude: number;
    };
  }>;
}

/**
 * Creates a pair of fresh synthetic breach observations for Maya (threshold: 3600s / 60m).
 * Uses real-time relative offsets so they are fresh when generated.
 */
export function createSyntheticBreachSequence(baseTimeSeconds: number = Math.floor(Date.now() / 1000)) {
  // First breach: 68 minutes (4,080s) at T - 120s
  const t1 = baseTimeSeconds - 120;
  const obs1: SyntheticDirectionsPayload = {
    search_metadata: {
      id: `synth_dir_breach_1_${t1}`,
      status: 'Success',
      created_at: new Date(t1 * 1000).toISOString(),
    },
    directions: [
      {
        travel_mode: 'Driving',
        duration: 4080, // 68 min
        distance: 14.2,
        formatted_duration: '1 hr 8 min',
        formatted_distance: '14.2 km',
      },
    ],
  };

  // Second breach: 72 minutes (4,320s) at T - 30s
  const t2 = baseTimeSeconds - 30;
  const obs2: SyntheticDirectionsPayload = {
    search_metadata: {
      id: `synth_dir_breach_2_${t2}`,
      status: 'Success',
      created_at: new Date(t2 * 1000).toISOString(),
    },
    directions: [
      {
        travel_mode: 'Driving',
        duration: 4320, // 72 min
        distance: 14.5,
        formatted_duration: '1 hr 12 min',
        formatted_distance: '14.5 km',
      },
    ],
  };

  // Recovery: 48 minutes (2,880s) at T + 60s (well below 60m - 5m = 55m hysteresis threshold)
  const t3 = baseTimeSeconds + 60;
  const obs3Recovered: SyntheticDirectionsPayload = {
    search_metadata: {
      id: `synth_dir_recovery_${t3}`,
      status: 'Success',
      created_at: new Date(t3 * 1000).toISOString(),
    },
    directions: [
      {
        travel_mode: 'Driving',
        duration: 2880, // 48 min
        distance: 13.8,
        formatted_duration: '48 min',
        formatted_distance: '13.8 km',
      },
    ],
  };

  return { obs1, obs2, obs3Recovered };
}

export function createSyntheticTrafficPayload(baseTimeSeconds: number = Math.floor(Date.now() / 1000)): SyntheticTrafficPayload {
  return {
    search_metadata: {
      id: `synth_traffic_${baseTimeSeconds}`,
      status: 'Success',
      created_at: new Date(baseTimeSeconds * 1000).toISOString(),
    },
    traffic_incidents: [
      {
        incident_id: 'trf_bellandur_waterlogging_01',
        type: 'road_closed',
        title: 'Road closed due to waterlogging at Bellandur Central Junction',
        gps_coordinates: {
          latitude: 12.9295,
          longitude: 77.6755,
        },
      },
      {
        incident_id: 'trf_outer_ring_congestion_02',
        type: 'construction',
        title: 'Metro rail pillar construction on Outer Ring Road',
        gps_coordinates: {
          latitude: 12.9320,
          longitude: 77.6820,
        },
      },
    ],
  };
}
