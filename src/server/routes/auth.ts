import { Router } from 'express';
import { getDb } from '../db.js';

export const authRouter = Router();

export interface Company {
  id: string;
  name: string;
  code: string;
  corporate_id?: string;
  domain?: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  neighbourhood: string;
  origin_lat: number;
  origin_lon: number;
  company_id: string;
  employee_id?: string;
}

// GET /api/auth/companies - List available corporate workspaces
authRouter.get('/companies', (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM companies ORDER BY name ASC').all() as unknown as Company[];
    res.json({ companies: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/session - Retrieve active company and member session
authRouter.get('/session', (req, res) => {
  try {
    const db = getDb();
    const companyId = (req.headers['x-company-id'] as string) || 'comp_paytm';
    const userId = (req.headers['x-user-id'] as string) || 'user_ananya';

    let company = db.prepare('SELECT * FROM companies WHERE id = ? OR UPPER(corporate_id) = ? OR UPPER(code) = ?').get(companyId, companyId.toUpperCase(), companyId.toUpperCase()) as unknown as Company | undefined;
    if (!company) {
      company = db.prepare('SELECT * FROM companies WHERE id = ?').get('comp_paytm') as unknown as Company | undefined;
    }

    const members = db.prepare('SELECT * FROM team_members WHERE company_id = ? ORDER BY user_name ASC').all(company?.id || 'comp_paytm') as unknown as AuthUser[];
    let user = members.find((m) => m.user_id === userId) || members[0] || null;

    res.json({
      company: company || null,
      user: user || null,
      allCompanyMembers: members,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login - Log into a specific company ecosystem and member account
authRouter.post('/login', (req, res) => {
  try {
    const db = getDb();
    const { companyCode, companyName, companyId, userName, employeeId, neighbourhood } = req.body;

    const rawCompanyId = (companyId || companyCode || '').trim();
    const rawCompanyName = (companyName || '').trim();
    const targetUserName = (userName || employeeId || 'Team Member').trim();
    const targetEmpId = (employeeId || '').trim();

    if (!rawCompanyId && !rawCompanyName) {
      return res.status(400).json({ error: 'Company Name and Company ID are required' });
    }

    // 1. Locate company by corporate_id, code, id, or name
    let company: Company | undefined;
    if (rawCompanyId) {
      company = db.prepare(`
        SELECT * FROM companies 
        WHERE UPPER(corporate_id) = ? OR UPPER(code) = ? OR UPPER(id) = ?
      `).get(rawCompanyId.toUpperCase(), rawCompanyId.toUpperCase(), rawCompanyId.toUpperCase()) as unknown as Company | undefined;
    }

    if (!company && rawCompanyName) {
      company = db.prepare(`
        SELECT * FROM companies 
        WHERE UPPER(name) = ? OR UPPER(name) LIKE ?
      `).get(rawCompanyName.toUpperCase(), `%${rawCompanyName.toUpperCase()}%`) as unknown as Company | undefined;
    }

    const nowIso = new Date().toISOString();

    // If company does not exist, provision new corporate entity
    if (!company) {
      const baseCode = (rawCompanyId || rawCompanyName.slice(0, 4) || 'CORP').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const code = baseCode.slice(0, 6) || 'CORP';
      const corpId = rawCompanyId || `${code}-CORP-01`;
      const newCompId = 'comp_' + code.toLowerCase() + '_' + Math.floor(Math.random() * 1000);
      const name = rawCompanyName || `${code} Enterprise`;
      const domain = `${code.toLowerCase()}.com`;

      db.prepare(`
        INSERT INTO companies (id, name, code, corporate_id, domain, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newCompId, name, code, corpId, domain, nowIso);

      company = {
        id: newCompId,
        name,
        code,
        corporate_id: corpId,
        domain,
        created_at: nowIso,
      };
    }

    // 2. Locate member under this company or provision
    let members = db.prepare('SELECT * FROM team_members WHERE company_id = ?').all(company.id) as unknown as AuthUser[];
    let user = members.find((m) => 
      (targetEmpId && m.employee_id?.toUpperCase() === targetEmpId.toUpperCase()) ||
      (m.employee_id && m.employee_id.toUpperCase() === targetUserName.toUpperCase()) ||
      m.user_name.toLowerCase() === targetUserName.toLowerCase() || 
      m.user_id.toLowerCase() === targetUserName.toLowerCase()
    );

    if (!user) {
      const newUserId = 'user_' + targetUserName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 1000);
      const hood = neighbourhood || 'Indiranagar';
      const lat = hood.toLowerCase().includes('hsr') ? 12.9121 : 12.9784;
      const lon = hood.toLowerCase().includes('hsr') ? 77.6446 : 77.6408;
      const newEmployeeId = targetEmpId || `${company.code}-EMP-${Math.floor(10 + Math.random() * 90)}`;

      db.prepare(`
        INSERT INTO team_members (id, company_id, team_id, user_id, user_name, role, neighbourhood, origin_lat, origin_lon, nex_user_id, nex_group_id, employee_id)
        VALUES (?, ?, 'team_office_pact', ?, ?, 'creator', ?, ?, ?, ?, ?, ?)
      `).run(`m_${newUserId}`, company.id, newUserId, targetUserName, hood, lat, lon, `nex_${newUserId}`, 'group_office_pact', newEmployeeId);

      user = {
        id: `m_${newUserId}`,
        user_id: newUserId,
        user_name: targetUserName,
        role: 'creator',
        neighbourhood: hood,
        origin_lat: lat,
        origin_lon: lon,
        company_id: company.id,
        employee_id: newEmployeeId,
      };

      members = db.prepare('SELECT * FROM team_members WHERE company_id = ?').all(company.id) as unknown as AuthUser[];
    } else if (targetEmpId && (!user.employee_id || user.employee_id.toUpperCase() !== targetEmpId.toUpperCase())) {
      db.prepare('UPDATE team_members SET employee_id = ? WHERE id = ?').run(targetEmpId, user.id);
      user.employee_id = targetEmpId;
    }

    res.json({
      success: true,
      company,
      user,
      allCompanyMembers: members,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout - Clear session
authRouter.post('/logout', (_req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});
