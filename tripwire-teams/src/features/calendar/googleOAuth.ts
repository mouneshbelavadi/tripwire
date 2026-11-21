import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../../config/encryption.js';
import { env } from '../../config/env.js';

/**
 * Strictly required OAuth scope for Tripwire Teams calendar operations
 */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export class CalendarAuthError extends Error {
  readonly code: string;
  constructor(message: string, code = 'CALENDAR_AUTH_ERROR') {
    super(message);
    this.name = 'CalendarAuthError';
    this.code = code;
  }
}

let defaultPrisma: PrismaClient | null = null;
export function getPrismaClient(): PrismaClient {
  if (!defaultPrisma) {
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

/**
 * Creates a new OAuth2 client using configured Google credentials.
 */
export function createOAuth2Client(redirectUri?: string): OAuth2Client {
  const clientId = env?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = env?.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const resolvedRedirectUri =
    redirectUri ||
    process.env.GOOGLE_REDIRECT_URI ||
    `http://localhost:${env?.PORT || process.env.PORT || 3000}/oauth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new CalendarAuthError(
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET configuration',
      'MISSING_GOOGLE_CREDENTIALS'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, resolvedRedirectUri);
}

/**
 * Generates Google OAuth2 authorization URL with offline access to ensure refresh token is returned.
 */
export function generateGoogleAuthUrl(state: string, redirectUri?: string): string {
  const client = createOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GOOGLE_CALENDAR_SCOPE],
    state,
  });
}

/**
 * Exchanges authorization code for credentials tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri?: string,
  customClient?: OAuth2Client
): Promise<{
  tokens: Credentials;
  refreshToken: string;
  accessToken?: string;
  email?: string;
}> {
  const client = customClient || createOAuth2Client(redirectUri);
  const response = await client.getToken(code);
  const tokens = response.tokens;

  if (!tokens || !tokens.refresh_token) {
    throw new CalendarAuthError(
      'Google did not return a refresh token. Ensure access_type=offline and prompt=consent were used.',
      'NO_REFRESH_TOKEN'
    );
  }

  // Attempt to decode email from id_token if present
  let email: string | undefined;
  if (tokens.id_token) {
    try {
      const parts = tokens.id_token.split('.');
      if (parts.length >= 2 && parts[1]) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        email = payload.email;
      }
    } catch {
      // ignore token parse errors
    }
  }

  return {
    tokens,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token || undefined,
    email,
  };
}

/**
 * Encrypts and persists Google OAuth refresh token to the database.
 */
export async function saveGoogleRefreshToken({
  workspaceId,
  slackUserId,
  refreshToken,
  email,
  db = getPrismaClient(),
}: {
  workspaceId: string;
  slackUserId: string;
  refreshToken: string;
  email?: string;
  db?: any;
}): Promise<any> {
  const encryptedRefreshToken = encrypt(refreshToken);

  const saved = await db.googleToken.upsert({
    where: {
      workspaceId_slackUserId: {
        workspaceId,
        slackUserId,
      },
    },
    create: {
      workspaceId,
      slackUserId,
      encryptedRefreshToken,
      email: email || null,
    },
    update: {
      encryptedRefreshToken,
      email: email !== undefined ? email : undefined,
    },
  });

  return saved;
}

/**
 * Decrypts refresh token and returns an authenticated OAuth2 client with auto-refresh capability.
 */
export async function getAuthenticatedClient({
  workspaceId,
  slackUserId,
  db = getPrismaClient(),
  redirectUri,
  clientOverride,
}: {
  workspaceId: string;
  slackUserId: string;
  db?: any;
  redirectUri?: string;
  clientOverride?: OAuth2Client;
}): Promise<OAuth2Client> {
  const record = await db.googleToken.findUnique({
    where: {
      workspaceId_slackUserId: {
        workspaceId,
        slackUserId,
      },
    },
  });

  if (!record || !record.encryptedRefreshToken) {
    throw new CalendarAuthError(
      `Google Calendar is not connected for user ${slackUserId} in workspace ${workspaceId}. Run /tripwire connect-calendar to authorize.`,
      'CALENDAR_NOT_CONNECTED'
    );
  }

  const decryptedRefreshToken = decrypt(record.encryptedRefreshToken);
  const client = clientOverride || createOAuth2Client(redirectUri);

  client.setCredentials({
    refresh_token: decryptedRefreshToken,
  });

  // Listen to token refresh events and update re-encrypted token in the database
  client.on('tokens', async (newTokens: Credentials) => {
    if (newTokens.refresh_token) {
      try {
        const reEncrypted = encrypt(newTokens.refresh_token);
        await db.googleToken.update({
          where: {
            workspaceId_slackUserId: {
              workspaceId,
              slackUserId,
            },
          },
          data: {
            encryptedRefreshToken: reEncrypted,
          },
        });
      } catch (err) {
        console.error('[GoogleOAuth] Error saving renewed refresh token:', err);
      }
    }
  });

  return client;
}

/**
 * Explicitly triggers refresh of expired access tokens using the refresh token.
 */
export async function refreshAccessToken(client: OAuth2Client): Promise<string> {
  try {
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new CalendarAuthError('Google did not return an access token upon refresh', 'TOKEN_REFRESH_EMPTY');
    }
    return token;
  } catch (error: any) {
    throw new CalendarAuthError(
      `Failed to refresh Google access token: ${error.message || String(error)}`,
      'TOKEN_REFRESH_FAILED'
    );
  }
}
