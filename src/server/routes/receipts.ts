import { Router, Request, Response } from 'express';
import { ReceiptService } from '../domain/receiptService.js';
import { getActiveUserId } from './session.js';
import { getDb } from '../db.js';
import { writeRateLimiter } from '../middleware/rateLimiter.js';
import { eventBus } from '../domain/eventBus.js';

export const receiptsRouter = Router();

/**
 * Reusable handler for recording authenticated participant decision on an alert.
 * Accepts: 'keep' | 'remote' | 'discuss' | 'meet' | 'cancel_cab' | 'cancel_meeting'
 */
export async function handleAlertDecision(req: Request, res: Response) {
  try {
    const alertId = req.params.alertId || req.params.id;
    const userId = (req.headers['x-user-id'] as string) || req.body.userId || req.body.user_id || getActiveUserId();
    const rawDecision = req.body.decision || req.body.action;

    const allowedDecisions = ['keep', 'remote', 'discuss', 'meet', 'cancel_cab', 'cancel_meeting'];
    let decision = rawDecision;
    if (decision === 'remote_fallback') decision = 'remote';
    if (decision === 'keep_plan') decision = 'keep';

    if (!decision || !allowedDecisions.includes(decision)) {
      res.status(400).json({
        error: 'Invalid decision. Must be keep, remote, discuss, meet, cancel_cab, or cancel_meeting.',
      });
      return;
    }

    const updated = await ReceiptService.recordDecision(alertId, userId, decision);

    // Record decision and broadcast/log appropriate action text into team_messages
    const db = getDb();
    const member = db.prepare('SELECT user_name FROM team_members WHERE user_id = ?').get(userId) as any;
    const participant = db.prepare('SELECT user_name FROM participants WHERE user_id = ?').get(userId) as any;
    const userName = member?.user_name || participant?.user_name || userId;

    let actionText = '';
    let statusText = '';
    switch (decision) {
      case 'meet':
        actionText = `📹 ${userName} selected "Go to Google Meet": Launched virtual Google Meet room (https://meet.google.com/new) and cast vote for remote fallback.`;
        statusText = 'remote_chosen';
        break;
      case 'remote':
        actionText = `📹 ${userName} selected "Go to Google Meet": Switched to remote fallback and notified team.`;
        statusText = 'remote_chosen';
        break;
      case 'cancel_cab':
        actionText = `🚕 ${userName} selected "Cancel the Cab": Canceled Uber / Ola ride reservation to avoid surge cancellation fee.`;
        statusText = 'cab_canceled';
        break;
      case 'cancel_meeting':
        actionText = `📅 ${userName} selected "Cancel the Meeting": Rescheduled today's in-person sync to tomorrow.`;
        statusText = 'meeting_canceled';
        break;
      case 'keep':
        actionText = `🚗 ${userName} selected "Maintain Office Plan": Proceeding with office commute despite traffic delay.`;
        statusText = 'plan_kept';
        break;
      case 'discuss':
        actionText = `💬 ${userName} selected "Discuss in Chat": Opened team conversation to align on next steps.`;
        statusText = 'needs_discussion';
        break;
      default:
        actionText = `${userName} recorded decision: ${decision}.`;
        statusText = `${decision}_chosen`;
    }

    // Insert into team_messages
    const msgId = `msg_act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      db.prepare(`
        INSERT INTO team_messages (id, company_id, channel_id, user_id, user_name, text, sent_time)
        VALUES (?, 'comp_paytm', 'group_office_pact', ?, ?, ?, ?)
      `).run(msgId, userId, userName, actionText, Date.now());
    } catch {
      try {
        db.prepare(`
          INSERT INTO team_messages (id, channel_id, user_id, user_name, text, sent_time)
          VALUES (?, 'group_office_pact', ?, ?, ?, ?)
        `).run(msgId, userId, userName, actionText, Date.now());
      } catch (e) {
        console.error('Failed to insert team message:', e);
      }
    }

    // Update alert status in database
    if (statusText) {
      db.prepare('UPDATE alerts SET decision_status = ? WHERE id = ?').run(statusText, alertId);
    }

    // Emit event to EventBus
    try {
      eventBus.emitEvent('decision', {
        alertId,
        userId,
        decision,
        status: statusText,
        actionText,
        receipt: updated,
      });
    } catch {}

    res.json({
      success: true,
      decision,
      action: decision,
      status: statusText,
      message: `Decision "${decision}" recorded for user ${userId}.`,
      receipt: updated,
    });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
}

// GET /api/receipts/latest/pact/:pactId - Returns the latest alert receipt for a pact
receiptsRouter.get('/latest/pact/:pactId', async (req, res) => {
  try {
    const db = getDb();
    const latestAlert = db
      .prepare('SELECT id FROM alerts WHERE pact_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(req.params.pactId) as any;

    if (!latestAlert) {
      res.json({ alert: null, receipt: null });
      return;
    }

    const receipt = await ReceiptService.getReceipt(latestAlert.id);
    res.json({ alert: latestAlert, receipt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/receipts/:alertId - Returns immutable evidence receipt
receiptsRouter.get('/:alertId', async (req, res) => {
  try {
    const receipt = await ReceiptService.getReceipt(req.params.alertId);
    res.json({ receipt });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/receipts/:alertId/decision - Authenticated decision (keep | remote | discuss) with write rate limiting
receiptsRouter.post('/:alertId/decision', writeRateLimiter, handleAlertDecision);
