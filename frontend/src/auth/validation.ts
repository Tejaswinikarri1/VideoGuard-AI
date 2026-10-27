const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_HINT = 'Minimum 10 characters, including one uppercase, one lowercase and one number.';

export function validateEmail(v: string): string | null {
  if (!v.trim()) return 'Email is required.';
  return EMAIL.test(v.trim()) ? null : 'Enter a valid email address.';
}
export function validatePassword(v: string): string | null {
  if (v.length < 10) return 'Password must be at least 10 characters.';
  if (!/[A-Z]/.test(v) || !/[a-z]/.test(v) || !/[0-9]/.test(v)) return 'Include one uppercase letter, one lowercase letter and one number.';
  return null;
}
export interface RegisterForm { name: string; email: string; password: string; confirm: string; agree: boolean }
export function validateRegister(f: RegisterForm): Partial<Record<keyof RegisterForm, string>> {
  const e: Partial<Record<keyof RegisterForm, string>> = {};
  if (!f.name.trim()) e.name = 'Full name is required.';
  const em = validateEmail(f.email); if (em) e.email = em;
  const pw = validatePassword(f.password); if (pw) e.password = pw;
  if (f.confirm !== f.password) e.confirm = 'Passwords do not match.';
  if (!f.agree) e.agree = 'You must accept the terms to continue.';
  return e;
}
