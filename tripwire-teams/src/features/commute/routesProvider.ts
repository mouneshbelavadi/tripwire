export type TravelMode = 'DRIVE' | 'TWO_WHEELER' | 'TRANSIT';

export interface LatLng {
  lat: number;
  lon: number;
}

export interface CommuteResult {
  durationSeconds: number;
  baselineSeconds: number | null;
  providerTimestamp: Date;
  status: 'ok' | 'unknown';
  modeUsed: 'DRIVE' | 'TWO_WHEELER' | 'TRANSIT';
}

export interface RoutesProvider {
  getCommute(
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
    mode: string,
    arriveBy: Date
  ): Promise<CommuteResult>;
}
