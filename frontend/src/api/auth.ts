import axios from 'axios';
import { api } from './client';

export interface AuthResult { accessToken: string; user: { id: string; displayName: string; email: string; roles: string[] } }
interface Envelope<T> { data: T | null; error: { code: string; message: string } | null }

/** Maps transport/HTTP failures to user-safe messages. Never reveals whether an email exists. */
export function authErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return 'Cannot reach the server. Check that the backend is running and try again.';
    if (e.response.status === 401) return 'Invalid email or password.';
    if (e.response.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (e.response.status === 400 || e.response.status === 409) return e.response.data?.error?.message ?? 'Please check your details and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const r = await api.post<Envelope<AuthResult>>('/auth/login', { email, password });
  if (!r.data.data) throw new Error('Empty response');
  return r.data.data;
}
export async function register(displayName: string, email: string, password: string): Promise<AuthResult> {
  const r = await api.post<Envelope<AuthResult>>('/auth/register', { displayName, email, password });
  if (!r.data.data) throw new Error('Empty response');
  return r.data.data;
}
