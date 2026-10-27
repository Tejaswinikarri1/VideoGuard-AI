export interface Envelope<T> { data: T | null; error: { code: string; message: string } | null; requestId?: string }
export interface Page<T> { items: T[]; total: number; page: number; size: number }
export type Role = 'USER' | 'ANALYST' | 'ADMIN';
export interface UserDto { id: string; displayName: string; email: string; roles: Role[]; active: boolean; phone?: string | null; notes?: string | null; lastLoginAt?: string | null; createdAt: string }
export interface Video { id: string; ownerId: string; ownerName?: string; ownerEmail?: string; filename: string; format: string; codec?: string; sizeBytes: number;
  durationSeconds?: number; width?: number; height?: number; frameRate?: number; metadataStatus: string; metadataError?: string | null; description?: string | null; location?: string | null;
  frameCount: number; createdAt: string; analysisCount: number; latestAnalysisStatus?: string | null; latestAnalysisId?: string | null }
export interface StageTiming { stage: string; startedAt?: string; completedAt?: string }
export interface Analysis { id: string; videoId: string; videoName?: string; videoDuration?: number; videoWidth?: number; videoHeight?: number; videoFrameRate?: number; videoSizeBytes: number;
  requestedBy: string; requestedByName?: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; stage: string; progressPercent: number; stageProgressPercent: number;
  pipelineVersion?: string; modelVersion?: string; attempt: number; createdAt: string; startedAt?: string; completedAt?: string; errorCode?: string; errorMessage?: string;
  eventCount: number; zoneCount: number; stageTimings: StageTiming[]; eventSummary: Record<string, number> }
export type EventType = 'PERSON_LOITERING' | 'SUDDEN_RUNNING' | 'RESTRICTED_AREA_INTRUSION' | 'WEAPON_DETECTION' | 'FALL_DETECTED';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type ReviewStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'UNCERTAIN';
export interface EventItem { id: string; analysisId: string; videoId: string; videoName?: string; videoLocation?: string | null; trackId?: number | null; eventType: EventType; startTimeSeconds: number; endTimeSeconds: number;
  confidence: number; severity: Severity; description: string; hasEvidence: boolean; evidenceStatus?: string; reviewStatus: ReviewStatus; ruleVersion?: string;
  measurements?: Record<string, string | number | boolean>; zoneId?: string | null; trajectory: number[][]; createdAt: string; lastReviewer?: string | null; lastReviewNotes?: string | null; lastReviewedAt?: string | null }
export interface Review { id: string; eventId: string; reviewerName: string; decision: ReviewStatus; notes?: string | null; createdAt: string }
export interface Zone { id: string; videoId: string; name: string; description?: string | null; color: string; polygon: number[][]; enabled: boolean }
export interface AuditLog { id: string; actorUserId?: string; actorEmail?: string; actorName?: string; action: string; actionLabel?: string; resourceType?: string; resourceId?: string;
  outcome: 'SUCCESS' | 'FAILURE'; requestId?: string; details?: string; ip?: string; createdAt: string }
export interface Stat { value: number; deltaPercent: number | null; trend?: number[] }
export interface DashboardSummary { totalVideos: Stat; totalAnalyses: Stat; detectedEvents: Stat; pendingReviews: Stat; eventTypes: Record<string, number>; severityTotals: Record<string, number>;
  series: { date: string; HIGH: number; MEDIUM: number; LOW: number }[]; recentVideos: Video[]; activeJobs: Analysis[]; recentJobs: Analysis[]; recentEvents: EventItem[]; storage: { usedBytes: number; quotaBytes: number }; days: number }
export interface AppConfig { maxUploadBytes: number; maxDurationSeconds: number; formats: string[]; storageQuotaBytes: number }
export interface MediaToken { path: string; token: string; expiresInSeconds: number }
