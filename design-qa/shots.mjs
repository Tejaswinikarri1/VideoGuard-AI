// DESIGN-QA ONLY: intercepts /api/v1 in the browser and answers with fixtures shaped like the mockups. Not part of the product.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const BASE = 'http://127.0.0.1:5173';
const img = fs.readFileSync('/home/claude/samples/bus.jpg');
const clip = fs.readFileSync('/home/claude/qa/clip.webm');
const iso = (s) => new Date(s + 'Z').toISOString();
const user = { id: 'u1', displayName: 'John Doe', email: 'john@example.com', roles: ['USER', 'ANALYST', 'ADMIN'], active: true, phone: '+1 (555) 123-4567', createdAt: iso('2024-01-15T10:23:00'), lastLoginAt: iso('2024-01-18T08:42:00') };
const V = (id, filename, d, w, h, fps, c, st, n) => ({ id, ownerId: 'u1', ownerName: 'John Doe', ownerEmail: 'user@example.com', filename, format: 'MP4', codec: 'h264', sizeBytes: 1.2e9, durationSeconds: d, width: w, height: h, frameRate: fps, metadataStatus: 'COMPLETED', description: 'Main parking lot camera facing the entrance. Covers vehicle parking area and pedestrian walkway.', frameCount: 6, createdAt: iso(c), analysisCount: n, latestAnalysisStatus: st, latestAnalysisId: 'a-' + id });
const videos = [V('v1', 'Parking_Lot_01.mp4', 8130, 1920, 1080, 30, '2024-01-15T10:23:00', 'COMPLETED', 2), V('v2', 'Entrance_Cam.mp4', 5412, 1920, 720, 30, '2024-01-14T18:45:00', 'RUNNING', 1), V('v3', 'Warehouse.mp4', 13530, 1920, 1080, 25, '2024-01-13T09:12:00', 'COMPLETED', 3),
  V('v4', 'Office_Area.mp4', 3495, 1280, 720, 30, '2024-01-13T14:20:00', 'FAILED', 1), V('v5', 'Loading_Bay.mp4', 7928, 1920, 1080, 30, '2024-01-12T11:30:00', 'COMPLETED', 2), V('v6', 'Lobby_Cam.mp4', 4845, 1280, 720, 30, '2024-01-11T16:05:00', 'RUNNING', 1)];
const stages = ['JOB_ACCEPTED', 'PREPARING_VIDEO', 'FRAME_SAMPLING', 'OBJECT_DETECTION'];
const A = (id, v, st, stage, p, extra = {}) => ({ id, videoId: v.id, videoName: v.filename, videoDuration: v.durationSeconds, videoWidth: v.width, videoHeight: v.height, videoFrameRate: v.frameRate, videoSizeBytes: 1.2e9, requestedBy: 'u1', requestedByName: 'John Doe', status: st, stage, progressPercent: p, stageProgressPercent: 65, pipelineVersion: '1.0.0', modelVersion: 'yolov8n:yolov8n.pt@f59b3d833e2f', attempt: 1, createdAt: iso('2024-01-15T10:45:12'), startedAt: iso('2024-01-15T10:45:12'), errorCode: null, zoneCount: 1, eventCount: 4, stageTimings: stages.map((s, i) => ({ stage: s, startedAt: iso('2024-01-15T10:45:12'), ...(i < 3 ? { completedAt: iso(`2024-01-15T10:4${5 + i}:30`) } : {}) })), eventSummary: {}, ...extra });
const running = A('a-run-13245', videos[0], 'RUNNING', 'OBJECT_DETECTION', 65);
const done = A('a-done-00147', videos[0], 'COMPLETED', 'COMPLETED', 100, { completedAt: iso('2024-01-15T10:55:12'), eventSummary: { total: 4, confirmed: 1, pending: 3, highSeverity: 2 }, stageTimings: [] });
const jobs = [A('j1', videos[1], 'RUNNING', 'OBJECT_DETECTION', 65), A('j2', videos[3], 'RUNNING', 'OBJECT_TRACKING', 42), A('j3', videos[4], 'RUNNING', 'ACTIVITY_ANALYSIS', 18), A('j4', videos[2], 'RUNNING', 'EVIDENCE_GENERATION', 70), A('j5', videos[5], 'RUNNING', 'FRAME_SAMPLING', 33)];
const traj = (t0) => Array.from({ length: 12 }, (_, i) => [t0 + i * 0.4, 0.45 + i * 0.01, 0.35, 0.55 + i * 0.01, 0.85]);
const E = (id, type, s, d, conf, sev, st, desc, vid = 'v1') => ({ id, analysisId: 'a-done-00147', videoId: vid, videoName: videos.find((v) => v.id === vid).filename, trackId: 12, eventType: type, startTimeSeconds: s, endTimeSeconds: s + d, confidence: conf, severity: sev, description: desc, hasEvidence: true, evidenceStatus: 'AVAILABLE', reviewStatus: st, measurements: {}, trajectory: traj(s), createdAt: iso('2024-01-15T10:55:12') });
const events = [E('e1', 'SUDDEN_RUNNING', 12, 2.1, 0.87, 'HIGH', 'PENDING', 'Tracked person moved rapidly for approximately 2.1 seconds (measured in normalized frame units, not real-world speed).'), E('e2', 'RESTRICTED_AREA_INTRUSION', 42, 8.3, 0.92, 'MEDIUM', 'PENDING', 'Tracked person entered restricted zone "North Lot" at 42.0 seconds.'),
  E('e3', 'PERSON_LOITERING', 75, 14.7, 0.79, 'LOW', 'CONFIRMED', 'Tracked person remained within a small area for approximately 14.7 seconds.'), E('e4', 'WEAPON_DETECTION', 92, 1.2, 0.95, 'HIGH', 'PENDING', "Detected 'knife' in 5 sampled frames (max confidence 0.95).")];
const page = (items) => ({ items, total: items.length, page: 0, size: 8 });
const stat = (value, d) => ({ value, deltaPercent: d });
const series = Array.from({ length: 30 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, HIGH: Math.round(8 + 6 * Math.sin(i / 3)), MEDIUM: Math.round(18 + 8 * Math.sin(i / 4 + 1)), LOW: Math.round(5 + 3 * Math.cos(i / 5)) }));
const dash = { totalVideos: stat(12, 20), totalAnalyses: stat(28, 40), detectedEvents: stat(156, -12), pendingReviews: stat(12, 33), eventTypes: { SUDDEN_RUNNING: 42, RESTRICTED_AREA_INTRUSION: 38, PERSON_LOITERING: 46, WEAPON_DETECTION: 12 }, severityTotals: { HIGH: 42, MEDIUM: 68, LOW: 46 }, series, recentVideos: videos.slice(0, 5), activeJobs: jobs, recentEvents: events, storage: { usedBytes: 428e9, quotaBytes: 1e12 }, days: 30 };
const zones = [{ id: 'z1', videoId: 'v1', name: 'Entrance', description: 'Main entrance to parking area. Unauthorized access is restricted.', color: '#2f8cff', polygon: [[0.12, 0.28], [0.42, 0.18], [0.78, 0.32], [0.82, 0.68], [0.46, 0.82], [0.18, 0.64]], enabled: true }, { id: 'z2', videoId: 'v1', name: 'Loading Bay', color: '#f5a524', polygon: [[0.6, 0.5], [0.9, 0.5], [0.9, 0.9], [0.6, 0.9]], enabled: false }, { id: 'z3', videoId: 'v1', name: 'Storage Area', color: '#8b5cf6', polygon: [[0.05, 0.6], [0.3, 0.6], [0.3, 0.95], [0.05, 0.95], [0.02, 0.8]], enabled: true }];
const U = (n, e, r, a, c) => ({ id: 'u-' + n, displayName: n, email: e, roles: r, active: a, createdAt: iso(c) });
const users = [user, U('Jane Smith', 'jane@example.com', ['USER', 'ANALYST'], true, '2024-01-14T14:45:00'), U('Michael Wilson', 'michael@example.com', ['USER'], true, '2024-01-12T09:17:00'), U('Sarah Lee', 'sarah@example.com', ['USER', 'ANALYST'], false, '2024-01-10T11:30:00')];
const L = (i, name, email, action, label, rt, rid, ok, det, t) => ({ id: 'l' + i, actorName: name, actorEmail: email, action, actionLabel: label, resourceType: rt, resourceId: rid, outcome: ok ? 'SUCCESS' : 'FAILURE', requestId: 'req_01H7K9Z3X8Q' + i, details: det, createdAt: iso(t) });
const logs = [L(1, 'John Doe', 'john@example.com', 'UPLOAD_VIDEO', 'Upload Video', 'VIDEO', 'vid_6783f2a1', true, 'Video "Parking_Lot_01.mp4" (2.1 GB) uploaded successfully', '2024-01-15T14:23:12'), L(2, 'Jane Smith', 'jane@example.com', 'START_ANALYSIS', 'Start Analysis', 'ANALYSIS', 'anl_8f4d2c9e', true, 'Started analysis for video vid_6783f2a1', '2024-01-15T14:25:40'), L(3, 'Sarah Johnson', 'sarah@example.com', 'LOGIN_FAILED', 'Login Failed', 'AUTH', null, false, 'invalid credentials', '2024-01-15T18:03:27')];
const system = { database: { status: 'UP' }, aiService: { status: 'UP', detectorLoaded: true }, queue: { QUEUED: 0, RUNNING: 1, COMPLETED: 24, FAILED: 1, CANCELLED: 2 }, failedLast24h: 1, storage: { videosBytes: 4.2e9, diskTotalBytes: 5e11, diskUsableBytes: 3e11 }, version: '1.0.0', models: { loaded: true, detector: 'yolov8n', weights: 'models/yolov8n.pt', supportedCategories: { person: ['person'], vehicle: ['car', 'bus', 'truck', 'motorcycle'], bag: ['backpack', 'handbag', 'suitcase'], knife: ['knife'] }, unsupportedCategories: [], weapon: { enabled: false } } };
const logLines = ['2024-01-15T10:45:12Z INFO Analysis job a-run-13245 accepted', '2024-01-15T10:45:13Z INFO Video metadata extracted: 1920x1080, 30 FPS, 8130.0s', '2024-01-15T10:47:33Z INFO Frame sampling completed: 40650 frames extracted', '2024-01-15T10:47:36Z INFO Running object detection (yolov8n)'];

function route(url, method, body) {
  const p = url.replace(/^.*\/api\/v1/, '').split('?')[0];
  if (p === '/auth/me') return user;
  if (p === '/config') return { maxUploadBytes: 5 * 1024 ** 3, maxDurationSeconds: 14400, formats: ['MP4', 'MOV', 'AVI', 'MKV', 'WEBM'], storageQuotaBytes: 1e12 };
  if (p === '/dashboard/summary') return dash;
  if (p === '/events/pending-count') return 12;
  if (p === '/media-tokens') { const b = JSON.parse(body || '{}'); return { path: `/media/${b.kind}/${b.id}`, token: 'tok', expiresInSeconds: 300 }; }
  if (p === '/videos') return { items: videos, total: 6, page: 0, size: 12 };
  if (/^\/videos\/v\d$/.test(p)) return videos.find((v) => v.id === p.split('/')[2]);
  if (/\/videos\/v\d\/zones$/.test(p)) return zones;
  if (/\/videos\/v\d\/analyses$/.test(p)) return [done, { ...running, id: 'a-old', status: 'FAILED', errorMessage: 'The analysis failed unexpectedly.', eventCount: 0 }];
  if (p === '/analyses') return page(url.includes('status=ACTIVE') ? jobs : [running, done]);
  if (p === '/analyses/a-run-13245') return running;
  if (p === '/analyses/a-done-00147') return done;
  if (/\/logs$/.test(p)) return logLines;
  if (/\/analyses\/.*\/events/.test(p)) return events;
  if (p === '/events') return { items: [...events, ...events].map((e, i) => ({ ...e, id: e.id + i })), total: 12, page: 0, size: 8 };
  if (/\/reviews$/.test(p)) return [];
  if (p === '/admin/users') return page(users);
  if (p === '/admin/audit-logs') return { items: logs, total: 240, page: 0, size: 8 };
  if (p === '/admin/audit-logs/actions') return ['LOGIN', 'UPLOAD_VIDEO'];
  if (p === '/admin/jobs') return page([]);
  if (p === '/admin/system') return system;
  return null;
}

const targets = JSON.parse(process.argv[2] ?? '[]');
const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell' });
for (const t of targets) {
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1672, height: 941 });
  if (t.auth !== false) await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('vg.token', 'fake'); if (!localStorage.getItem('vg.theme')) localStorage.setItem('vg.theme', 'dark'); } catch (e) {} });
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    const u = r.url();
    if (u.includes('/api/v1/media/video')) return r.respond({ status: 200, contentType: 'video/webm', body: clip, headers: { 'Accept-Ranges': 'bytes' } });
    if (u.includes('/api/v1/media/')) return r.respond({ status: 200, contentType: 'image/jpeg', body: img });
    if (u.includes('/api/v1/')) { const d = route(u, r.method(), r.postData()); return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: d, error: null }) }); }
    r.continue();
  });
  pg.on('pageerror', (e) => console.log('PAGEERROR', t.name, e.message));
  await pg.goto(BASE + t.path, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  if (t.click) { await pg.evaluate((txt) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(txt))?.click(), t.click); await new Promise((r) => setTimeout(r, 800)); }
  await pg.screenshot({ path: `/home/claude/qa/out/${t.name}.png` });
  console.log('shot', t.name);
  await pg.close();
}
await browser.close();
