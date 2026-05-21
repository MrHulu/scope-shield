@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required. Install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  npm ci
  if errorlevel 1 (
    echo npm ci failed. Trying npm install...
    npm install
    if errorlevel 1 (
      pause
      exit /b 1
    )
  )
)

npm run deploy:local -- --host 127.0.0.1 --port 4173 --feishu --strict-port --shutdown-on-idle --auto-feishu-login
if errorlevel 1 pause
