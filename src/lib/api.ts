import axios from 'axios';

// withCredentials: true membuat browser mengirim cookie sesi HttpOnly pada
// setiap request /api/v1 (same-origin lewat proxy Nginx maupun dev Vite).
// Sejak v1.1.0 tidak ada lagi header Authorization: token tidak pernah
// menyentuh JavaScript, jadi tidak ada yang bisa dicuri lewat XSS.
const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 pada /auth/me atau /auth/logout sudah ditangani langsung oleh
    // AuthProvider (cek sesi awal / keluar); jangan memancarkan
    // auth:logout lagi dari sini, karena itu akan memicu loop.
    const url = (error.config?.url ?? '') as string;
    if (error.response?.status === 401 && !url.includes('/auth/me') && !url.includes('/auth/logout')) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

// ---------- Auth + RBAC ----------
// Login TIDAK mengembalikan token (sejak v1.1.0): server menulis cookie
// HttpOnly, dan respons hanya berisi role + username + expires_at.
export const login = (username: string, password: string) =>
  api.post('/secure-gate', { username, password });

// Mengembalikan identitas pemilik cookie sesi (dipakai AuthProvider untuk
// memulihkan sesi setelah refresh halaman).
export const getMe = () => api.get('/auth/me');

// Menghapus cookie sesi di server; state lokal selalu dibersihkan oleh
// AuthProvider walau request ini gagal.
export const logout = () => api.post('/auth/logout');

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
// Daftar berkas yang sedang dikarantina (v1.3.0). original_mode adalah
// izin yang akan dipulihkan saat pelepasan (null bila tidak tercatat),
// current_mode adalah izin berkas saat ini di disk.
export interface QuarantinedFile {
  file_path: string;
  original_mode: string | null;
  current_mode: string | null;
  exists: boolean;
}

export const getQuarantinedList = () =>
  api.get<{ files: QuarantinedFile[]; count: number }>('/quarantine/list');

export interface ReleaseResult {
  message: string;
  restored_mode: string;
  restored_original: boolean;
  audited: boolean;
}

export const releaseQuarantine = (filePath: string) =>
  api.post<ReleaseResult>('/quarantine/release', { file_path: filePath });

// ---------- Backup ----------
export const runBackup = () => api.post('/backup/run');

// ---------- Telegram ----------
export const testTelegram = (payload?: {
  telegram_token?: string;
  telegram_chat_id?: string;
}) => api.post('/telegram/test', payload ?? {});

export default api;
