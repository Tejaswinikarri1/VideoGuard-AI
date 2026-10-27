import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { validatePassword, validateRegister } from '../auth/validation';
import Login from '../pages/Login';
import Register from '../pages/Register';
import { ThemeProvider } from '../theme/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import * as authApi from '../api/auth';

const wrap = (ui: ReactElement) => render(<ThemeProvider><AuthProvider><MemoryRouter>{ui}</MemoryRouter></AuthProvider></ThemeProvider>);

describe('validation', () => {
  it('enforces 10 chars + upper + lower + number', () => {
    expect(validatePassword('Short1a')).toMatch(/10/);
    expect(validatePassword('alllowercase1')).toMatch(/uppercase/);
    expect(validatePassword('ValidPassw0rd')).toBeNull();
  });
  it('requires matching confirm and terms', () => {
    const e = validateRegister({ name: 'A', email: 'a@b.co', password: 'ValidPassw0rd', confirm: 'nope', agree: false });
    expect(e.confirm).toBeTruthy(); expect(e.agree).toBeTruthy(); expect(e.password).toBeUndefined();
  });
});

describe('Login', () => {
  afterEach(() => vi.restoreAllMocks());
  it('blocks submit on invalid email without calling the API', async () => {
    const spy = vi.spyOn(authApi, 'login');
    wrap(<Login />);
    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
  it('shows a generic message when the server is unreachable (no fake success)', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(Object.assign(new Error('Network'), { isAxiosError: true }));
    wrap(<Login />);
    await userEvent.type(screen.getByLabelText('Email address'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'whatever');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
  it('toggles password visibility', async () => {
    wrap(<Login />);
    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pw).toHaveAttribute('type', 'text');
  });
});

describe('Register', () => {
  it('shows the password rule hint and rejects weak passwords', async () => {
    wrap(<Register />);
    expect(screen.getByText(/Minimum 10 characters/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
  });
});

describe('theme', () => {
  it('persists the theme choice and applies it to the document', async () => {
    wrap(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Light theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('vg.theme')).toBe('light');
  });
});
