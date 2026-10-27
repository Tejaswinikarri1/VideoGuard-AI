# Terminal 3: React dev server
Set-Location "$PSScriptRoot\..\frontend"
if (-not (Test-Path node_modules)) { npm install }
npm run dev
