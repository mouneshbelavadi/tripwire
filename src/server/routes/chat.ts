import { Router } from 'express';
import { config } from '../config.js';
import { TeamChannelProvider } from '../providers/teamChannel.js';
import { getActiveUserId } from './session.js';
import { getDb } from '../db.js';
import { eventBus } from '../domain/eventBus.js';

export const chatRouter = Router();

// Dedicated test group and test identities per BUILDPLAN & astra.md
export const TEST_GROUP_ID = 'group_office_pact';

// GET /api/chat/status - Returns exact status of in-app team channel integration
chatRouter.get('/status', (_req, res) => {
  const providerStatus = TeamChannelProvider.getStatus();
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

    if (!config.teamChannel.isConfigured) {
      // Invariant: If credentials fail/missing, mark sponsor integration incomplete.
      // Never fabricate a mock token or claim live connection.
      res.status(503).json({
        status: 'incomplete',
        reason: 'TEAM_CHANNEL_APP_KEY, APP_SECRET or API_BASE missing in environment.',
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
    const tokenResult = await TeamChannelProvider.issueAccessToken(member.nex_user_id, member.user_name);

    if (tokenResult.code !== 0 || !tokenResult.result?.accessToken) {
      res.status(502).json({
        status: 'token_issuance_failed',
        error: tokenResult.msg || 'Non-zero return code from team channel v4 token endpoint',
        code: tokenResult.code,
        sponsorIntegration: 'incomplete',
      });
      return;
    }

    res.json({
      status: 'ok',
      accessToken: tokenResult.result.accessToken,
      userId: tokenResult.result.userId,
      appKey: config.teamChannel.appKey,
      apiBase: config.teamChannel.apiBase,
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

// GET /api/chat/messages - Returns company-scoped team channel messages
chatRouter.get('/messages', (req, res) => {
  try {
    const db = getDb();
    const companyId = (req.headers['x-company-id'] as string) || (req.query.company_id as string) || 'comp_paytm';
    const channelId = `channel_${companyId}_office_pact`;

    const rows = db.prepare(
      'SELECT * FROM team_messages WHERE company_id = ? OR channel_id = ? OR (channel_id = ? AND company_id IS NULL) ORDER BY sent_time ASC'
    ).all(companyId, channelId, TEST_GROUP_ID) as any[];

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

// POST /api/chat/messages - Send message to company team channel
chatRouter.post('/messages', (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const companyId = (req.headers['x-company-id'] as string) || 'comp_paytm';
    const channelId = `channel_${companyId}_office_pact`;
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Message text required' });
      return;
    }

    const db = getDb();
    let member = db.prepare('SELECT user_id, user_name FROM team_members WHERE user_id = ?').get(userId) as any;
    if (!member) {
      member = { user_id: userId, user_name: (req.headers['x-user-name'] as string) || 'Team Member' };
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowEpoch = Date.now();

    db.prepare(`
      INSERT INTO team_messages (id, company_id, channel_id, user_id, user_name, text, sent_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(msgId, companyId, channelId, member.user_id, member.user_name, text.trim(), nowEpoch);

    const messageObj = {
      id: msgId,
      senderId: member.user_id,
      senderName: member.user_name,
      text: text.trim(),
      sentTime: nowEpoch,
    };

    eventBus.emitEvent('chat', {
      message: messageObj,
    });

    res.json({
      message: messageObj,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
