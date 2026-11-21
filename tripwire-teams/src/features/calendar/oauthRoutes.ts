import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import {
  generateGoogleAuthUrl,
  exchangeCodeForTokens,
  saveGoogleRefreshToken,
  getPrismaClient,
} from './googleOAuth.js';
import { env } from '../../config/env.js';

export interface OAuthStatePayload {
  workspaceId: string;
  slackUserId: string;
  timestamp: number;
  redirectUri?: string;
}

// In-memory CSRF state cache with 10-minute validity
const stateStore = new Map<string, OAuthStatePayload>();
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Generates a random cryptographic state parameter to prevent CSRF.
 */
export function generateOAuthState(
  workspaceId: string,
  slackUserId: string,
  redirectUri?: string
): string {
  // Prune expired states
  const now = Date.now();
  for (const [key, val] of stateStore.entries()) {
    if (now - val.timestamp > STATE_TTL_MS) {
      stateStore.delete(key);
    }
  }

  const state = crypto.randomBytes(32).toString('hex');
  stateStore.set(state, {
    workspaceId,
    slackUserId,
    timestamp: now,
    redirectUri,
  });
  return state;
}

/**
 * Verifies and immediately consumes the OAuth state parameter (one-time use).
 */
export function verifyAndConsumeOAuthState(state: string): OAuthStatePayload | null {
  if (!state || typeof state !== 'string') return null;
  const entry = stateStore.get(state);
  if (!entry) return null;

  stateStore.delete(state);

  if (Date.now() - entry.timestamp > STATE_TTL_MS) {
    return null;
  }

  return entry;
}

export function clearOAuthStates(): void {
  stateStore.clear();
}

export const oauthRouter = Router();

/**
 * GET /connect or /oauth/google/connect
 * Initiates Google OAuth consent flow for the given workspace and slack user.
 */
async function handleConnect(req: Request, res: Response) {
  const workspaceId = (req.query.workspaceId as string) || (req.query.team_id as string);
  const slackUserId = (req.query.slackUserId as string) || (req.query.user_id as string);
  const redirectUri = req.query.redirectUri as string | undefined;

  if (!workspaceId || !slackUserId) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Bad Request</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:2rem;}</style></head>
        <body>
          <h2>Missing Parameters</h2>
          <p>Both <code>workspaceId</code> and <code>slackUserId</code> query parameters are required.</p>
        </body>
      </html>
    `);
    return;
  }

  const state = generateOAuthState(workspaceId, slackUserId, redirectUri);
  const authUrl = generateGoogleAuthUrl(state, redirectUri);
  res.redirect(authUrl);
}

oauthRouter.get('/connect', handleConnect);
oauthRouter.get('/oauth/google/connect', handleConnect);

/**
 * GET /callback or /oauth/google/callback
 * Handles Google OAuth redirect, verifies cryptographic state, exchanges code for refresh token, and stores it encrypted.
 */
async function handleCallback(req: Request, res: Response) {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;

  if (error) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Google Authorization Cancelled</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:2rem;text-align:center;}</style></head>
        <body>
          <h2 style="color:#ef4444;">Authorization Cancelled or Denied</h2>
          <p>Google returned error: <code>${error}</code></p>
          <p>You can retry connecting via <code>/tripwire connect-calendar</code> in Slack.</p>
        </body>
      </html>
    `);
    return;
  }

  if (!code || !state) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Bad Request</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:2rem;}</style></head>
        <body>
          <h2>Invalid Request</h2>
          <p>Missing authorization code or state parameter.</p>
        </body>
      </html>
    `);
    return;
  }

  const statePayload = verifyAndConsumeOAuthState(state);
  if (!statePayload) {
    res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>CSRF Validation Failed</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:2rem;text-align:center;}</style></head>
        <body>
          <h2 style="color:#ef4444;">Invalid or Expired Session (CSRF Protection)</h2>
          <p>The state parameter is invalid or has expired. Please run <code>/tripwire connect-calendar</code> in Slack to generate a fresh link.</p>
        </body>
      </html>
    `);
    return;
  }

  try {
    const { tokens, refreshToken, email } = await exchangeCodeForTokens(
      code,
      statePayload.redirectUri
    );

    await saveGoogleRefreshToken({
      workspaceId: statePayload.workspaceId,
      slackUserId: statePayload.slackUserId,
      refreshToken,
      email,
    });

    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tripwire Teams — Calendar Connected</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 1.5rem;
          }
          .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 2.5rem;
            max-width: 480px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
          }
          .icon-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            background-color: rgba(16, 185, 129, 0.15);
            border: 2px solid #10b981;
            border-radius: 50%;
            margin-bottom: 1.25rem;
            color: #10b981;
            font-size: 28px;
          }
          h1 {
            font-size: 1.5rem;
            margin: 0 0 0.75rem 0;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          p {
            color: #94a3b8;
            font-size: 0.95rem;
            line-height: 1.6;
            margin: 0 0 1.25rem 0;
          }
          .account-box {
            background-color: #0f172a;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            font-size: 0.875rem;
            color: #38bdf8;
            margin-bottom: 1.5rem;
            word-break: break-all;
          }
          .footer-note {
            font-size: 0.8rem;
            color: #64748b;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon-badge">✓</div>
          <h1>Google Calendar Connected</h1>
          <p>
            Your Google account has been authorized. Tripwire Teams can now schedule your office syncs and automatically upgrade them with Google Meet links if commute tripwires fire.
          </p>
          ${email ? `<div class="account-box">Connected Account: <strong>${email}</strong></div>` : ''}
          <p class="footer-note">You can safely close this browser tab and return to Slack.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error('[GoogleOAuth Callback Error]:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authorization Failed</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:2rem;text-align:center;}</style></head>
        <body>
          <h2 style="color:#ef4444;">Authorization Failed</h2>
          <p>${err.message || 'An unknown error occurred during token exchange.'}</p>
          <p>Please try running <code>/tripwire connect-calendar</code> again in Slack.</p>
        </body>
      </html>
    `);
  }
}

oauthRouter.get('/callback', handleCallback);
oauthRouter.get('/oauth/google/callback', handleCallback);

/**
 * Handles `/tripwire connect-calendar` slash command by generating authorization URL and sending ephemeral link to lead.
 */
export async function handleConnectCalendarCommand({
  command,
  ack,
  respond,
  baseUrl,
}: {
  command: { team_id: string; user_id: string };
  ack: () => Promise<void>;
  respond: (msg: any) => Promise<any>;
  baseUrl?: string;
}): Promise<void> {
  await ack();

  const host = baseUrl || `http://localhost:${env?.PORT || process.env.PORT || 3000}`;
  const redirectUri = `${host}/oauth/google/callback`;
  const state = generateOAuthState(command.team_id, command.user_id, redirectUri);
  const authUrl = generateGoogleAuthUrl(state, redirectUri);

  await respond({
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📅 Connect Google Calendar',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            'Authorize Tripwire Teams to create office events and convert them to Google Meet if commute disruptions are confirmed before your decision deadline.\n\n' +
            '*Required scope:* `https://www.googleapis.com/auth/calendar.events` (events only).',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Connect Google Calendar',
              emoji: true,
            },
            url: authUrl,
            style: 'primary',
            action_id: 'connect_google_calendar_button',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '🔒 Your refresh token is encrypted at rest using AES-256-GCM. Only plan owners require calendar authorization.',
          },
        ],
      },
    ],
  });
}
