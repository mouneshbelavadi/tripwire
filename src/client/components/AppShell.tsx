import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { TopBar } from './TopBar';
import { TeamChat } from './TeamChat';

export function AppShell() {
  const {
    pacts,
    selectedPactId,
    activeUser,
    currentCompany,
    actionNotice,
    setActionNotice,
    isChatDrawerOpen,
    setIsChatDrawerOpen,
    toggleChatDrawer,
    unreadChatCount,
    hasSimulatedData,
    resetDemo,
    toast,
    dismissToast,
  } = useApp();

  const navigate = useNavigate();
  const location = useLocation();

  const currentPact = pacts.find((p) => p.id === selectedPactId) || pacts[0] || null;
  const currentPactPath = `/pacts/${selectedPactId || pacts[0]?.id || 'pact_bellandur_01'}`;

  return (
    <div className="app-shell-root">
      {/* 1. Global amber simulation banner when simulated data is active */}
      {hasSimulatedData && (
        <div className="simulated-data-banner" role="alert">
          <div className="banner-content">
            <span className="banner-text">
              ⚠️ SIMULATED CHANGE ACTIVE · Real traffic checks paused for demonstration
            </span>
          </div>
          <button
            type="button"
            className="banner-reset-btn"
            onClick={resetDemo}
            title="Clear all synthetic records and restore clean baseline"
          >
            Reset Demo Data
          </button>
        </div>
      )}

      {/* Floating Toast Notification on new alert event */}
      {toast && (
        <div className={`floating-toast ${toast.type}`} role="status">
          <div className="toast-icon" aria-hidden="true">🚨</div>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-message">{toast.message}</div>
            {toast.link && (
              <Link to={toast.link} className="toast-action-btn" onClick={dismissToast}>
                Review Evidence Receipt →
              </Link>
            )}
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={dismissToast}
            aria-label="Dismiss alert toast"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. TopBar with Corporate Session Header */}
      <TopBar />

      {/* 3. Shell Body (Sidebar + Main Content + Slide-over Drawer) */}
      <div className="app-shell-body">
        {/* Left Navigation Sidebar */}
        <aside className="app-nav-sidebar" aria-label="Main Navigation">
          <div className="sidebar-nav-group">
            <div className="nav-group-title">WORKSPACE</div>

            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
              title="Dashboard"
            >
              <span className="nav-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="9" />
                  <rect x="14" y="3" width="7" height="5" />
                  <rect x="14" y="12" width="7" height="9" />
                  <rect x="3" y="16" width="7" height="5" />
                </svg>
              </span>
              <span className="nav-label">Dashboard</span>
            </NavLink>

            <NavLink
              to={currentPactPath}
              className={({ isActive }) =>
                `nav-item-link ${isActive || (location.pathname.startsWith('/pacts/') && location.pathname !== '/pacts/new') ? 'active' : ''}`
              }
              title="Active Pacts & Tripwires"
            >
              <span className="nav-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </span>
              <span className="nav-label">Pacts</span>
              <span className="nav-badge-count">{pacts.length}</span>
            </NavLink>

            <NavLink
              to="/history"
              className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
              title="Historical Plans & Archived Receipts"
            >
              <span className="nav-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 14 14" />
                </svg>
              </span>
              <span className="nav-label">History</span>
            </NavLink>
          </div>

          <div className="sidebar-nav-group">
            <div className="nav-group-title">TOOLS & VERIFICATION</div>

            <NavLink
              to="/demo"
              className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
              title="Demo & Simulation Test Harness"
            >
              <span className="nav-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v7.31L4.69 19.3A2 2 0 0 0 6.44 22h11.12a2 2 0 0 0 1.75-2.7L14 9.31V2" />
                  <path d="M8.5 2h7" />
                  <path d="M7 16h10" />
                </svg>
              </span>
              <span className="nav-label">Demo Lab</span>
              <span className="nav-pill-test">LAB</span>
            </NavLink>

            <NavLink
              to="/how-it-works"
              className={({ isActive }) => `nav-item-link ${isActive ? 'active' : ''}`}
              title="Mathematical Invariants & Rules"
            >
              <span className="nav-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <span className="nav-label">How It Works</span>
            </NavLink>
          </div>

          {/* New Pact Button */}
          <div className="sidebar-action-slot">
            <button
              type="button"
              className="btn-new-pact-sidebar"
              onClick={() => navigate('/pacts/new')}
              title="Create new bilateral office pact"
            >
              <span className="plus-icon" aria-hidden="true">+</span>
              <span className="new-pact-label">New Pact</span>
            </button>
          </div>

          {/* Active User Footprint */}
          <div className="sidebar-user-footer">
            <div className="user-avatar-circle" aria-hidden="true">
              {activeUser?.user_name.charAt(0) || 'U'}
            </div>
            <div className="user-details-mini">
              <div className="user-name-line">{activeUser?.user_name || 'Active User'}</div>
              <div className="user-neighbourhood-line">
                {activeUser?.neighbourhood} · {currentCompany?.code || 'OFFICE'}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="app-main-content">
          {actionNotice && (
            <div className="action-notification-toast" role="status">
              <span className="notice-text">{actionNotice}</span>
              <button
                type="button"
                className="notice-dismiss-btn"
                onClick={() => setActionNotice(null)}
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          )}

          <div className="main-content-scroll">
            <Outlet />
          </div>
        </main>

        {/* Slide-over Team Chat Drawer (336px) */}
        {isChatDrawerOpen && (
          <div
            className="chat-drawer-backdrop"
            onClick={() => setIsChatDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={`team-chat-drawer ${isChatDrawerOpen ? 'open' : ''}`}
          aria-label="Team Channel Chat"
          aria-hidden={!isChatDrawerOpen}
        >
          <div className="drawer-header">
            <div className="drawer-header-left">
              <span className="drawer-channel-icon" aria-hidden="true">#</span>
              <div>
                <div className="drawer-channel-title">
                  {currentCompany?.code ? currentCompany.code.toLowerCase() : 'team'}-office-pact
                </div>
                <div className="drawer-channel-subtitle">
                  <span className="status-live-dot" aria-hidden="true" />
                  {currentCompany?.name || 'Office Pact'} · Bengaluru
                </div>
              </div>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setIsChatDrawerOpen(false)}
              aria-label="Close Team Chat"
              title="Close chat drawer (Esc)"
            >
              ✕
            </button>
          </div>

          <div className="drawer-body">
            <TeamChat pact={currentPact} activeUser={activeUser} />
          </div>
        </aside>
      </div>

      {/* 4. Mobile Bottom Tab Bar (strictly below 840px, 4 clean items) */}
      <nav className="mobile-bottom-tabs" aria-label="Mobile Navigation Tabs">
        <NavLink to="/" end className={({ isActive }) => `mobile-bottom-item ${isActive ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to={currentPactPath}
          className={({ isActive }) =>
            `mobile-bottom-item ${isActive || (location.pathname.startsWith('/pacts/') && location.pathname !== '/pacts/new') ? 'active' : ''}`
          }
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>Pacts</span>
        </NavLink>

        <button
          type="button"
          className="mobile-bottom-item chat-trigger"
          onClick={toggleChatDrawer}
          aria-label="Open team chat"
        >
          <div className="mobile-chat-icon-container">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {unreadChatCount > 0 && <span className="m-chat-badge">{unreadChatCount}</span>}
          </div>
          <span>Chat</span>
        </button>

        <NavLink to="/pacts/new" className={({ isActive }) => `mobile-bottom-item ${isActive ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>+ New</span>
        </NavLink>
      </nav>
    </div>
  );
}
