import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CompanyLogo } from '../components/CompanyLogos';

interface CompanyRecord {
  id: string;
  name: string;
  code: string;
  corporate_id?: string;
  domain?: string;
  created_at: string;
  employee_count: number;
  pact_count: number;
}

interface EmployeeRecord {
  id: string;
  company_id: string;
  team_id?: string;
  user_id: string;
  user_name: string;
  employee_id?: string;
  role: string;
  neighbourhood: string;
  company_name?: string;
  company_code?: string;
  corporate_id?: string;
}

interface AdminMetrics {
  totalCompanies: number;
  totalEmployees: number;
  totalPacts: number;
  activeWatches: number;
  workerStatus: string;
  workerCadence: string;
  tenantIsolation: string;
}

export function AdminPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Company Registration Form State
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [domain, setDomain] = useState('');
  const [leadName, setLeadName] = useState('');
  const [officeLocation, setOfficeLocation] = useState('Indiranagar');
  const [registering, setRegistering] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState<{
    companyName: string;
    corporateId: string;
    leadName: string;
  } | null>(null);

  // Provision Member Form State
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberEmployeeId, setMemberEmployeeId] = useState('');
  const [memberRole, setMemberRole] = useState<'creator' | 'participant'>('participant');
  const [memberNeighbourhood, setMemberNeighbourhood] = useState('Indiranagar');
  const [provisioning, setProvisioning] = useState(false);
  const [provisionSuccessMsg, setProvisionSuccessMsg] = useState<string | null>(null);

  // Employee Directory State
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('all');
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Copy helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchEmployeesForCompany = async (companyId: string) => {
    setLoadingEmployees(true);
    try {
      if (companyId === 'all') {
        const res = await fetch('/api/admin/employees');
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.employees || []);
        }
      } else {
        const res = await fetch(`/api/admin/companies/${encodeURIComponent(companyId)}/employees`);
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.employees || []);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [ovRes, compRes, empRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/companies'),
        fetch('/api/admin/employees'),
      ]);
      if (ovRes.ok && compRes.ok) {
        const ovData = await ovRes.json();
        const compData = await compRes.json();
        setMetrics(ovData.metrics);
        setCompanies(compData.companies || []);
        if (compData.companies && compData.companies.length > 0 && !targetCompanyId) {
          setTargetCompanyId(compData.companies[0].id);
        }
      } else {
        setError('Failed to fetch administrative data');
      }
      if (empRes && empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to admin service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          code: companyCode,
          domain,
          leadName,
          officeLocation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register company');

      setRegisteredSuccess({
        companyName: data.company.name,
        corporateId: data.company.corporate_id,
        leadName: data.leadEmployee.user_name,
      });

      // Clear form
      setCompanyName('');
      setCompanyCode('');
      setDomain('');
      setLeadName('');

      // Refresh list
      await fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleProvisionMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCompanyId || !memberName.trim()) return;
    setProvisioning(true);
    setProvisionSuccessMsg(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: targetCompanyId,
          name: memberName,
          employeeId: memberEmployeeId,
          role: memberRole,
          neighbourhood: memberNeighbourhood,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to provision member');

      setProvisionSuccessMsg(data.message || `Member '${memberName}' added successfully!`);
      setMemberName('');
      setMemberEmployeeId('');
      await fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Provisioning failed');
    } finally {
      setProvisioning(false);
    }
  };

  const handleCopy = (idText: string) => {
    navigator.clipboard.writeText(idText);
    setCopiedId(idText);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="admin-page-container" style={{
      minHeight: '100vh',
      background: 'var(--paper, #F7F6F2)',
      color: 'var(--ink, #202824)',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      padding: '32px 24px',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
        
        {/* Top Header Navigation */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--rule, #D5D8D0)',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'var(--pact-green, #1B4D3E)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.02em', color: 'var(--ink, #202824)' }}>
                Enterprise Administration Console
              </h1>
              <p style={{ fontSize: '13px', margin: 0, color: 'var(--ink-secondary, #5F6661)' }}>
                Multi-tenant workspace registry, corporate entity provisioning, and tenant isolation management {loading ? '(Syncing...)' : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--ink, #202824)',
                background: 'var(--paper-raised, #FCFBF8)',
                border: '1px solid var(--rule, #D5D8D0)',
                borderRadius: '6px',
                textDecoration: 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Go to Login Page
            </Link>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#FFFFFF',
                background: 'var(--pact-green, #1B4D3E)',
                border: 'none',
                borderRadius: '6px',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-button, 0 1px 3px rgba(0,0,0,0.1))',
              }}
            >
              Enter Workspace →
            </Link>
          </div>
        </header>

        {error && (
          <div style={{
            background: 'var(--error-wash, #FDF2F2)',
            border: '1px solid var(--error-border, #F8B4B4)',
            color: 'var(--error-ink, #9B1C1C)',
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* System Telemetry & Metrics Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}>
          <div style={{
            background: 'var(--paper-raised, #FCFBF8)',
            border: '1px solid var(--rule, #D5D8D0)',
            borderRadius: '8px',
            padding: '16px 20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary, #5F6661)', marginBottom: '6px' }}>
              Corporate Tenants
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink, #202824)' }}>
              {metrics?.totalCompanies ?? '...'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--pact-green, #1B4D3E)', marginTop: '4px', fontWeight: 500 }}>
              Isolated SQLite Tenancies
            </div>
          </div>

          <div style={{
            background: 'var(--paper-raised, #FCFBF8)',
            border: '1px solid var(--rule, #D5D8D0)',
            borderRadius: '8px',
            padding: '16px 20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary, #5F6661)', marginBottom: '6px' }}>
              Provisioned Members
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink, #202824)' }}>
              {metrics?.totalEmployees ?? '...'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary, #5F6661)', marginTop: '4px' }}>
              Across all registered companies
            </div>
          </div>

          <div style={{
            background: 'var(--paper-raised, #FCFBF8)',
            border: '1px solid var(--rule, #D5D8D0)',
            borderRadius: '8px',
            padding: '16px 20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary, #5F6661)', marginBottom: '6px' }}>
              Active Bilateral Pacts
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink, #202824)' }}>
              {metrics?.totalPacts ?? '...'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary, #5F6661)', marginTop: '4px' }}>
              Monitored office commute corridors
            </div>
          </div>

          <div style={{
            background: 'var(--paper-raised, #FCFBF8)',
            border: '1px solid var(--rule, #D5D8D0)',
            borderRadius: '8px',
            padding: '16px 20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary, #5F6661)', marginBottom: '6px' }}>
              Scheduler & Worker Health
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--pact-green, #1B4D3E)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--pact-green, #1B4D3E)', display: 'inline-block' }} />
              ACTIVE
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary, #5F6661)', marginTop: '4px' }}>
              Autonomous 5-minute tick cycle
            </div>
          </div>
        </div>

        {/* Section 1 & 2 Grid: Company Registration & Employee Provisioning */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '24px',
          marginBottom: '32px',
        }}>
          
          {/* Register Corporate Entity */}
          <div style={{
            background: 'var(--paper-raised, #FCFBF8)',
            border: '1px solid var(--rule, #D5D8D0)',
            borderRadius: '8px',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'var(--pact-wash, #EEF4F0)',
                color: 'var(--pact-green, #1B4D3E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--ink, #202824)' }}>
                  Register New Corporate Entity
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--ink-secondary, #5F6661)' }}>
                  Creates an isolated corporate tenancy and generates an official Company ID
                </span>
              </div>
            </div>

            {registeredSuccess && (
              <div style={{
                background: 'var(--pact-wash, #EEF4F0)',
                border: '1px solid var(--pact-border, #C3D9CC)',
                borderRadius: '6px',
                padding: '14px 16px',
                marginBottom: '18px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--pact-green, #1B4D3E)', marginBottom: '6px' }}>
                  Entity Registered Successfully!
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ink, #202824)', marginBottom: '8px' }}>
                  Company: <strong>{registeredSuccess.companyName}</strong>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--paper, #FFFFFF)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--pact-border, #C3D9CC)',
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--ink-secondary, #5F6661)', display: 'block' }}>ASSIGNED COMPANY ID:</span>
                    <strong style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--pact-green, #1B4D3E)' }}>
                      {registeredSuccess.corporateId}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(registeredSuccess.corporateId)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: '1px solid var(--rule, #D5D8D0)',
                      background: 'var(--paper, #F7F6F2)',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedId === registeredSuccess.corporateId ? 'Copied!' : 'Copy ID'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-secondary, #5F6661)', marginTop: '8px' }}>
                  Team members can now log in using Company Name, this Company ID, and their Name.
                </div>
              </div>
            )}

            <form onSubmit={handleRegisterCompany}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                  Company Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Consultancy Services, Zomato"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid var(--rule-strong, #BABDB6)',
                    background: 'var(--paper, #FFFFFF)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                    Company Code / Ticker (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TCS, ZOM"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--rule-strong, #BABDB6)',
                      background: 'var(--paper, #FFFFFF)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                    Corporate Domain (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. tcs.com, zomato.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--rule-strong, #BABDB6)',
                      background: 'var(--paper, #FFFFFF)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                    Initial Lead / Admin Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rohan Sharma"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--rule-strong, #BABDB6)',
                      background: 'var(--paper, #FFFFFF)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                    Office Hub / Location
                  </label>
                  <select
                    value={officeLocation}
                    onChange={(e) => setOfficeLocation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--rule-strong, #BABDB6)',
                      background: 'var(--paper, #FFFFFF)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Indiranagar">Indiranagar (East)</option>
                    <option value="HSR Layout">HSR Layout (South-East)</option>
                    <option value="Whitefield">Whitefield (East Corridor)</option>
                    <option value="Bellandur">Bellandur (Outer Ring Rd)</option>
                    <option value="Koramangala">Koramangala (Central)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={registering}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  background: 'var(--pact-green, #1B4D3E)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: registering ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {registering ? 'Registering Corporate Entity...' : 'Register Entity & Generate Company ID →'}
              </button>
            </form>
          </div>

          {/* Provision Team Member */}
          <div style={{
            background: 'var(--paper-raised, #FCFBF8)',
            border: '1px solid var(--rule, #D5D8D0)',
            borderRadius: '8px',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'var(--pact-wash, #EEF4F0)',
                color: 'var(--pact-green, #1B4D3E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--ink, #202824)' }}>
                  Provision Employee / Colleague
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--ink-secondary, #5F6661)' }}>
                  Add a team member to an existing company workspace
                </span>
              </div>
            </div>

            {provisionSuccessMsg && (
              <div style={{
                background: 'var(--pact-wash, #EEF4F0)',
                border: '1px solid var(--pact-border, #C3D9CC)',
                color: 'var(--pact-green, #1B4D3E)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '16px',
              }}>
                {provisionSuccessMsg}
              </div>
            )}

            <form onSubmit={handleProvisionMember}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                  Target Company Workspace *
                </label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid var(--rule-strong, #BABDB6)',
                    background: 'var(--paper, #FFFFFF)',
                    boxSizing: 'border-box',
                  }}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.corporate_id || c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                    Employee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kabir Verma, Maya Rao"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--rule-strong, #BABDB6)',
                      background: 'var(--paper, #FFFFFF)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                    Employee ID
                  </label>
                  <input
                    type="text"
                    placeholder={
                      targetCompanyId
                        ? `e.g. ${(companies.find((c) => c.id === targetCompanyId)?.code || 'EMP').toUpperCase()}-EMP-03`
                        : 'e.g. PAYTM-EMP-03'
                    }
                    value={memberEmployeeId}
                    onChange={(e) => setMemberEmployeeId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--rule-strong, #BABDB6)',
                      background: 'var(--paper, #FFFFFF)',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                    Role
                  </label>
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--rule-strong, #BABDB6)',
                      background: 'var(--paper, #FFFFFF)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="participant">Participant (Commuter)</option>
                    <option value="creator">Workspace Lead (Creator)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #5F6661)', marginBottom: '5px' }}>
                    Departure Neighborhood
                  </label>
                  <select
                    value={memberNeighbourhood}
                    onChange={(e) => setMemberNeighbourhood(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid var(--rule-strong, #BABDB6)',
                      background: 'var(--paper, #FFFFFF)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Indiranagar">Indiranagar (12.9784, 77.6408)</option>
                    <option value="HSR Layout">HSR Layout (12.9121, 77.6446)</option>
                    <option value="Whitefield">Whitefield (12.9698, 77.7499)</option>
                    <option value="Koramangala">Koramangala (12.9352, 77.6245)</option>
                    <option value="Bellandur">Bellandur (12.9304, 77.6784)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={provisioning}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  background: '#2563EB',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: provisioning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {provisioning ? 'Provisioning Member...' : 'Provision Team Member →'}
              </button>
            </form>
          </div>
        </div>

        {/* Registered Corporate Entities Directory */}
        <div style={{
          background: 'var(--paper-raised, #FCFBF8)',
          border: '1px solid var(--rule, #D5D8D0)',
          borderRadius: '8px',
          padding: '24px',
          overflowX: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--ink, #202824)' }}>
                Registered Corporate Entities Directory
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-secondary, #5F6661)' }}>
                All corporate tenants provisioned with official Company IDs and isolated channels
              </span>
            </div>
            <button
              type="button"
              onClick={fetchAdminData}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ink, #202824)',
                background: 'var(--paper, #F7F6F2)',
                border: '1px solid var(--rule, #D5D8D0)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh Directory
            </button>
          </div>

          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            textAlign: 'left',
          }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid var(--rule, #D5D8D0)',
                color: 'var(--ink-secondary, #5F6661)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <th style={{ padding: '10px 12px' }}>Company Entity</th>
                <th style={{ padding: '10px 12px' }}>Company ID</th>
                <th style={{ padding: '10px 12px' }}>Domain</th>
                <th style={{ padding: '10px 12px' }}>Members</th>
                <th style={{ padding: '10px 12px' }}>Active Pacts</th>
                <th style={{ padding: '10px 12px' }}>Tenant Isolation</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((comp) => {
                const compIdToDisplay = comp.corporate_id || `${comp.code}-CORP-01`;
                return (
                  <tr key={comp.id} style={{
                    borderBottom: '1px solid var(--rule-subtle, #EBE8E3)',
                  }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          background: '#FFFFFF',
                          border: '1px solid var(--rule-subtle, #EBE8E3)',
                          padding: '2px',
                        }}>
                          <CompanyLogo code={comp.code} size={16} />
                        </div>
                        <div>
                          <strong style={{ color: 'var(--ink, #202824)', display: 'block' }}>{comp.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--ink-secondary, #5F6661)' }}>Code: {comp.code}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <code style={{
                          background: 'var(--pact-wash, #EEF4F0)',
                          color: 'var(--pact-green, #1B4D3E)',
                          padding: '3px 7px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}>
                          {compIdToDisplay}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(compIdToDisplay)}
                          title="Copy Company ID"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--ink-secondary, #5F6661)',
                            padding: '2px',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--ink-secondary, #5F6661)' }}>
                      {comp.domain || `${comp.code.toLowerCase()}.com`}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        background: 'var(--paper, #F7F6F2)',
                        border: '1px solid var(--rule, #D5D8D0)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}>
                        {comp.employee_count} {comp.employee_count === 1 ? 'member' : 'members'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        background: comp.pact_count > 0 ? 'var(--pact-wash, #EEF4F0)' : 'var(--paper, #F7F6F2)',
                        color: comp.pact_count > 0 ? 'var(--pact-green, #1B4D3E)' : 'var(--ink-secondary, #5F6661)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}>
                        {comp.pact_count} {comp.pact_count === 1 ? 'pact' : 'pacts'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: 'var(--pact-green, #1B4D3E)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Row-Level Isolated
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Provisioned Corporate Employee Directory */}
        <div style={{
          marginTop: '28px',
          background: 'var(--paper-raised, #FCFBF8)',
          border: '1px solid var(--rule, #D5D8D0)',
          borderRadius: '8px',
          padding: '24px',
          overflowX: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--ink, #202824)' }}>
                Corporate Employee Directory
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--ink-secondary, #5F6661)' }}>
                Active provisioned colleagues across corporate tenants with assigned Employee IDs
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={selectedEmpFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedEmpFilter(val);
                  fetchEmployeesForCompany(val);
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid var(--rule, #D5D8D0)',
                  background: 'var(--paper, #FFFFFF)',
                  color: 'var(--ink, #202824)',
                }}
              >
                <option value="all">All Corporate Workspaces ({employees.length})</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => fetchEmployeesForCompany(selectedEmpFilter)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ink, #202824)',
                  background: 'var(--paper, #F7F6F2)',
                  border: '1px solid var(--rule, #D5D8D0)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                {loadingEmployees ? 'Refreshing...' : 'Refresh Directory'}
              </button>
            </div>
          </div>

          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            textAlign: 'left',
          }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid var(--rule, #D5D8D0)',
                color: 'var(--ink-secondary, #5F6661)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <th style={{ padding: '10px 12px' }}>Employee Name</th>
                <th style={{ padding: '10px 12px' }}>Employee ID</th>
                <th style={{ padding: '10px 12px' }}>Company Workspace</th>
                <th style={{ padding: '10px 12px' }}>Role</th>
                <th style={{ padding: '10px 12px' }}>Departure Hub</th>
                <th style={{ padding: '10px 12px' }}>System User ID</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-secondary, #5F6661)' }}>
                    {loadingEmployees ? 'Loading provisioned employees...' : 'No provisioned employees found.'}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const comp = companies.find((c) => c.id === emp.company_id);
                  const displayCompName = emp.company_name || comp?.name || emp.company_id;
                  const displayCompCode = emp.company_code || comp?.code || 'CORP';
                  const displayEmpId = emp.employee_id || `${displayCompCode}-EMP-01`;

                  return (
                    <tr key={emp.id || emp.user_id} style={{
                      borderBottom: '1px solid var(--rule-subtle, #EBE8E3)',
                    }}>
                      <td style={{ padding: '12px' }}>
                        <strong style={{ color: 'var(--ink, #202824)' }}>{emp.user_name}</strong>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code style={{
                            background: 'var(--pact-wash, #EEF4F0)',
                            color: 'var(--pact-green, #1B4D3E)',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}>
                            {displayEmpId}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(displayEmpId)}
                            title="Copy Employee ID"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: 'var(--ink-secondary, #5F6661)',
                              padding: '2px',
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <CompanyLogo code={displayCompCode} size={14} />
                          <span style={{ color: 'var(--ink, #202824)', fontWeight: 500 }}>{displayCompName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: emp.role === 'creator' ? 'var(--pact-wash, #EEF4F0)' : 'var(--paper, #F7F6F2)',
                          color: emp.role === 'creator' ? 'var(--pact-green, #1B4D3E)' : 'var(--ink-secondary, #5F6661)',
                          border: '1px solid var(--rule, #D5D8D0)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}>
                          {emp.role === 'creator' ? 'Workspace Lead' : 'Commuter'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--ink-secondary, #5F6661)' }}>
                        {emp.neighbourhood || 'Indiranagar'}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--ink-secondary, #5F6661)', fontFamily: 'monospace', fontSize: '11px' }}>
                        {emp.user_id}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Multi-Tenant Security & Tenant Isolation Footer Card */}
        <div style={{
          marginTop: '28px',
          background: 'var(--paper-raised, #FCFBF8)',
          border: '1px solid var(--rule, #D5D8D0)',
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--pact-wash, #EEF4F0)',
            color: 'var(--pact-green, #1B4D3E)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-secondary, #5F6661)', lineHeight: '1.5' }}>
            <strong style={{ color: 'var(--ink, #202824)' }}>Enterprise Multi-Tenancy Architecture:</strong> Every company entity is strictly isolated at the database layer using partitioned <code>company_id</code> foreign keys. Team chat messages, commute bilateral agreements, and live watch tasks execute inside separate security scopes.
          </div>
        </div>

      </div>
    </div>
  );
}
