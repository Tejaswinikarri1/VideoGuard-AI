import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import * as ep from '../api/endpoints';
import { AuthProvider } from '../auth/AuthContext';
import { Pagination } from '../components/ui';
import { ToastProvider } from '../components/Toast';
import { avatarColor, initials } from '../fmt';
import SettingsPage from '../pages/Settings';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

const me = { id: 'u1', displayName: 'Rae Chen', email: 'rae@x.co', roles: ['USER', 'ANALYST'] as never, active: true, createdAt: '2026-01-01T00:00:00Z' };
const shell = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ThemeProvider><ToastProvider><AuthProvider><MemoryRouter>{ui}</MemoryRouter></AuthProvider></ToastProvider></ThemeProvider></QueryClientProvider>);
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); localStorage.setItem('vg.token', 't'); vi.spyOn(ep, 'getMe').mockResolvedValue(me); vi.spyOn(ep, 'systemStatus').mockResolvedValue({ backend: 'UP', aiService: 'UP', version: '1.0.0' }); });

describe('Settings', () => {
  it('profile save is disabled until something changes, then sends the change', async () => {
    const upd = vi.spyOn(ep, 'updateProfile').mockResolvedValue({ ...me, displayName: 'Rae C' });
    shell(<SettingsPage />);
    const save = await screen.findByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    const name = await screen.findByDisplayValue('Rae Chen');
    await userEvent.clear(name); await userEvent.type(name, 'Rae C');
    expect(save).toBeEnabled();
    await userEvent.click(save);
    await waitFor(() => expect(upd).toHaveBeenCalledWith({ displayName: 'Rae C', phone: '' }));
  });
  it('email is read-only', async () => {
    shell(<SettingsPage />);
    expect(await screen.findByDisplayValue('rae@x.co')).toBeDisabled();
  });
  it('password form enforces the policy and match before enabling submit', async () => {
    const ch = vi.spyOn(ep, 'changePassword').mockResolvedValue({} as never);
    shell(<SettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Security/ }));
    const btn = screen.getByRole('button', { name: 'Update password' });
    await userEvent.type(screen.getByLabelText('Current password'), 'OldPassw0rd!');
    await userEvent.type(screen.getByLabelText('New password'), 'weak');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'weak');
    expect(btn).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('New password')); await userEvent.clear(screen.getByLabelText('Confirm new password'));
    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPassw0rd');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'BrandNewPassw0rd');
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    await waitFor(() => expect(ch).toHaveBeenCalledWith({ currentPassword: 'OldPassw0rd!', newPassword: 'BrandNewPassw0rd' }));
  });
  it('theme choice (incl. system) persists', async () => {
    function Probe() { const { theme } = useTheme(); return <span data-testid="t">{theme}</span>; }
    shell(<><Probe /><SettingsPage /></>);
    await userEvent.click(await screen.findByRole('button', { name: /Appearance/ }));
    await userEvent.click(screen.getByRole('radio', { name: /System/ }));
    expect(screen.getByTestId('t')).toHaveTextContent('system');
    expect(localStorage.getItem('vg.theme')).toBe('system');
  });
  it('notification preference is stored per device', async () => {
    shell(<SettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    const sw = screen.getByRole('switch', { name: 'Analysis notifications' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    expect(localStorage.getItem('vg.pref.notifyAnalysis')).toBe('0');
  });
});

describe('helpers', () => {
  it('initials handle punctuation and the AI service actor', () => {
    expect(initials('John Doe')).toBe('JD'); expect(initials('System (AI Service)')).toBe('AI'); expect(initials('')).toBe('?');
  });
  it('avatar colour is stable per name', () => { expect(avatarColor('Jane')).toBe(avatarColor('Jane')); });
  it('pagination shows an ellipsis and the last page for long lists', async () => {
    const go = vi.fn();
    render(<Pagination page={0} size={8} total={240} onPage={go} label="events" />);
    expect(screen.getByText('…')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '30' }));
    expect(go).toHaveBeenCalledWith(29);
  });
});
