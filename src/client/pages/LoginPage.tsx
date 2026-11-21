import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { CompanyLogo } from '../components/CompanyLogos';

interface EnterpriseCompany {
  code: string;
  corporateId: string;
  name: string;
  subtitle: string;
}

const ENTERPRISE_COMPANIES: EnterpriseCompany[] = [
  { code: 'PAYTM', corporateId: 'PAYTM-CORP-01', name: 'Paytm (One97 Communications)', subtitle: 'Digital Payments' },
  { code: 'GOOG', corporateId: 'GOOG-BLR-01', name: 'Google Bengaluru', subtitle: 'Technology & Cloud' },
  { code: 'MSFT', corporateId: 'MSFT-IN-01', name: 'Microsoft India', subtitle: 'Enterprise Software' },
  { code: 'AMZN', corporateId: 'AMZN-BLR-01', name: 'Amazon India', subtitle: 'E-Commerce & AWS' },
  { code: 'INFY', corporateId: 'INFY-EC-01', name: 'Infosys Limited', subtitle: 'Consulting & IT' },
  { code: 'FLPK', corporateId: 'FLPK-BLR-01', name: 'Flipkart Internet', subtitle: 'Retail Platform' },
  { code: 'SWIG', corporateId: 'SWIG-BLR-01', name: 'Swiggy Technologies', subtitle: 'Logistics & Tech' },
  { code: 'UBER', corporateId: 'UBER-BLR-01', name: 'Uber India Tech', subtitle: 'Mobility & Rides' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { loginCompany } = useApp();

  const [companyName, setCompanyName] = useState('Paytm (One97 Communications)');
  const [companyId, setCompanyId] = useState('PAYTM-CORP-01');
  const [userName, setUserName] = useState('');
  const [employeeId, setEmployeeId] = useState('PAYTM-EMP-02');
  const [selectedCode, setSelectedCode] = useState('PAYTM');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectCompany = (comp: EnterpriseCompany) => {
    setSelectedCode(comp.code);
    setCompanyName(comp.name);
    setCompanyId(comp.corporateId);
    setEmployeeId(`${comp.code}-EMP-01`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !companyId.trim() || !userName.trim() || !employeeId.trim()) {
      setError('Please provide Company Name, Company ID, Employee Full Name, and Employee ID.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ok = await (loginCompany as (compName: string, compId?: string, uName?: string, empId?: string) => Promise<boolean>)(
        companyName.trim(),
        companyId.trim(),
        userName.trim(),
        employeeId.trim()
      );
      if (ok) {
        navigate('/');
      } else {
        setError('Login failed. Please verify your Company ID, Employee Name, and Employee ID.');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to authenticate with workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      background: 'var(--paper, #F7F6F2)',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
    }}>
      <div className="login-card" style={{
        width: '100%',
        maxWidth: '560px',
        background: 'var(--paper-raised, #FCFBF8)',
        border: '1px solid var(--rule, #D5D8D0)',
        borderRadius: '12px',
        padding: '36px 32px',
        boxShadow: 'var(--shadow-card, 0 4px 20px rgba(0,0,0,0.08))',
      }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--pact-wash, #EEF4F0)',
            color: 'var(--pact-green, #1B4D3E)',
            marginBottom: '12px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="12 2 15 8 12 14 9 8 12 2" fill="currentColor" fillOpacity="0.25" />
              <line x1="12" y1="12" x2="12" y2="22" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink, #202824)', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            Tripwire: Office Pact
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary, #5F6661)', margin: 0 }}>
            Enterprise commute agreements & automated bilateral fallbacks
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--error-wash, #FDF2F2)',
            border: '1px solid var(--error-border, #F8B4B4)',
            color: 'var(--error-ink, #9B1C1C)',
            padding: '10px 14px',
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

        {/* Company Quick-Select Grid with Official Vector Logos */}
        <div style={{ marginBottom: '22px' }}>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--ink-secondary, #5F6661)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Select Corporate Workspace (Or Enter Details Below)
          </label>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}>
            {ENTERPRISE_COMPANIES.map((comp) => {
              const isSelected = selectedCode === comp.code;
              return (
                <button
                  key={comp.code}
                  type="button"
                  onClick={() => handleSelectCompany(comp)}
                  title={`${comp.name} (${comp.corporateId})`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid var(--pact-green, #1B4D3E)' : '1px solid var(--rule, #D5D8D0)',
                    background: isSelected ? 'var(--pact-wash, #EEF4F0)' : 'var(--paper, #FFFFFF)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    minHeight: '62px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '4px',
                  }}>
                    <CompanyLogo code={comp.code} size={18} />
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'var(--pact-green, #1B4D3E)' : 'var(--ink, #202824)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    padding: '0 4px',
                  }}>
                    {comp.code}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Authentication Form: Company Name, Company ID, Employee Name, Employee ID */}
        <form onSubmit={handleSubmit}>
          
          {/* 1. Company Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--ink-secondary, #5F6661)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              1. Company Legal Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Paytm (One97 Communications)"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid var(--rule-strong, #BABDB6)',
                background: 'var(--paper, #FFFFFF)',
                color: 'var(--ink, #202824)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 2. Company ID */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--ink-secondary, #5F6661)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              2. Company ID (Corporate Workspace Key)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="e.g. PAYTM-CORP-01, GOOG-BLR-01"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  borderRadius: '6px',
                  border: '1px solid var(--rule-strong, #BABDB6)',
                  background: 'var(--paper, #FFFFFF)',
                  color: 'var(--ink, #202824)',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '11px',
                color: 'var(--ink-secondary, #5F6661)',
              }}>
                Key
              </span>
            </div>
          </div>

          {/* 3. Employee Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--ink-secondary, #5F6661)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              3. Employee Full Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Kabir Verma, Ananya Sharma, or Maya Rao"
              required
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid var(--rule-strong, #BABDB6)',
                background: 'var(--paper, #FFFFFF)',
                color: 'var(--ink, #202824)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 4. Employee ID */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--ink-secondary, #5F6661)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              4. Employee ID (Corporate Badge / Staff ID)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. PAYTM-EMP-01, EMP-104, GOOG-BLR-102"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  borderRadius: '6px',
                  border: '1px solid var(--rule-strong, #BABDB6)',
                  background: 'var(--paper, #FFFFFF)',
                  color: 'var(--ink, #202824)',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '11px',
                color: 'var(--ink-secondary, #5F6661)',
              }}>
                Badge
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '6px',
              background: 'var(--pact-green, #1B4D3E)',
              color: '#FFFFFF',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-button, 0 1px 3px rgba(0,0,0,0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? 'Authenticating Workspace...' : 'Enter Corporate Workspace →'}
          </button>
        </form>

        {/* Link to Admin Console */}
        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--ink-secondary, #5F6661)',
        }}>
          Registering a new company or need an ID?{' '}
          <Link
            to="/admin"
            style={{
              color: 'var(--pact-green, #1B4D3E)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Open Admin Console (/admin) →
          </Link>
        </div>

        {/* Multi-Tenant Security & Tenant Isolation Guarantee */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--rule, #D5D8D0)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          fontSize: '12px',
          color: 'var(--ink-secondary, #5F6661)',
          lineHeight: '1.45',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px', color: 'var(--pact-green, #1B4D3E)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <strong style={{ color: 'var(--ink, #202824)' }}>Multi-Tenant Ecosystem Isolation:</strong> Colleagues belonging to the same company collaborate in the same ecosystem and shared team channel. Different companies operate in completely isolated environments.
          </div>
        </div>

      </div>
    </div>
  );
}
