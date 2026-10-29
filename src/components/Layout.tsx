import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Info,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useRealtime, useRealtimeEvent } from '../lib/realtime';
import { getStatus } from '../lib/api';
import { Badge } from './ui';

interface SystemStatus {
  is_monitoring: boolean;
  maintenance_mode: boolean;
}

const PAGE_LABEL_KEYS: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/audit-trail': 'nav.auditTrail',
  '/system': 'nav.system',
  '/settings': 'nav.settings',
};

export default function Layout() {
  const { logout, role, isAuditor } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const { connected } = useRealtime();

  // Status dari event realtime (langsung), dengan polling sebagai fallback.
  useRealtimeEvent((event) => {
    if (event.type !== 'status') return;
    const data = event.data as
      | { is_monitoring?: boolean; maintenance_mode?: boolean }
      | undefined;
    if (!data) return;
    setStatus({
      is_monitoring: !!data.is_monitoring,
      maintenance_mode: !!data.maintenance_mode,
    });
  });

  const navSections = [
    {
      label: t('nav.monitoring'),
      items: [
        {
          to: '/dashboard',
          icon: <LayoutDashboard className="h-4 w-4" />,
          label: t('nav.dashboard'),
        },
        {
          to: '/audit-trail',
          icon: <ScrollText className="h-4 w-4" />,
          label: t('nav.auditTrail'),
        },
      ],
    },
    {
      label: t('nav.systemSection'),
      items: [
        { to: '/system', icon: <Info className="h-4 w-4" />, label: t('nav.system') },
        { to: '/settings', icon: <Settings className="h-4 w-4" />, label: t('nav.settings') },
      ],
    },
  ];

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await getStatus();
        if (active) setStatus(res.data);
      } catch {
        /* status bersifat opsional; halaman tetap dapat dipakai */
      }
    };
    void load();

    // Saat SSE terhubung, status sudah dikirim lewat event; polling hanya
    // fallback agar tidak ada request periodik yang mubazir.
    if (connected) {
      return () => {
        active = false;
      };
    }

    const timer = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [connected]);

  const handleLogout = () => {
    logout();
    navigate('/secure-gate');
  };

  const pageLabel = PAGE_LABEL_KEYS[location.pathname]
    ? t(PAGE_LABEL_KEYS[location.pathname])
    : t('nav.dashboard');
  const monitoring = status?.is_monitoring ?? false;
  const maintenance = status?.maintenance_mode ?? false;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        {t('nav.skipToContent')}
      </a>

      {sidebarOpen && (
        <div
          className="animate-fade fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          role="presentation"
        />
      )}

      <aside
        id="main-navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
              <ShieldCheck className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-foreground">FIM-IPL</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {t('app.tagline')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground md:hidden"
            aria-label={t('nav.closeMenu')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-white/[0.05] text-foreground [&_svg]:text-accent before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-accent'
                          : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
                      }`
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-3.5">
          <div className="space-y-2 text-[10px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('nav.agent')}</span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    monitoring ? 'animate-pulse bg-success' : 'bg-muted-foreground/50'
                  }`}
                />
                <span className={monitoring ? 'text-success' : 'text-muted-foreground'}>
                  {monitoring ? t('nav.active') : t('nav.stopped')}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('nav.mode')}</span>
              <span
                className={`flex items-center gap-1 ${
                  maintenance ? 'text-warning' : 'text-muted-foreground'
                }`}
              >
                {maintenance && <Wrench className="h-3 w-3" />}
                {maintenance ? t('nav.maintenance') : t('nav.normal')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('nav.version')}</span>
              <span className="text-muted-foreground">v1.0.0</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <Badge tone={isAuditor ? 'warning' : 'accent'}>
              {role === 'auditor' ? t('role.auditor') : t('role.superAdmin')}
            </Badge>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      <div className="md:pl-[252px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground md:hidden"
              aria-label={t('nav.openMenu')}
              aria-expanded={sidebarOpen}
              aria-controls="main-navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-[11px] text-muted-foreground md:flex">
              <span>FIM-IPL</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-foreground">{pageLabel}</span>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold tracking-tight">FIM-IPL</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] sm:flex ${
                connected
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-warning/30 bg-warning/10 text-warning'
              }`}
              title={connected ? t('realtime.connected') : t('realtime.offline')}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? 'animate-pulse bg-success' : 'bg-warning'
                }`}
              />
              {connected ? t('realtime.live') : t('realtime.polling')}
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] text-muted-foreground sm:flex">
              <Activity
                className={`h-3 w-3 ${monitoring ? 'text-success' : 'text-muted-foreground/60'}`}
              />
              {monitoring ? t('nav.monitoringOn') : t('nav.monitoringOff')}
            </span>
            <Badge tone={isAuditor ? 'warning' : 'accent'} className="hidden sm:inline-flex">
              {isAuditor ? t('role.readOnly') : t('role.fullAccess')}
            </Badge>
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              title={t('nav.language')}
              aria-label={t('nav.language')}
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === 'id' ? 'ID' : 'EN'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger"
              title={t('nav.logout')}
              aria-label={t('nav.logout')}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {maintenance && (
          <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/[0.07] px-4 py-2 text-[11px] text-warning lg:px-8">
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span>{t('nav.maintenanceBanner')}</span>
          </div>
        )}

        <main
          id="main-content"
          className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>

        <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-1 border-t border-border px-4 py-4 text-[10px] text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>FIM-IPL v1.0.0 · Immutable Private Ledger · SHA-256</span>
          <span>{t('app.tagline')}</span>
        </footer>
      </div>
    </div>
  );
}
