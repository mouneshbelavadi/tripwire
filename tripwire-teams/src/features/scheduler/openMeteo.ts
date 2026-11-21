/**
 * Tripwire Teams - Open-Meteo Weather API Integration
 * 
 * Free, keyless API integration for precipitation probability and rainfall (mm).
 * Strictly non-negotiable:
 * 1. Never fakes data as live. Unreachable or timed-out responses return safe fallback with status: 'unknown'.
 * 2. Never logs coordinates or sensitive parameters.
 * 3. Graceful handling of network timeouts (default 5000ms).
 */

export interface OpenMeteoHourlyUnits {
  time: string;
  precipitation_probability: string;
  rain: string;
}

export interface OpenMeteoHourlyData {
  time: string[];
  precipitation_probability: (number | null)[];
  rain: (number | null)[];
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms?: number;
  utc_offset_seconds?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  elevation?: number;
  hourly_units?: OpenMeteoHourlyUnits;
  hourly?: OpenMeteoHourlyData;
  error?: boolean;
  reason?: string;
}

export interface RainForecastResult {
  precipitationProbability: number; // 0 - 100 (%) peak in window
  rainfallMm: number; // total rain in window (mm)
  maxRainfallMm: number; // peak hourly rain in window (mm)
  isHeavyRain: boolean; // precipitationProbability >= 70 && rainfallMm > 0.5
  status: 'ok' | 'unknown';
  provenance: 'live' | 'fallback';
  commuteWindow: {
    start: Date;
    end: Date;
  };
  matchingSlotsCount: number;
  errorReason?: string;
}

export interface FetchRainForecastOptions {
  lat: number;
  lon: number;
  windowStart: Date;
  windowEnd: Date;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * Creates a safe fallback forecast when Open-Meteo is unreachable, times out, or fails.
 * Rule: Defaults to 0% rain probability and 0 mm rain without crashing the scheduler.
 */
export function createFallbackForecast(
  windowStart: Date,
  windowEnd: Date,
  reason: string = 'Network or provider unavailable'
): RainForecastResult {
  return {
    precipitationProbability: 0,
    rainfallMm: 0,
    maxRainfallMm: 0,
    isHeavyRain: false,
    status: 'unknown',
    provenance: 'fallback',
    commuteWindow: {
      start: windowStart,
      end: windowEnd,
    },
    matchingSlotsCount: 0,
    errorReason: reason,
  };
}

/**
 * Parses timestamp string from Open-Meteo response into UTC epoch ms.
 * If utc_offset_seconds is present, accounts for the provider's local offset.
 */
function parseSlotTimeMs(timeStr: string, utcOffsetSeconds: number = 0): number {
  if (!timeStr) return NaN;

  // If timestamp already has Z or explicit offset
  if (timeStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timeStr)) {
    return new Date(timeStr).getTime();
  }

  // If timeStr is "YYYY-MM-DDTHH:mm", treat as UTC timestamp then subtract utcOffsetSeconds
  const parsedUtc = Date.parse(timeStr + ':00Z');
  if (!Number.isNaN(parsedUtc)) {
    return parsedUtc - utcOffsetSeconds * 1000;
  }

  // Fallback to standard Date parsing
  return new Date(timeStr).getTime();
}

/**
 * Pure parser for Open-Meteo API response.
 * Extracts peak precipitation probability and total rain in mm for the targeted commute window.
 */
export function parseOpenMeteoResponse(
  data: OpenMeteoResponse,
  windowStart: Date,
  windowEnd: Date
): RainForecastResult {
  if (!data || data.error || !data.hourly || !Array.isArray(data.hourly.time)) {
    return createFallbackForecast(
      windowStart,
      windowEnd,
      data?.reason || 'Invalid or malformed Open-Meteo payload'
    );
  }

  const { time, precipitation_probability, rain } = data.hourly;
  const utcOffsetSeconds = typeof data.utc_offset_seconds === 'number' ? data.utc_offset_seconds : 0;

  const winStartMs = windowStart.getTime();
  const winEndMs = windowEnd.getTime();

  if (Number.isNaN(winStartMs) || Number.isNaN(winEndMs) || winStartMs >= winEndMs) {
    return createFallbackForecast(windowStart, windowEnd, 'Invalid commute window range');
  }

  const matchingProbabilities: number[] = [];
  const matchingRainMm: number[] = [];

  for (let i = 0; i < time.length; i++) {
    const timeStr = time[i];
    const slotStartMs = parseSlotTimeMs(timeStr, utcOffsetSeconds);
    if (Number.isNaN(slotStartMs)) continue;

    // Each hourly slot covers [slotStartMs, slotStartMs + 1 hour)
    const slotEndMs = slotStartMs + 3600 * 1000;

    // Check if slot overlaps with commute window [winStartMs, winEndMs]
    const overlaps = slotStartMs < winEndMs && slotEndMs > winStartMs;

    if (overlaps) {
      const rawProb = precipitation_probability ? precipitation_probability[i] : null;
      const rawRain = rain ? rain[i] : null;

      const prob = typeof rawProb === 'number' && !Number.isNaN(rawProb) ? Math.max(0, Math.min(100, rawProb)) : 0;
      const rainAmount = typeof rawRain === 'number' && !Number.isNaN(rawRain) ? Math.max(0, rawRain) : 0;

      matchingProbabilities.push(prob);
      matchingRainMm.push(rainAmount);
    }
  }

  if (matchingProbabilities.length === 0) {
    return createFallbackForecast(
      windowStart,
      windowEnd,
      'No forecast hourly slots matched the commute window'
    );
  }

  const peakProbability = Math.max(...matchingProbabilities);
  const totalRainMm = Math.round(matchingRainMm.reduce((acc, curr) => acc + curr, 0) * 10) / 10;
  const maxRainMm = Math.round(Math.max(...matchingRainMm) * 10) / 10;

  // Rain tightening condition: probability >= 70% and rainfall > 0.5mm
  const isHeavyRain = peakProbability >= 70 && totalRainMm > 0.5;

  return {
    precipitationProbability: peakProbability,
    rainfallMm: totalRainMm,
    maxRainfallMm: maxRainMm,
    isHeavyRain,
    status: 'ok',
    provenance: 'live',
    commuteWindow: {
      start: windowStart,
      end: windowEnd,
    },
    matchingSlotsCount: matchingProbabilities.length,
  };
}

/**
 * Fetches Open-Meteo hourly rain forecast for the given coordinates and commute window.
 * Free, keyless API. Automatically handles network timeout, 5xx errors, and fallbacks.
 */
export async function fetchRainForecast(options: FetchRainForecastOptions): Promise<RainForecastResult> {
  const {
    lat,
    lon,
    windowStart,
    windowEnd,
    timeoutMs = 5000,
    fetchFn = globalThis.fetch,
  } = options;

  if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
    return createFallbackForecast(windowStart, windowEnd, 'Invalid coordinates');
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat.toFixed(4))}&longitude=${encodeURIComponent(lon.toFixed(4))}&hourly=precipitation_probability,rain&timezone=auto`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return createFallbackForecast(
        windowStart,
        windowEnd,
        `Open-Meteo returned HTTP ${response.status}`
      );
    }

    const payload = await response.json() as OpenMeteoResponse;
    return parseOpenMeteoResponse(payload, windowStart, windowEnd);
  } catch (error: any) {
    const isTimeout = error?.name === 'AbortError' || error?.message?.includes('aborted');
    return createFallbackForecast(
      windowStart,
      windowEnd,
      isTimeout ? `Request timed out after ${timeoutMs}ms` : 'Network transport error'
    );
  } finally {
    clearTimeout(timer);
  }
}
