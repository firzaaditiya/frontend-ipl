export type FormatLang = 'id' | 'en';

function localeOf(lang: FormatLang): string {
  return lang === 'en' ? 'en-US' : 'id-ID';
}

export function formatNumber(
  value: number | null | undefined,
  lang: FormatLang = 'id',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return value.toLocaleString(localeOf(lang));
}

export function formatDateTime(
  value: string | Date | null | undefined,
  lang: FormatLang = 'id',
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(localeOf(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTime(
  value: string | Date | null | undefined,
  lang: FormatLang = 'id',
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(localeOf(lang), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelative(
  value: string | Date | null | undefined,
  lang: FormatLang = 'id',
): string {
  const never = lang === 'en' ? 'never' : 'belum pernah';
  if (!value) return never;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return never;

  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (lang === 'en') {
    if (diffSeconds < 5) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDateTime(date, lang);
  }

  if (diffSeconds < 5) return 'baru saja';
  if (diffSeconds < 60) return `${diffSeconds} detik lalu`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return formatDateTime(date, lang);
}

export function formatDuration(seconds: number | null | undefined, lang: FormatLang = 'id'): string {
  if (seconds === null || seconds === undefined || seconds < 0) return '—';
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(lang === 'en' ? `${days}d` : `${days} hr`);
  if (hours > 0) parts.push(lang === 'en' ? `${hours}h` : `${hours} jam`);
  if (minutes > 0 || parts.length === 0) {
    parts.push(lang === 'en' ? `${minutes}m` : `${minutes} mnt`);
  }
  return parts.join(' ');
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(2)} MB`;
}

export function shortHash(hash: string | null | undefined, head = 8, tail = 8): string {
  if (!hash) return '—';
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function basename(path: string | null | undefined): string {
  if (!path) return '—';
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || path;
}

export function dirname(path: string | null | undefined): string {
  if (!path) return '';
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

export function errorMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  };
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

export const ACTION_LABELS: Record<string, string> = {
  MODIFIED: 'MODIFIED',
  CREATED: 'CREATED',
  DELETED: 'DELETED',
  UNREADABLE: 'UNREADABLE',
};
