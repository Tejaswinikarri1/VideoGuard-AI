import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeChoice = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';
const KEY = 'vg.theme';
interface Ctx { theme: ThemeChoice; resolved: Theme; setTheme: (t: ThemeChoice) => void }
const C = createContext<Ctx>({ theme: 'dark', resolved: 'dark', setTheme: () => {} });

function initial(): ThemeChoice {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'system' ? v : 'dark'; } catch { return 'dark'; }
}
const systemPref = (): Theme => (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(initial);
  const [sys, setSys] = useState<Theme>(systemPref);
  const resolved: Theme = theme === 'system' ? sys : theme;
  useEffect(() => { document.documentElement.setAttribute('data-theme', resolved); }, [resolved]);
  useEffect(() => {
    if (theme !== 'system' || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    const h = () => setSys(mq.matches ? 'light' : 'dark');
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, [theme]);
  const setTheme = (t: ThemeChoice) => { setThemeState(t); try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ } };
  return <C.Provider value={{ theme, resolved, setTheme }}>{children}</C.Provider>;
}
export const useTheme = () => useContext(C);
