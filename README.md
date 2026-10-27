# VideoGuard AI

AI-assisted surveillance video analysis with human-in-the-loop review. Runs **directly on Windows, no Docker**.

| Service | Stack | Port |
|---|---|---|
| `frontend/` | React + TypeScript + Vite + TanStack Query | 5173 |
| `backend/` | Java 21, Spring Boot 3.3, Spring Security (JWT), Spring Data MongoDB, Maven Wrapper | 8081 |
| `ai-service/` | Python, FastAPI, YOLOv8n (Ultralytics), ByteTrack, OpenCV, FFmpeg | 8000 |
| Database | MongoDB Atlas (`MONGODB_URI`) | cloud |

The job queue is **MongoDB-backed** (atomic claim, lease recovery, retry limits): no Redis, no Docker.
Any authenticated user can analyze videos they own or that are shared with them. Every AI-generated event is created `PENDING`; any authenticated user with access to its video can confirm / reject / mark uncertain.
For Windows setup, Maven Wrapper downloads, service startup, health checks, and analyst login, see [commands.md](./commands.md).

---
## 1. What has actually been verified (read this first)

| Area | Status |
|---|---|
| AI service (rules, severity, evidence, pipeline, job API, token auth, training tools) | **35 pytest tests pass** |
| **Real video through the real stack** | `scripts/analyze_video.py` on a real 79 s, 768x576 pedestrian-surveillance clip (OpenCV sample `vtest.avi`) with **real YOLOv8n + ByteTrack + pose**: 398 frames in ~62 s on 1 CPU core, 72 tracks, 4 loitering candidates with evidence images. **Not ground-truthed** (see 9). |
| YOLOv8n / ByteTrack / pose model on real input | Verified (people, bus, tracks, torso angles). ~75 ms/frame detection on 1 core. |
| **OD-WeaponDetection** (github.com/ari-dasci/OD-WeaponDetection) | Real annotation layout inspected; converter verified on a real 80-image subset (all matched, boxes visually correct). **Pilot** fine-tune on that subset (3 epochs, 54 s) ran end to end and its checkpoint produced `WEAPON_DETECTION` events through the real pipeline. **The pilot model is NOT usable** (it called a knife a pistol). **A real training run has not been done** (needs GPU; see `docs/MODEL_AND_DATA.md`). |
| Frontend | 21 vitest tests, `tsc` clean, build OK, and all main screens rendered in headless Chromium at 1672x941 and compared with your mockups. Not pixel-identical (see 9). |
| Spring Boot backend | Java **parses** only. **Never compiled against Spring, never run, no MongoDB.** Expect small first-run fixes. |
| End-to-end (browser -> backend -> MongoDB -> AI service) | **Never run.** |
| Fights, theft | **Not implemented**: they need a video action-recognition model trained on labelled video. |

**No accuracy figure exists for this system.** See `docs/MODEL_AND_DATA.md`.

## 2. Prerequisites (Windows 10/11)

Open PowerShell and check each; install what is missing (`winget` commands shown):

| Tool | Check | Install |
|---|---|---|
| Java 21 JDK | `java -version` | `winget install EclipseAdoptium.Temurin.21.JDK` |
| Node.js 20+ | `node -v` | `winget install OpenJS.NodeJS.LTS` |
| Python 3.11/3.12 | `py -3.12 --version` | `winget install Python.Python.3.12` |
| FFmpeg (includes ffprobe) | `ffprobe -version` | `winget install Gyan.FFmpeg` |

Maven is **not** needed (the Maven Wrapper downloads it on first run). Reopen PowerShell after installing so PATH updates.
If PowerShell blocks the startup scripts, use the VS Code task **VideoGuard: Start AI Service** or run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-ai.ps1`. The bypass applies only to that PowerShell process and does not change your machine's execution policy.

## 3. MongoDB Atlas
1. Create a free cluster, a database user (readWrite), and under **Network Access** add your current IP.
2. Copy the connection string (Drivers → Java) into `MONGODB_URI` (database name `videoguard`).
MongoDB Atlas is recommended. A local standalone MongoDB also works; review status and review history are saved separately with rollback compensation rather than a multi-document transaction.
Indexes are created automatically at startup.

## 4. One-time setup
```powershell
cd videoguard
Copy-Item .env.example .env        # edit: MONGODB_URI, JWT_SECRET, AI_SERVICE_TOKEN, BOOTSTRAP_ADMIN_*, storage paths

# AI service (run from the videoguard folder; use Python 3.12 for the safest wheels - 3.13/3.14 may work but are untested here)
cd ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-inference.txt     # fastapi, opencv, ultralytics, lap, ...
python scripts\download_weights.py            # official yolov8n.pt -> models\
python scripts\verify_model.py                # REAL check: loads model, detects people in a photo, runs ByteTrack. Must end with "OK"
python -m pytest -q
deactivate; cd ..

# frontend
cd frontend; npm install; cd ..
```

## 5. Run (three terminals, from the `videoguard` folder)
| Terminal | Command | Ready when |
|---|---|---|
| 1 – AI | `.\scripts\start-ai.ps1` | http://127.0.0.1:8000/health shows `"detectorLoaded": true` |
| 2 – Backend | `.\scripts\start-backend.ps1` | log shows `Started VideoGuardApplication` (first run downloads Maven + dependencies) |
| 3 – Frontend | `.\scripts\start-frontend.ps1` | open http://localhost:5173 |

Sign in with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`. Public registration only ever creates a plain USER; use **User Management** to grant ANALYST (needed to submit reviews).

## 6. Smoke test
1. Register/sign in → **Upload Video** (short MP4). Metadata (duration, resolution, FPS) must come from the file.
2. Rename a `.txt` to `.mp4` and upload → must be rejected.
3. Open the video → **Configure Zones** → draw a polygon → Save.
4. **Analyze Video** → watch real stage progress and logs → results page.
5. Open an event → confirm/reject/uncertain (needs ANALYST) → check **Audit Logs** (admin).
6. Sign in as a second user → the first user's video URL must return "not found".

## 7. Tests
`.\scripts\test-all.ps1` (AI pytest, frontend vitest, backend `mvnw test`).
Real-model checks to run once ML is installed: `curl -H "X-Service-Token: <token>" http://127.0.0.1:8000/v1/models` lists the checkpoint's real class names and which categories are supported.

## 8. Troubleshooting
| Symptom | Fix |
|---|---|
| `ffprobe not found` / upload says FFmpeg unavailable | Add FFmpeg `bin` to PATH, reopen terminal, or set `FFMPEG_BIN`/`FFPROBE_BIN` to full paths |
| Backend: `JWT_SECRET must be at least 32 bytes` | Use a longer secret |
| Backend can't connect to Mongo | Atlas Network Access IP, user/password, URL-encode special characters in the password |
| Review fails to save | Check the backend logs and confirm MongoDB is reachable; review writes use rollback compensation and do not require a replica set |
| `/health` says `degraded` | Weights missing → `python scripts\setup_models.py`; or ML stack not installed → section 4 |
| Analysis fails `AI_SERVICE_UNAVAILABLE` | Start the AI service and confirm `/health` reports `"detectorLoaded": true`; check that `AI_SERVICE_TOKEN` matches in `.env` for both services. The Analysis Progress → Analysis Logs panel reports whether the backend could connect or received an HTTP rejection. |
| Frontend shows "Cannot reach the server" | Backend not running on `BACKEND_PORT`; Vite proxies `/api` to 8080 |
| 401 loops back to login | Token expired (15 min default) – by design |
| `mvnw` can't download | Corporate proxy/firewall: allow `repo.maven.apache.org` |

## 9. Behavior you should know
- **No fake data.** Dashboard numbers, progress, stages, logs and events all come from the database / AI service. Empty states are shown when there is nothing.
- **Speeds are not real-world speeds.** "Sudden Running" uses normalized frame-widths per second; the UI never shows m/s.
- **Severity** (LOW/MEDIUM/HIGH) is a documented prioritization rule (`ai-service/app/severity.py`), not a verdict and not a review decision.
- **Thresholds are uncalibrated defaults.** Calibrate on labeled footage before relying on results. No accuracy figure is claimed.
- **Private media.** Files live in `VIDEO_STORAGE_ROOT`/`EVIDENCE_STORAGE_ROOT` under generated names. The browser gets 5-minute, single-resource signed links.
- **Roles:** USER owns videos; ANALYST may review events on videos they own or that were shared with them; ADMIN manages users/audit/system. Admins get no implicit access to other users' videos.
- Upload encryption at rest is **not** implemented (the mockup's "encrypted" wording was changed accordingly).
- **UI fidelity:** layouts, colors, components and copy follow your 14 mockups. Differences you will see: the mockups' photographs (control-room background, camera thumbnails) are replaced by a gradient / real video frames (drop your photo at `frontend/public/auth-bg.jpg` to restore the login background); the mini sparkline bars on dashboard stat cards are omitted because there is no data behind them; the sidebar/top bar is one consistent design where the mockups differ from each other.
- **Not real-time streaming:** it analyzes uploaded recordings (PRD scope). See `docs/MODEL_AND_DATA.md` section 4.

## 10. Not implemented / known limitations
- YOLOv12, benchmark mode, ensemble, pose/fall, X3D/SlowFast, weapon checkpoint (hook only).
- No password reset, profile editing, Terms/Privacy pages (controls shown disabled).
- No bulk review, no video sharing UI (the `sharedWith` field exists in the API/DB only).
- No evidence video clips (snapshots only). Analysis state in the AI service is in memory; an AI restart mid-job fails that job (the backend marks it failed).
- Rate limiting is in-memory (single backend instance).
- Docker Compose is not included.

## 11. Licensing
- Ultralytics YOLOv8 code and weights: **AGPL-3.0** (commercial license available). Network-served use has AGPL implications; review before deployment.
- The GingerBrains weapon repository is GPL-3.0 per your notes; verify its weights' ownership and reuse terms before using them.
- ByteTrack (MIT) is used through Ultralytics' implementation.

## 12. API summary (all under `/api/v1`, envelope `{data, error:{code,message}, requestId}`)
`POST /auth/register|login|logout`, `GET /auth/me`, `GET /config`, `GET /dashboard/summary`,
`POST/GET /videos`, `GET/PATCH/DELETE /videos/{id}`, `GET/POST /videos/{id}/zones`, `PUT/DELETE /videos/{id}/zones/{zoneId}`,
`POST/GET /videos/{id}/analyses` (`Idempotency-Key` required, 202), `GET /analyses`, `GET /analyses/{id}`, `/logs`, `POST /analyses/{id}/cancel`, `GET /analyses/{id}/events|export`,
`GET /events`, `/events/pending-count`, `/events/{id}`, `POST/GET /events/{id}/reviews`, `POST /media-tokens` + `GET /media/{kind}/{id}?t=`,
`GET/POST/PATCH /admin/users`, `GET /admin/audit-logs|audit-logs/export|audit-logs/actions|jobs|system`.
Interactive docs once the backend runs: http://localhost:8080/swagger-ui.html

## 12b. Analyze a video without the web app
```
cd ai-service
python scripts\analyze_video.py C:\videos\lobby.mp4 --pose --zone "0.1,0.4;0.6,0.4;0.6,0.95;0.1,0.95" --out results
python scripts\analyze_video.py lobby.mp4 --weapon-model models\weapon\best.pt --weapon-labels pistol,knife
```
Prints stages, tracks and events and writes `results\result.json` plus annotated evidence images. Use this first on your own footage to see what the thresholds do.

## 13. Feature list
**Accounts & security:** register/sign-in (10+ chars, upper/lower/digit), BCrypt, 15-min JWT, session-expiry handling, bootstrap admin, roles USER/ANALYST/ADMIN (no self-escalation, last-admin protection), ownership checks on every resource (404 for others' data), rate limiting, short-lived signed media links, CORS allow-list, audit log of sensitive actions.
**Videos:** drag-and-drop upload with progress/cancel, extension + content-signature + FFprobe decodability checks, size/duration limits, real metadata, thumbnails + 6 preview frames, library with search/filter/sort/grid-list/pagination, detail page with custom player, edit description, delete.
**Restricted zones:** draw polygon/rectangle on a video frame, move points, name/describe/colour/enable, normalized coordinates, server-side geometry validation (self-intersection, range, area), used by intrusion detection.
**Analysis:** idempotent start (202), one-active-run guard, durable MongoDB queue (atomic claim, lease recovery, retries), 10 real pipeline stages with true progress/timings/logs, cancel, full history per video, failure reasons.
**Detection:** YOLOv8n (person, vehicle, bag, knife), ByteTrack tracking, person loitering and sudden running (both measured in body-heights, distance-independent, smoothed, sustained), restricted-area intrusion (foot point in polygon), fall detection (pose model; upright -> lying -> stays down), weapon-label persistence rule (distinct frames; optional fine-tuned pistol/knife checkpoint), duplicate suppression, factual explanations from measurements, documented severity rules, annotated evidence snapshots, per-event trajectory drawn on the video, model/rule versions stored per run.
**Review:** timeline + event cards from the same data, jump-to-moment, filters/search, review dialog (Confirm/Reject/Uncertain + notes), review history, status update with rollback compensation if history persistence fails, AI can never set a review status, every event starts PENDING, pending-review queue with counts.
**Admin:** user list/search/filter, add user, roles, activate/deactivate, notes, per-user activity, audit log with filters + CSV export, system status (DB, AI service, queue, loaded models, storage), job/failure browser.
**Account & settings:** profile editing, password change with strength rules, notification preferences (in-app + browser), light/dark/system theme, privacy notes, real notification centre with pending events and analysis outcomes.
**UX:** dark/light themes (saved), collapsible sidebar with live system status, Ctrl+K search, responsive layout, loading/empty/error/permission/expired-session states, keyboard-accessible dialogs, status badges that never rely on colour alone, CSV export of results.
**ML tooling:** dataset preparation (VOC/YOLO -> Ultralytics), weapon fine-tuning with held-out test metrics, event-level precision/recall evaluator, design-QA screenshot harness.
