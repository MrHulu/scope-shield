$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')
$LogDir = Join-Path $RepoRoot '.output\local-server'
$OutLog = Join-Path $LogDir 'scope-shield-autostart.out.log'
$ErrLog = Join-Path $LogDir 'scope-shield-autostart.err.log'
$Port = 4174

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $RepoRoot

function Write-DeployLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -LiteralPath $OutLog -Value $line
}

function Resolve-NodeExe {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    'D:\NodeJS\node.exe',
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  throw 'Node.js 20+ is required but node.exe was not found.'
}

function Test-PortListener {
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return [bool]$listeners
}

try {
  if (Test-PortListener) {
    Write-DeployLog "Port $Port is already listening. Skip Scope Shield autostart to avoid duplicate servers."
    exit 0
  }

  if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'dist\index.html'))) {
    Write-DeployLog 'dist/index.html missing; building production bundle.'
    npm run build *>> $OutLog
  }

  $node = Resolve-NodeExe
  Write-DeployLog "Starting Scope Shield LAN server with $node on 0.0.0.0:$Port."
  & $node (Join-Path $RepoRoot 'scripts\serve-dist.mjs') --root dist --host 0.0.0.0 --port $Port --no-open 1>> $OutLog 2>> $ErrLog
} catch {
  Add-Content -LiteralPath $ErrLog -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message)
  throw
}
