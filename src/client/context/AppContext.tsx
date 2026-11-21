import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { HealthResponse, PactDetails, TeamMember } from '../types';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'alert' | 'info' | 'action' | 'delivery' | 'decision';
  link?: string;
  read: boolean;
}

export interface AppToast {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'success';
  link?: string;
}

export interface CompanyInfo {
  id: string;
  name: string;
  code: string;
  domain?: string;
}

export interface AppContextType {
  health: HealthResponse | null;
  currentCompany: CompanyInfo | null;
  activeUser: TeamMember | null;
  teamMembers: TeamMember[];
  pacts: PactDetails[];
  selectedPactId: string | null;
  setSelectedPactId: (id: string) => void;
  loading: boolean;
  actionNotice: string | null;
  setActionNotice: (msg: string | null) => void;
  handleSwitchUser: (userId: string) => Promise<void>;
  loginCompany: (companyName: string, companyId?: string, userName?: string, employeeId?: string) => Promise<boolean>;
  logout: () => void;
  loadData: (userId?: string, companyId?: string) => Promise<void>;
  latestReceipt: any | null;
  // Team Chat Drawer
  isChatDrawerOpen: boolean;
  setIsChatDrawerOpen: (open: boolean) => void;
  toggleChatDrawer: () => void;
  unreadChatCount: number;
  setUnreadChatCount: React.Dispatch<React.SetStateAction<number>>;
  // Notifications Popover
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  // Browser Web Notifications
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  // Toast
  toast: AppToast | null;
  dismissToast: () => void;
  // Simulation & Demo
  hasSimulatedData: boolean;
  resetDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<CompanyInfo | null>(() => {
    try {
      const saved = localStorage.getItem('officepact_company');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { id: 'comp_paytm', name: 'Paytm (One97 Communications)', code: 'PAYTM', domain: 'paytm.com' };
  });

  const [activeUser, setActiveUser] = useState<TeamMember | null>(() => {
    try {
      const saved = localStorage.getItem('officepact_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pacts, setPacts] = useState<PactDetails[]>([]);
  const [selectedPactId, setSelectedPactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestReceipt, setLatestReceipt] = useState<any | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [hasSimulatedData, setHasSimulatedData] = useState(false);

  // Team chat drawer state
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(2);

  // Notifications state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif_init_1',
      title: 'Pact Ready for Review',
      message: 'Strategy meetup v1 requires bilateral approval to arm.',
      timestamp: '10m ago',
      type: 'action',
      link: '/pacts/pact_paytm_google_anantha',
      read: false,
    },
    {
      id: 'notif_init_2',
      title: 'Live Watch Scheduled',
      message: 'Background worker standing by. Directions check every 5m once armed.',
      timestamp: '15m ago',
      type: 'info',
      link: '/history',
      read: false,
    },
  ]);

  // Browser Web Notification Permission
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  // Floating Toast State
  const [toast, setToast] = useState<AppToast | null>(null);
  const seenAlertIds = useRef<Set<string>>(new Set());

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === 'granted') {
          try {
            new Notification('Tripwire: Office Pact', {
              body: '✓ Desktop notifications enabled. You will receive alerts when commute thresholds breach.',
              icon: '/favicon.ico',
            });
          } catch {
            // ignore
          }
        }
        return perm;
      } catch (err) {
        console.error('Error requesting notification permission:', err);
      }
    }
    return 'default';
  }, []);

  const toggleChatDrawer = useCallback(() => {
    setIsChatDrawerOpen((prev) => {
      if (!prev) {
        setUnreadChatCount(0); // Clear unread on open
      }
      return !prev;
    });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  // Load all session, health, pacts, and simulation data
  const loadData = useCallback(async (currentUserId?: string, targetCompId?: string) => {
    try {
      const compId = targetCompId || currentCompany?.id || 'comp_paytm';
      
      // 1. Session & Corporate Team Members
      try {
        const authRes = await fetch('/api/auth/session', {
          headers: {
            'x-company-id': compId,
            'x-user-id': currentUserId || activeUser?.user_id || 'user_ananya',
          },
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.company) setCurrentCompany(authData.company);

          let savedUser: TeamMember | null = null;
          try {
            const raw = localStorage.getItem('officepact_user');
            if (raw) savedUser = JSON.parse(raw);
          } catch {}

          const members: TeamMember[] = (authData.allCompanyMembers || []).map((m: any) => ({
            ...m,
            employee_id:
              m.employee_id ||
              m.employeeId ||
              (m.user_id === savedUser?.user_id ? savedUser?.employee_id : undefined) ||
              (m.user_id === activeUser?.user_id ? activeUser?.employee_id : undefined),
          }));
          setTeamMembers(members);

          let chosen = currentUserId
            ? members.find((m: any) => m.user_id === currentUserId) || authData.user
            : activeUser || authData.user;
          if (chosen) {
            chosen = {
              ...chosen,
              employee_id:
                chosen.employee_id ||
                chosen.employeeId ||
                (chosen.user_id === savedUser?.user_id ? savedUser?.employee_id : undefined) ||
                (chosen.user_id === activeUser?.user_id ? activeUser?.employee_id : undefined),
            };
          }
          setActiveUser(chosen);
          if (chosen) {
            localStorage.setItem('officepact_user', JSON.stringify(chosen));
          }
        }
      } catch {
        // Fallback to legacy session endpoint if needed
        const sessionRes = await fetch('/api/session');
        const sessionData = await sessionRes.json();
        setTeamMembers(sessionData.members || []);
      }

      const userIdToUse = currentUserId || activeUser?.user_id || 'user_ananya';

      // 2. Health & Budget
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }

      // 3. Pacts for Company
      const pactsRes = await fetch(`/api/pacts?company_id=${encodeURIComponent(compId)}`, {
        headers: {
          'x-company-id': compId,
          'x-user-id': userIdToUse,
        },
      });
      if (pactsRes.ok) {
        const pactsData = await pactsRes.json();
        const loadedPacts: PactDetails[] = pactsData.pacts || [];
        setPacts(loadedPacts);

        const currentTargetId = selectedPactId || loadedPacts[0]?.id;
        if (loadedPacts.length > 0 && !selectedPactId) {
          setSelectedPactId(loadedPacts[0].id);
        }

        // 4. Latest receipt for current target pact
        if (currentTargetId) {
          const rRes = await fetch(`/api/receipts/latest/pact/${currentTargetId}`);
          if (rRes.ok) {
            const rData = await rRes.json();
            const receipt = rData.receipt || null;
            setLatestReceipt(receipt);

            if (receipt && receipt.alertId && !seenAlertIds.current.has(receipt.alertId)) {
              seenAlertIds.current.add(receipt.alertId);

              const alertNotification: AppNotification = {
                id: `alert_${receipt.alertId}`,
                title: '🚨 Tripwire Alert: Threshold Breached',
                message: `${receipt.evidence?.fastestDurationMinutes || 72}m commute exceeded limit. Review evidence receipt.`,
                timestamp: 'Just now',
                type: 'alert',
                link: `/pacts/${currentTargetId}/alerts/${receipt.alertId}`,
                read: false,
              };

              setNotifications((prev) => [alertNotification, ...prev.filter((n) => n.id !== alertNotification.id)]);

              setToast({
                id: receipt.alertId,
                title: '🚨 Commute Threshold Breached!',
                message: `Commute exceeded agreed limit twice. Remote fallback ready.`,
                type: 'alert',
                link: `/pacts/${currentTargetId}/alerts/${receipt.alertId}`,
              });
            }
          } else {
            setLatestReceipt(null);
          }
        }
      }

      // 5. Simulation status check
      const simRes = await fetch('/api/simulation/status');
      if (simRes.ok) {
        const simData = await simRes.json();
        setHasSimulatedData(Boolean(simData.isSimulationActive || simData.hasSimulatedData));
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPactId, currentCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loginCompany = useCallback(
    async (companyName: string, companyId?: string, userName?: string, employeeId?: string) => {
      try {
        const resolvedEmployeeId =
          employeeId || (userName ? 'EMP-' + userName.slice(0, 3).toUpperCase() : 'EMP-01');

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: companyName,
            companyId: companyId || companyName,
            companyCode: companyId || companyName,
            userName: userName || 'Team Member',
            employeeId: resolvedEmployeeId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        setCurrentCompany(data.company);

        const userWithEmp: TeamMember = {
          ...data.user,
          employee_id: data.user?.employee_id || data.user?.employeeId || resolvedEmployeeId,
        };
        const membersWithEmp: TeamMember[] = (data.allCompanyMembers || []).map((m: any) => ({
          ...m,
          employee_id:
            m.employee_id ||
            m.employeeId ||
            (m.user_id === userWithEmp.user_id ? userWithEmp.employee_id : undefined),
        }));

        setActiveUser(userWithEmp);
        setTeamMembers(membersWithEmp);
        localStorage.setItem('officepact_company', JSON.stringify(data.company));
        localStorage.setItem('officepact_user', JSON.stringify(userWithEmp));
        await loadData(data.user?.user_id, data.company?.id);
        return true;
      } catch (err: any) {
        console.error('Login error:', err);
        return false;
      }
    },
    [loadData]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('officepact_company');
    localStorage.removeItem('officepact_user');
    window.location.href = '/login';
  }, []);

  const handleSwitchUser = async (userId: string) => {
    try {
      const member = teamMembers.find((m) => m.user_id === userId);
      if (member) {
        setActiveUser(member);
        localStorage.setItem('officepact_user', JSON.stringify(member));
      }
      await loadData(userId);
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const resetDemo = async () => {
    try {
      const res = await fetch('/api/simulation/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setActionNotice(data.message || 'Demo data reset successfully.');
      setHasSimulatedData(false);
      seenAlertIds.current.clear();
      setToast(null);
      await loadData();
    } catch (err: any) {
      setActionNotice(`Reset failed: ${err.message}`);
    }
  };

  return (
    <AppContext.Provider
      value={{
        health,
        currentCompany,
        activeUser,
        teamMembers,
        pacts,
        selectedPactId,
        setSelectedPactId,
        loading,
        actionNotice,
        setActionNotice,
        handleSwitchUser,
        loginCompany,
        logout,
        loadData,
        latestReceipt,
        isChatDrawerOpen,
        setIsChatDrawerOpen,
        toggleChatDrawer,
        unreadChatCount,
        setUnreadChatCount,
        isNotificationsOpen,
        setIsNotificationsOpen,
        notifications,
        unreadNotificationCount,
        markNotificationRead,
        clearNotifications,
        notificationPermission,
        requestNotificationPermission,
        toast,
        dismissToast,
        hasSimulatedData,
        resetDemo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
