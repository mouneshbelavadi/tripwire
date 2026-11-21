import { Router } from 'express';
import { PactService } from '../domain/pactService.js';
import { getActiveUserId } from './session.js';
import { getDb } from '../db.js';
import { createPactSchema, updatePactSchema } from '../schemas/pactValidation.js';
import { writeRateLimiter } from '../middleware/rateLimiter.js';

export const pactsRouter = Router();

// GET /api/pacts - List pacts
pactsRouter.get('/', (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const companyId = (req.headers['x-company-id'] as string) || (req.query.company_id as string);
    const teamId = (req.query.team_id as string) || 'team_office_pact';
    const pacts = PactService.listPacts(teamId, userId, companyId);
    res.json({ pacts });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/pacts - Create a new pact
pactsRouter.post('/', writeRateLimiter, (req, res) => {
  try {
    const validation = createPactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const teamId = (req.body.team_id as string) || (req.query.team_id as string) || 'team_office_pact';
    const pact = PactService.createPact(teamId, userId, validation.data);
    res.status(201).json({
      pact,
      message: pact.status === 'awaiting_approval'
        ? 'Pact created and submitted for team approvals.'
        : 'Pact created successfully in draft status.',
    });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/pacts/:id - Get pact details
pactsRouter.get('/:id', (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const pact = PactService.getPactDetails(req.params.id, userId);
    res.json({ pact });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// PUT /api/pacts/:id - Update pact rules (increments version, invalidates prior approvals)
pactsRouter.put('/:id', writeRateLimiter, (req, res) => {
  try {
    const validation = updatePactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const updated = PactService.updatePactRules(req.params.id, userId, validation.data);
    res.json({ pact: updated, message: `Pact updated to version ${updated.version}. Prior approvals invalidated.` });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/pacts/:id/approve - Approve current pact version
pactsRouter.post('/:id/approve', writeRateLimiter, (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const updated = PactService.approvePact(req.params.id, userId);
    res.json({
      pact: updated,
      message: updated.status === 'armed'
        ? `All participants approved! Pact is now ARMED.`
        : `Approval recorded for version ${updated.version}. Awaiting remaining approvals.`
    });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/pacts/:id/pause - Pause pact monitoring
pactsRouter.post('/:id/pause', writeRateLimiter, (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const updated = PactService.pausePact(req.params.id, userId);
    res.json({
      pact: updated,
      message: `Pact monitoring paused.`
    });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/pacts/feed/recent-activity - Return recent events
pactsRouter.get('/feed/recent-activity', (_req, res) => {
  try {
    const db = getDb();
    const events: Array<{ id: string; timestamp: string; title: string; description: string; type: string }> = [];

    // 1. Observations
    const obsRows = db.prepare(`
      SELECT o.id, o.received_at, o.normalized_json, o.provenance, w.pact_id, p.title as pact_title
      FROM observations o
      JOIN watches w ON o.watch_id = w.id
      JOIN pacts p ON w.pact_id = p.id
      ORDER BY o.received_at DESC
      LIMIT 10
    `).all() as any[];

    for (const obs of obsRows) {
      try {
        const norm = JSON.parse(obs.normalized_json);
        const mins = norm.fastestDuration ? Math.round(norm.fastestDuration / 60) : null;
        events.push({
          id: obs.id,
          timestamp: obs.received_at,
          title: obs.pact_title || 'Route Observation',
          description: mins ? `Recorded commute observation: ${mins} min (${obs.provenance})` : `Incident scan completed (${obs.provenance})`,
          type: 'observation'
        });
      } catch (e) {
        // ignore JSON parse error
      }
    }

    // 2. Alerts
    const alertRows = db.prepare(`
      SELECT a.id, a.created_at, a.decision_status, p.title as pact_title
      FROM alerts a
      JOIN pacts p ON a.pact_id = p.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `).all() as any[];

    for (const a of alertRows) {
      events.push({
        id: a.id,
        timestamp: a.created_at,
        title: a.pact_title,
        description: `Alert triggered: 2 consecutive breaches verified (status: ${a.decision_status})`,
        type: 'alert'
      });
    }

    // 3. Pacts
    const pactRows = db.prepare(`
      SELECT id, title, status, version, updated_at
      FROM pacts
      ORDER BY updated_at DESC
      LIMIT 5
    `).all() as any[];

    for (const p of pactRows) {
      events.push({
        id: `pact_${p.id}_${p.version}`,
        timestamp: p.updated_at,
        title: p.title,
        description: `Pact status updated to ${p.status.toUpperCase()} (version ${p.version})`,
        type: 'pact'
      });
    }

    // Sort descending by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ events: events.slice(0, 8) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pacts/:id/close - Close/complete pact and move to Past
pactsRouter.post('/:id/close', writeRateLimiter, (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const updated = PactService.closePact(req.params.id, userId, 'completed');
    res.json({
      pact: updated,
      message: `Pact marked as completed and moved to Past.`
    });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/pacts/:id/complete - Complete pact and move to Past
pactsRouter.post('/:id/complete', writeRateLimiter, (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const updated = PactService.closePact(req.params.id, userId, 'completed');
    res.json({
      pact: updated,
      message: `Pact marked as completed and moved to Past.`
    });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});
