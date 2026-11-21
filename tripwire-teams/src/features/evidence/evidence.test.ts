import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchDisruptionNews,
  formatCautiousAttribution,
  attachSupplementaryNewsEvidence,
  resetNewsQueryCaps,
  getQueryCapCount,
  DEFAULT_DISRUPTION_QUERY,
  NEWS_ALERTS_ALLOWED,
  MAX_HEADLINES_COUNT,
  type DisruptionNewsItem,
} from './serpNews.js';

describe('SerpApi Disruption News Evidence Specialist', () => {
  const originalEnv = process.env.SERPAPI_API_KEY;

  beforeEach(() => {
    resetNewsQueryCaps();
    vi.restoreAllMocks();
    delete process.env.SERPAPI_API_KEY;
  });

  afterEach(() => {
    process.env.SERPAPI_API_KEY = originalEnv;
  });

  describe('Cautious Attribution Formatting', () => {
    it('formats attribution with cautious framing "Possible cause, from the web (reported by {source})"', () => {
      const attribution = formatCautiousAttribution('The Hindu');
      expect(attribution).toBe('Possible cause, from the web (reported by The Hindu)');
    });

    it('falls back to "Unknown source" if source is empty or whitespace', () => {
      expect(formatCautiousAttribution('')).toBe(
        'Possible cause, from the web (reported by Unknown source)'
      );
      expect(formatCautiousAttribution('   ')).toBe(
        'Possible cause, from the web (reported by Unknown source)'
      );
    });
  });

  describe('Safety Invariant: News Headlines NEVER Trigger Alerts on Their Own', () => {
    it('enforces NEWS_ALERTS_ALLOWED is strictly false', () => {
      expect(NEWS_ALERTS_ALLOWED).toBe(false);
    });

    it('refuses to attach news evidence if commute breach is NOT flagged by Routes API', () => {
      const mockNews: DisruptionNewsItem[] = [
        {
          title: 'Heavy waterlogging on Outer Ring Road',
          source: 'Deccan Herald',
          publishedAt: '10 mins ago',
          url: 'https://example.com/news/1',
          attribution: 'Possible cause, from the web (reported by Deccan Herald)',
        },
      ];

      // Commute breach is false -> supplementary news must be stripped/empty
      const attachedWhenNoBreach = attachSupplementaryNewsEvidence(false, mockNews);
      expect(attachedWhenNoBreach).toEqual([]);

      // Commute breach is true -> supplementary news is attached
      const attachedWhenBreached = attachSupplementaryNewsEvidence(true, mockNews);
      expect(attachedWhenBreached).toEqual(mockNews);
    });
  });

  describe('Parsing News Headlines & Cautious Attribution', () => {
    it('parses news headlines, caps at 3 items, and formats cautious attribution', async () => {
      const mockSerpApiResponse = {
        news_results: [
          {
            title: 'Waterlogging causes massive gridlock near Silk Board',
            source: { name: 'Bangalore Mirror' },
            date: '1 hour ago',
            link: 'https://bangaloremirror.indiatimes.com/traffic/1',
          },
          {
            title: 'Protest rally slows traffic on Bellary Road towards airport',
            source: 'The Hindu',
            date: '2 hours ago',
            link: 'https://thehindu.com/news/cities/bangalore/traffic-2',
          },
          {
            title: 'BMTC bus breakdown clogs Outer Ring Road flyover',
            source: { name: 'Deccan Herald' },
            iso_date: '2026-11-21T18:00:00Z',
            link: 'https://deccanherald.com/bengaluru/3',
          },
          {
            title: 'Fourth story that should be omitted due to cap of 3',
            source: 'Times of India',
            date: '3 hours ago',
            link: 'https://timesofindia.com/city/bengaluru/4',
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSerpApiResponse,
      });

      const results = await fetchDisruptionNews({
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toHaveLength(MAX_HEADLINES_COUNT);
      expect(results).toHaveLength(3);

      expect(results[0]).toEqual({
        title: 'Waterlogging causes massive gridlock near Silk Board',
        source: 'Bangalore Mirror',
        publishedAt: '1 hour ago',
        url: 'https://bangaloremirror.indiatimes.com/traffic/1',
        attribution: 'Possible cause, from the web (reported by Bangalore Mirror)',
      });

      expect(results[1]).toEqual({
        title: 'Protest rally slows traffic on Bellary Road towards airport',
        source: 'The Hindu',
        publishedAt: '2 hours ago',
        url: 'https://thehindu.com/news/cities/bangalore/traffic-2',
        attribution: 'Possible cause, from the web (reported by The Hindu)',
      });

      expect(results[2]).toEqual({
        title: 'BMTC bus breakdown clogs Outer Ring Road flyover',
        source: 'Deccan Herald',
        publishedAt: '2026-11-21T18:00:00Z',
        url: 'https://deccanherald.com/bengaluru/3',
        attribution: 'Possible cause, from the web (reported by Deccan Herald)',
      });

      // Verify request parameters sent to SerpApi
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(calledUrl.searchParams.get('engine')).toBe('google_news');
      expect(calledUrl.searchParams.get('q')).toBe(DEFAULT_DISRUPTION_QUERY);
      expect(calledUrl.searchParams.get('api_key')).toBe('test-api-key');
      expect(calledUrl.searchParams.get('gl')).toBe('in');
      expect(calledUrl.searchParams.get('hl')).toBe('en');
    });

    it('reads apiKey from process.env.SERPAPI_API_KEY if not passed in options', async () => {
      process.env.SERPAPI_API_KEY = 'env-serp-key-123';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          news_results: [
            {
              title: 'Metro rail work disrupts Whitefield corridor',
              source: 'NDTV',
              date: '30 mins ago',
              link: 'https://ndtv.com/bengaluru/metro',
            },
          ],
        }),
      });

      const results = await fetchDisruptionNews({
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Metro rail work disrupts Whitefield corridor');
      expect(results[0].attribution).toBe('Possible cause, from the web (reported by NDTV)');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(calledUrl.searchParams.get('api_key')).toBe('env-serp-key-123');
    });
  });

  describe('Missing or Invalid API Key Graceful Fallback', () => {
    it('returns empty array without throwing when apiKey is undefined and env is unset', async () => {
      const mockFetch = vi.fn();
      const results = await fetchDisruptionNews({
        apiKey: undefined,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns empty array without throwing when apiKey is empty string', async () => {
      const mockFetch = vi.fn();
      const results = await fetchDisruptionNews({
        apiKey: '   ',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns empty array without throwing when SerpApi returns an invalid API key error body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          error: 'Invalid API key. Your API key should be 64 characters long.',
        }),
      });

      const results = await fetchDisruptionNews({
        apiKey: 'invalid-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns empty array without throwing when SerpApi returns HTTP 401 Unauthorized', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const results = await fetchDisruptionNews({
        apiKey: 'unauthorized-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Timeout & Failure Resilient Fallback', () => {
    it('returns empty array without throwing when request times out', async () => {
      const mockFetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      const results = await fetchDisruptionNews({
        apiKey: 'test-key',
        timeoutMs: 50,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns empty array without throwing on network failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND serpapi.com'));

      const results = await fetchDisruptionNews({
        apiKey: 'test-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns empty array without throwing when server responds with HTTP 500 error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const results = await fetchDisruptionNews({
        apiKey: 'test-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toEqual([]);
    });

    it('returns empty array without throwing when response body is not valid JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });

      const results = await fetchDisruptionNews({
        apiKey: 'test-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(results).toEqual([]);
    });
  });

  describe('Per-Plan Query Cap & Caching', () => {
    it('caps queries to 1 per decision window and returns cached results on repeated calls', async () => {
      const mockSerpApiResponse = {
        news_results: [
          {
            title: 'Waterlogging at Hebbal flyover causes 45m delay',
            source: 'The Hindu',
            date: '45 mins ago',
            link: 'https://thehindu.com/bengaluru/hebbal',
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSerpApiResponse,
      });

      const planId = 'plan-bengaluru-east-101';
      const windowId = 'window-2026-11-22-morning';

      // 1st query: executes live fetch
      const firstResult = await fetchDisruptionNews({
        planId,
        windowId,
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(firstResult).toHaveLength(1);
      expect(firstResult[0].title).toBe('Waterlogging at Hebbal flyover causes 45m delay');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(getQueryCapCount(planId, windowId)).toBe(1);

      // 2nd query in the same decision window: capped!
      // Must NOT call fetch again; returns cached results
      const secondResult = await fetchDisruptionNews({
        planId,
        windowId,
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(secondResult).toEqual(firstResult);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, no second call made

      // 3rd query with forceFresh = true bypasses the cap if explicitly asked
      const thirdResult = await fetchDisruptionNews({
        planId,
        windowId,
        apiKey: 'test-api-key',
        forceFresh: true,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(thirdResult).toEqual(firstResult);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(getQueryCapCount(planId, windowId)).toBe(2);
    });

    it('isolates query caps across different plans and windows', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          news_results: [
            {
              title: 'Heavy rain alert for Bengaluru urban',
              source: 'India Today',
              date: '1 hour ago',
              link: 'https://indiatoday.in/weather',
            },
          ],
        }),
      });

      await fetchDisruptionNews({
        planId: 'plan-A',
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await fetchDisruptionNews({
        planId: 'plan-B',
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      // Two different plans each make 1 query
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(getQueryCapCount('plan-A')).toBe(1);
      expect(getQueryCapCount('plan-B')).toBe(1);
    });

    it('returns empty array when query cap is exceeded without prior cached news', async () => {
      // Simulate exceeding query cap with reset
      const planId = 'plan-capped-empty';
      const windowId = 'window-1';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ news_results: [] }),
      });

      // First query returns empty news
      const firstResult = await fetchDisruptionNews({
        planId,
        windowId,
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      expect(firstResult).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second query returns cached empty array without calling fetch
      const secondResult = await fetchDisruptionNews({
        planId,
        windowId,
        apiKey: 'test-api-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      expect(secondResult).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
