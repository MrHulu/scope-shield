import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const repoRoot = path.resolve(import.meta.dirname, '..')

async function withServer(args, fn, env = {}) {
  const proc = spawn(process.execPath, ['scripts/serve-dist.mjs', ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  proc.stdout.on('data', (data) => { stdout += data.toString() })
  proc.stderr.on('data', (data) => { stderr += data.toString() })

  try {
    await waitUntil(() => stdout.includes('Scope Shield local deploy is running.'))
    return await fn({ proc, stdout: () => stdout, stderr: () => stderr })
  } finally {
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill('SIGTERM')
      await new Promise((resolve) => proc.once('close', resolve))
    }
  }
}

async function waitUntil(predicate, timeoutMs = 10_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for server')
}

async function makeDistRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scope-shield-dist-'))
  await fs.writeFile(path.join(root, 'index.html'), '<html><body>Scope Shield</body></html>')
  return root
}

test('static LAN mode blocks Feishu runtime endpoints and serves SPA fallback', async () => {
  const root = await makeDistRoot()
  const port = 5191
  try {
    await withServer(['--root', root, '--host', '0.0.0.0', '--port', String(port), '--no-open'], async () => {
      const status = await fetch(`http://127.0.0.1:${port}/__feishu/status`)
      assert.equal(status.status, 403)
      assert.equal((await status.json()).enabled, false)

      const login = await fetch(`http://127.0.0.1:${port}/__feishu/login`, { method: 'POST' })
      assert.equal(login.status, 403)

      const localData = await fetch(`http://127.0.0.1:${port}/__local_data/backup`)
      assert.equal(localData.status, 403)
      assert.equal((await localData.json()).enabled, false)

      const spa = await fetch(`http://127.0.0.1:${port}/projects/demo`)
      assert.equal(spa.status, 200)
      assert.match(await spa.text(), /Scope Shield/)
    })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('private local mode enables Feishu status endpoint', async () => {
  const root = await makeDistRoot()
  const port = 5192
  try {
    await withServer(['--root', root, '--host', '127.0.0.1', '--port', String(port), '--feishu', '--no-open'], async ({ stdout }) => {
      assert.match(stdout(), /Feishu: enabled/)
      const status = await fetch(`http://127.0.0.1:${port}/__feishu/status`)
      assert.equal(status.status, 200)
      const json = await status.json()
      assert.equal(json.enabled, true)
      assert.equal(typeof json.loggedIn, 'boolean')
    })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('private local login endpoint returns after launching the login process', async () => {
  const root = await makeDistRoot()
  const loginScript = path.join(root, 'fake-feishu-login.mjs')
  const port = 5193
  try {
    await fs.writeFile(loginScript, 'setTimeout(() => process.exit(0), 2000)\n')
    await withServer(
      ['--root', root, '--host', '127.0.0.1', '--port', String(port), '--feishu', '--no-open'],
      async () => {
        const login = await fetch(`http://127.0.0.1:${port}/__feishu/login`, { method: 'POST' })
        assert.equal(login.status, 202)
        const json = await login.json()
        assert.equal(json.ok, true)
        assert.equal(json.started, true)
        assert.equal(json.status.running, true)

        const status = await fetch(`http://127.0.0.1:${port}/__feishu/status`)
        assert.equal(status.status, 200)
        const statusJson = await status.json()
        assert.equal(statusJson.login.running, true)
      },
      { SCOPE_SHIELD_FEISHU_LOGIN_SCRIPT: loginScript },
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('private local mode can open Feishu login automatically when credentials are missing', async () => {
  const root = await makeDistRoot()
  const loginScript = path.join(root, 'fake-auto-feishu-login.mjs')
  const marker = path.join(root, 'auto-login-started.txt')
  const missingStatePath = path.join(root, 'missing-feishu-state.json')
  const port = 5196
  try {
    await fs.writeFile(
      loginScript,
      `import fs from 'node:fs';
fs.writeFileSync(process.env.SCOPE_SHIELD_FAKE_LOGIN_MARKER, 'started');
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1000);
`,
    )
    await withServer(
      [
        '--root',
        root,
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--feishu',
        '--no-open',
        '--auto-feishu-login',
      ],
      async () => {
        await waitUntil(async () => {
          try {
            await fs.access(marker)
            return true
          } catch {
            return false
          }
        })
        const status = await fetch(`http://127.0.0.1:${port}/__feishu/status`)
        assert.equal(status.status, 200)
        assert.equal((await status.json()).login.running, true)
      },
      {
        SCOPE_SHIELD_FEISHU_LOGIN_SCRIPT: loginScript,
        SCOPE_SHIELD_FEISHU_STATE_PATH: missingStatePath,
        SCOPE_SHIELD_FAKE_LOGIN_MARKER: marker,
      },
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('local data backup endpoint persists and returns the backup file', async () => {
  const root = await makeDistRoot()
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scope-shield-local-data-'))
  const dataPath = path.join(dataDir, 'backup.json')
  const port = 5194
  const backup = {
    version: '1.0',
    createdAt: '2026-05-20T00:00:00.000Z',
    projectCount: 1,
    requirementCount: 0,
    data: { version: '1.0', exportedAt: '2026-05-20T00:00:00.000Z', projects: [], personNameCache: [] },
  }
  try {
    await withServer(
      ['--root', root, '--host', '127.0.0.1', '--port', String(port), '--no-open'],
      async () => {
        const missing = await fetch(`http://127.0.0.1:${port}/__local_data/backup`)
        assert.equal(missing.status, 404)

        const saved = await fetch(`http://127.0.0.1:${port}/__local_data/backup`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backup),
        })
        assert.equal(saved.status, 200)
        assert.equal((await saved.json()).filePath, dataPath)

        const loaded = await fetch(`http://127.0.0.1:${port}/__local_data/backup`)
        assert.equal(loaded.status, 200)
        assert.deepEqual((await loaded.json()).backup, backup)
      },
      { SCOPE_SHIELD_LOCAL_DATA_PATH: dataPath },
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('shutdown-on-idle stops the private local server after browser heartbeats end', async () => {
  const root = await makeDistRoot()
  const port = 5195
  try {
    await withServer(
      [
        '--root',
        root,
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--no-open',
        '--shutdown-on-idle',
        '--idle-timeout-ms',
        '300',
      ],
      async ({ proc }) => {
        const heartbeat = await fetch(`http://127.0.0.1:${port}/__runtime/heartbeat`, {
          method: 'POST',
        })
        assert.equal(heartbeat.status, 200)
        const json = await heartbeat.json()
        assert.equal(json.shutdownOnIdle, true)
        assert.equal(json.idleTimeoutMs, 300)
        assert.equal(typeof json.lastHeartbeatAt, 'string')

        await waitUntil(() => proc.exitCode !== null, 5_000)
        assert.equal(proc.exitCode, 0)
      },
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
