import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler, User } from './api';

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return setReady(true);
    api
      .get<{ user: User }>('auth/me')
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [logout]);

  const login = async (email: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>('auth/login', { email, password });
    setToken(r.token);
    setUser(r.user);
  };

  return <Ctx.Provider value={{ user, ready, login, logout, setUser }}>{children}</Ctx.Provider>;
}
