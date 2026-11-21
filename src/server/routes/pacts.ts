import { Router } from 'express';
import { PactService } from '../domain/pactService.js';
import { getActiveUserId } from './session.js';

export const pactsRouter = Router();

// GET /api/pacts - List pacts
pactsRouter.get('/', (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const teamId = (req.query.team_id as string) || 'team_office_pact';
    const pacts = PactService.listPacts(teamId, userId);
    res.json({ pacts });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/pacts - Create a new pact
pactsRouter.post('/', (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const teamId = (req.body.team_id as string) || (req.query.team_id as string) || 'team_office_pact';
    const pact = PactService.createPact(teamId, userId, req.body);
    res.status(201).json({ pact, message: 'Pact created successfully in draft status.' });
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
pactsRouter.put('/:id', (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || getActiveUserId();
    const updated = PactService.updatePactRules(req.params.id, userId, req.body);
    res.json({ pact: updated, message: `Pact updated to version ${updated.version}. Prior approvals invalidated.` });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/pacts/:id/approve - Approve current pact version
pactsRouter.post('/:id/approve', (req, res) => {
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

// POST /api/pacts/:id/close - Close/complete pact and move to Past
pactsRouter.post('/:id/close', (req, res) => {
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
pactsRouter.post('/:id/complete', (req, res) => {
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
