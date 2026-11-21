import type { HealthResponse } from '../types';

interface TopBarProps {
  health: HealthResponse | null;
  activeUser: { user_id: string; user_name: string; neighbourhood: string; role: string } | null;
  allMembers: Array<{ user_id: string; user_name: string; neighbourhood: string; role: string }>;
  onSwitchUser: (userId: string) => void;
}

export function TopBar({ health, activeUser, allMembers, onSwitchUser }: TopBarProps) {
  const mode = health?.mode || 'SIMULATION';
  const spent = health?.budget.researchSpent ?? 0;
  const cap = health?.budget.researchCeiling ?? 40;

  return (
    <header className="top-bar">
      <div className="brand-section">
        <span className="brand-title">Tripwire: Office Pact</span>
        <span className="team-badge">BEYOND 9TO5 · Bengaluru</span>
      </div>

      <div className="status-section">
        <span className={`mode-badge ${mode.toLowerCase()}`}>
          {mode} MODE
        </span>
        <span className="budget-pill" title="SerpApi credit attempts used / ceiling">
          BUDGET: {spent}/{cap} CREDITS
        </span>
      </div>

      <div className="account-section">
        <label htmlFor="user-select" style={{ fontSize: '12px', color: 'var(--ink-secondary)', marginRight: '4px' }}>
          Session:
        </label>
        <select
          id="user-select"
          className="user-select"
          value={activeUser?.user_id || ''}
          onChange={(e) => onSwitchUser(e.target.value)}
        >
          {allMembers.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.user_name} ({m.neighbourhood})
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
