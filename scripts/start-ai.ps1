# Terminal 1: AI service (FastAPI + YOLOv8n + ByteTrack)
. "$PSScriptRoot\load-env.ps1"
Set-Location "$PSScriptRoot\..\ai-service"
if (-not (Test-Path .venv)) { Write-Error "Run the one-time setup first (README step 4)."; exit 1 }
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
