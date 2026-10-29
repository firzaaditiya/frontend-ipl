import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  Link2,
  Lock,
  Search,
  ShieldCheck,
  ShieldX,
  Unlock,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useRealtimeEvent } from '../lib/realtime';
import {
  exportLedger,
  getBlocks,
  releaseQuarantine,
  verifyChain,
  type BlockAction,
} from '../lib/api';
import {
  basename,
  dirname,
  errorMessage,
  formatDateTime,
  formatRelative,
  shortHash,
} from '../lib/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  PageHeader,
  Spinner,
  Toast,
} from '../components/ui';

interface Block {
  id: string;
  timestamp: string;
  file_path: string;
  action: string;
  old_hash: string;
  new_hash: string;
  quarantined: boolean;
  quarantine_err?: string;
  prev_block_hash: string;
  block_hash: string;
}

interface PaginatedResponse {
  blocks: Block[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface VerifyResult {
  valid: boolean;
  message: string;
  failed_block?: string;
  total_blocks: number;
  verified_at?: string;
}

type FilterValue = 'ALL' | BlockAction;
type ToastState = { type: 'success' | 'error'; text: string } | null;

const FILTERS: Array<{ value: FilterValue; labelKey: string }> = [
  { value: 'ALL', labelKey: 'audit.filterAll' },
  { value: 'MODIFIED', labelKey: 'audit.filterModified' },
  { value: 'CREATED', labelKey: 'audit.filterCreated' },
  { value: 'DELETED', labelKey: 'audit.filterDeleted' },
  { value: 'UNREADABLE', labelKey: 'audit.filterUnreadable' },
  { value: 'RELEASED', labelKey: 'audit.filterReleased' },
];

const ACTION_TONE: Record<string, 'danger' | 'warning' | 'muted' | 'success'> = {
  MODIFIED: 'danger',
  CREATED: 'warning',
  DELETED: 'muted',
  UNREADABLE: 'danger',
  RELEASED: 'success',
};

export default function AuditTrailPage() {
  const { isAuditor } = useAuth();
  const { t, lang } = useI18n();
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Block | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const limit = 15;

  const showToast = (type: 'success' | 'error', text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ type, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const fetchBlocks = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await getBlocks(page, limit, search || undefined, filter);
        setData({ ...res.data, blocks: res.data.blocks ?? [] });
      } catch {
        showToast('error', t('audit.loadFailed'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, search, filter, t],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBlocks();
  }, [fetchBlocks]);

  // Saat anomali baru masuk (atau karantina dilepas) dan kita di halaman
  // pertama, muat ulang daftar tanpa memunculkan spinner.
  useRealtimeEvent((event) => {
    const anomalies =
      event.type === 'scan'
        ? (event.data as { anomalies?: number } | undefined)?.anomalies ?? 0
        : 0;
    const shouldRefresh = event.type === 'quarantine_released' || anomalies > 0;
    if (shouldRefresh && page === 1) {
      void fetchBlocks(true);
    }
  });

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleFilter = (next: FilterValue) => {
    setFilter(next);
    setPage(1);
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await verifyChain();
      setVerify(res.data);
      showToast(
        res.data.valid ? 'success' : 'error',
        res.data.valid ? t('audit.verifyIntactToast') : t('audit.verifyTamperedToast'),
      );
    } catch (err) {
      setVerify({
        valid: false,
        message: errorMessage(err, t('audit.verifyFailedMsg')),
        total_blocks: 0,
      });
      showToast('error', t('audit.verifyFailed'));
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportLedger();
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fim-ipl-ledger-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast('success', t('audit.exportSuccess'));
    } catch {
      showToast('error', t('audit.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleRelease = async () => {
    if (!releaseTarget) return;
    setReleasing(true);
    try {
      await releaseQuarantine(releaseTarget.file_path);
      showToast('success', t('audit.releaseSuccess'));
      setReleaseTarget(null);
      setSelectedBlock(null);
      await fetchBlocks();
    } catch (err) {
      showToast('error', errorMessage(err, t('audit.releaseFailed')));
    } finally {
      setReleasing(false);
    }
  };

  const totalPages = data?.total_pages ?? 0;

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow={t('audit.eyebrow')}
        title={t('audit.title')}
        description={t('audit.description')}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={handleExport}
              loading={exporting}
            >
              {t('audit.export')}
            </Button>
            <Button
              variant="primary"
              icon={<Link2 className="h-3.5 w-3.5" />}
              onClick={handleVerify}
              loading={verifying}
            >
              {t('audit.verify')}
            </Button>
          </>
        }
      />

      {verify && (
        <div
          className={`flex items-start gap-2.5 rounded-lg border p-3 text-[11px] ${
            verify.valid
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {verify.valid ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <p className="font-semibold">
              {verify.valid
                ? t('audit.verifyIntact')
                : t('audit.verifyTampered', {
                    block: verify.failed_block ?? t('common.unknown'),
                  })}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {verify.message} · {verify.total_blocks} block
              {verify.verified_at ? ` · ${formatRelative(verify.verified_at, lang)}` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => handleFilter(item.value)}
              className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                filter === item.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 lg:w-[420px]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('audit.searchPlaceholder')}
              className="w-full rounded-lg border border-input bg-background/70 py-2 pl-8 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            {t('common.search')}
          </Button>
        </form>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-border bg-surface/60 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">{t('audit.colBlock')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('audit.colTime')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('audit.colFile')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('audit.colEvent')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('audit.colQuarantine')}</th>
                <th className="px-4 py-2.5 font-semibold">{t('audit.colHash')}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-muted-foreground">
                      <Spinner className="h-4 w-4 text-accent" />
                      {t('audit.loadingBlocks')}
                    </div>
                  </td>
                </tr>
              ) : data && data.blocks.length > 0 ? (
                data.blocks.map((block) => {
                  const highlighted =
                    verify && !verify.valid && verify.failed_block === block.id;
                  return (
                    <tr
                      key={block.id}
                      onClick={() => setSelectedBlock(block)}
                      className={`cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-white/[0.025] ${
                        highlighted ? 'bg-danger/[0.06]' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[10px] text-accent">
                        {block.id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[10px] text-muted-foreground">
                        {formatDateTime(block.timestamp, lang)}
                      </td>
                      <td className="max-w-[280px] px-4 py-2.5">
                        <p className="truncate text-[11px] text-foreground" title={block.file_path}>
                          {basename(block.file_path)}
                        </p>
                        <p
                          className="truncate text-[9px] text-muted-foreground"
                          title={block.file_path}
                        >
                          {dirname(block.file_path)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={ACTION_TONE[block.action] ?? 'muted'}>{block.action}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <QuarantineBadge block={block} />
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-2.5 font-mono text-[9px] text-muted-foreground/80"
                        title={block.block_hash}
                      >
                        {shortHash(block.block_hash, 6, 5)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedBlock(block);
                          }}
                          className="rounded-md border border-border bg-surface px-2 py-1 text-[9px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                        >
                          {t('common.detail')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<FileSearch className="h-7 w-7" />}
                      title={search || filter !== 'ALL' ? t('audit.noMatch') : t('audit.emptyLedger')}
                      description={
                        search || filter !== 'ALL'
                          ? t('audit.noMatchDesc')
                          : t('audit.emptyLedgerDesc')
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && totalPages > 1 && (
          <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {t('audit.showing', {
                from: (page - 1) * limit + 1,
                to: Math.min(page * limit, data.total),
                total: data.total,
              })}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                aria-label={t('audit.prevPage')}
                className="px-2"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 font-mono text-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                aria-label={t('audit.nextPage')}
                className="px-2"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
        <Link2 className="h-3 w-3" />
        {t('audit.ledgerNote')}
      </p>

      {selectedBlock && (
        <BlockDrawer
          block={selectedBlock}
          isAuditor={isAuditor}
          onClose={() => setSelectedBlock(null)}
          onRelease={() => setReleaseTarget(selectedBlock)}
        />
      )}

      <ConfirmDialog
        open={!!releaseTarget}
        title={t('audit.releaseTitle')}
        description={
          <>
            {t('audit.releaseDesc')}
            <span className="mt-2 block truncate rounded border border-border bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
              {releaseTarget?.file_path}
            </span>
          </>
        }
        confirmLabel={t('audit.releaseConfirm')}
        tone="warning"
        busy={releasing}
        onConfirm={handleRelease}
        onClose={() => !releasing && setReleaseTarget(null)}
      />

      {toast && <Toast message={toast.text} tone={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function QuarantineBadge({ block }: { block: Block }) {
  const { t } = useI18n();
  if (block.action === 'DELETED') {
    return <span className="text-[10px] text-muted-foreground/50">—</span>;
  }
  if (block.quarantined) {
    return (
      <Badge tone="warning" icon={<Lock className="h-2.5 w-2.5" />}>
        {t('audit.quarantined')}
      </Badge>
    );
  }
  if (block.quarantine_err) {
    return (
      <Badge tone="danger" icon={<AlertTriangle className="h-2.5 w-2.5" />}>
        {t('audit.failed')}
      </Badge>
    );
  }
  return <span className="text-[10px] text-muted-foreground/50">—</span>;
}

function BlockDrawer({
  block,
  isAuditor,
  onClose,
  onRelease,
}: {
  block: Block;
  isAuditor: boolean;
  onClose: () => void;
  onRelease: () => void;
}) {
  const { t, lang } = useI18n();
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    asideRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <aside
        ref={asideRef}
        tabIndex={-1}
        className="animate-slide-in flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl outline-none"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${t('audit.detailBlock')} ${block.id}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {t('audit.detailBlock')}
            </p>
            <h2 className="mt-1 font-mono text-sm font-semibold text-accent">{block.id}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={ACTION_TONE[block.action] ?? 'muted'}>{block.action}</Badge>
              <span className="text-[10px] text-muted-foreground">
                {formatDateTime(block.timestamp, lang)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section>
            <SectionLabel>{t('audit.file')}</SectionLabel>
            <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-border bg-background/50 p-2.5">
              <p className="min-w-0 flex-1 break-all font-mono text-[10px] leading-relaxed text-foreground">
                {block.file_path}
              </p>
              <CopyButton value={block.file_path} />
            </div>
          </section>

          <section>
            <SectionLabel>{t('audit.quarantineStatus')}</SectionLabel>
            <div className="mt-1.5 flex items-center justify-between rounded-lg border border-border bg-background/50 px-2.5 py-2">
              <QuarantineBadge block={block} />
              <span className="text-[9px] text-muted-foreground">
                {block.action === 'DELETED'
                  ? t('audit.fileGone')
                  : block.quarantined
                    ? t('audit.permission000')
                    : t('audit.notQuarantined')}
              </span>
            </div>
            {block.quarantine_err && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-[10px] text-danger">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="break-all">{block.quarantine_err}</span>
              </div>
            )}
          </section>

          <section className="space-y-2.5">
            <SectionLabel>{t('audit.hashChain')}</SectionLabel>
            <HashRow label={t('audit.oldHash')} value={block.old_hash} />
            <HashRow label={t('audit.newHash')} value={block.new_hash} />
            <HashRow label={t('audit.prevBlock')} value={block.prev_block_hash} />
            <HashRow label={t('audit.blockHash')} value={block.block_hash} />
          </section>

          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
              <Link2 className="h-3 w-3 text-accent" />
              {t('audit.integrityChain')}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {t('audit.integrityChainDesc')}
            </p>
          </div>
        </div>

        {!isAuditor && block.quarantined && block.action !== 'DELETED' && (
          <div className="border-t border-border px-5 py-4">
            <Button
              variant="secondary"
              icon={<Unlock className="h-3.5 w-3.5" />}
              onClick={onRelease}
              className="w-full"
            >
              {t('audit.releaseBtn')}
            </Button>
          </div>
        )}
        {isAuditor && block.quarantined && (
          <div className="border-t border-border px-5 py-4 text-center text-[10px] text-muted-foreground">
            {t('audit.auditorReadOnly')}
          </div>
        )}
      </aside>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {value && <CopyButton value={value} />}
      </div>
      <p className="mt-1 break-all font-mono text-[9px] leading-relaxed text-foreground/80">
        {value || '—'}
      </p>
    </div>
  );
}
