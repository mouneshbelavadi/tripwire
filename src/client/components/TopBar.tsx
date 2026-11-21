import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { CompanyLogo } from './CompanyLogos';
import type { HealthResponse, TeamMember } from '../types';

export interface TopBarProps {
  health?: HealthResponse | null;
  activeUser?: TeamMember | null;
  allMembers?: TeamMember[];
  onSwitchUser?: (userId: string) => Promise<void> | void;
}

export function TopBar(props: TopBarProps = {}) {
  const navigate = useNavigate();
  let context: ReturnType<typeof useApp> | null = null;
  try {
    context = useApp();
  } catch {
    context = null;
  }

  const health = props?.health ?? context?.health;
  const activeUser = props?.activeUser ?? context?.activeUser;
  const teamMembers = props?.allMembers ?? context?.teamMembers ?? [];
  const handleSwitchUser = props?.onSwitchUser ?? context?.handleSwitchUser;
  const currentCompany = context?.currentCompany;
  const logout = context?.logout;
  const toggleChatDrawer = context?.toggleChatDrawer;
  const unreadChatCount = context?.unreadChatCount ?? 0;
  const isNotificationsOpen = context?.isNotificationsOpen ?? false;
  const setIsNotificationsOpen = context?.setIsNotificationsOpen;
  const notifications = context?.notifications ?? [];
  const unreadNotificationCount = context?.unreadNotificationCount ?? 0;
  const markNotificationRead = context?.markNotificationRead;
  const clearNotifications = context?.clearNotifications;
  const notificationPermission = context?.notificationPermission ?? 'default';
  const requestNotificationPermission = context?.requestNotificationPermission;

  const mode = health?.mode || 'LIVE';

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate('/login');
  };

  return (
    <header className="top-bar" role="banner">
      {/* Brand & Bengaluru Context */}
      <div className="brand-section">
        <Link to="/" className="brand-link" title="Tripwire: Office Pact Home">
          <span className="brand-logo-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="12 2 15 8 12 14 9 8 12 2" fill="currentColor" fillOpacity="0.25" />
              <line x1="12" y1="12" x2="12" y2="22" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-title">Tripwire: Office Pact</span>
        </Link>

        {/* Corporate Workspace Badge */}
        {currentCompany ? (
          <span
            className="company-workspace-badge"
            title={`Active Workspace: ${currentCompany.name}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '16px',
              backgroundColor: 'var(--pact-wash, #eef4f0)',
              border: '1px solid var(--pact-border, #c3d9cc)',
              color: 'var(--pact-green, #1b4d3e)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <CompanyLogo code={currentCompany.code} size={15} />
            </span>
            <span>{currentCompany.name}</span>
          </span>
        ) : (
          <span className="bengaluru-context-chip" title="Hackathon Context: BEYOND 9TO5, 21 Nov 2026, Asia/Kolkata">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Bengaluru (IST)
          </span>
        )}
      </div>

      {/* Global Status Section (ZERO CREDIT MENTIONS) */}
      <div className="status-section">
        <span
          className={`mode-badge ${mode.toLowerCase()}`}
          title={mode === 'LIVE' ? 'Connected to live SerpApi Directions & Traffic' : 'Running in controlled demonstration mode'}
        >
          <span className="mode-dot" aria-hidden="true" />
          {mode} MODE
        </span>
      </div>

      {/* Quick Actions & Session Switcher */}
      <div className="account-section">
        {/* Notification Bell with Badge */}
        <div className="topbar-notif-container">
          <button
            type="button"
            className={`topbar-icon-btn ${unreadNotificationCount > 0 ? 'has-unread' : ''}`}
            onClick={() => setIsNotificationsOpen?.(!isNotificationsOpen)}
            aria-label={`Notifications (${unreadNotificationCount} unread)`}
            title="Tripwire Notifications & Alerts"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadNotificationCount > 0 && (
              <span className="notif-badge-count">{unreadNotificationCount}</span>
            )}
          </button>

          {/* Notifications Popover Dropdown */}
          {isNotificationsOpen && (
            <div className="notif-dropdown-popover" role="dialog" aria-label="Notifications list">
              <div className="notif-dropdown-header">
                <span className="notif-header-title">Notifications</span>
                {unreadNotificationCount > 0 && (
                  <button
                    type="button"
                    className="notif-clear-btn"
                    onClick={() => clearNotifications?.()}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Browser Notification Permission Prompt */}
              <div className="notif-permission-bar">
                {notificationPermission === 'granted' ? (
                  <span className="perm-status-granted">
                    <span className="perm-dot" /> Web Notifications Active
                  </span>
                ) : notificationPermission === 'denied' ? (
                  <span className="perm-status-denied" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Desktop Alerts Blocked in Settings
                  </span>
                ) : (
                  <button
                    type="button"
                    className="notif-permission-prompt-btn"
                    onClick={() => requestNotificationPermission?.()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    Enable Desktop Notifications
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.read ? 'read' : 'unread'} ${n.type}`}
                      onClick={() => markNotificationRead?.(n.id)}
                    >
                      <div className="notif-item-header">
                        <span className={`notif-type-tag ${n.type}`}>
                          {n.type === 'alert' ? 'ALERT' : n.type === 'action' ? 'ACTION' : 'INFO'}
                        </span>
                        <span className="notif-time">{n.timestamp}</span>
                      </div>
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-desc">{n.message}</div>
                      {n.link && (
                        <Link
                          to={n.link}
                          className="notif-link-btn"
                          onClick={() => setIsNotificationsOpen?.(false)}
                        >
                          View Details →
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Team Chat Button with Slide-over Drawer Trigger */}
        <button
          type="button"
          className="team-chat-toggle-btn"
          onClick={() => toggleChatDrawer?.()}
          title="Toggle Team Chat Slide-over Drawer"
          aria-label="Toggle Team Chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="chat-btn-label">Team Chat</span>
          {unreadChatCount > 0 && (
            <span className="chat-unread-pill">{unreadChatCount}</span>
          )}
        </button>

        <div className="topbar-divider" />

        {/* Corporate Colleague Switcher */}
        <div className="session-switcher" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-secondary, #5F6661)' }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <select
            id="user-select"
            className="user-select"
            value={activeUser?.user_id || ''}
            onChange={(e) => handleSwitchUser?.(e.target.value)}
            aria-label="Active session switcher"
            style={{
              maxWidth: '220px',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {teamMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.user_name} {m.employee_id ? `(${m.employee_id})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="topbar-divider" />

        {/* Enterprise Admin Console Link */}
        <Link
          to="/admin"
          className="topbar-admin-btn"
          title="Enterprise Administration Console (Provisioning & Tenants)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Admin</span>
        </Link>

        {/* Switch Company / Logout button */}
        <button
          type="button"
          onClick={handleLogout}
          className="btn-switch-company"
          title="Switch Company Workspace or Log Out"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Switch</span>
        </button>
      </div>
    </header>
  );
}
