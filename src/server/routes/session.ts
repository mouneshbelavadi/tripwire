import { Router } from 'express';
import { getDb } from '../db.js';

export const sessionRouter = Router();

// Simple in-memory session default for local multi-user testing
let activeUserId: string = 'user_maya';

export function getActiveUserId(): string {
  return activeUserId;
}

export function setActiveUserId(id: string): void {
  activeUserId = id;
}

// GET /api/session - Returns available team test members and active session user
sessionRouter.get('/', (_req, res) => {
  const db = getDb();
  const members = db.prepare('SELECT user_id, user_name, neighbourhood, role FROM team_members').all() as any[];
  const active = members.find((m) => m.user_id === activeUserId) || members[0];

  res.json({
    members,
    activeUser: active,
  });
});

// POST /api/session/switch - Switch the active session user
sessionRouter.post('/switch', (req, res) => {
  const { user_id } = req.body;
  const db = getDb();
  const member = db.prepare('SELECT user_id, user_name, neighbourhood, role FROM team_members WHERE user_id = ?').get(user_id) as any;

  if (!member) {
    res.status(404).json({ error: `User ${user_id} not found in team members` });
    return;
  }

  setActiveUserId(member.user_id);
  res.json({
    message: `Active session switched to ${member.user_name} (${member.neighbourhood})`,
    activeUser: member,
  });
});
