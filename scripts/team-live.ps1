param([ValidateSet('start', 'stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot

if ($Action -eq 'stop') {
    & node scripts/dashboard-live.cjs stop --team-db
    exit $LASTEXITCODE
}

# Prepare host dependencies before creating any local Docker resources.
foreach ($command in @('node', 'npm.cmd', 'go', 'docker')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Missing $command. Install Node.js >=22.19, Go >=1.27.3 and Docker Desktop (Linux containers)."
    }
}
& node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=19)?0:1)'
if ($LASTEXITCODE -ne 0) { throw 'Node.js >=22.19 required.' }
$chrome = Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'
if (-not (Test-Path -LiteralPath $chrome)) { throw 'Install Google Chrome for all users (Program Files) before starting the Live lab.' }
& docker info --format '{{.OSType}}' | ForEach-Object {
    if ($_ -ne 'linux') { throw 'Docker Desktop must use Linux containers.' }
}
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop before continuing.' }

# Refuse occupied UI ports; do not stop unrelated processes/containers.
& node -e 'const net=require("node:net");(async()=>{for(const port of [5173,13001,18444])await new Promise((ok,no)=>{const s=net.createServer();s.once("error",no);s.listen(port,"127.0.0.1",()=>s.close(ok));});})().catch(()=>{console.error("Live ports busy. Stop the Docker dashboard with scripts/team.ps1 stop, or stop the existing native lab first.");process.exitCode=1;});'
if ($LASTEXITCODE -ne 0) { throw 'Live ports are occupied.' }

foreach ($folder in @('backend', 'dashboard')) {
    # Reinstall from the lockfile on every launch, including after git pull.
    & npm.cmd --prefix $folder ci
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed for $folder." }
}
& powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\team.ps1 setup
if ($LASTEXITCODE -ne 0) { throw 'Team env/certificate setup failed.' }

$composeArgs = @('compose', '--env-file', '.env.team', '-f', 'compose.team.yaml')
# Start only PostgreSQL; backend/Gateway/UI run on the host for direct H2 capture.
& docker @composeArgs up -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Could not start the team database.' }
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker @composeArgs exec -T postgres pg_isready -h 127.0.0.1 -U dacn2_admin -d dacn2 *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) { throw 'Database not ready after 60 seconds. Inspect team.ps1 logs. Data has been kept.' }
Write-Output 'Starting Live. Ctrl+C stops the app; Docker PostgreSQL and its data are kept.'
& node scripts/dashboard-live.cjs --team-db
exit $LASTEXITCODE
