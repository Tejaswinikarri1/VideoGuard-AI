# Dot-source from the other scripts: loads ..\.env into this PowerShell session only.
$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) { Write-Error ".env not found. Copy .env.example to .env and edit it."; exit 1 }
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$' -and -not $_.TrimStart().StartsWith('#')) {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), 'Process')
  }
}
foreach ($v in 'MONGODB_URI','JWT_SECRET','AI_SERVICE_TOKEN') {
  if (-not [Environment]::GetEnvironmentVariable($v)) { Write-Error "$v is not set in .env"; exit 1 }
}
New-Item -ItemType Directory -Force -Path $env:VIDEO_STORAGE_ROOT, $env:EVIDENCE_STORAGE_ROOT | Out-Null
