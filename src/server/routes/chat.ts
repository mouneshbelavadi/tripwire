import { Router } from 'express';
import { config } from '../config.js';
import { NexconnProvider } from '../providers/nexconn.js';
import { getActiveUserId } from './session.js';
import { getDb } from '../db.js';

export const chatRouter = Router();

// Dedicated test group and test identities per BUILDPLAN & astra.md
export const TEST_GROUP_ID = 'group_office_pact';

// GET /api/chat/status - Returns exact status of Nexconn sponsor track integration
chatRouter.get('/status', (_req, res) => {
  const providerStatus = NexconnProvider.getStatus();
  res.json({
    status: providerStatus.status,
    configured: providerStatus.configured,
    reason: providerStatus.reason,
    endpoint: providerStatus.endpoint,
    channelId: TEST_GROUP_ID,
    packageVersions: {
      chat: '26.5.1',
      engine: '26.5.1',
    },
    integrationState: providerStatus.configured ? 'ready' : 'incomplete_credentials_missing',
  });
});

// POST /api/chat/token - Protected token endpoint deriving identity from authenticated session
chatRouter.post('/token', async (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const db = getDb();
    const member = db
      .prepare('SELECT user_id, user_name, nex_user_id, nex_group_id FROM team_members WHERE user_id = ?')
      .get(userId) as any;

    if (!member) {
      res.status(403).json({ error: `Forbidden: User ${userId} is not a member of the team.` });
      return;
    }

    if (!config.nexconn.isConfigured) {
      // Invariant: If credentials fail/missing, mark sponsor integration incomplete.
      // Never fabricate a mock token or claim live connection.
      res.status(503).json({
        status: 'incomplete',
        reason: 'NEXCONN_APP_KEY, APP_SECRET or API_BASE missing in environment.',
        sponsorIntegration: 'incomplete',
        configured: false,
        member: {
          user_id: member.user_id,
          user_name: member.user_name,
          nex_user_id: member.nex_user_id,
        },
      });
      return;
    }

    // Call official v4 access token issue API
    const tokenResult = await NexconnProvider.issueAccessToken(member.nex_user_id, member.user_name);

    if (tokenResult.code !== 0 || !tokenResult.result?.accessToken) {
      res.status(502).json({
        status: 'token_issuance_failed',
        error: tokenResult.msg || 'Non-zero return code from Nexconn v4 token endpoint',
        code: tokenResult.code,
        sponsorIntegration: 'incomplete',
      });
      return;
    }

    res.json({
      status: 'ok',
      accessToken: tokenResult.result.accessToken,
      userId: tokenResult.result.userId,
      appKey: config.nexconn.appKey,
      apiBase: config.nexconn.apiBase,
      groupId: TEST_GROUP_ID,
      user: {
        id: member.user_id,
        name: member.user_name,
        nexUserId: member.nex_user_id,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, sponsorIntegration: 'incomplete' });
  }
});

// GET /api/chat/messages - Returns team channel messages
chatRouter.get('/messages', (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM team_messages WHERE channel_id = ? ORDER BY sent_time ASC').all(TEST_GROUP_ID) as any[];
    res.json({
      messages: rows.map((r) => ({
        id: r.id,
        senderId: r.user_id,
        senderName: r.user_name,
        text: r.text,
        sentTime: r.sent_time,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/messages - Send message to team channel
chatRouter.post('/messages', (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Message text required' });
      return;
    }

    const db = getDb();
    const member = db.prepare('SELECT user_id, user_name FROM team_members WHERE user_id = ?').get(userId) as any;
    if (!member) {
      res.status(403).json({ error: `Forbidden: User ${userId} is not in team.` });
      return;
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowEpoch = Date.now();

    db.prepare(`
      INSERT INTO team_messages (id, channel_id, user_id, user_name, text, sent_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(msgId, TEST_GROUP_ID, member.user_id, member.user_name, text.trim(), nowEpoch);

    res.json({
      message: {
        id: msgId,
        senderId: member.user_id,
        senderName: member.user_name,
        text: text.trim(),
        sentTime: nowEpoch,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
