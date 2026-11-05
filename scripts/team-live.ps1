param(
    [ValidateSet('start', 'stop')][string]$Action = 'start',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot

if ($Action -eq 'stop') {
    & node scripts/dashboard-live.cjs stop --team-db
    exit $LASTEXITCODE
}

# Collect all missing prerequisites before installing or starting anything.
$issues = New-Object 'System.Collections.Generic.List[string]'
$available = @{}
foreach ($command in @('node', 'npm.cmd', 'go', 'docker')) {
    $available[$command] = [bool](Get-Command $command -ErrorAction SilentlyContinue)
    if (-not $available[$command]) {
        $issues.Add("Missing command: $command. Install it and reopen PowerShell to refresh PATH.")
    }
}
if ($available['node']) {
    try {
        $nodeVersion = (& node --version 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+\.\d+\.\d+)$') {
            $issues.Add('Cannot determine Node.js version.')
        } elseif ([version]$Matches[1] -lt [version]'22.19.0') {
            $issues.Add("Node.js >=22.19.0 required; found $nodeVersion.")
        }
    } catch { $issues.Add('Cannot run Node.js; check its installation/PATH.') }
}
if ($available['go']) {
    try {
        $goVersion = (& go version 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $goVersion -notmatch 'go(\d+\.\d+\.\d+)(?:\s|$)') {
            $issues.Add('Cannot determine a stable Go version (need >=1.27.3).')
        } elseif ([version]$Matches[1] -lt [version]'1.27.3') {
            $issues.Add("Go >=1.27.3 required; found $goVersion.")
        }
    } catch { $issues.Add('Cannot run Go; check its installation/PATH.') }
}
$chrome = Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'
if (-not (Test-Path -LiteralPath $chrome)) {
    $issues.Add('Install Google Chrome for all users in C:\Program Files\Google\Chrome\Application (not only AppData).')
}
if ($available['docker']) {
    try {
        $dockerType = (& docker info --format '{{.OSType}}' 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { $issues.Add('Start Docker Desktop and wait until its engine is ready.') }
        elseif ($dockerType -ne 'linux') { $issues.Add('Switch Docker Desktop to Linux containers.') }
        & docker compose version *> $null
        if ($LASTEXITCODE -ne 0) { $issues.Add('Docker Compose v2 is missing; repair/update Docker Desktop.') }
    } catch { $issues.Add('Cannot query Docker Desktop/Compose; start or repair Docker Desktop.') }
}
if ($issues.Count -gt 0) {
    Write-Output 'Complete prerequisite check failed. Fix ALL items below, then reopen PowerShell:'
    foreach ($issue in $issues) { Write-Output " - $issue" }
    Write-Output 'Full Windows setup checklist: README.md -> Clone va chay Live.'
    exit 1
}
Write-Output 'Prerequisites OK: Node/npm, Go, Chrome, Docker Linux engine and Compose.'
if ($CheckOnly) { exit 0 }

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
