import { RoutesProvider, CommuteResult, TravelMode } from './routesProvider.js';
import { DailyQuotaTracker, dailyQuota } from './quota.js';

export interface GoogleRoutesOptions {
  apiKey?: string;
  baseUrl?: string;
  quotaTracker?: DailyQuotaTracker;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

interface FetchRouteResponse {
  kind: 'ok' | 'unsupported_mode' | 'rate_limited' | 'quota_exceeded' | 'timeout' | 'error';
  durationSeconds?: number;
  baselineSeconds?: number | null;
  status?: number;
}

export function parseGoogleDuration(durationStr: unknown): number | null {
  if (typeof durationStr !== 'string') return null;
  const trimmed = durationStr.trim();
  if (!trimmed.endsWith('s')) return null;
  const numPart = trimmed.slice(0, -1);
  const num = Number(numPart);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

export function normalizeTravelMode(mode: string): TravelMode {
  const m = mode.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (m === 'TWO_WHEELER' || m === 'MOTORCYCLE' || m === 'SCOOTER' || m === 'BIKE') {
    return 'TWO_WHEELER';
  }
  if (m === 'TRANSIT' || m === 'BUS' || m === 'TRAIN' || m === 'METRO' || m === 'SUBWAY') {
    return 'TRANSIT';
  }
  return 'DRIVE';
}

export class GoogleRoutesProvider implements RoutesProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly quotaTracker: DailyQuotaTracker;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: GoogleRoutesOptions) {
    this.apiKey =
      options?.apiKey ||
      process.env.GOOGLE_ROUTES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';
    this.baseUrl = options?.baseUrl || 'https://routes.googleapis.com/directions/v2:computeRoutes';
    this.quotaTracker = options?.quotaTracker || dailyQuota;
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.fetchFn = options?.fetchFn || globalThis.fetch.bind(globalThis);
  }

  /**
   * Performs an HTTP call to Google Routes API with timeout, quota enforcement, and 1 retry on 5xx.
   * Non-negotiable: Never logs coordinates or API keys.
   */
  private async callComputeRoutes(
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
    mode: TravelMode,
    departureTime: Date,
    isRetry = false
  ): Promise<FetchRouteResponse> {
    if (!this.quotaTracker.consume(1)) {
      console.warn('[GoogleRoutes] Daily quota limit reached, blocking network call.');
      return { kind: 'quota_exceeded' };
    }

    if (!this.apiKey) {
      console.warn('[GoogleRoutes] Missing Google Routes API key.');
      return { kind: 'error' };
    }

    const requestBody: Record<string, any> = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lon,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lon,
          },
        },
      },
      travelMode: mode,
      departureTime: departureTime.toISOString(),
    };

    if (mode === 'DRIVE' || mode === 'TWO_WHEELER') {
      requestBody.routingPreference = 'TRAFFIC_AWARE';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.staticDuration',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429) {
        console.warn('[GoogleRoutes] Received 429 Rate Limited from Routes API.');
        return { kind: 'rate_limited', status: 429 };
      }

      if (response.status >= 500 && response.status < 600) {
        if (!isRetry) {
          console.warn(`[GoogleRoutes] Server error ${response.status}. Retrying once...`);
          return await this.callComputeRoutes(origin, destination, mode, departureTime, true);
        }
        console.warn(`[GoogleRoutes] Server error ${response.status} after retry.`);
        return { kind: 'error', status: response.status };
      }

      if (response.status === 400 || response.status === 404) {
        // Mode may not be supported in this corridor
        return { kind: 'unsupported_mode', status: response.status };
      }

      if (!response.ok) {
        console.warn(`[GoogleRoutes] Unexpected HTTP status: ${response.status}`);
        return { kind: 'error', status: response.status };
      }

      const data = (await response.json()) as any;
      if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
        return { kind: 'unsupported_mode', status: 200 };
      }

      const firstRoute = data.routes[0];
      const durationSeconds = parseGoogleDuration(firstRoute?.duration);
      if (!durationSeconds || durationSeconds <= 0) {
        console.warn('[GoogleRoutes] Implausible or missing duration in route response.');
        return { kind: 'error' };
      }

      const baselineSeconds = parseGoogleDuration(firstRoute?.staticDuration);

      return {
        kind: 'ok',
        durationSeconds,
        baselineSeconds,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        console.warn(`[GoogleRoutes] Request timed out after ${this.timeoutMs}ms.`);
        return { kind: 'timeout' };
      }
      console.warn('[GoogleRoutes] Network or transport error occurred.');
      return { kind: 'error' };
    }
  }

  /**
   * Two-step departure time calculation for a given travel mode.
   * Step 1: Query first-pass estimate from arriveBy.
   * Step 2: Compute departure_time = arrive_by - firstPassDuration, and query once more with exact calculated departure time.
   */
  private async calculateTwoStepCommute(
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
    mode: TravelMode,
    arriveBy: Date
  ): Promise<{ result: CommuteResult; isUnsupported: boolean }> {
    const unknownResult: CommuteResult = {
      durationSeconds: 0,
      baselineSeconds: null,
      providerTimestamp: new Date(),
      status: 'unknown',
      modeUsed: mode,
    };

    // Step 1: Query first-pass estimate from arriveBy
    const step1 = await this.callComputeRoutes(origin, destination, mode, arriveBy);

    if (step1.kind === 'unsupported_mode') {
      return { result: unknownResult, isUnsupported: true };
    }

    if (step1.kind !== 'ok' || !step1.durationSeconds || step1.durationSeconds <= 0) {
      return { result: unknownResult, isUnsupported: false };
    }

    const firstPassDuration = step1.durationSeconds;

    // Step 2: departure_time = arrive_by - firstPassDuration
    const departureTime = new Date(arriveBy.getTime() - firstPassDuration * 1000);
    const step2 = await this.callComputeRoutes(origin, destination, mode, departureTime);

    if (step2.kind === 'unsupported_mode') {
      return { result: unknownResult, isUnsupported: true };
    }

    if (step2.kind !== 'ok' || !step2.durationSeconds || step2.durationSeconds <= 0) {
      return { result: unknownResult, isUnsupported: false };
    }

    return {
      result: {
        durationSeconds: step2.durationSeconds,
        baselineSeconds: step2.baselineSeconds ?? null,
        providerTimestamp: new Date(),
        status: 'ok',
        modeUsed: mode,
      },
      isUnsupported: false,
    };
  }

  /**
   * Public interface method: Never throws an unhandled error into the scheduler.
   */
  public async getCommute(
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
    mode: string,
    arriveBy: Date
  ): Promise<CommuteResult> {
    const requestedMode = normalizeTravelMode(mode);

    try {
      // First attempt with requested mode
      const attempt = await this.calculateTwoStepCommute(origin, destination, requestedMode, arriveBy);

      if (attempt.result.status === 'ok') {
        return attempt.result;
      }

      // If mode was TWO_WHEELER or TRANSIT and it was unsupported in this corridor, fallback to DRIVE
      if (attempt.isUnsupported && requestedMode !== 'DRIVE') {
        console.info(`[GoogleRoutes] Mode ${requestedMode} unsupported in corridor. Falling back to DRIVE.`);
        const fallbackAttempt = await this.calculateTwoStepCommute(origin, destination, 'DRIVE', arriveBy);
        return fallbackAttempt.result;
      }

      return attempt.result;
    } catch {
      // Guard against any unforeseen exception to protect the scheduler
      return {
        durationSeconds: 0,
        baselineSeconds: null,
        providerTimestamp: new Date(),
        status: 'unknown',
        modeUsed: requestedMode,
      };
    }
  }
}
