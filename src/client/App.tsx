import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewPactWizardPage } from './pages/NewPactWizardPage';
import { PactDetailPage } from './pages/PactDetailPage';
import { BreachReceiptPage } from './pages/BreachReceiptPage';
import { HistoryPage } from './pages/HistoryPage';
import { DemoLabPage } from './pages/DemoLabPage';
import { HowItWorksPage } from './pages/HowItWorksPage';

function ProtectedRoutes() {
  const { currentCompany } = useApp();
  // If no company workspace is active, redirect to login
  if (!currentCompany) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* Public Corporate Multi-Tenant Login & Admin */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* Protected Workspace Ecosystem */}
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pacts/new" element={<NewPactWizardPage />} />
            <Route path="/pacts/:id" element={<PactDetailPage />} />
            <Route path="/pacts/:id/alerts/:alertId" element={<BreachReceiptPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/demo" element={<DemoLabPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            {/* Catch-all route redirects to Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
