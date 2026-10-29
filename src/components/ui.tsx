import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Spinner className="h-5 w-5 text-accent" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40',
  secondary:
    'border-border bg-surface text-foreground hover:border-border-strong hover:bg-white/[0.04] focus-visible:ring-white/20',
  ghost:
    'border-transparent bg-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-white/20',
  danger:
    'border-danger/30 bg-danger/10 text-danger hover:border-danger/50 hover:bg-danger/15 focus-visible:ring-danger/30',
  success:
    'border-success/30 bg-success/10 text-success hover:border-success/50 hover:bg-success/15 focus-visible:ring-success/30',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-[11px]',
  md: 'px-3.5 py-2 text-xs',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : icon}
      {children}
    </button>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'muted';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'border-border bg-white/[0.04] text-foreground',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  success: 'border-success/30 bg-success/10 text-success',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/30 bg-info/10 text-info',
  muted: 'border-border bg-transparent text-muted-foreground',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className = '',
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgeTones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
  padded = true,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-border bg-card ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex items-start gap-2.5">
            {icon && <span className="mt-0.5 text-accent">{icon}</span>}
            <div>
              {title && (
                <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
              )}
              {description && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={`${padded ? 'p-4 sm:p-5' : ''} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className = '',
}: {
  label?: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          {label}
        </label>
      )}
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-muted-foreground/60">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

type ToastTone = 'success' | 'error' | 'info';

const toastStyles: Record<ToastTone, { border: string; icon: ReactNode }> = {
  success: { border: 'border-success/30', icon: <CheckCircle2 className="h-4 w-4 text-success" /> },
  error: { border: 'border-danger/30', icon: <XCircle className="h-4 w-4 text-danger" /> },
  info: { border: 'border-info/30', icon: <Info className="h-4 w-4 text-info" /> },
};

export function Toast({
  message,
  tone = 'success',
  onClose,
}: {
  message: string;
  tone?: ToastTone;
  onClose: () => void;
}) {
  const style = toastStyles[tone];
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-rise fixed bottom-5 right-5 z-[70] flex max-w-sm items-start gap-2.5 rounded-lg border ${style.border} bg-surface-strong px-3.5 py-3 text-xs text-foreground shadow-2xl`}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <span className="leading-relaxed">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t('common.close')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'accent';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const toneStyles = {
    danger: { icon: 'border-danger/30 bg-danger/10 text-danger', button: 'primary' as const },
    warning: { icon: 'border-warning/30 bg-warning/10 text-warning', button: 'primary' as const },
    accent: { icon: 'border-accent/30 bg-accent/10 text-accent', button: 'primary' as const },
  }[tone];

  return (
    <div
      className="animate-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={() => !busy && onClose()}
      role="presentation"
    >
      <div
        className="animate-rise w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-lg border p-2 ${toneStyles.icon}`}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy} autoFocus>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={busy}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);
  const { t } = useI18n();

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-surface text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground ${className}`}
      title={copied ? t('common.copied') : t('common.copy')}
      aria-label={copied ? t('common.copied') : t('common.copy')}
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
