# Terminal 2: Spring Boot backend (Maven Wrapper, no separate Maven needed)
. "$PSScriptRoot\load-env.ps1"
Set-Location "$PSScriptRoot\..\backend"
.\mvnw.cmd spring-boot:run
