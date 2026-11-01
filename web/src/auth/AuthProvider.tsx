import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import { onUnauthorized, session } from './session';

export interface User {
  id: string;
  email: string;
}

type Status = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  expired: boolean;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [expired, setExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>(() =>
    session.getToken() ? 'loading' : 'unauthenticated',
  );

  const clear = useCallback(
    (wasExpired = false) => {
      session.clear();
      queryClient.clear();
      setUser(null);
      setExpired(wasExpired);
      setStatus('unauthenticated');
    },
    [queryClient],
  );

  const logout = useCallback(() => clear(false), [clear]);

  // Validate a stored token on load. Only a 401 ends the session; network/5xx keep it.
  useEffect(() => {
    if (!session.getToken()) return;
    let cancelled = false;
    api
      .GET('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        if (!session.getToken()) {
          clear();
          return;
        }
        if (data) {
          setUser(data);
          setStatus('authenticated');
        } else clear(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) clear(true);
        else setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [clear, attempt]);

  // Any 401 from a protected endpoint ends the session.
  useEffect(
    () =>
      onUnauthorized(() => {
        if (session.getToken()) clear(true);
      }),
    [clear],
  );

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const establish = useCallback((token: string, u: User) => {
    session.setToken(token);
    setUser(u);
    setExpired(false);
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
    () => ({ status, user, login, register, logout, expired, retry }),
    [status, user, login, register, logout, expired, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
