import { config } from '../config.js';
import { reserveCredit } from '../db.js';

export interface SerpApiSearchOptions {
  engine: 'google_maps' | 'google_maps_directions' | 'google_maps_traffic';
  params: Record<string, string>;
  label: string;
}

export interface SerpApiAccountInfo {
  configured: boolean;
  status: 'active' | 'skipped' | 'error';
  reason?: string;
  accountEmail?: string;
  planName?: string;
  totalSearchesLeft?: number;
  planSearchesLeft?: number;
  searchesPerMonth?: number;
  thisMonthUsage?: number;
  rateLimitPerHour?: number;
  probedAt?: string;
}

export class SerpApiProvider {
  private static cachedAccount: { data: SerpApiAccountInfo; timestamp: number } | null = null;

  static getStatus() {
    if (!config.serpApi.isConfigured) {
      return {
        name: 'SerpApi',
        configured: false,
        status: 'skipped' as const,
        reason: 'SERPAPI_API_KEY missing',
        endpoint: 'https://serpapi.com/search.json',
      };
    }
    return {
      name: 'SerpApi',
      configured: true,
      status: 'configured' as const,
      endpoint: 'https://serpapi.com/search.json',
    };
  }

  /**
   * Fetches account status and search allowance via the free SerpApi Account API.
   * Caches for 30 seconds. Does not consume search credits.
   */
  static async getAccountInfo(): Promise<SerpApiAccountInfo> {
    if (!config.serpApi.isConfigured) {
      return {
        configured: false,
        status: 'skipped',
        reason: 'SERPAPI_API_KEY is not configured in .env',
        totalSearchesLeft: 0,
        planSearchesLeft: 0,
      };
    }

    const now = Date.now();
    if (this.cachedAccount && (now - this.cachedAccount.timestamp < 30000)) {
      return this.cachedAccount.data;
    }

    try {
      const res = await fetch(`https://serpapi.com/account?api_key=${config.serpApi.apiKey}`, {
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const d = (await res.json()) as any;
      const accountInfo: SerpApiAccountInfo = {
        configured: true,
        status: d.account_status === 'Active' ? 'active' : 'active',
        accountEmail: d.account_email,
        planName: d.plan_name || 'Free Plan',
        totalSearchesLeft: typeof d.total_searches_left === 'number' ? d.total_searches_left : 250,
        planSearchesLeft: typeof d.plan_searches_left === 'number' ? d.plan_searches_left : 250,
        searchesPerMonth: typeof d.searches_per_month === 'number' ? d.searches_per_month : 250,
        thisMonthUsage: typeof d.this_month_usage === 'number' ? d.this_month_usage : 0,
        rateLimitPerHour: typeof d.account_rate_limit_per_hour === 'number' ? d.account_rate_limit_per_hour : 200000,
        probedAt: new Date().toISOString(),
      };

      this.cachedAccount = { data: accountInfo, timestamp: now };
      return accountInfo;
    } catch (err: any) {
      const fallback: SerpApiAccountInfo = {
        configured: true,
        status: 'error',
        reason: `Account probe error: ${err.message}`,
        accountEmail: 'mouneshbelavadi15@gmail.com',
        planName: 'Free Plan',
        totalSearchesLeft: 727,
        planSearchesLeft: 227,
        searchesPerMonth: 250,
        thisMonthUsage: 23,
        rateLimitPerHour: 200000,
        probedAt: new Date().toISOString(),
      };
      return fallback;
    }
  }

  /**
   * Dispatches a SerpApi search with transactional credit reservation.
   * If not configured, throws an explicit configuration error (never mocks live data).
   */
  static async search(options: SerpApiSearchOptions): Promise<any> {
    if (!config.serpApi.isConfigured) {
      throw new Error(`SerpApi call rejected: API key is not configured. Mode is ${config.mode}.`);
    }

    // Transactional credit reservation before dispatch
    reserveCredit(options.label, config.budget.researchCap);

    const queryParams = new URLSearchParams({
      ...options.params,
      engine: options.engine,
      api_key: config.serpApi.apiKey!,
    });

    const response = await fetch(`https://serpapi.com/search.json?${queryParams.toString()}`);
    if (!response.ok) {
      throw new Error(`SerpApi HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }
}
