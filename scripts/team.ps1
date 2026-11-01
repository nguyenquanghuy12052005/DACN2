param([ValidateSet('setup', 'start', 'stop', 'status', 'logs')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
function Run-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw 'Docker command failed; stop here and inspect its output.' }
}
$composeArgs = @('compose', '--env-file', '.env.team', '-f', 'compose.team.yaml')
if ($Action -in @('setup', 'start')) {
    if (-not (Test-Path -LiteralPath '.env.team')) {
        $adminPassword = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
        $appPassword = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
        @("TEAM_POSTGRES_PASSWORD=$adminPassword", "TEAM_APP_PASSWORD=$appPassword", 'TEAM_TLS_DIR=./gateway/.team-tls') |
            Set-Content -LiteralPath '.env.team' -Encoding ascii
        Remove-Variable adminPassword, appPassword
    }
    # Keep existing machine setup untouched if it already uses gateway/cert.pem.
    $usesTeamTls = Select-String -LiteralPath '.env.team' -Pattern '^TEAM_TLS_DIR=\./gateway/\.team-tls\s*$' -Quiet
    if ($usesTeamTls) {
        $tlsDir = Join-Path $projectRoot 'gateway/.team-tls'
        if (-not (Test-Path -LiteralPath $tlsDir)) { New-Item -ItemType Directory -Path $tlsDir | Out-Null }
        $certExists = Test-Path -LiteralPath (Join-Path $tlsDir 'cert.pem')
        $keyExists = Test-Path -LiteralPath (Join-Path $tlsDir 'key.pem')
        if ($certExists -ne $keyExists) { throw 'Partial certificate/key pair; inspect it manually before continuing.' }
        if (-not $certExists) {
            $generator = Join-Path $projectRoot 'scripts/team-cert'
            Run-Docker run --rm --mount "type=bind,source=$generator,target=/src,readonly" --mount "type=bind,source=$tlsDir,target=/out" golang:1.27.3-bookworm go run /src/main.go
        }
    }
    if ($Action -eq 'setup') { Write-Output 'Local setup prepared. Run team.ps1 start next.'; exit }
    Run-Docker @composeArgs up -d --build
    Write-Output 'Dashboard preview: http://127.0.0.1:5173/dashboard (Live integration pending).'
    exit
}
if ($Action -eq 'stop') { Run-Docker @composeArgs stop }
if ($Action -eq 'status') { Run-Docker @composeArgs ps }
if ($Action -eq 'logs') { Run-Docker @composeArgs logs --tail 80 }
