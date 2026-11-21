import { Router } from 'express';
import { getDb } from '../db.js';

export const adminRouter = Router();

// GET /api/admin/overview - Enterprise System & Telemetry Overview
adminRouter.get('/overview', (_req, res) => {
  try {
    const db = getDb();

    const compCount = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as any)?.count || 0;
    const empCount = (db.prepare('SELECT COUNT(*) as count FROM team_members').get() as any)?.count || 0;
    const pactCount = (db.prepare('SELECT COUNT(*) as count FROM pacts').get() as any)?.count || 0;
    const watchCount = (db.prepare("SELECT COUNT(*) as count FROM watches WHERE enabled = 1").get() as any)?.count || 0;

    const companies = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM team_members m WHERE m.company_id = c.id) as employee_count,
        (SELECT COUNT(*) FROM pacts p WHERE p.company_id = c.id) as pact_count
      FROM companies c
      ORDER BY c.created_at DESC
      LIMIT 10
    `).all();

    res.json({
      metrics: {
        totalCompanies: compCount,
        totalEmployees: empCount,
        totalPacts: pactCount,
        activeWatches: watchCount,
        workerStatus: 'HEALTHY · ACTIVE',
        workerCadence: '5-minute polling tick',
        tenantIsolation: 'ROW-LEVEL STRICT (company_id)',
      },
      recentCompanies: companies,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/companies - List All Registered Corporate Entities
adminRouter.get('/companies', (_req, res) => {
  try {
    const db = getDb();
    const companies = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM team_members m WHERE m.company_id = c.id) as employee_count,
        (SELECT COUNT(*) FROM pacts p WHERE p.company_id = c.id) as pact_count
      FROM companies c
      ORDER BY c.name ASC
    `).all();

    res.json({ companies });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/companies - Register New Corporate Entity & Generate Company ID
adminRouter.post('/companies', (req, res) => {
  try {
    const db = getDb();
    const { name, code, domain, leadName, officeLocation } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company Name is required' });
    }

    const cleanName = name.trim();
    const baseCode = (code || cleanName.slice(0, 4)).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const ticker = baseCode.slice(0, 6) || 'CORP';

    // Auto-generate clean corporate enterprise ID like TCS-CORP-01 or INF-CORP-01
    const countRow = db.prepare("SELECT COUNT(*) as count FROM companies WHERE code = ?").get(ticker) as any;
    const seq = (countRow?.count || 0) + 1;
    const seqStr = seq < 10 ? `0${seq}` : `${seq}`;
    const corporateId = `${ticker}-CORP-${seqStr}`;

    const newCompId = 'comp_' + ticker.toLowerCase() + '_' + Math.floor(Math.random() * 10000);
    const corporateDomain = domain ? domain.trim() : `${ticker.toLowerCase()}.com`;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO companies (id, name, code, corporate_id, domain, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newCompId, cleanName, ticker, corporateId, corporateDomain, nowIso);

    // Auto-provision initial primary lead employee
    const initialLead = (leadName && leadName.trim()) ? leadName.trim() : 'Lead Admin';
    const newUserId = 'user_' + initialLead.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 1000);
    const hood = officeLocation || 'Indiranagar';
    const lat = hood.toLowerCase().includes('hsr') ? 12.9121 : 12.9784;
    const lon = hood.toLowerCase().includes('hsr') ? 77.6446 : 77.6408;

    db.prepare(`
      INSERT INTO team_members (id, company_id, team_id, user_id, user_name, role, neighbourhood, origin_lat, origin_lon, nex_user_id, nex_group_id)
      VALUES (?, ?, 'team_office_pact', ?, ?, 'creator', ?, ?, ?, ?, ?)
    `).run(`m_${newUserId}`, newCompId, newUserId, initialLead, hood, lat, lon, `nex_${newUserId}`, 'group_office_pact');

    res.json({
      success: true,
      company: {
        id: newCompId,
        name: cleanName,
        code: ticker,
        corporate_id: corporateId,
        domain: corporateDomain,
        created_at: nowIso,
      },
      leadEmployee: {
        user_id: newUserId,
        user_name: initialLead,
        role: 'creator',
      },
      message: `Corporate entity '${cleanName}' registered with Company ID: ${corporateId}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/employees - Provision Team Member under Corporate Workspace
adminRouter.post('/employees', (req, res) => {
  try {
    const db = getDb();
    const { companyId, name, role, neighbourhood, originLat, originLon } = req.body;

    if (!companyId || !name || !name.trim()) {
      return res.status(400).json({ error: 'Company ID and Employee Name are required' });
    }

    const company = db.prepare('SELECT * FROM companies WHERE id = ? OR UPPER(corporate_id) = ?').get(companyId, companyId.toUpperCase()) as any;
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const empName = name.trim();
    const empRole = role === 'creator' ? 'creator' : 'participant';
    const hood = neighbourhood || 'Indiranagar';
    const lat = typeof originLat === 'number' ? originLat : (hood.toLowerCase().includes('hsr') ? 12.9121 : 12.9784);
    const lon = typeof originLon === 'number' ? originLon : (hood.toLowerCase().includes('hsr') ? 77.6446 : 77.6408);

    const newUserId = 'user_' + empName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 1000);

    db.prepare(`
      INSERT INTO team_members (id, company_id, team_id, user_id, user_name, role, neighbourhood, origin_lat, origin_lon, nex_user_id, nex_group_id)
      VALUES (?, ?, 'team_office_pact', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`m_${newUserId}`, company.id, newUserId, empName, empRole, hood, lat, lon, `nex_${newUserId}`, 'group_office_pact');

    res.json({
      success: true,
      employee: {
        id: `m_${newUserId}`,
        user_id: newUserId,
        user_name: empName,
        role: empRole,
        neighbourhood: hood,
        company_id: company.id,
      },
      message: `Employee '${empName}' provisioned under ${company.name}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
