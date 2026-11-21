import { Router } from 'express';
import { getDb } from '../db.js';

export const notificationsRouter = Router();

// GET /api/notifications - Returns recent in-app notifications
notificationsRouter.get('/', (_req, res) => {
  try {
    const db = getDb();
    const notifications: any[] = [];

    // 1. Alerts & Threshold breaches
    const alertRows = db.prepare(`
      SELECT 
        a.id as alert_id,
        a.pact_id,
        a.episode_id,
        a.decision_status,
        a.created_at,
        p.title as pact_title,
        p.destination_name,
        p.fallback_text,
        c.answer as context_answer
      FROM alerts a
      JOIN pacts p ON a.pact_id = p.id
      LEFT JOIN citation_contexts c ON a.id = c.alert_id
      ORDER BY a.created_at DESC
      LIMIT 10
    `).all() as any[];

    for (const a of alertRows) {
      const d = new Date(a.created_at);
      const ist = !isNaN(d.getTime())
        ? d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: 'short',
            hour12: false,
          }) + ' IST'
        : a.created_at;

      notifications.push({
        id: `notif_alert_${a.alert_id}`,
        alertId: a.alert_id,
        pactId: a.pact_id,
        type: 'alert',
        title: '🚨 Commute Threshold Breach Detected',
        message: `Two consecutive checks exceeded threshold for "${a.pact_title}". Recommended action: ${a.fallback_text}`,
        timestampIst: ist,
        timestampUtc: a.created_at,
        read: a.decision_status !== 'pending',
      });
    }

    // 2. Outbox status events
    const outboxRows = db.prepare(`
      SELECT o.id, o.alert_id, o.status, o.attempts, o.provider_receipt, o.created_at, p.title as pact_title
      FROM outbox o
      JOIN alerts a ON o.alert_id = a.id
      JOIN pacts p ON a.pact_id = p.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `).all() as any[];

    for (const o of outboxRows) {
      const d = new Date(o.created_at);
      const ist = !isNaN(d.getTime())
        ? d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: 'short',
            hour12: false,
          }) + ' IST'
        : o.created_at;

      const isDelivered = o.status === 'delivered' || o.status === 'sent';
      notifications.push({
        id: `notif_outbox_${o.id}`,
        alertId: o.alert_id,
        type: isDelivered ? 'delivery' : 'info',
        title: isDelivered ? '✓ Alert Sent to Team Conversation' : 'ℹ Alert Delivery Queued',
        message: isDelivered
          ? `Dispatched alert receipt for "${o.pact_title}" to channel.`
          : `Alert delivery pending. ${o.provider_receipt || ''}`,
        timestampIst: ist,
        timestampUtc: o.created_at,
        read: true,
      });
    }

    // 3. Acknowledgements recorded
    const ackRows = db.prepare(`
      SELECT ack.id, ack.alert_id, ack.user_id, ack.decision, ack.created_at, tm.user_name, p.title as pact_title
      FROM acknowledgements ack
      JOIN team_members tm ON ack.user_id = tm.user_id
      JOIN alerts a ON ack.alert_id = a.id
      JOIN pacts p ON a.pact_id = p.id
      ORDER BY ack.created_at DESC
      LIMIT 5
    `).all() as any[];

    for (const ack of ackRows) {
      const d = new Date(ack.created_at);
      const ist = !isNaN(d.getTime())
        ? d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: 'short',
            hour12: false,
          }) + ' IST'
        : ack.created_at;

      const decisionText = ack.decision === 'remote' ? 'Switch to remote' : ack.decision === 'keep' ? 'Proceed with trip' : 'Discuss in chat';
      notifications.push({
        id: `notif_ack_${ack.id}`,
        alertId: ack.alert_id,
        type: 'decision',
        title: `Decision Recorded: ${decisionText}`,
        message: `${ack.user_name} recorded decision: "${decisionText}" for "${ack.pact_title}".`,
        timestampIst: ist,
        timestampUtc: ack.created_at,
        read: true,
      });
    }

    // Sort by timestampUtc descending
    notifications.sort((a, b) => new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime());

    res.json({ notifications });
  } catch (err: any) {
    console.error('Failed to get notifications:', err);
    res.status(500).json({ error: err.message });
  }
});
