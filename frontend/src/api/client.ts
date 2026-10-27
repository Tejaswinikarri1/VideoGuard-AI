import axios from 'axios';
import type { Envelope } from './types';

export const TOKEN_KEY = 'vg.token';
export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
export const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function storeToken(token: string, remember: boolean) {
  clearToken();
  try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

/** Expired/invalid session: drop the token and return to sign-in (login page explains why). */
api.interceptors.response.use((r) => r, (err) => {
  const code = err?.response?.data?.error?.code;
  if (err?.response?.status === 401 && (code === 'AUTH_TOKEN_EXPIRED' || code === 'AUTH_REQUIRED') && !location.pathname.startsWith('/login')) {
    clearToken();
    location.assign('/login?expired=1');
  }
  return Promise.reject(err);
});

export async function unwrap<T>(p: Promise<{ data: Envelope<T> }>): Promise<T> {
  const r = await p;
  return r.data.data as T;
}

export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return 'Cannot reach the server. Check your connection and try again.';
    if (e.response.status === 403) return 'You do not have permission to do that.';
    return (e.response.data as Envelope<unknown> | undefined)?.error?.message ?? fallback;
  }
  return fallback;
}
