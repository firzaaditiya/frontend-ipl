import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cpu,
  FileCheck2,
  Files,
  Link2,
  Lock,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Timer,
  Wrench,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getBlocks,
  getMetrics,
  getSettings,
  getStats,
  verifyChain,
  type ScanMetric,
} from '../lib/api';
import {
  basename,
  dirname,
  formatBytes,
  formatNumber,
  formatRelative,
  formatTime,
  shortHash,
} from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useRealtime, useRealtimeEvent } from '../lib/realtime';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
} from '../components/ui';

interface Stats {
  total_files: number;
  safe_files: number;
  total_anomalies: number;
  total_blocks: number;
  is_monitoring: boolean;
  maintenance_mode: boolean;
}

interface SettingsSummary {
  watch_paths: string[];
  scan_interval_sec: number;
  worker_count: number;
  is_monitoring: boolean;
  maintenance_mode: boolean;
}

interface Block {
  id: string;
  timestamp: string;
  file_path: string;
  action: string;
  old_hash: string;
  new_hash: string;
  quarantined: boolean;
  quarantine_err?: string;
  block_hash: string;
  prev_block_hash: string;
}

interface VerifyResult {
  valid: boolean;
  message: string;
  failed_block?: string;
  total_blocks: number;
  verified_at: string;
}

const ACTION_TONE: Record<string, 'danger' | 'warning' | 'muted'> = {
  MODIFIED: 'danger',
  CREATED: 'warning',
  DELETED: 'muted',
  UNREADABLE: 'danger',
};

const TOOLTIP_STYLE = {
  backgroundColor: '#141613',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 8,
  color: '#f2f2ef',
  fontSize: 10,
  padding: '6px 8px',
};

const TOOLTIP_LABEL_STYLE = { color: '#9ca09a', fontSize: 9, marginBottom: 2 };

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { connected } = useRealtime();
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<SettingsSummary | null>(null);
  const [metrics, setMetrics] = useState<ScanMetric[]>([]);
  const [recent, setRecent] = useState<Block[]>([]);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Jam lokal untuk hitung mundur pemindaian berikutnya (v1.2.0). Diperbarui
  // tiap detik agar operator dapat mengamati polling deterministik secara
  // langsung, bukan hanya membaca interval pada pengaturan.
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  const loadData = useCallback(async (silent = false) => {
    if (inFlight.current) {
      if (!silent) setRefreshing(true);
      return;
    }
    inFlight.current = true;
    if (!silent) setRefreshing(true);

    try {
      const results = await Promise.allSettled([
        getStats(),
        getMetrics(60),
        getBlocks(1, 10),
        getSettings(),
      ]);

      const [statsRes, metricsRes, blocksRes, settingsRes] = results;

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
        setLoadError('');
        setLastUpdated(new Date());
      } else {
        setLoadError('dash.loadError');
      }
      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value.data.metrics || []);
      }
      if (blocksRes.status === 'fulfilled') {
        const blocks = (blocksRes.value.data.blocks || []) as Block[];
        setRecent(blocks.filter((block) => block.action !== 'RELEASED').slice(0, 6));
      }
      if (settingsRes.status === 'fulfilled') {
        setSettings(settingsRes.value.data);
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(true);
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Polling hanya menjadi fallback saat SSE tidak terhubung.
  useEffect(() => {
    if (connected) return;
    const timer = window.setInterval(() => void loadData(true), 20_000);
    return () => window.clearInterval(timer);
  }, [connected, loadData]);

  // Pembaruan realtime: refresh senyap saat ada scan/status kejadian baru.
  const refreshTimer = useRef<number | undefined>(undefined);
  useRealtimeEvent((event) => {
    if (
      event.type !== 'scan' &&
      event.type !== 'status' &&
      event.type !== 'quarantine_released'
    ) {
      return;
    }
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => void loadData(true), 400);
  });
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await verifyChain();
      setVerify(res.data);
    } catch {
      setVerify({
        valid: false,
        message: t('audit.verifyFailedMsg'),
        total_blocks: 0,
        verified_at: new Date().toISOString(),
      });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <LoadingBlock label={t('dash.loading')} />;
  }

  const chartData = metrics.map((metric) => ({
    time: formatTime(metric.timestamp, lang),
    elapsed: metric.elapsed_ms,
    mem: +(metric.mem_alloc_bytes / 1024 / 1024).toFixed(2),
  }));

  const lastMetric = metrics[metrics.length - 1];
  // Pemindaian berikutnya diperkirakan dari siklus terakhir + interval.
  // Nilai ini sengaja null (bukan tebakan) bila pemantauan berhenti, mode
  // pemeliharaan aktif, atau belum ada siklus yang tercatat, agar dasbor
  // tidak menampilkan hitung mundur yang menyesatkan.
  const nextScanInSec = (() => {
    if (!stats?.is_monitoring || stats?.maintenance_mode || !lastMetric) return null;
    const intervalSec = settings?.scan_interval_sec;
    if (!intervalSec || intervalSec <= 0) return null;
    const last = new Date(lastMetric.timestamp).getTime();
    if (Number.isNaN(last)) return null;
    return Math.ceil((last + intervalSec * 1000 - now) / 1000);
  })();
  const avgMs =
    metrics.length > 0
      ? Math.round(metrics.reduce((total, metric) => total + metric.elapsed_ms, 0) / metrics.length)
      : 0;
  const safePercentage =
    stats && stats.total_files > 0
      ? Math.round((stats.safe_files / stats.total_files) * 100)
      : 0;
  const chainValue = verify
    ? verify.valid
      ? t('dash.intact')
      : t('dash.broken')
    : t('dash.unverified');

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow={t('nav.dashboard')}
        title={t('dash.title')}
        description={t('dash.description')}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
              onClick={() => void loadData()}
              disabled={refreshing}
            >
              {t('common.refresh')}
            </Button>
            <Button
              variant="primary"
              icon={<Link2 className="h-3.5 w-3.5" />}
              onClick={handleVerify}
              loading={verifying}
            >
              {t('dash.verifyLedger')}
            </Button>
          </>
        }
      />

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[11px] text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t(loadError)}</span>
        </div>
      )}

      {stats && stats.total_files === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[11px] text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {t('dash.noBaseline')}{' '}
            <Link
              to="/settings"
              className="font-semibold underline underline-offset-2 hover:text-warning/80"
            >
              {t('dash.openSettings')}
            </Link>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dash.filesMonitored')}
          value={formatNumber(stats?.total_files, lang)}
          hint={t('dash.filesMonitoredHint')}
          icon={<Files className="h-4 w-4" />}
          tone="neutral"
        />
        <StatCard
          label={t('dash.filesSafe')}
          value={formatNumber(stats?.safe_files, lang)}
          hint={t('dash.filesSafeHint', { value: safePercentage })}
          icon={<FileCheck2 className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label={t('dash.anomalies')}
          value={formatNumber(stats?.total_anomalies, lang)}
          hint={t('dash.anomaliesHint')}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={stats && stats.total_anomalies > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          label={t('dash.chainIntegrity')}
          value={chainValue}
          hint={
            verify
              ? t('dash.verifiedBlocks', { value: formatNumber(verify.total_blocks, lang) })
              : t('dash.notVerified')
          }
          icon={
            verify ? (
              verify.valid ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )
            ) : (
              <Link2 className="h-4 w-4" />
            )
          }
          tone={verify ? (verify.valid ? 'success' : 'danger') : 'neutral'}
          mono={false}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={t('dash.scanPerformance')}
          description={t('dash.scanPerformanceDesc')}
          icon={<Activity className="h-4 w-4" />}
          actions={
            <span className="text-[10px] text-muted-foreground">
              {t('dash.avg')} <span className="font-mono text-accent">{avgMs} ms</span>
            </span>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <Timer className="h-3 w-3 text-accent" />
                  {t('dash.responseTime')}
                </span>
                <span className="font-mono text-[10px] text-foreground">
                  {lastMetric ? `${lastMetric.elapsed_ms} ms` : '—'}
                </span>
              </div>
              <div className="h-48">
                {chartData.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-6 w-6" />}
                    title={t('dash.noMetrics')}
                    description={t('dash.noMetricsDesc')}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="elapsedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59145" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#f59145" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="time"
                        stroke="#6f746d"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={36}
                      />
                      <YAxis
                        stroke="#6f746d"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        width={38}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL_STYLE}
                        formatter={(value) => [`${value} ms`, t('dash.responseSeries')]}
                      />
                      <Area
                        type="monotone"
                        dataKey="elapsed"
                        stroke="#f59145"
                        strokeWidth={1.8}
                        fill="url(#elapsedFill)"
                        name="ms"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <Cpu className="h-3 w-3 text-info" />
                  {t('dash.heapMemory')}
                </span>
                <span className="font-mono text-[10px] text-foreground">
                  {lastMetric ? formatBytes(lastMetric.mem_alloc_bytes) : '—'}
                </span>
              </div>
              <div className="h-48">
                {chartData.length === 0 ? (
                  <EmptyState
                    icon={<Cpu className="h-6 w-6" />}
                    title={t('dash.noMemory')}
                    description={t('dash.noMemoryDesc')}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="time"
                        stroke="#6f746d"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={36}
                      />
                      <YAxis
                        stroke="#6f746d"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        width={38}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={TOOLTIP_LABEL_STYLE}
                        formatter={(value) => [`${value} MB`, t('dash.heapAllocSeries')]}
                      />
                      <Line
                        type="monotone"
                        dataKey="mem"
                        stroke="#7dd3fc"
                        strokeWidth={1.8}
                        dot={false}
                        name="MB"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={t('dash.systemStatus')}
          description={t('dash.systemStatusDesc')}
          icon={<Server className="h-4 w-4" />}
        >
          <div className="space-y-2.5">
            <StatusRow
              label={t('dash.monitoring')}
              value={stats?.is_monitoring ? t('nav.active') : t('nav.stopped')}
              tone={stats?.is_monitoring ? 'success' : 'muted'}
              icon={<Activity className="h-3 w-3" />}
            />
            <StatusRow
              label={t('dash.mode')}
              value={stats?.maintenance_mode ? t('nav.maintenance') : t('nav.normal')}
              tone={stats?.maintenance_mode ? 'warning' : 'muted'}
              icon={<Wrench className="h-3 w-3" />}
            />
            <StatusRow
              label={t('dash.interval')}
              value={
                settings ? t('dash.seconds', { value: settings.scan_interval_sec }) : '—'
              }
              icon={<Clock3 className="h-3 w-3" />}
            />
            <StatusRow
              label={t('dash.worker')}
              value={settings ? t('dash.goroutines', { value: settings.worker_count }) : '—'}
              icon={<Cpu className="h-3 w-3" />}
            />
            <StatusRow
              label={t('realtime.label')}
              value={connected ? t('realtime.live') : t('realtime.polling')}
              tone={connected ? 'success' : 'warning'}
              icon={<Radio className="h-3 w-3" />}
            />
            <StatusRow
              label={t('dash.lastScan')}
              value={
                lastMetric ? formatRelative(lastMetric.timestamp, lang) : t('common.never')
              }
              icon={<Timer className="h-3 w-3" />}
            />
            <StatusRow
              label={t('dash.nextScan')}
              value={
                nextScanInSec === null
                  ? '—'
                  : nextScanInSec <= 0
                    ? t('dash.nextScanSoon')
                    : t('dash.seconds', { value: nextScanInSec })
              }
              icon={<Timer className="h-3 w-3" />}
            />
            <StatusRow
              label={t('dash.lastCycle')}
              value={
                lastMetric
                  ? t('dash.lastCycleValue', {
                      anomalies: lastMetric.anomalies,
                      quarantined: lastMetric.quarantined,
                    })
                  : '—'
              }
              icon={<Activity className="h-3 w-3" />}
            />
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t('dash.watchPaths')}
            </p>
            <div className="space-y-1.5">
              {(settings?.watch_paths ?? []).length === 0 ? (
                <p className="text-[11px] text-muted-foreground">{t('dash.notConfigured')}</p>
              ) : (
                settings?.watch_paths.map((path) => (
                  <p
                    key={path}
                    className="truncate rounded-md border border-border bg-background/50 px-2 py-1.5 font-mono text-[10px] text-muted-foreground"
                    title={path}
                  >
                    {path}
                  </p>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{t('dash.integrityHealth')}</span>
              <span
                className={`font-mono ${
                  safePercentage >= 90
                    ? 'text-success'
                    : safePercentage >= 70
                      ? 'text-warning'
                      : 'text-danger'
                }`}
              >
                {safePercentage}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  safePercentage >= 90
                    ? 'bg-success'
                    : safePercentage >= 70
                      ? 'bg-warning'
                      : 'bg-danger'
                }`}
                style={{ width: `${safePercentage}%` }}
              />
            </div>
          </div>

          {verify && (
            <div
              className={`mt-4 rounded-lg border p-2.5 text-[10px] ${
                verify.valid
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-danger/30 bg-danger/10 text-danger'
              }`}
            >
              <p className="flex items-center gap-1.5 font-semibold">
                {verify.valid ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <ShieldX className="h-3.5 w-3.5" />
                )}
                {verify.valid
                  ? t('dash.chainIntact')
                  : t('dash.blockTampered', { block: verify.failed_block ?? t('common.unknown') })}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {formatNumber(verify.total_blocks, lang)} block ·{' '}
                {formatRelative(verify.verified_at, lang)}
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={t('dash.recentAnomalies')}
          description={t('dash.recentAnomaliesDesc')}
          icon={<ShieldAlert className="h-4 w-4" />}
          actions={
            <Link
              to="/audit-trail"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-accent transition-colors hover:text-accent/80"
            >
              {t('dash.viewAll')}
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
          padded={false}
        >
          {recent.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-7 w-7" />}
              title={t('dash.noAnomalies')}
              description={t('dash.noAnomaliesDesc')}
            />
          ) : (
            <div className="divide-y divide-border">
              {recent.map((block) => (
                <Link
                  key={block.id}
                  to="/audit-trail"
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                      block.quarantined
                        ? 'border-warning/30 bg-warning/10 text-warning'
                        : 'border-danger/30 bg-danger/10 text-danger'
                    }`}
                  >
                    {block.quarantined ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-foreground">
                      {basename(block.file_path)}
                    </p>
                    <p className="truncate text-[9px] text-muted-foreground">
                      {dirname(block.file_path) || block.id}
                    </p>
                  </div>
                  <Badge tone={ACTION_TONE[block.action] ?? 'muted'}>{block.action}</Badge>
                  <span className="hidden w-16 text-right text-[9px] text-muted-foreground sm:block">
                    {formatTime(block.timestamp, lang)}
                  </span>
                  <span
                    className="hidden w-24 truncate text-right font-mono text-[9px] text-muted-foreground/70 lg:block"
                    title={block.block_hash}
                  >
                    {shortHash(block.block_hash, 5, 4)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={t('dash.securityPosture')}
          description={t('dash.securityPostureDesc')}
          icon={<ShieldCheck className="h-4 w-4" />}
        >
          <div className="space-y-3">
            <QuickMetric
              label={t('dash.cyclesRecorded')}
              value={formatNumber(metrics.length, lang)}
              icon={<Activity className="h-3.5 w-3.5" />}
            />
            <QuickMetric
              label={t('dash.ledgerBlocks')}
              value={formatNumber(stats?.total_blocks, lang)}
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
            />
            <QuickMetric
              label={t('dash.lastFilesScanned')}
              value={formatNumber(lastMetric?.files_scanned, lang)}
              icon={<Files className="h-3.5 w-3.5" />}
            />
            <QuickMetric
              label={t('dash.systemMemory')}
              value={formatBytes(lastMetric?.mem_sys_bytes)}
              icon={<Cpu className="h-3.5 w-3.5" />}
            />
          </div>

          {(stats?.total_anomalies ?? 0) > 0 ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-[10px] text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {t('dash.anomaliesRecordedMsg', {
                  value: formatNumber(stats?.total_anomalies, lang),
                })}
              </span>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-[10px] text-success">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t('dash.noAnomaliesMsg')}</span>
            </div>
          )}

          {lastUpdated && (
            <p className="mt-4 text-center text-[9px] text-muted-foreground/60">
              {t('common.updated')} {formatRelative(lastUpdated, lang)}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
  mono = true,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: 'neutral' | 'success' | 'danger';
  mono?: boolean;
}) {
  const toneStyles = {
    neutral: 'border-border bg-surface text-muted-foreground',
    success: 'border-success/25 bg-success/10 text-success',
    danger: 'border-danger/25 bg-danger/10 text-danger',
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${toneStyles}`}>
          {icon}
        </div>
      </div>
      <p
        className={`mt-2.5 truncate text-xl font-semibold tracking-tight text-foreground ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'muted';
  icon?: ReactNode;
}) {
  const valueTone = {
    neutral: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    muted: 'text-muted-foreground',
  }[tone];

  return (
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={`font-semibold ${valueTone}`}>{value}</span>
    </div>
  );
}

function QuickMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-2">
      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-mono text-[11px] font-semibold text-foreground">{value}</span>
    </div>
  );
}
