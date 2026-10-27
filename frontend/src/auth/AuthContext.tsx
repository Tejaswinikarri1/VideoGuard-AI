import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, storeToken } from '../api/client';
import * as authApi from '../api/auth';
import { getMe } from '../api/endpoints';
import type { UserDto } from '../api/types';

interface AuthState { user: UserDto | null; authenticated: boolean; loading: boolean; signIn: (e: string, p: string, remember: boolean) => Promise<void>;
  signUp: (n: string, e: string, p: string) => Promise<void>; signOut: () => void; has: (role: string) => boolean; updateUser: (u: UserDto) => void }
const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [token, setTok] = useState<string | null>(getToken());
  const [loading, setLoading] = useState<boolean>(!!getToken());

  useEffect(() => {
    if (!token || user) { setLoading(false); return; }
    let live = true;
    getMe().then((u) => live && setUser(u)).catch(() => { clearToken(); if (live) setTok(null); }).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [token, user]);

  const accept = useCallback((r: authApi.AuthResult, remember: boolean) => { storeToken(r.accessToken, remember); setTok(r.accessToken); setUser(r.user as unknown as UserDto); }, []);
  return (
    <Ctx.Provider value={{ user, authenticated: !!token, loading,
      signIn: async (e, p, remember) => accept(await authApi.login(e, p), remember),
      signUp: async (n, e, p) => accept(await authApi.register(n, e, p), false),
      signOut: () => { api.post('/auth/logout').catch(() => undefined).finally(() => { clearToken(); setTok(null); setUser(null); }); },
      has: (role) => !!user?.roles.includes(role as never), updateUser: setUser }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
