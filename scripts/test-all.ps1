# Runs every automated test suite. Backend tests need Maven Central access.
. "$PSScriptRoot\load-env.ps1"
Push-Location "$PSScriptRoot\..\ai-service"; .\.venv\Scripts\python.exe -m pytest -q; Pop-Location
Push-Location "$PSScriptRoot\..\frontend"; npm test; Pop-Location
Push-Location "$PSScriptRoot\..\backend"; .\mvnw.cmd test; Pop-Location
