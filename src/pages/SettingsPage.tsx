import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  Bell,
  Bot,
  CheckCircle2,
  CloudUpload,
  Database,
  FolderOpen,
  KeyRound,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Users,
  Webhook,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import {
  disableMaintenance,
  enableMaintenance,
  getSettings,
  initBaseline,
  runBackup,
  setupAuditor,
  startMonitoring,
  stopMonitoring,
  testTelegram,
  updateBaseline,
  updateSettings,
} from '../lib/api';
import { errorMessage, formatNumber } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  LoadingBlock,
  PageHeader,
  Toast,
} from '../components/ui';

interface SettingsData {
  watch_paths: string[];
  scan_interval_sec: number;
  worker_count: number;
  telegram_chat_id: string;
  telegram_configured: boolean;
  backup_webhook_url: string;
  is_monitoring: boolean;
  maintenance_mode: boolean;
  auditor_username: string;
  auditor_configured: boolean;
}

type Tab = 'operasional' | 'pemindaian' | 'notifikasi' | 'akses';
type ToastState = { type: 'success' | 'error'; text: string } | null;
type ConfirmKey = 'maintenance' | 'init-baseline' | 'update-baseline';

interface ConfirmState {
  key: ConfirmKey;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'warning' | 'danger' | 'accent';
}

const TABS: Array<{ value: Tab; labelKey: string; icon: ReactNode }> = [
  { value: 'operasional', labelKey: 'settings.tabOperational', icon: <Activity className="h-3.5 w-3.5" /> },
  { value: 'pemindaian', labelKey: 'settings.tabScanning', icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
  { value: 'notifikasi', labelKey: 'settings.tabNotifications', icon: <Bell className="h-3.5 w-3.5" /> },
  { value: 'akses', labelKey: 'settings.tabAccess', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

const INPUT_CLASS =
  'w-full rounded-lg border border-input bg-background/70 px-3 py-2.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60';

export default function SettingsPage() {
  const { isAuditor, isAdmin } = useAuth();
  const { t, lang } = useI18n();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [tab, setTab] = useState<Tab>('operasional');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const [watchPaths, setWatchPaths] = useState('');
  const [scanInterval, setScanInterval] = useState(300);
  const [workerCount, setWorkerCount] = useState(4);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatID, setTelegramChatID] = useState('');
  const [webhookURL, setWebhookURL] = useState('');
  const [auditorUser, setAuditorUser] = useState('');
  const [auditorPass, setAuditorPass] = useState('');

  const showToast = (type: 'success' | 'error', text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ type, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const fetchSettings = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await getSettings();
      const data = res.data as SettingsData;
      setSettings(data);
      setWatchPaths(data.watch_paths.join('\n'));
      setScanInterval(data.scan_interval_sec);
      setWorkerCount(data.worker_count);
      setTelegramChatID(data.telegram_chat_id || '');
      setWebhookURL(data.backup_webhook_url || '');
    } catch (err) {
      showToast('error', errorMessage(err, t('settings.settingsLoadFailed')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSettings(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const paths = watchPaths
      .split('\n')
      .map((path) => path.trim())
      .filter(Boolean);

    if (paths.length === 0) {
      showToast('error', t('settings.watchPathRequired'));
      return;
    }

    const interval = Math.max(30, Math.min(86400, scanInterval || 300));
    const workers = Math.max(1, Math.min(16, workerCount || 4));

    setSaving(true);
    try {
      await updateSettings({
        watch_paths: paths,
        scan_interval_sec: interval,
        worker_count: workers,
        telegram_token: telegramToken || undefined,
        telegram_chat_id: telegramChatID || undefined,
        backup_webhook_url: webhookURL,
      });
      setTelegramToken('');
      showToast('success', t('settings.settingsSaved'));
      await fetchSettings();
    } catch (err) {
      showToast('error', errorMessage(err, t('settings.settingsSaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const withBusy = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      showToast('success', success);
      await fetchSettings();
    } catch (err) {
      showToast('error', errorMessage(err, t('settings.actionFailed')));
    } finally {
      setBusy(null);
    }
  };

  const handleStartMonitoring = () =>
    withBusy('start', startMonitoring, t('settings.monitoringStarted'));

  const handleStopMonitoring = () =>
    withBusy('stop', stopMonitoring, t('settings.monitoringStopped'));

  const handleTestTelegram = async () => {
    setBusy('telegram');
    try {
      await testTelegram({
        telegram_token: telegramToken.trim() || undefined,
        telegram_chat_id: telegramChatID.trim() || undefined,
      });
      showToast('success', t('settings.telegramTestOk'));
    } catch (err) {
      showToast('error', errorMessage(err, t('settings.telegramTestFailed')));
    } finally {
      setBusy(null);
    }
  };

  const handleRunBackup = () => {
    if (!settings?.telegram_configured && !settings?.backup_webhook_url) {
      showToast('error', t('settings.backupNoChannel'));
      return;
    }
    return withBusy('backup', runBackup, t('settings.backupRan'));
  };

  const handleCreateAuditor = async () => {
    if (!auditorUser.trim()) {
      showToast('error', t('settings.auditorUsernameRequired'));
      return;
    }
    if (auditorPass.length < 8) {
      showToast('error', t('settings.passwordMin8'));
      return;
    }
    setBusy('auditor');
    try {
      await setupAuditor(auditorUser.trim(), auditorPass);
      showToast('success', t('settings.auditorCreated', { name: auditorUser.trim() }));
      setAuditorUser('');
      setAuditorPass('');
      await fetchSettings();
    } catch (err) {
      showToast('error', errorMessage(err, t('settings.auditorCreateFailed')));
    } finally {
      setBusy(null);
    }
  };

  const askMaintenance = () => {
    const enabling = !settings?.maintenance_mode;
    setConfirm({
      key: 'maintenance',
      title: enabling
        ? t('settings.confirmMaintenanceOnTitle')
        : t('settings.confirmMaintenanceOffTitle'),
      description: enabling
        ? t('settings.confirmMaintenanceOnDesc')
        : t('settings.confirmMaintenanceOffDesc'),
      confirmLabel: enabling ? t('settings.confirmEnable') : t('settings.confirmDisable'),
      tone: enabling ? 'warning' : 'accent',
    });
  };

  const askInitBaseline = () => {
    setConfirm({
      key: 'init-baseline',
      title: t('settings.confirmInitTitle'),
      description: t('settings.confirmInitDesc'),
      confirmLabel: t('settings.confirmInitialize'),
      tone: 'danger',
    });
  };

  const askUpdateBaseline = () => {
    setConfirm({
      key: 'update-baseline',
      title: t('settings.confirmUpdateTitle'),
      description: t('settings.confirmUpdateDesc'),
      confirmLabel: t('settings.confirmUpdate'),
      tone: 'warning',
    });
  };

  const executeConfirm = async () => {
    if (!confirm) return;
    const current = confirm;

    if (current.key === 'maintenance') {
      const enabling = !settings?.maintenance_mode;
      await withBusy(
        'maintenance',
        enabling ? enableMaintenance : disableMaintenance,
        enabling ? t('settings.maintenanceOn') : t('settings.maintenanceOff'),
      );
    } else if (current.key === 'init-baseline') {
      await withBusy(
        'init-baseline',
        async () => {
          await initBaseline();
        },
        t('settings.baselineInitialized'),
      );
    } else {
      await withBusy(
        'update-baseline',
        async () => {
          await updateBaseline();
        },
        t('settings.baselineUpdated'),
      );
    }
    setConfirm(null);
  };

  if (loading) {
    return <LoadingBlock label={t('settings.loading')} />;
  }

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        description={t('settings.description')}
      />

      {isAuditor && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-[11px] text-warning">
          {t('settings.auditorBanner')}
        </div>
      )}

      <div
        className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
        role="tablist"
        aria-label={t('settings.title')}
      >
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-medium transition-colors ${
              tab === item.value
                ? 'bg-card text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.icon}
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'operasional' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard
              label={t('settings.monitoring')}
              value={settings?.is_monitoring ? t('nav.active') : t('nav.stopped')}
              tone={settings?.is_monitoring ? 'success' : 'muted'}
              icon={<Activity className="h-3.5 w-3.5" />}
            />
            <StatusCard
              label={t('settings.maintenance')}
              value={settings?.maintenance_mode ? t('nav.maintenance') : t('nav.normal')}
              tone={settings?.maintenance_mode ? 'warning' : 'muted'}
              icon={<Wrench className="h-3.5 w-3.5" />}
            />
            <StatusCard
              label={t('settings.interval')}
              value={`${settings?.scan_interval_sec ?? 0}s`}
              tone="neutral"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            />
            <StatusCard
              label={t('settings.watchPath')}
              value={formatNumber(settings?.watch_paths.length, lang)}
              tone="neutral"
              icon={<FolderOpen className="h-3.5 w-3.5" />}
            />
          </div>

          <Card
            title={t('settings.monitorControlTitle')}
            description={t('settings.monitorControlDesc')}
            icon={<Play className="h-4 w-4" />}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="success"
                icon={<Play className="h-3.5 w-3.5" />}
                onClick={handleStartMonitoring}
                loading={busy === 'start'}
                disabled={isAuditor || settings?.is_monitoring}
              >
                {t('settings.startMonitoring')}
              </Button>
              <Button
                variant="danger"
                icon={<Square className="h-3.5 w-3.5" />}
                onClick={handleStopMonitoring}
                loading={busy === 'stop'}
                disabled={isAuditor || !settings?.is_monitoring}
              >
                {t('settings.stopMonitoring')}
              </Button>
              <Button
                variant={settings?.maintenance_mode ? 'primary' : 'secondary'}
                icon={<Wrench className="h-3.5 w-3.5" />}
                onClick={askMaintenance}
                loading={busy === 'maintenance'}
                disabled={isAuditor}
              >
                {settings?.maintenance_mode
                  ? t('settings.disableMaintenance')
                  : t('settings.enableMaintenance')}
              </Button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              {t('settings.monitorControlNote')}
            </p>
          </Card>

          <Card
            title={t('settings.baselineTitle')}
            description={t('settings.baselineDesc')}
            icon={<Database className="h-4 w-4" />}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={askInitBaseline}
                loading={busy === 'init-baseline'}
                disabled={isAuditor}
              >
                {t('settings.initBaseline')}
              </Button>
              <Button
                variant="secondary"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={askUpdateBaseline}
                loading={busy === 'update-baseline'}
                disabled={isAuditor}
              >
                {t('settings.updateBaseline')}
              </Button>
            </div>
            <div className="mt-3 grid gap-2 text-[10px] leading-relaxed text-muted-foreground sm:grid-cols-2">
              <p className="rounded-lg border border-border bg-background/40 p-2.5">
                {t('settings.initBaselineNote')}
              </p>
              <p className="rounded-lg border border-border bg-background/40 p-2.5">
                {t('settings.updateBaselineNote')}
              </p>
            </div>
          </Card>
        </div>
      )}

      {tab === 'pemindaian' && (
        <div className="space-y-4">
          <Card
            title={t('settings.watchPathsTitle')}
            description={t('settings.watchPathsDesc')}
            icon={<FolderOpen className="h-4 w-4" />}
          >
            <Field hint={t('settings.watchPathsHint')}>
              <textarea
                value={watchPaths}
                onChange={(event) => setWatchPaths(event.target.value)}
                disabled={isAuditor}
                rows={5}
                spellCheck={false}
                className={`${INPUT_CLASS} resize-y font-mono leading-relaxed`}
                placeholder={'/var/www/html\n/var/www/html/wp-content'}
              />
            </Field>
          </Card>

          <Card
            title={t('settings.scanParamsTitle')}
            description={t('settings.scanParamsDesc')}
            icon={<SlidersHorizontal className="h-4 w-4" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('settings.intervalLabel')}
                htmlFor="interval"
                hint={t('settings.intervalHint')}
              >
                <input
                  id="interval"
                  type="number"
                  min={30}
                  max={86400}
                  disabled={isAuditor}
                  value={scanInterval}
                  onChange={(event) => {
                    const value = parseInt(event.target.value, 10);
                    if (!Number.isNaN(value)) setScanInterval(value);
                  }}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field
                label={t('settings.workersLabel')}
                htmlFor="workers"
                hint={t('settings.workersHint')}
              >
                <input
                  id="workers"
                  type="number"
                  min={1}
                  max={16}
                  disabled={isAuditor}
                  value={workerCount}
                  onChange={(event) => {
                    const value = parseInt(event.target.value, 10);
                    if (!Number.isNaN(value)) setWorkerCount(value);
                  }}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-background/40 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
              {t('settings.scanNote')}
            </div>
          </Card>

          <SaveBar saving={saving} disabled={isAuditor} onSave={handleSave} />
        </div>
      )}

      {tab === 'notifikasi' && (
        <div className="space-y-4">
          <Card
            title={t('settings.telegramTitle')}
            description={t('settings.telegramDesc')}
            icon={<Bot className="h-4 w-4" />}
            actions={
              <Badge tone={settings?.telegram_configured ? 'success' : 'muted'}>
                {settings?.telegram_configured
                  ? t('settings.configured')
                  : t('settings.notConfigured')}
              </Badge>
            }
          >
            <div className="space-y-4">
              <Field
                label={t('settings.botToken')}
                htmlFor="tg-token"
                hint={
                  settings?.telegram_configured
                    ? t('settings.botTokenStored')
                    : t('settings.botTokenHint')
                }
              >
                <input
                  id="tg-token"
                  type="password"
                  disabled={isAuditor}
                  value={telegramToken}
                  onChange={(event) => setTelegramToken(event.target.value)}
                  className={INPUT_CLASS}
                  placeholder={
                    settings?.telegram_configured
                      ? t('settings.botTokenStored')
                      : '123456:ABC-DEF…'
                  }
                  autoComplete="off"
                />
              </Field>
              <Field label={t('settings.chatId')} htmlFor="tg-chat">
                <input
                  id="tg-chat"
                  type="text"
                  disabled={isAuditor}
                  value={telegramChatID}
                  onChange={(event) => setTelegramChatID(event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="-1001234567890"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  icon={<Send className="h-3.5 w-3.5" />}
                  onClick={handleTestTelegram}
                  loading={busy === 'telegram'}
                  disabled={isAuditor}
                >
                  {t('settings.sendTest')}
                </Button>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {t('settings.testTelegramNote')}
              </p>
            </div>
          </Card>

          <Card
            title={t('settings.backupTitle')}
            description={t('settings.backupDesc')}
            icon={<CloudUpload className="h-4 w-4" />}
          >
            <Field
              label={t('settings.webhookLabel')}
              htmlFor="webhook"
              hint={t('settings.webhookHint')}
            >
              <input
                id="webhook"
                type="url"
                disabled={isAuditor}
                value={webhookURL}
                onChange={(event) => setWebhookURL(event.target.value)}
                className={INPUT_CLASS}
                placeholder="https://server.example.com/webhook"
              />
            </Field>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={<CloudUpload className="h-3.5 w-3.5" />}
                onClick={handleRunBackup}
                loading={busy === 'backup'}
                disabled={isAuditor}
              >
                {t('settings.runBackup')}
              </Button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              {t('settings.backupNote')}
            </p>
          </Card>

          <SaveBar saving={saving} disabled={isAuditor} onSave={handleSave} />
        </div>
      )}

      {tab === 'akses' && (
        <div className="space-y-4">
          {isAdmin && (
            <Card
              title={t('settings.auditorAccountTitle')}
              description={t('settings.auditorAccountDesc')}
              icon={<Users className="h-4 w-4" />}
              actions={
                <Badge tone={settings?.auditor_configured ? 'success' : 'muted'}>
                  {settings?.auditor_configured
                    ? t('settings.active')
                    : t('settings.notConfigured')}
                </Badge>
              }
            >
              {settings?.auditor_configured && (
                <div className="mb-4 rounded-lg border border-border bg-background/40 px-2.5 py-2 text-[10px] text-muted-foreground">
                  {t('settings.activeAccount')}{' '}
                  <span className="font-mono text-success">{settings.auditor_username}</span>.{' '}
                  {t('settings.rotateNote')}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('settings.auditorUsername')} htmlFor="aud-user">
                  <input
                    id="aud-user"
                    type="text"
                    value={auditorUser}
                    onChange={(event) => setAuditorUser(event.target.value)}
                    className={INPUT_CLASS}
                    placeholder={t('settings.auditorUsernamePlaceholder')}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t('settings.auditorPassword')} htmlFor="aud-pass">
                  <input
                    id="aud-pass"
                    type="password"
                    value={auditorPass}
                    onChange={(event) => setAuditorPass(event.target.value)}
                    className={INPUT_CLASS}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Button
                  variant="primary"
                  icon={<KeyRound className="h-3.5 w-3.5" />}
                  onClick={handleCreateAuditor}
                  loading={busy === 'auditor'}
                >
                  {settings?.auditor_configured
                    ? t('settings.rotateAuditor')
                    : t('settings.createAuditor')}
                </Button>
              </div>
            </Card>
          )}

          <Card
            title={t('settings.rbacTitle')}
            description={t('settings.rbacDesc')}
            icon={<ShieldCheck className="h-4 w-4" />}
            padded={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[10px]">
                <thead>
                  <tr className="border-b border-border bg-surface/60 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">{t('settings.capability')}</th>
                    <th className="px-4 py-2.5 text-center font-semibold">
                      {t('settings.superAdminCol')}
                    </th>
                    <th className="px-4 py-2.5 text-center font-semibold">
                      {t('settings.auditorCol')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    [t('settings.capDashboard'), true, true],
                    [t('settings.capAudit'), true, true],
                    [t('settings.capSettings'), true, false],
                    [t('settings.capBaseline'), true, false],
                    [t('settings.capMonitoring'), true, false],
                    [t('settings.capRelease'), true, false],
                    [t('settings.capBackup'), true, false],
                  ].map(([label, admin, auditor]) => (
                    <tr key={label as string}>
                      <td className="px-4 py-2.5 text-foreground">{label}</td>
                      <td className="px-4 py-2.5 text-center">
                        {admin ? (
                          <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="mx-auto h-3.5 w-3.5 text-danger" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {auditor ? (
                          <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="mx-auto h-3.5 w-3.5 text-danger" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title={t('settings.securityTitle')}
            description={t('settings.securityDesc')}
            icon={<KeyRound className="h-4 w-4" />}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                [t('settings.secJwt'), t('settings.secJwtDesc')],
                [t('settings.secBcrypt'), t('settings.secBcryptDesc')],
                [t('settings.secRate'), t('settings.secRateDesc')],
                [t('settings.secRbac'), t('settings.secRbacDesc')],
                 [t('settings.secLoginPath'), t('settings.secLoginPathDesc')],
                 [t('settings.secCors'), t('settings.secCorsDesc')],
                 [t('settings.secStorage'), t('settings.secStorageDesc')],
               ].map(([title, text]) => (
                <div key={title} className="rounded-lg border border-border bg-background/40 p-2.5">
                  <p className="text-[10px] font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="rounded-lg border border-border bg-surface p-3 text-[10px] leading-relaxed text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <Webhook className="h-3 w-3 text-accent" />
              {t('settings.note')}
            </span>{' '}
            {t('settings.noteText')}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone ?? 'warning'}
        busy={busy === confirm?.key}
        onConfirm={executeConfirm}
        onClose={() => !busy && setConfirm(null)}
      />

      {toast && <Toast message={toast.text} tone={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function StatusCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'muted' | 'neutral';
  icon: ReactNode;
}) {
  const toneStyles = {
    success: 'border-success/25 bg-success/10 text-success',
    warning: 'border-warning/25 bg-warning/10 text-warning',
    muted: 'border-border bg-surface text-muted-foreground',
    neutral: 'border-border bg-surface text-muted-foreground',
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${toneStyles}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SaveBar({
  saving,
  disabled,
  onSave,
}: {
  saving: boolean;
  disabled: boolean;
  onSave: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="sticky bottom-4 flex justify-end">
      <Button
        variant="primary"
        icon={<Save className="h-3.5 w-3.5" />}
        onClick={onSave}
        loading={saving}
        disabled={disabled}
      >
        {t('settings.saveChanges')}
      </Button>
    </div>
  );
}
