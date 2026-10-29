import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export type UserRole = 'super_admin' | 'auditor';

interface AuthContextType {
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAuditor: boolean;
  isAdmin: boolean;
  login: (token: string, role?: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

function getValidToken(): string | null {
  const stored = localStorage.getItem('fim_token');
  if (!stored) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(stored.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('fim_token');
      localStorage.removeItem('fim_role');
      return null;
    }
    return stored;
  } catch {
    localStorage.removeItem('fim_token');
    localStorage.removeItem('fim_role');
    return null;
  }
}

function getStoredRole(token: string | null): UserRole | null {
  // Prioritas: localStorage (dari respons login) → klaim JWT.
  // Tidak ada fallback default: role tak dikenal = tidak diberi hak admin.
  const stored = localStorage.getItem('fim_role');
  if (stored === 'super_admin' || stored === 'auditor') return stored;
  if (!token) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1]));
    if (payload.role === 'auditor' || payload.role === 'super_admin') {
      return payload.role as UserRole;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getValidToken);
  const [role, setRole] = useState<UserRole | null>(() =>
    getStoredRole(localStorage.getItem('fim_token')),
  );

  const isAuthenticated = !!token;
  const isAuditor = role === 'auditor';
  // Fail-closed: hanya role super_admin yang dianggap admin.
  const isAdmin = role === 'super_admin';

  const login = useCallback((newToken: string, newRole?: UserRole) => {
    localStorage.setItem('fim_token', newToken);
    // Role dari respons login; fallback decode JWT.
    let r: UserRole | null = newRole ?? null;
    if (!r) {
      try {
        const payload = JSON.parse(decodeBase64Url(newToken.split('.')[1]));
        if (payload.role === 'auditor' || payload.role === 'super_admin') {
          r = payload.role;
        }
      } catch {
        /* ignore */
      }
    }
    if (r) {
      localStorage.setItem('fim_role', r);
    } else {
      localStorage.removeItem('fim_role');
    }
    setToken(newToken);
    setRole(r);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fim_token');
    localStorage.removeItem('fim_role');
    setToken(null);
    setRole(null);
  }, []);

  // Dipancarkan oleh interceptor Axios dan klien SSE saat token ditolak.
  // Tanpa listener ini token terhapus di localStorage tetapi state React
  // tetap "login", sehingga UI menampilkan 401 berulang.
  useEffect(() => {
    const onLogout = () => logout();
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ token, role, isAuthenticated, isAuditor, isAdmin, login, logout }}>
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
