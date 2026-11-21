/**
 * SerpApi Disruption News Integration
 * 
 * Supplementary evidence module for Bengaluru commute disruptions.
 * 
 * CRITICAL SAFETY RULES:
 * 1. Web news headlines NEVER trigger an alert or remote recommendation on their own.
 *    They are strictly supplementary evidence attached to an already-flagged Routes API commute breach.
 * 2. Cautious framing: Headlines are never stated as confirmed facts.
 *    Attribution is always framed: "Possible cause, from the web (reported by {source})".
 * 3. Per-plan query cap: Max 1 query per decision window to prevent quota burn.
 * 4. Resilient fallback: Missing keys, timeouts, network issues, or SerpApi errors
 *    always return an empty array without failing the parent recommendation.
 */

export interface DisruptionNewsItem {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  attribution: string;
}

export interface FetchDisruptionNewsOptions {
  planId?: string;
  windowId?: string;
  query?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  forceFresh?: boolean;
}

export interface QueryCapRecord {
  queryCount: number;
  lastQueryTime: number;
  cachedNews: DisruptionNewsItem[];
}

export const DEFAULT_DISRUPTION_QUERY =
  'Bengaluru traffic OR waterlogging OR strike OR bandh OR protest';

export const SERPAPI_SEARCH_URL = 'https://serpapi.com/search.json';
export const DEFAULT_TIMEOUT_MS = 5000;
export const MAX_HEADLINES_COUNT = 3;

/**
 * Invariant: News headlines NEVER trigger alerts or remote recommendations alone.
 */
export const NEWS_ALERTS_ALLOWED = false as const;

// In-memory query cap & cache tracker by planId (and optional windowId)
const planQueryMap = new Map<string, QueryCapRecord>();

export function getCapKey(planId: string, windowId?: string): string {
  return windowId ? `${planId}:${windowId}` : planId;
}

export function getQueryCapCount(planId: string, windowId?: string): number {
  const key = getCapKey(planId, windowId);
  return planQueryMap.get(key)?.queryCount ?? 0;
}

export function resetNewsQueryCaps(): void {
  planQueryMap.clear();
}

/**
 * Format cautious attribution string.
 * Never claims confirmed facts; always frames as possible cause.
 */
export function formatCautiousAttribution(source: string): string {
  const cleanSource = source.trim() || 'Unknown source';
  return `Possible cause, from the web (reported by ${cleanSource})`;
}

/**
 * Enforce critical safety rule:
 * News headlines can ONLY be attached if commute breach has ALREADY been flagged by Routes API.
 * Never allows news to trigger an alert independently.
 */
export function attachSupplementaryNewsEvidence(
  isRoutesBreachFlagged: boolean,
  news: DisruptionNewsItem[]
): DisruptionNewsItem[] {
  if (!isRoutesBreachFlagged) {
    return [];
  }
  return news;
}

/**
 * Fetch supplementary disruption news headlines from SerpApi Google News.
 */
export async function fetchDisruptionNews(
  options: FetchDisruptionNewsOptions = {}
): Promise<DisruptionNewsItem[]> {
  const {
    planId,
    windowId,
    query = DEFAULT_DISRUPTION_QUERY,
    apiKey = process.env.SERPAPI_API_KEY,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = globalThis.fetch,
    forceFresh = false,
  } = options;

  // 1. Missing or empty API key: gracefully fallback immediately
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return [];
  }

  // 2. Per-plan query cap check (max 1 query per decision window)
  if (planId) {
    const capKey = getCapKey(planId, windowId);
    const existing = planQueryMap.get(capKey);

    if (existing && existing.queryCount >= 1 && !forceFresh) {
      // Exceeded query cap: return cached result from earlier query
      return existing.cachedNews ?? [];
    }
  }

  // 3. Setup timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const url = new URL(SERPAPI_SEARCH_URL);
    url.searchParams.set('engine', 'google_news');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', apiKey.trim());
    url.searchParams.set('gl', 'in');
    url.searchParams.set('hl', 'en');

    const response = await fetchFn(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      // Non-200 responses (e.g. 401 Unauthorized, 429 Quota Exceeded, 500)
      return [];
    }

    const data = (await response.json()) as any;

    if (data?.error) {
      // SerpApi returns { error: "..." } on invalid API key or account error
      return [];
    }

    const rawArticles = Array.isArray(data?.news_results)
      ? data.news_results
      : [];

    const extracted: DisruptionNewsItem[] = [];

    for (const item of rawArticles) {
      if (extracted.length >= MAX_HEADLINES_COUNT) {
        break;
      }

      if (!item || typeof item !== 'object') {
        continue;
      }

      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title) {
        continue;
      }

      let sourceName = 'Unknown source';
      if (typeof item.source === 'string' && item.source.trim()) {
        sourceName = item.source.trim();
      } else if (
        typeof item.source === 'object' &&
        item.source !== null &&
        typeof item.source.name === 'string' &&
        item.source.name.trim()
      ) {
        sourceName = item.source.name.trim();
      }

      const publishedAt =
        (typeof item.date === 'string' && item.date.trim()) ||
        (typeof item.iso_date === 'string' && item.iso_date.trim()) ||
        (typeof item.time === 'string' && item.time.trim()) ||
        '';

      const url =
        (typeof item.link === 'string' && item.link.trim()) ||
        (typeof item.url === 'string' && item.url.trim()) ||
        '';

      extracted.push({
        title,
        source: sourceName,
        publishedAt,
        url,
        attribution: formatCautiousAttribution(sourceName),
      });
    }

    // Update query cap cache if planId is provided
    if (planId) {
      const capKey = getCapKey(planId, windowId);
      planQueryMap.set(capKey, {
        queryCount: (planQueryMap.get(capKey)?.queryCount ?? 0) + 1,
        lastQueryTime: Date.now(),
        cachedNews: extracted,
      });
    }

    return extracted;
  } catch (_error) {
    // Network errors, timeouts, JSON parsing errors, aborts:
    // Graceful fallback: return empty array without throwing
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
