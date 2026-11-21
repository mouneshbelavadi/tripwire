import { config } from '../config.js';

export interface YouAnswerOptions {
  query: string;
  freshness?: 'day' | 'week' | 'month' | 'year';
}

export class YouProvider {
  static getStatus() {
    if (!config.youCom.isConfigured) {
      return {
        name: 'You.com',
        configured: false,
        status: 'skipped' as const,
        reason: 'YDC_API_KEY missing',
        endpoint: 'https://api.you.com/v1/answer',
      };
    }
    return {
      name: 'You.com',
      configured: true,
      status: 'configured' as const,
      endpoint: 'https://api.you.com/v1/answer',
    };
  }

  /**
   * Request cited public context from You.com Answer API.
   * Strict invariant: Query < 400 characters, no private personal/coordinate data.
   */
  static async answer(options: YouAnswerOptions): Promise<any> {
    if (!config.youCom.isConfigured) {
      throw new Error(`You.com call rejected: API key not configured. Mode is ${config.mode}.`);
    }

    if (options.query.length > 400) {
      throw new Error(`You.com query exceeds 400 character limit (${options.query.length} chars)`);
    }

    const response = await fetch('https://api.you.com/v1/answer', {
      method: 'POST',
      headers: {
        'X-API-Key': config.youCom.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: options.query,
        freshness: options.freshness || 'week',
      }),
    });

    if (!response.ok) {
      throw new Error(`You.com HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }
}
