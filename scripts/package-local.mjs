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

Only the newest package is kept in .output/local-deploy.

The package contains dist/, a local server, bundled Feishu login script
dependencies, and double-click startup scripts. The recipient only needs
Node.js 20+. Private local startup opens the Feishu login window automatically
when local credentials are missing.
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
  await fs.copyFile(
    path.join(here, 'local-data-runtime.mjs'),
    path.join(packageDir, 'scripts', 'local-data-runtime.mjs'),
  )
  await fs.copyFile(
    path.join(here, 'feishu-runtime.mjs'),
    path.join(packageDir, 'scripts', 'feishu-runtime.mjs'),
  )
  await fs.copyFile(
    path.join(here, 'feishu-login-manager.mjs'),
    path.join(packageDir, 'scripts', 'feishu-login-manager.mjs'),
  )
  await fs.copyFile(
    path.join(here, 'feishu-login.mjs'),
    path.join(packageDir, 'scripts', 'feishu-login.mjs'),
  )
  await fs.copyFile(
    path.join(here, 'ensure-feishu-runtime.mjs'),
    path.join(packageDir, 'scripts', 'ensure-feishu-runtime.mjs'),
  )
  await copyPlaywrightRuntime(packageDir)

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
node scripts\\serve-dist.mjs --root dist --host 127.0.0.1 --port 4173 --feishu --open --strict-port --shutdown-on-idle --auto-feishu-login
if errorlevel 1 pause
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
node .\\scripts\\serve-dist.mjs --root dist --host 127.0.0.1 --port 4173 --feishu --open --strict-port --shutdown-on-idle --auto-feishu-login
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
node scripts/serve-dist.mjs --root dist --host 127.0.0.1 --port 4173 --feishu --open --strict-port --shutdown-on-idle --auto-feishu-login
`,
    { mode: 0o755 },
  )

  await fs.writeFile(
    path.join(packageDir, 'start-lan-share.cmd'),
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
    path.join(packageDir, 'start-lan-share.ps1'),
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
    path.join(packageDir, 'start-lan-share.sh'),
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

## Start on your own computer

- Windows: double-click \`start-local.cmd\`
- PowerShell: \`powershell -ExecutionPolicy Bypass -File .\\start-local.ps1\`
- macOS / Linux: \`./start-local.sh\`

This private mode binds to \`127.0.0.1:4173\` and supports Feishu login for this computer's account.
The package includes the Feishu login script dependencies, so startup does not run \`npm install\`.
When no local Feishu credentials exist, the Feishu login window opens automatically. The login window uses bundled Playwright Chromium when available, otherwise the computer's Chrome or Microsoft Edge.
If the computer has no supported browser engine, run \`node scripts/ensure-feishu-runtime.mjs\` with network access once, then click Feishu login again.

## LAN share mode

Use \`start-lan-share.cmd\` only when you want other devices on the same LAN to open this app from your computer.
LAN share mode disables Feishu login by design. Visitors who need Feishu sync should run this package on their own computer.
LAN share mode also disables the host computer's local backup API, so visitors cannot read or overwrite the host's app-data backup.

## Requirement

Node.js 20+ must be installed on the machine that runs this package.
Node.js includes npm; npm is only needed if you manually run \`scripts/ensure-feishu-runtime.mjs\` to install a missing Playwright Chromium browser.

Local data is also mirrored to the current user's app data folder so browser port changes do not create a blank app.

## Data

Scope Shield is local-first. Project data is stored in the browser profile of the machine and browser that opens the app.

## Stop

Private local mode stops automatically shortly after you close the browser window. You can also press Ctrl+C in the terminal.
LAN share mode keeps running until you press Ctrl+C or close its terminal window.
`,
  )
}

async function copyPlaywrightRuntime(packageDir) {
  const modules = [
    ['@playwright', 'test'],
    ['playwright'],
    ['playwright-core'],
  ]
  for (const parts of modules) {
    const source = path.join(repoRoot, 'node_modules', ...parts)
    const target = path.join(packageDir, 'node_modules', ...parts)
    try {
      await fs.access(source)
    } catch {
      throw new Error(`Missing ${source}. Run npm install before packaging.`)
    }
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.cp(source, target, {
      recursive: true,
      filter: (entry) => !entry.includes(`${path.sep}.cache${path.sep}`),
    })
  }
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

async function resetOutputRoot(outputRoot) {
  const resolvedOutputRoot = path.resolve(outputRoot)
  const expectedOutputRoot = path.resolve(repoRoot, '.output', 'local-deploy')
  if (resolvedOutputRoot !== expectedOutputRoot) {
    throw new Error(`Refusing to clean unexpected output directory: ${resolvedOutputRoot}`)
  }
  await rmWithRetry(resolvedOutputRoot)
  await fs.mkdir(resolvedOutputRoot, { recursive: true })
}

async function rmWithRetry(targetPath, attempts = 8) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)))
    }
  }
  throw lastError
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
  await resetOutputRoot(outputRoot)
  const packageName = `${packageInfo.name}-local-${stamp}`
  const packageDir = path.join(outputRoot, packageName)
  const zipPath = `${packageDir}.zip`

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
        lanEntry: 'start-lan-share.cmd',
        server: 'scripts/serve-dist.mjs',
        dist: 'dist',
        bundledNodeModules: ['@playwright/test', 'playwright', 'playwright-core'],
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
