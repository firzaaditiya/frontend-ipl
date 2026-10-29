import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  FolderOpen,
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import { getSystemInfo, type SystemInfo } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { formatDuration, formatNumber } from '../lib/format';
import { Badge, Button, Card, LoadingBlock, PageHeader, Toast } from '../components/ui';

function osLabel(os: string): string {
  if (os === 'windows') return 'Windows';
  if (os === 'linux') return 'Linux';
  if (os === 'darwin') return 'macOS';
  return os;
}

export default function SystemPage() {
  const { t, lang } = useI18n();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await getSystemInfo();
      setInfo(res.data);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleCopy = async () => {
    if (!info) return;
    const text = [
      `FIM-IPL v${info.version}`,
      `OS: ${osLabel(info.os)} (${info.arch})`,
      `Go: ${info.go_version}`,
      `Uptime: ${formatDuration(info.uptime_sec, lang)}`,
      `Quarantine: ${info.quarantine_mode}`,
      `Watch paths: ${info.watch_paths.join(', ')}`,
      `Workers: ${info.worker_count}`,
      `Interval: ${info.scan_interval_sec}s`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setToast(t('system.copied'));
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  if (loading) {
    return <LoadingBlock label={t('system.loading')} />;
  }

  const quarantineLabel =
    info?.quarantine_mode === 'readonly_fallback'
      ? t('system.readonlyFallback')
      : t('system.chmod000');

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow={t('system.eyebrow')}
        title={t('system.title')}
        description={t('system.description')}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Copy className="h-3.5 w-3.5" />}
              onClick={() => void handleCopy()}
              disabled={!info}
            >
              {t('system.copyInfo')}
            </Button>
            <Button
              variant="primary"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => void load()}
            >
              {t('system.checkNow')}
            </Button>
          </>
        }
      />

      {hasError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[11px] text-danger">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t('system.loadFailed')}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title={t('system.appInfo')}
          icon={<ShieldCheck className="h-4 w-4" />}
          actions={<Badge tone="accent">v{info?.version ?? '1.0.0'}</Badge>}
        >
          <p className="text-lg font-semibold tracking-tight text-foreground">FIM-IPL</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t('app.tagline')}
          </p>
          <div className="mt-4 space-y-2 text-[10px]">
            <InfoRow label={t('system.version')} value={info?.version ?? '—'} />
            <InfoRow
              label={t('system.apiStatus')}
              value={info ? t('system.reachable') : t('system.unreachable')}
              tone={info ? 'success' : 'danger'}
            />
            <InfoRow
              label={t('system.quarantineMode')}
              value={quarantineLabel}
              tone={info?.quarantine_mode === 'readonly_fallback' ? 'warning' : 'neutral'}
            />
          </div>
        </Card>

        <Card title={t('system.environment')} icon={<Server className="h-4 w-4" />}>
          <div className="space-y-2 text-[10px]">
            <InfoRow label={t('system.os')} value={info ? osLabel(info.os) : '—'} />
            <InfoRow label={t('system.arch')} value={info?.arch ?? '—'} />
            <InfoRow label={t('system.goVersion')} value={info?.go_version ?? '—'} />
            <InfoRow
              label={t('system.uptime')}
              value={info ? formatDuration(info.uptime_sec, lang) : '—'}
            />
            <InfoRow
              label={t('system.workers')}
              value={info ? formatNumber(info.worker_count, lang) : '—'}
            />
            <InfoRow
              label={t('system.interval')}
              value={info ? `${info.scan_interval_sec}s` : '—'}
            />
          </div>
        </Card>

        <Card title={t('common.status')} icon={<Activity className="h-4 w-4" />}>
          <div className="space-y-2 text-[10px]">
            <InfoRow
              label={t('settings.monitoring')}
              value={info?.is_monitoring ? t('nav.active') : t('nav.stopped')}
              tone={info?.is_monitoring ? 'success' : 'warning'}
            />
            <InfoRow
              label={t('settings.maintenance')}
              value={info?.maintenance_mode ? t('nav.maintenance') : t('nav.normal')}
              tone={info?.maintenance_mode ? 'warning' : 'neutral'}
            />
            <InfoRow
              label={t('system.watchPaths')}
              value={formatNumber(info?.watch_paths.length, lang)}
            />
            <InfoRow label="API" value="/api/v1" />
          </div>
          {info?.quarantine_mode === 'readonly_fallback' && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-2.5 text-[10px] leading-relaxed text-warning">
              <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t('system.quarantineNote')}</span>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={t('system.capabilities')}
          description={t('system.capabilityDesc')}
          icon={<Database className="h-4 w-4" />}
        >
          <ul className="space-y-2">
            {[
              { icon: <Activity className="h-3.5 w-3.5" />, text: t('system.capDetect') },
              { icon: <Lock className="h-3.5 w-3.5" />, text: t('system.capQuarantine') },
              { icon: <Database className="h-3.5 w-3.5" />, text: t('system.capLedger') },
              { icon: <Bell className="h-3.5 w-3.5" />, text: t('system.capNotify') },
              { icon: <KeyRound className="h-3.5 w-3.5" />, text: t('system.capRbac') },
            ].map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2 text-[10px] text-muted-foreground"
              >
                <span className="text-accent">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('system.access')} icon={<Users className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="rounded-lg border border-accent/25 bg-accent/[0.06] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-foreground">
                  {t('role.superAdmin')}
                </span>
                <Badge tone="accent">{t('role.fullAccess')}</Badge>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                {t('system.superAdminDesc')}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-foreground">
                  {t('role.auditor')}
                </span>
                <Badge tone="info">{t('role.readOnly')}</Badge>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                {t('system.auditorDesc')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title={t('system.watchPaths')}
        description={t('settings.watchPathsDesc')}
        icon={<FolderOpen className="h-4 w-4" />}
      >
        {(info?.watch_paths.length ?? 0) === 0 ? (
          <p className="text-[11px] text-muted-foreground">{t('dash.notConfigured')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {info?.watch_paths.map((path) => (
              <p
                key={path}
                className="truncate rounded-lg border border-border bg-background/50 px-2.5 py-2 font-mono text-[10px] text-muted-foreground"
                title={path}
              >
                {path}
              </p>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-accent" />
            {info ? `${info.scan_interval_sec}s` : '—'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-accent" />
            {info ? `${info.worker_count} workers` : '—'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-success" />
            {info ? t('system.reachable') : t('system.unreachable')}
          </span>
        </div>
      </Card>

      {toast && <Toast message={toast} tone="success" onClose={() => setToast(null)} />}
    </div>
  );
}

function InfoRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    neutral: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-mono ${toneClass}`}>{value}</span>
    </div>
  );
}
