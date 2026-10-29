import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fim_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fim_token');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

// ---------- Auth + RBAC ----------
export const login = (username: string, password: string) =>
  api.post('/secure-gate', { username, password });

export const setupPassword = (username: string, password: string) =>
  api.post('/setup', { username, password });

// Membuat akun Auditor (read-only). Hanya Super Admin.
export const setupAuditor = (username: string, password: string) =>
  api.post('/setup/auditor', { username, password });

// ---------- Dashboard ----------
export const getStats = () => api.get('/dashboard/stats');
export const getStatus = () => api.get('/dashboard/status');

// ---------- Ledger ----------
export type BlockAction = 'MODIFIED' | 'CREATED' | 'DELETED' | 'UNREADABLE' | 'RELEASED';

export const getBlocks = (
  page: number,
  limit: number,
  search?: string,
  action?: BlockAction | 'ALL',
) =>
  api.get('/ledger/blocks', {
    params: { page, limit, search, action: action && action !== 'ALL' ? action : undefined },
  });

export const verifyChain = () => api.get('/ledger/verify');

// Ledger export → mengembalikan JSON blob (untuk unduhan file).
export const exportLedger = () =>
  api.get('/ledger/export', { responseType: 'blob' });

// ---------- System ----------
export interface SystemInfo {
  app_name: string;
  version: string;
  os: string;
  arch: string;
  go_version: string;
  started_at: string;
  uptime_sec: number;
  quarantine_mode: 'chmod_000' | 'readonly_fallback';
  watch_paths: string[];
  worker_count: number;
  scan_interval_sec: number;
  is_monitoring: boolean;
  maintenance_mode: boolean;
}

export const getSystemInfo = () => api.get<SystemInfo>('/system/info');

// ---------- Metrics ----------
export interface ScanMetric {
  timestamp: string;
  elapsed_ms: number;
  mem_alloc_bytes: number;
  mem_sys_bytes: number;
  files_scanned: number;
  anomalies: number;
  quarantined: number;
  skipped?: boolean;
  skip_reason?: string;
}

export const getMetrics = (limit = 100) =>
  api.get<{ metrics: ScanMetric[]; count: number }>('/metrics', { params: { limit } });

// ---------- Settings ----------
export const getSettings = () => api.get('/settings');
export const updateSettings = (data: {
  watch_paths?: string[];
  scan_interval_sec?: number;
  worker_count?: number;
  telegram_token?: string;
  telegram_chat_id?: string;
  backup_webhook_url?: string;
}) => api.post('/settings', data);

// ---------- Monitoring ----------
export const startMonitoring = () => api.post('/monitoring/start');
export const stopMonitoring = () => api.post('/monitoring/stop');

// ---------- Baseline ----------
export const initBaseline = () => api.post('/baseline/init');
export const updateBaseline = () => api.post('/baseline/update');

// ---------- Maintenance Mode ----------
export const enableMaintenance = () => api.post('/maintenance/enable');
export const disableMaintenance = () => api.post('/maintenance/disable');

// ---------- Quarantine ----------
export const releaseQuarantine = (filePath: string) =>
  api.post('/quarantine/release', { file_path: filePath });

// ---------- Backup ----------
export const runBackup = () => api.post('/backup/run');

// ---------- Telegram ----------
export const testTelegram = (payload?: {
  telegram_token?: string;
  telegram_chat_id?: string;
}) => api.post('/telegram/test', payload ?? {});

export default api;
