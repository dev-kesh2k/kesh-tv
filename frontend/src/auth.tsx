import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, getToken, setToken, setUnauthorizedHandler, User } from './api';

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
  /** Sem internet ao abrir: a sessão continua guardada; mostra "Sem conexão" em vez do login. */
  offline: boolean;
  retry: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return setReady(true);
    api
      .get<{ user: User }>('auth/me')
      .then((r) => {
        setUser(r.user);
        setOffline(false);
      })
      .catch((e) => setOffline(e instanceof ApiError && e.status === 0))
      .finally(() => setReady(true));
  }, [logout, attempt]);

  // Voltou a internet: tenta de novo sozinho.
  useEffect(() => {
    if (!offline) return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [offline, retry]);

  const login = async (email: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>('auth/login', { email, password });
    setToken(r.token);
    setUser(r.user);
  };

  return <Ctx.Provider value={{ user, ready, login, logout, setUser, offline, retry }}>{children}</Ctx.Provider>;
}
