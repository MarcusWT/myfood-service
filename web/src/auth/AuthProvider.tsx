import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/api/client';
import { onUnauthorized, session } from './session';

export interface User {
  id: string;
  email: string;
}

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(() =>
    session.getToken() ? 'loading' : 'unauthenticated',
  );

  const clear = useCallback(() => {
    session.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Validate a stored token on load.
  useEffect(() => {
    if (!session.getToken()) return;
    let cancelled = false;
    api
      .GET('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setUser(data);
          setStatus('authenticated');
        } else clear();
      })
      .catch(() => {
        // 401 (expired/invalid), network, or server error: end the session; user can log in again.
        if (!cancelled) clear();
      });
    return () => {
      cancelled = true;
    };
  }, [clear]);

  // Any 401 from a protected endpoint ends the session.
  useEffect(() => onUnauthorized(clear), [clear]);

  const establish = useCallback((token: string, u: User) => {
    session.setToken(token);
    setUser(u);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.POST('/auth/login', { body: { email, password } });
      if (data) establish(data.token, data.user);
    },
    [establish],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.POST('/auth/register', { body: { email, password } });
      if (data) establish(data.token, data.user);
    },
    [establish],
  );

  const value = useMemo(
    () => ({ status, user, login, register, logout: clear }),
    [status, user, login, register, clear],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
