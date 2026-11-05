$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'team-live.ps1'
$quotedScript = "'" + $scriptPath.Replace("'", "''") + "'"

# Isolated shells mock prerequisite commands; no installs/Docker startup/DB calls.
$missingCase = @'
function Get-Command { [CmdletBinding()] param([string]$Name) return $null }
& __SCRIPT__ -CheckOnly
'@
$output = (& powershell -NoProfile -Command $missingCase.Replace('__SCRIPT__', $quotedScript) 2>&1 | Out-String)
if ($LASTEXITCODE -ne 1) { throw 'Missing-tools preflight must fail.' }
foreach ($name in @('node', 'npm.cmd', 'go', 'docker')) {
    if (-not $output.Contains("Missing command: $name.")) { throw "Missing aggregate error for $name." }
}

$versionCase = @'
function Get-Command { [CmdletBinding()] param([string]$Name) return @{ Name = $Name } }
function node { $global:LASTEXITCODE = 0; 'v20.20.2' }
function go { $global:LASTEXITCODE = 0; 'go version go1.26.0 windows/amd64' }
function docker { $global:LASTEXITCODE = 0; if ($args[0] -eq 'info') { 'windows' } }
& __SCRIPT__ -CheckOnly
'@
$output = (& powershell -NoProfile -Command $versionCase.Replace('__SCRIPT__', $quotedScript) 2>&1 | Out-String)
if ($LASTEXITCODE -ne 1) { throw 'Wrong-version preflight must fail.' }
foreach ($message in @('Node.js >=22.19.0 required', 'Go >=1.27.3 required', 'Switch Docker Desktop to Linux containers')) {
    if (-not $output.Contains($message)) { throw "Missing aggregate error: $message" }
}
$readyCase = @'
function Get-Command { [CmdletBinding()] param([string]$Name) return @{ Name = $Name } }
function Test-Path { [CmdletBinding()] param([string]$LiteralPath) return $true }
function node { if ($args[0] -ne '--version') { throw 'Unexpected Node startup' }; $global:LASTEXITCODE = 0; 'v22.19.0' }
function go { $global:LASTEXITCODE = 0; 'go version go1.27.3 windows/amd64' }
function docker {
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'info') { 'linux' }
    elseif ($args[0] -ne 'compose' -or $args[1] -ne 'version') { throw 'Unexpected Docker mutation' }
}
function npm.cmd { throw 'Unexpected dependency install' }
& __SCRIPT__ -CheckOnly
'@
$output = (& powershell -NoProfile -Command $readyCase.Replace('__SCRIPT__', $quotedScript) 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or -not $output.Contains('Prerequisites OK')) { throw 'CheckOnly must succeed without installing or starting services.' }
Write-Output 'PASS: aggregate missing tools/invalid versions and read-only successful CheckOnly (3 scenarios).'
