import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import * as ep from '../api/endpoints';
import type { Analysis, DashboardSummary, EventItem } from '../api/types';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { ReviewDialog } from '../components/ReviewDialog';
import { Timeline } from '../components/Timeline';
import { bytes, clock, duration, eta } from '../fmt';
import Dashboard from '../pages/Dashboard';
import { ThemeProvider } from '../theme/ThemeContext';

const ev: EventItem = { id: 'e1', analysisId: 'a1', videoId: 'v1', videoName: 'x.mp4', trackId: 3, eventType: 'SUDDEN_RUNNING', startTimeSeconds: 12, endTimeSeconds: 14, confidence: 0.87, severity: 'HIGH',
  description: 'Tracked person moved rapidly for approximately 2.0 seconds.', hasEvidence: false, reviewStatus: 'PENDING', trajectory: [], createdAt: '2026-01-01T00:00:00Z' };

const shell = (ui: ReactElement, route = '/') => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ThemeProvider><AuthProvider><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></AuthProvider></ThemeProvider></QueryClientProvider>);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });

describe('formatters', () => {
  it('formats durations, clocks and sizes', () => {
    expect(duration(8130)).toBe('02:15:30'); expect(duration(null)).toBe('--:--:--');
    expect(clock(41.67, true)).toBe('00:00:41.67'); expect(bytes(1536)).toBe('1.5 KB');
  });
  it('does not invent an ETA without progress signal', () => { expect(eta(undefined, 50)).toBe('—'); expect(eta(new Date().toISOString(), 1)).toBe('—'); });
});

describe('routing & auth', () => {
  it('redirects signed-out users to the sign-in page', async () => {
    shell(<App />, '/videos');
    expect(await screen.findByText('Welcome Back')).toBeInTheDocument();
  });
});

describe('Dashboard', () => {
  it('shows recent real jobs when there are no active analyses', async () => {
    const recentJob: Analysis = {
      id: 'a1', videoId: 'v1', videoName: 'warehouse.mp4', videoSizeBytes: 1024, requestedBy: 'u1',
      status: 'COMPLETED', stage: 'PERSISTING_RESULTS', progressPercent: 100, stageProgressPercent: 100,
      attempt: 1, createdAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z',
      eventCount: 0, zoneCount: 0, stageTimings: [], eventSummary: {},
    };
    const summary: DashboardSummary = {
      totalVideos: { value: 0, deltaPercent: null }, totalAnalyses: { value: 1, deltaPercent: null },
      detectedEvents: { value: 0, deltaPercent: null }, pendingReviews: { value: 0, deltaPercent: null },
      eventTypes: {}, severityTotals: {}, series: [], recentVideos: [], activeJobs: [], recentJobs: [recentJob],
      recentEvents: [], storage: { usedBytes: 0, quotaBytes: 0 }, days: 30,
    };
    vi.spyOn(ep, 'dashboard').mockResolvedValue(summary);
    shell(<Dashboard />);
    expect(await screen.findByRole('heading', { name: 'Analysis Jobs' })).toBeInTheDocument();
    expect(screen.getByText('No analyses are running. Showing your latest jobs.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'warehouse.mp4' })).toHaveAttribute('href', '/analyses/a1');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});

describe('Timeline', () => {
  it('renders markers from the same events and seeks on click', async () => {
    const onSeek = vi.fn(), onSelect = vi.fn();
    render(<Timeline duration={100} events={[ev]} current={0} onSeek={onSeek} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /SUDDEN_RUNNING at 00:00:12, HIGH/ }));
    expect(onSeek).toHaveBeenCalledWith(12); expect(onSelect).toHaveBeenCalledWith(ev);
  });
});

describe('ReviewDialog', () => {
  const asUser = (roles: string[]) => {
    localStorage.setItem('vg.token', 't');
    vi.spyOn(ep, 'getMe').mockResolvedValue({ id: 'u1', displayName: 'Rae', email: 'r@x.co', roles: roles as never, active: true, createdAt: '2026-01-01T00:00:00Z' });
    vi.spyOn(ep, 'eventReviews').mockResolvedValue([]);
  };
  it('allows regular users to submit review decisions', async () => {
    asUser(['USER']);
    const submit = vi.spyOn(ep, 'submitReview').mockResolvedValue({ ...ev, reviewStatus: 'UNCERTAIN' });
    shell(<ReviewDialog event={ev} onClose={() => {}} />);
    const btn = await screen.findByRole('button', { name: 'Submit Review' });
    await waitFor(() => expect(screen.getByRole('radio', { name: /UNCERTAIN/ })).toBeEnabled());
    expect(screen.queryByText(/Only users with the Analyst role/)).not.toBeInTheDocument();
    expect(btn).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /UNCERTAIN/ }));
    await userEvent.type(screen.getByLabelText(/Reviewer Notes/), 'Not clear');
    await userEvent.click(btn);
    await waitFor(() => expect(submit).toHaveBeenCalledWith('e1', 'UNCERTAIN', 'Not clear'));
  });
});
