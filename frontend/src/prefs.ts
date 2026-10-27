import { useState } from 'react';

/** Per-device boolean preference persisted in localStorage. */
export function usePref(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const k = `vg.pref.${key}`;
  const read = () => { try { const v = localStorage.getItem(k); return v === null ? def : v === '1'; } catch { return def; } };
  const [v, set] = useState<boolean>(read);
  return [v, (x: boolean) => { set(x); try { localStorage.setItem(k, x ? '1' : '0'); } catch { /* ignore */ } }];
}
export const readPref = (key: string, def: boolean) => { try { const v = localStorage.getItem(`vg.pref.${key}`); return v === null ? def : v === '1'; } catch { return def; } };
