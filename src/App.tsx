import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { I18nProvider, useI18n } from './lib/i18n';
import { RealtimeProvider } from './lib/realtime';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AuditTrailPage = lazy(() => import('./pages/AuditTrailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SystemPage = lazy(() => import('./pages/SystemPage'));

function RouteFallback() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
      {t('common.loading')}
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  // Selama sesi belum diverifikasi (ready=false), tampilkan loading agar
  // pengguna yang sesinya valid tidak sempat dilempar ke halaman login.
  if (!ready) {
    return <RouteFallback />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/secure-gate" replace />;
  }
  return <>{children}</>;
}

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/audit-trail': 'nav.auditTrail',
  '/system': 'nav.system',
  '/settings': 'nav.settings',
  '/secure-gate': 'login.signIn',
};

function AppRoutes() {
  const { isAuthenticated, ready } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  useEffect(() => {
    const key = PAGE_TITLE_KEYS[location.pathname] ?? 'app.tagline';
    document.title = `${t(key)} · FIM-IPL`;
  }, [location.pathname, t]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/secure-gate"
          element={
            !ready ? (
              <RouteFallback />
            ) : isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="audit-trail" element={<AuditTrailPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="about" element={<Navigate to="/system" replace />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/secure-gate" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <RealtimeProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </RealtimeProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
