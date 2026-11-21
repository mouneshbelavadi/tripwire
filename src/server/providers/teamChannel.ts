import crypto from 'crypto';
import { config } from '../config.js';

const ALLOWED_REGIONS = new Set([
  'https://api.sg-light-api.com',
  'https://api-b.sg-light-api.com',
  'https://api.us-light-api.com',
  'https://api-b.us-light-api.com',
  'https://api.sau-light-api.com',
  'https://api-b.sau-light-api.com',
]);

export class TeamChannelProvider {
  static getStatus() {
    if (!config.teamChannel.isConfigured) {
      return {
        name: 'In-App Team Channel',
        configured: false,
        status: 'skipped' as const,
        reason: 'TEAM_CHANNEL_APP_KEY, APP_SECRET or API_BASE missing',
        endpoint: config.teamChannel.apiBase || 'https://api.sg-light-api.com',
      };
    }

    const cleanBase = config.teamChannel.apiBase?.replace(/\/$/, '');
    if (!cleanBase || !ALLOWED_REGIONS.has(cleanBase)) {
      return {
        name: 'In-App Team Channel',
        configured: false,
        status: 'blocked_config' as const,
        reason: 'TEAM_CHANNEL_API_BASE must be a documented regional HTTPS endpoint',
        endpoint: cleanBase || 'unspecified',
      };
    }

    return {
      name: 'In-App Team Channel',
      configured: true,
      status: 'configured' as const,
      endpoint: cleanBase,
    };
  }

  /**
   * Generates a v4 access token for an authenticated user session.
   * Signature: SHA1(AppSecret + Nonce + Timestamp)
   */
  static async issueAccessToken(userId: string, name: string): Promise<any> {
    if (!config.teamChannel.isConfigured) {
      throw new Error(`In-app team channel call rejected: Credentials not configured. Mode is ${config.mode}.`);
    }

    const base = config.teamChannel.apiBase!.replace(/\/$/, '');
    const nonce = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHash('sha1')
      .update(config.teamChannel.appSecret! + nonce + timestamp)
      .digest('hex');

    const response = await fetch(`${base}/v4/auth/access-token/issue`, {
      method: 'POST',
      headers: {
        'App-Key': config.teamChannel.appKey!,
        'Nonce': nonce,
        'Timestamp': timestamp,
        'Signature': signature,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, name }),
    });

    if (!response.ok) {
      throw new Error(`In-app team channel HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }
}
