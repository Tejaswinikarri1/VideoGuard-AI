# VideoGuard: Windows Commands

Run these commands in **PowerShell**. Replace `C:\path\to\videoguard` with the folder containing this file. Keep the three service terminals open while using the app.

## 1. Install prerequisites

Open PowerShell and install any missing tools:

```powershell
winget install --id EclipseAdoptium.Temurin.21.JDK --exact
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Python.Python.3.12 --exact
winget install --id Gyan.FFmpeg --exact
```

Close and reopen PowerShell after installation, then verify:

```powershell
java -version
node --version
py -3.12 --version
ffmpeg -version
ffprobe -version
```

Create a MongoDB Atlas cluster and database user, allow your current IP in Atlas **Network Access**, then copy the Atlas connection string for the next step. Atlas is recommended; the local standalone MongoDB used by this development setup is also supported.

## 2. Configure the project once

```powershell
Set-Location "C:\path\to\videoguard"
Copy-Item .env.example .env
notepad .env
```

In `.env`, set `MONGODB_URI`, `JWT_SECRET`, `AI_SERVICE_TOKEN`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, and the storage paths. Use separate random values of at least 32 characters for `JWT_SECRET` and `AI_SERVICE_TOKEN`. To generate a random value in PowerShell:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Run those commands again for a separate secret. Do not share or commit `.env`. The bootstrap admin password must be at least 10 characters and contain an uppercase letter, a lowercase letter, and a digit. Changing `BOOTSTRAP_ADMIN_PASSWORD` later does not change an already-created account's password.

Create the shared storage folders (use the same paths in `.env`):

```powershell
New-Item -ItemType Directory -Force -Path 'C:\videoguard-data\videos', 'C:\videoguard-data\evidence'
```

## 3. Install AI dependencies and model weights once

From the project root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-ai.ps1
```

This creates `ai-service\.venv`, installs CPU PyTorch and inference requirements, downloads YOLO weights, then verifies that the model loads. It can take a while on first run.

## 4. Download Maven and backend dependencies

No separate Maven installation is needed. The Maven Wrapper downloads Maven 3.9.9 on first use and caches it under your Windows user profile. From PowerShell:

```powershell
Set-Location "C:\path\to\videoguard\backend"
.\mvnw.cmd -version
.\mvnw.cmd test
```

The first wrapper/test run also downloads the backend's Maven dependencies from Maven Central. To start the backend, use the project script below; it loads the root `.env` before Spring Boot starts.

## 5. Install frontend dependencies once

```powershell
Set-Location "C:\path\to\videoguard\frontend"
npm install
```

## 6. Start the project

Start each command in its own PowerShell terminal. Use the same project root in every terminal. The process-scoped execution-policy bypass avoids changing your machine's PowerShell policy.

**Terminal 1 — AI service**

```powershell
Set-Location "C:\path\to\videoguard"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-ai.ps1
```

Wait until `http://127.0.0.1:8000/health` reports `"detectorLoaded": true`.

**Terminal 2 — backend**

```powershell
Set-Location "C:\path\to\videoguard"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
```

On the first start, Maven downloads the required Maven and backend dependencies. Wait for `Started VideoGuardApplication`.

**Terminal 3 — frontend**

```powershell
Set-Location "C:\path\to\videoguard"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend.ps1
```

Open <http://localhost:5173>.

## 7. Check service health

Run these from a separate PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-WebRequest http://127.0.0.1:8081/actuator/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing
```

To check that the authenticated AI model endpoint works:

```powershell
Set-Location "C:\path\to\videoguard"
$tokenLine = Get-Content .\.env | Where-Object { $_ -match '^AI_SERVICE_TOKEN=' } | Select-Object -First 1
$token = $tokenLine -replace '^AI_SERVICE_TOKEN=', ''
Invoke-RestMethod http://127.0.0.1:8000/v1/models -Headers @{ 'X-Service-Token' = $token }
```

## 8. Analyst login

The existing local account `admin@example.com` has the `ANALYST` role (as well as `ADMIN` and `USER`). Sign in with the password configured as `BOOTSTRAP_ADMIN_PASSWORD` in the root `.env`. The password is deliberately not copied into this document; keep `.env` private. All authenticated users can analyze videos they own or that are shared with them, and submit review decisions for events on videos they can access.

If that account does not work, sign in with the configured bootstrap-admin credentials and use **User Management** to create or update an account with the `ANALYST` role. Set its password when creating the account; passwords cannot be recovered from the database. Public registration creates only a `USER`.

## 9. Run tests

From the project root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-all.ps1
```

Or run individual suites:

```powershell
Set-Location "C:\path\to\videoguard\ai-service"
.\.venv\Scripts\python.exe -m pytest -q

Set-Location "C:\path\to\videoguard\frontend"
npm test
npm run build

Set-Location "C:\path\to\videoguard\backend"
.\mvnw.cmd test
```

## 10. Stop the project

In each of the three service terminals, press **Ctrl+C**. Do not close the AI/backend terminals while analyses are running.

## Troubleshooting

- **Maven Wrapper download fails:** check internet/proxy access to `repo.maven.apache.org`; retry `.\mvnw.cmd -version` from `backend`.
- **MongoDB connection fails:** verify `MONGODB_URI`, Atlas credentials, URL-encode special characters in the database password, and allow your current IP in Atlas.
- **AI health says `degraded`:** rerun `scripts\setup-ai.ps1`, then restart the AI terminal.
- **Analysis reports `AI_SERVICE_UNAVAILABLE`:** verify AI health and the authenticated `/v1/models` command above; ensure both backend and AI read the same `AI_SERVICE_TOKEN` from `.env`.
- **A service port is busy:** stop the old process using that port or change the corresponding application configuration before restarting.
