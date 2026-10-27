import { api, unwrap } from './client';
import type * as T from './types';

const qs = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const getConfig = () => unwrap<T.AppConfig>(api.get('/config'));
export const getMe = () => unwrap<T.UserDto>(api.get('/auth/me'));
export const updateProfile = (b: { displayName: string; phone?: string }) => unwrap<T.UserDto>(api.patch('/auth/me', b));
export const changePassword = (b: { currentPassword: string; newPassword: string }) => api.post('/auth/password', b);
export const systemStatus = () => unwrap<{ backend: string; aiService: string; version: string }>(api.get('/config/status'));
export const dashboard = (days: number) => unwrap<T.DashboardSummary>(api.get('/dashboard/summary', { params: { days } }));

export const listVideos = (p: { q?: string; status?: string; sort?: string; page?: number; size?: number }) => unwrap<T.Page<T.Video>>(api.get('/videos', { params: qs(p) }));
export const getVideo = (id: string) => unwrap<T.Video>(api.get(`/videos/${id}`));
export const patchVideo = (id: string, b: { description?: string; location?: string }) => unwrap<T.Video>(api.patch(`/videos/${id}`, b));
export const deleteVideo = (id: string) => api.delete(`/videos/${id}`);
export const uploadVideo = (file: File, onProgress: (pct: number) => void, signal: AbortSignal, location?: string) => {
  const f = new FormData(); f.append('file', file); if (location?.trim()) f.append('location', location.trim());
  return unwrap<T.Video>(api.post('/videos', f, { signal, timeout: 0, onUploadProgress: (e) => onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0) }));
};

export const listZones = (videoId: string) => unwrap<T.Zone[]>(api.get(`/videos/${videoId}/zones`));
export type ZoneInput = Pick<T.Zone, 'name' | 'description' | 'color' | 'polygon' | 'enabled'>;
export const createZone = (videoId: string, z: ZoneInput) => unwrap<T.Zone>(api.post(`/videos/${videoId}/zones`, z));
export const updateZone = (videoId: string, id: string, z: ZoneInput) => unwrap<T.Zone>(api.put(`/videos/${videoId}/zones/${id}`, z));
export const deleteZone = (videoId: string, id: string) => api.delete(`/videos/${videoId}/zones/${id}`);

export const startAnalysis = (videoId: string, key: string) => unwrap<T.Analysis>(api.post(`/videos/${videoId}/analyses`, null, { headers: { 'Idempotency-Key': key } }));
export const videoAnalyses = (videoId: string) => unwrap<T.Analysis[]>(api.get(`/videos/${videoId}/analyses`));
export const listAnalyses = (p: { status?: string; page?: number; size?: number }) => unwrap<T.Page<T.Analysis>>(api.get('/analyses', { params: qs(p) }));
export const getAnalysis = (id: string) => unwrap<T.Analysis>(api.get(`/analyses/${id}`));
export const analysisLogs = (id: string) => unwrap<string[]>(api.get(`/analyses/${id}/logs`));
export const cancelAnalysis = (id: string) => unwrap<T.Analysis>(api.post(`/analyses/${id}/cancel`));

export const analysisEvents = (id: string, p: { type?: string; severity?: string; status?: string; q?: string }) => unwrap<T.EventItem[]>(api.get(`/analyses/${id}/events`, { params: qs(p) }));
export const searchEvents = (p: { type?: string; severity?: string; status?: string; q?: string; page?: number; size?: number }) => unwrap<T.Page<T.EventItem>>(api.get('/events', { params: qs(p) }));
export const pendingCount = () => unwrap<number>(api.get('/events/pending-count'));
export const submitReview = (id: string, decision: string, notes: string) => unwrap<T.EventItem>(api.post(`/events/${id}/reviews`, { decision, notes }));
export const eventReviews = (id: string) => unwrap<T.Review[]>(api.get(`/events/${id}/reviews`));

export const mediaToken = (kind: string, id: string) => unwrap<T.MediaToken>(api.post('/media-tokens', { kind, id }));

export const adminUsers = (p: { q?: string; role?: string; status?: string; sort?: string; page?: number; size?: number }) => unwrap<T.Page<T.UserDto>>(api.get('/admin/users', { params: qs(p) }));
export const adminCreateUser = (b: { displayName: string; email: string; password: string; roles: string[] }) => unwrap<T.UserDto>(api.post('/admin/users', b));
export const adminUpdateUser = (id: string, b: { roles?: string[]; active?: boolean; notes?: string; phone?: string }) => unwrap<T.UserDto>(api.patch(`/admin/users/${id}`, b));
export type AuditFilters = { from?: string; to?: string; actor?: string; action?: string; outcome?: string; resourceType?: string; resourceId?: string };
export const adminAudit = (p: AuditFilters & { page?: number; size?: number }) => unwrap<T.Page<T.AuditLog>>(api.get('/admin/audit-logs', { params: qs(p) }));
export const adminAuditActions = () => unwrap<string[]>(api.get('/admin/audit-logs/actions'));
export const adminJobs = (p: { status?: string; page?: number; size?: number }) => unwrap<T.Page<T.Analysis>>(api.get('/admin/jobs', { params: qs(p) }));
export const adminSystem = () => unwrap<Record<string, any>>(api.get('/admin/system'));

/** Authenticated file download (CSV) without exposing a public URL. */
export async function download(path: string, params: Record<string, unknown>, filename: string) {
  const r = await api.get(path, { params: qs(params), responseType: 'blob' });
  const url = URL.createObjectURL(r.data as Blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
