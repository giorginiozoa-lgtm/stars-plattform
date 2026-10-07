// Auth-Context: haelt die angemeldete Person, kapselt Login/Logout/Registrierung.
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setToken, getToken } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<{ pending: boolean; message?: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.get<{ user: User }>('/auth/me');
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    setToken(token);
    setUser(user);
  }

  // Neue Konten warten in der Regel auf die Freigabe durch stars (kein Token).
  async function register(data: Record<string, unknown>) {
    const r = await api.post<{ token?: string; user?: User; pending?: boolean; message?: string }>('/auth/register', data);
    if (r.pending || !r.token) return { pending: true, message: r.message };
    setToken(r.token);
    setUser(r.user!);
    return { pending: false };
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh: loadMe }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
