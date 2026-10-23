$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
$dotnetExecutable = if ($dotnetCommand) { $dotnetCommand.Source } else { Join-Path $projectRoot '.tools\dotnet\dotnet.exe' }
if (-not (Test-Path -LiteralPath $dotnetExecutable)) { throw 'Install the .NET 10 SDK before running this script.' }
$env:DOTNET_ROOT = Split-Path -Parent $dotnetExecutable
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$apiRoot = Join-Path $projectRoot 'backend\AnimeTracker.Api'
$logDirectory = Join-Path $projectRoot '.tools'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
if (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 5000 is already in use. Stop the existing API before starting another copy.' }
Push-Location $projectRoot
try {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend\node_modules'))) {
        & npm.cmd --prefix (Join-Path $projectRoot 'frontend') ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    }
    & $dotnetExecutable build (Join-Path $apiRoot 'AnimeTracker.Api.csproj') --nologo
    if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
    $apiDll = Join-Path $apiRoot 'bin\Debug\net10.0\AnimeTracker.Api.dll'
    $apiProcess = Start-Process -FilePath $dotnetExecutable -ArgumentList @('"' + $apiDll + '"', '--urls', 'http://localhost:5000') -WorkingDirectory $apiRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'api.log') -RedirectStandardError (Join-Path $logDirectory 'api-error.log')
    try {
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if ($apiProcess.HasExited) { throw "The API exited. See $logDirectory\api-error.log." }
            try { $health = Invoke-RestMethod 'http://localhost:5000/api/health' -TimeoutSec 1; if ($health.status -eq 'healthy') { $ready = $true; break } } catch { Start-Sleep -Milliseconds 500 }
        }
        if (-not $ready) { throw 'API startup timed out. See .tools/api.log.' }
        Write-Host 'AniTrack is ready at http://127.0.0.1:5173. Press Ctrl+C to stop both servers.'
        & npm.cmd --prefix (Join-Path $projectRoot 'frontend') run dev
    } finally { if (-not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id } }
} finally { Pop-Location }
