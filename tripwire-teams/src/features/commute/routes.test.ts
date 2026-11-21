import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleRoutesProvider } from './googleRoutes.js';
import { DailyQuotaTracker } from './quota.js';

describe('GoogleRoutesProvider', () => {
  const origin = { lat: 12.9784, lon: 77.6408 }; // Indiranagar
  const destination = { lat: 12.926, lon: 77.6762 }; // Google Bellandur
  const arriveBy = new Date('2026-11-23T09:30:00.000Z');

  let quotaTracker: DailyQuotaTracker;

  beforeEach(() => {
    quotaTracker = new DailyQuotaTracker({ maxDailyRequests: 500 });
    quotaTracker.reset();
  });

  it('calculates commute using 2-step departure time logic', async () => {
    const recordedCalls: { url: string; body: any }[] = [];

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      recordedCalls.push({ url, body });

      if (recordedCalls.length === 1) {
        // Step 1: First-pass query
        return {
          ok: true,
          status: 200,
          json: async () => ({
            routes: [
              {
                duration: '1800s', // 30 minutes
                staticDuration: '1500s', // 25 minutes baseline
              },
            ],
          }),
        };
      }

      // Step 2: Refined query with computed departure time
      return {
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              duration: '1860s', // 31 minutes traffic duration
              staticDuration: '1500s',
            },
          ],
        }),
      };
    });

    const provider = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetch as any,
    });

    const result = await provider.getCommute(origin, destination, 'DRIVE', arriveBy);

    expect(result.status).toBe('ok');
    expect(result.durationSeconds).toBe(1860);
    expect(result.baselineSeconds).toBe(1500);
    expect(result.modeUsed).toBe('DRIVE');
    expect(result.providerTimestamp).toBeInstanceOf(Date);

    // Verify exactly 2 calls were made
    expect(recordedCalls).toHaveLength(2);

    // Call 1 should have departureTime == arriveBy
    expect(recordedCalls[0].body.departureTime).toBe(arriveBy.toISOString());
    expect(recordedCalls[0].body.travelMode).toBe('DRIVE');
    expect(recordedCalls[0].body.routingPreference).toBe('TRAFFIC_AWARE');

    // Call 2 should have departureTime == arriveBy - 1800s (09:00:00)
    const expectedStep2Departure = new Date(arriveBy.getTime() - 1800 * 1000).toISOString();
    expect(recordedCalls[1].body.departureTime).toBe(expectedStep2Departure);
  });

  it('handles timeout (5000ms) gracefully and returns status: "unknown"', async () => {
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      // Simulate abort signal triggering
      const signal = init?.signal;
      return new Promise((_, reject) => {
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    const provider = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      timeoutMs: 50, // Short timeout for test
      fetchFn: mockFetch as any,
    });

    const result = await provider.getCommute(origin, destination, 'DRIVE', arriveBy);

    expect(result.status).toBe('unknown');
    expect(result.durationSeconds).toBe(0);
    expect(result.baselineSeconds).toBeNull();
  });

  it('handles 429 rate limit and returns status: "unknown"', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Resource has been exhausted' } }),
    });

    const provider = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetch as any,
    });

    const result = await provider.getCommute(origin, destination, 'DRIVE', arriveBy);

    expect(result.status).toBe('unknown');
    expect(result.durationSeconds).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('guards against zero or negative duration and returns status: "unknown"', async () => {
    // Test 0s duration
    const mockFetchZero = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [{ duration: '0s', staticDuration: '0s' }],
      }),
    });

    const providerZero = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetchZero as any,
    });

    const resultZero = await providerZero.getCommute(origin, destination, 'DRIVE', arriveBy);
    expect(resultZero.status).toBe('unknown');
    expect(resultZero.durationSeconds).toBe(0);

    // Test negative duration
    const mockFetchNegative = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [{ duration: '-10s' }],
      }),
    });

    const providerNegative = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetchNegative as any,
    });

    const resultNegative = await providerNegative.getCommute(origin, destination, 'DRIVE', arriveBy);
    expect(resultNegative.status).toBe('unknown');

    // Test missing duration field
    const mockFetchMissing = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [{}],
      }),
    });

    const providerMissing = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetchMissing as any,
    });

    const resultMissing = await providerMissing.getCommute(origin, destination, 'DRIVE', arriveBy);
    expect(resultMissing.status).toBe('unknown');
  });

  it('enforces daily quota cap and blocks subsequent external API requests', async () => {
    // Set daily limit to 2 requests
    const strictQuota = new DailyQuotaTracker({ maxDailyRequests: 2 });
    strictQuota.reset();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [{ duration: '1200s', staticDuration: '1000s' }],
      }),
    });

    const provider = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker: strictQuota,
      fetchFn: mockFetch as any,
    });

    // Request 1: takes 2 calls (step 1 + step 2)
    const result1 = await provider.getCommute(origin, destination, 'DRIVE', arriveBy);
    expect(result1.status).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(strictQuota.getCurrentCount()).toBe(2);
    expect(strictQuota.canMakeRequest()).toBe(false);

    // Request 2: Quota is exhausted (limit = 2, count = 2)
    const result2 = await provider.getCommute(origin, destination, 'DRIVE', arriveBy);
    expect(result2.status).toBe('unknown');
    expect(result2.durationSeconds).toBe(0);

    // CRITICAL: fetch was NOT called again!
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries once on 5xx server errors and succeeds if retry succeeds', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call fails with 503 Service Unavailable
        return { ok: false, status: 503, json: async () => ({ error: 'Service Unavailable' }) };
      }
      if (callCount === 2) {
        // Retry of Step 1 succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({
            routes: [{ duration: '1500s', staticDuration: '1200s' }],
          }),
        };
      }
      // Step 2 succeeds
      return {
        ok: true,
        status: 200,
        json: async () => ({
          routes: [{ duration: '1550s', staticDuration: '1200s' }],
        }),
      };
    });

    const provider = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetch as any,
    });

    const result = await provider.getCommute(origin, destination, 'DRIVE', arriveBy);
    expect(result.status).toBe('ok');
    expect(result.durationSeconds).toBe(1550);
    expect(callCount).toBe(3); // Call 1 (failed 503) + Call 2 (retry succeeded) + Call 3 (step 2)
  });

  it('returns status: "unknown" if 5xx persists on retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    const provider = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetch as any,
    });

    const result = await provider.getCommute(origin, destination, 'DRIVE', arriveBy);
    expect(result.status).toBe('unknown');
    expect(mockFetch).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });

  it('falls back to DRIVE when TWO_WHEELER is unsupported in corridor', async () => {
    const attemptedModes: string[] = [];

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      attemptedModes.push(body.travelMode);

      if (body.travelMode === 'TWO_WHEELER') {
        // Simulate corridor where TWO_WHEELER returns 400 unsupported or empty routes
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Travel mode TWO_WHEELER not supported' } }),
        };
      }

      // DRIVE succeeds
      return {
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              duration: '2100s',
              staticDuration: '1800s',
            },
          ],
        }),
      };
    });

    const provider = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetch as any,
    });

    const result = await provider.getCommute(origin, destination, 'TWO_WHEELER', arriveBy);

    expect(result.status).toBe('ok');
    expect(result.modeUsed).toBe('DRIVE');
    expect(result.durationSeconds).toBe(2100);
    expect(attemptedModes).toEqual(['TWO_WHEELER', 'DRIVE', 'DRIVE']);
  });

  it('never throws an unhandled error when fetch encounters a network crash', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const provider = new GoogleRoutesProvider({
      apiKey: 'test-api-key',
      quotaTracker,
      fetchFn: mockFetch as any,
    });

    await expect(provider.getCommute(origin, destination, 'DRIVE', arriveBy)).resolves.toEqual(
      expect.objectContaining({
        status: 'unknown',
        durationSeconds: 0,
        baselineSeconds: null,
      })
    );
  });
});
