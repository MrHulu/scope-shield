#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { localDeployStamp, parseLocalDeployArgs } from './local-deploy-utils.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

function help() {
  return `
Create a self-contained local deployment package.

Usage:
  npm run package:local -- [--skip-build] [--no-zip]

Output:
  .output/local-deploy/scope-shield-local-<timestamp>/
  .output/local-deploy/scope-shield-local-<timestamp>.zip

The package contains dist/, a zero-dependency local server, and double-click
startup scripts. The recipient only needs Node.js 20+.
`.trim()
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function readPackageInfo() {
  const raw = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf-8')
  return JSON.parse(raw)
}

async function writePackageEntrypoints(packageDir) {
  await fs.mkdir(path.join(packageDir, 'scripts'), { recursive: true })
  await fs.copyFile(
    path.join(here, 'serve-dist.mjs'),
    path.join(packageDir, 'scripts', 'serve-dist.mjs'),
  )
  await fs.copyFile(
    path.join(here, 'local-deploy-utils.mjs'),
    path.join(packageDir, 'scripts', 'local-deploy-utils.mjs'),
  )

  await fs.writeFile(
    path.join(packageDir, 'start-local.cmd'),
    `@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)
node scripts\\serve-dist.mjs --root dist --host 0.0.0.0 --port 4173 --open
pause
`,
  )

  await fs.writeFile(
    path.join(packageDir, 'start-local.ps1'),
    `$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 20+ is required: https://nodejs.org/' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}
node .\\scripts\\serve-dist.mjs --root dist --host 0.0.0.0 --port 4173 --open
`,
  )

  await fs.writeFile(
    path.join(packageDir, 'start-local.sh'),
    `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required: https://nodejs.org/" >&2
  exit 1
fi
node scripts/serve-dist.mjs --root dist --host 0.0.0.0 --port 4173 --open
`,
    { mode: 0o755 },
  )

  await fs.writeFile(
    path.join(packageDir, 'README.local-deploy.md'),
    `# Scope Shield local deployment package

## Start

- Windows: double-click \`start-local.cmd\`
- PowerShell: \`powershell -ExecutionPolicy Bypass -File .\\start-local.ps1\`
- macOS / Linux: \`./start-local.sh\`

The server binds to \`0.0.0.0:4173\`, so devices on the same LAN can open the LAN URL printed in the terminal.

## Requirement

Node.js 20+ must be installed on the machine that runs this package.

## Data

Scope Shield is local-first. Project data is stored in the browser profile of the machine and browser that opens the app.

## Stop

Close the terminal window or press Ctrl+C.
`,
  )
}

async function createZip(packageDir, zipPath) {
  await fs.rm(zipPath, { force: true })
  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        'Compress-Archive -LiteralPath $env:SCOPE_SHIELD_PACKAGE_SOURCE -DestinationPath $env:SCOPE_SHIELD_PACKAGE_ZIP -Force',
      ],
      {
        env: {
          ...process.env,
          SCOPE_SHIELD_PACKAGE_SOURCE: packageDir,
          SCOPE_SHIELD_PACKAGE_ZIP: zipPath,
        },
        stdio: 'inherit',
        shell: false,
      },
    )
    return result.status === 0
  }

  const result = spawnSync('zip', ['-qry', zipPath, path.basename(packageDir)], {
    cwd: path.dirname(packageDir),
    stdio: 'inherit',
    shell: false,
  })
  return result.status === 0
}

async function main() {
  const options = parseLocalDeployArgs(process.argv.slice(2), { open: false })
  if (options.help) {
    console.log(help())
    return
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  if (!options.skipBuild) {
    runChecked(npmCommand, ['run', 'build'])
  }

  const packageInfo = await readPackageInfo()
  const stamp = localDeployStamp()
  const outputRoot = path.join(repoRoot, '.output', 'local-deploy')
  const packageName = `${packageInfo.name}-local-${stamp}`
  const packageDir = path.join(outputRoot, packageName)
  const zipPath = `${packageDir}.zip`

  await fs.rm(packageDir, { recursive: true, force: true })
  await fs.mkdir(packageDir, { recursive: true })
  await fs.cp(path.join(repoRoot, 'dist'), path.join(packageDir, 'dist'), { recursive: true })
  await writePackageEntrypoints(packageDir)

  await fs.writeFile(
    path.join(packageDir, 'package-manifest.json'),
    JSON.stringify(
      {
        name: packageInfo.name,
        createdAt: new Date().toISOString(),
        entry: 'start-local.cmd',
        server: 'scripts/serve-dist.mjs',
        dist: 'dist',
      },
      null,
      2,
    ),
  )

  let zipped = false
  if (!options.noZip) {
    zipped = await createZip(packageDir, zipPath)
  }

  console.log('\nLocal deployment package created.')
  console.log(`Folder: ${packageDir}`)
  if (zipped) {
    console.log(`Zip:    ${zipPath}`)
  } else if (!options.noZip) {
    console.log('Zip:    skipped because no zip tool was available')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
