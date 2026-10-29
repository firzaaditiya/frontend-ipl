import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getMe, logout as apiLogout } from './api';

export type UserRole = 'super_admin' | 'auditor';

interface AuthContextType {
  role: UserRole | null;
  isAuthenticated: boolean;
  isAuditor: boolean;
  isAdmin: boolean;
  // ready = sesi sudah diverifikasi ke server. Selama belum ready, rute
  // terproteksi menampilkan loading, bukan langsung melempar ke login.
  ready: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isValidRole(value: unknown): value is UserRole {
  return value === 'super_admin' || value === 'auditor';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);

  const clearSession = useCallback(() => {
    setRole(null);
    setIsAuthenticated(false);
  }, []);

  const login = useCallback((newRole: UserRole) => {
    setRole(newRole);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    // Gagal logout di server (mis. cookie sudah kedaluwarsa) tidak boleh
    // menghalangi keluar: state lokal selalu dibersihkan.
    try {
      await apiLogout();
    } catch {
      /* abaikan: sesi sudah tidak valid */
    }
    clearSession();
  }, [clearSession]);

  // Satu-satunya sumber kebenaran sesi adalah cookie HttpOnly di browser,
  // yang TIDAK bisa dibaca JavaScript. Karena itu AuthProvider tidak
  // menyimpan token apa pun: saat mount, ia bertanya ke server lewat
  // GET /auth/me. Bila cookie valid, server menjawab role; bila tidak,
  // pengguna dianggap belum login.
  useEffect(() => {
    // Migrasi dari v1.0.0: hapus sisa token lama bila masih tersimpan di
    // browser pengguna, agar tidak ada token usang yang tertinggal.
    localStorage.removeItem('fim_token');
    localStorage.removeItem('fim_role');

    const onLogout = () => clearSession();
    window.addEventListener('auth:logout', onLogout);

    let cancelled = false;
    getMe()
      .then((res) => {
        if (cancelled) return;
        const nextRole: unknown = (res.data as { role?: unknown }).role;
        if (isValidRole(nextRole)) {
          setRole(nextRole);
          setIsAuthenticated(true);
        } else {
          // Fail-closed: role tak dikenal = tidak diberi hak apa pun.
          clearSession();
        }
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      window.removeEventListener('auth:logout', onLogout);
    };
  }, [clearSession]);

  const isAuditor = role === 'auditor';
  // Fail-closed: hanya role super_admin yang dianggap admin.
  const isAdmin = role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{ role, isAuthenticated, isAuditor, isAdmin, ready, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
