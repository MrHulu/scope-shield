$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 20+ is required: https://nodejs.org/' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'npm is required. Install Node.js from https://nodejs.org/' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

if (-not (Test-Path -LiteralPath '.\node_modules')) {
  Write-Host 'Installing dependencies...'
  npm ci
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'npm ci failed. Trying npm install...'
    npm install
    if ($LASTEXITCODE -ne 0) {
      Read-Host 'Press Enter to exit'
      exit $LASTEXITCODE
    }
  }
}

npm run deploy:local -- --host 0.0.0.0 --port 4173
Read-Host 'Press Enter to exit'
