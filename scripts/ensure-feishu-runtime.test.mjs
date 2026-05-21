import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  PLAYWRIGHT_PACKAGE,
  commandForPlatform,
  ensureFeishuRuntime,
  findSystemBrowser,
  getPlaywrightInstallCommand,
  getPlaywrightRuntimeStatus,
} from './ensure-feishu-runtime.mjs'

test('getPlaywrightRuntimeStatus detects installed package and browser executable', async () => {
  const status = await getPlaywrightRuntimeStatus({
    importPlaywright: async () => ({
      chromium: {
        executablePath: () => '/cache/chromium',
      },
    }),
    pathExists: (target) => target === '/cache/chromium',
  })

  assert.deepEqual(status, {
    packageInstalled: true,
    browserInstalled: true,
    executablePath: '/cache/chromium',
    systemBrowserPath: null,
  })
})

test('getPlaywrightRuntimeStatus accepts a system Chrome or Edge browser', async () => {
  const status = await getPlaywrightRuntimeStatus({
    platform: 'win32',
    importPlaywright: async () => ({
      chromium: {
        executablePath: () => 'C:\\missing\\chromium.exe',
      },
    }),
    pathExists: (target) => target === 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  })

  assert.equal(status.packageInstalled, true)
  assert.equal(status.browserInstalled, true)
  assert.equal(status.systemBrowserPath, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
})

test('ensureFeishuRuntime does nothing when package and browser are ready', async () => {
  const commands = []
  const result = await ensureFeishuRuntime({
    log: () => {},
    importPlaywright: async () => ({
      chromium: {
        executablePath: () => '/cache/chromium',
      },
    }),
    pathExists: (target) => target === '/cache/chromium',
    run: (command, args) => {
      commands.push([command, ...args])
      return { status: 0 }
    },
  })

  assert.deepEqual(commands, [])
  assert.deepEqual(result, {
    installedPackage: false,
    installedBrowser: false,
  })
})

test('ensureFeishuRuntime installs package and browser when Playwright is missing', async () => {
  const commands = []
  const cwd = 'C:\\package'
  const localCli = 'C:\\package\\node_modules\\playwright\\cli.js'
  const result = await ensureFeishuRuntime({
    cwd,
    platform: 'win32',
    log: () => {},
    importPlaywright: async () => {
      throw new Error('missing')
    },
    pathExists: (target) => target === localCli,
    run: (command, args) => {
      commands.push([command, ...args])
      return { status: 0 }
    },
  })

  assert.deepEqual(commands, [
    ['npm.cmd', 'install', '--no-save', PLAYWRIGHT_PACKAGE],
    [process.execPath, localCli, 'install', 'chromium'],
  ])
  assert.deepEqual(result, {
    installedPackage: true,
    installedBrowser: true,
  })
})

test('ensureFeishuRuntime installs only Chromium when the package exists but browser is missing', async () => {
  const commands = []
  const result = await ensureFeishuRuntime({
    platform: 'linux',
    log: () => {},
    importPlaywright: async () => ({
      chromium: {
        executablePath: () => '/cache/missing-chromium',
      },
    }),
    pathExists: () => false,
    run: (command, args) => {
      commands.push([command, ...args])
      return { status: 0 }
    },
  })

  assert.deepEqual(commands, [
    ['npx', 'playwright', 'install', 'chromium'],
  ])
  assert.deepEqual(result, {
    installedPackage: false,
    installedBrowser: true,
  })
})

test('commandForPlatform appends .cmd on Windows only', () => {
  assert.equal(commandForPlatform('npm', 'win32'), 'npm.cmd')
  assert.equal(commandForPlatform('npm', 'linux'), 'npm')
})

test('findSystemBrowser returns null when no known browser path exists', () => {
  assert.equal(findSystemBrowser({ platform: 'linux', pathExists: () => false }), null)
})

test('getPlaywrightInstallCommand prefers bundled playwright cli', () => {
  const cwd = '/package'
  const localCli = path.join(cwd, 'node_modules', 'playwright', 'cli.js')
  assert.deepEqual(
    getPlaywrightInstallCommand({
      cwd,
      platform: 'linux',
      nodePath: '/node',
      pathExists: (target) => target === localCli,
    }),
    {
      command: '/node',
      args: [localCli, 'install', 'chromium'],
    },
  )
  assert.deepEqual(
    getPlaywrightInstallCommand({
      cwd,
      platform: 'linux',
      pathExists: () => false,
    }),
    {
      command: 'npx',
      args: ['playwright', 'install', 'chromium'],
    },
  )
})
