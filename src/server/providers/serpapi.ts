import { config } from '../config.js';
import { reserveCredit } from '../db.js';

export interface SerpApiSearchOptions {
  engine: 'google_maps' | 'google_maps_directions' | 'google_maps_traffic';
  params: Record<string, string>;
  label: string;
}

export class SerpApiProvider {
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
