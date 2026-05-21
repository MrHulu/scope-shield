#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const PLAYWRIGHT_PACKAGE = '@playwright/test@1.58'

const SYSTEM_BROWSER_PATHS = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ],
}

export function commandForPlatform(command, platform = process.platform) {
  return platform === 'win32' ? `${command}.cmd` : command
}

export function getPlaywrightInstallCommand({
  cwd = process.cwd(),
  platform = process.platform,
  pathExists = fs.existsSync,
  nodePath = process.execPath,
} = {}) {
  const localCli = path.join(cwd, 'node_modules', 'playwright', 'cli.js')
  if (pathExists(localCli)) {
    return {
      command: nodePath,
      args: [localCli, 'install', 'chromium'],
    }
  }
  return {
    command: commandForPlatform('npx', platform),
    args: ['playwright', 'install', 'chromium'],
  }
}

export async function getPlaywrightRuntimeStatus({
  importPlaywright = () => import('@playwright/test'),
  pathExists = fs.existsSync,
  platform = process.platform,
} = {}) {
  try {
    const mod = await importPlaywright()
    const executablePath = mod.chromium?.executablePath?.() ?? null
    const bundledBrowserInstalled = Boolean(executablePath && pathExists(executablePath))
    const systemBrowserPath = findSystemBrowser({ platform, pathExists })
    return {
      packageInstalled: true,
      browserInstalled: bundledBrowserInstalled || Boolean(systemBrowserPath),
      executablePath,
      systemBrowserPath,
    }
  } catch {
    return {
      packageInstalled: false,
      browserInstalled: false,
      executablePath: null,
      systemBrowserPath: null,
    }
  }
}

export function findSystemBrowser({
  platform = process.platform,
  pathExists = fs.existsSync,
} = {}) {
  for (const candidate of SYSTEM_BROWSER_PATHS[platform] ?? []) {
    if (pathExists(candidate)) return candidate
  }
  return null
}

function runChecked(command, args, {
  cwd = process.cwd(),
  run = spawnSync,
  stdio = 'inherit',
} = {}) {
  const result = run(command, args, {
    cwd,
    stdio,
    shell: false,
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

export async function ensureFeishuRuntime({
  cwd = process.cwd(),
  platform = process.platform,
  log = console.log,
  run = spawnSync,
  importPlaywright,
  pathExists,
} = {}) {
  const status = await getPlaywrightRuntimeStatus({ importPlaywright, pathExists, platform })
  const npmCommand = commandForPlatform('npm', platform)

  if (!status.packageInstalled) {
    log('First launch: installing Feishu login components. This only needs to happen once.')
    runChecked(npmCommand, ['install', '--no-save', PLAYWRIGHT_PACKAGE], { cwd, run })
    log('Installing Chromium for the login window...')
    const install = getPlaywrightInstallCommand({ cwd, platform, pathExists })
    runChecked(install.command, install.args, { cwd, run })
    log('Feishu login components are ready.')
    return {
      installedPackage: true,
      installedBrowser: true,
    }
  }

  if (!status.browserInstalled) {
    log('Completing Chromium setup for the Feishu login window...')
    const install = getPlaywrightInstallCommand({ cwd, platform, pathExists })
    runChecked(install.command, install.args, { cwd, run })
    log('Feishu login components are ready.')
    return {
      installedPackage: false,
      installedBrowser: true,
    }
  }

  log('Feishu login components are ready.')
  if (status.systemBrowserPath) {
    log(`Using system browser for Feishu login: ${status.systemBrowserPath}`)
  }
  return {
    installedPackage: false,
    installedBrowser: false,
  }
}

async function main() {
  await ensureFeishuRuntime()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
