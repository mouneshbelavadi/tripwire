import { Router } from 'express';
import { ReceiptService } from '../domain/receiptService.js';
import { getActiveUserId } from './session.js';
import { getDb } from '../db.js';

export const receiptsRouter = Router();

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

// POST /api/receipts/:alertId/decision - Authenticated decision (keep | remote | discuss)
receiptsRouter.post('/:alertId/decision', async (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const { decision } = req.body;

    if (!decision || !['keep', 'remote', 'discuss'].includes(decision)) {
      res.status(400).json({ error: 'Invalid decision. Must be keep, remote, or discuss.' });
      return;
    }

    const updated = await ReceiptService.recordDecision(req.params.alertId, userId, decision);
    res.json({
      message: `Decision "${decision}" recorded for user ${userId}.`,
      receipt: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
