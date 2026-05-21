import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createFeishuLoginManager } from './feishu-login-manager.mjs'

function createFakeSpawn() {
  const processes = []
  const spawnProcess = (command, args, options) => {
    const proc = new EventEmitter()
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.exitCode = null
    proc.kill = (signal = 'SIGTERM') => {
      proc.killed = true
      proc.signal = signal
      queueMicrotask(() => proc.emit('close', null, signal))
      return true
    }
    proc.command = command
    proc.args = args
    proc.options = options
    processes.push(proc)
    return proc
  }
  return { spawnProcess, processes }
}

test('login manager returns immediately and keeps the login process running', () => {
  const fake = createFakeSpawn()
  const manager = createFeishuLoginManager({
    nodePath: 'node',
    scriptPath: 'scripts/feishu-login.mjs',
    cwd: '/package',
    env: { TEST_ENV: '1' },
    spawnProcess: fake.spawnProcess,
  })

  const result = manager.start()

  assert.equal(result.ok, true)
  assert.equal(result.started, true)
  assert.equal(result.status.running, true)
  assert.equal(fake.processes.length, 1)
  assert.deepEqual(fake.processes[0].args, ['scripts/feishu-login.mjs'])
  assert.equal(manager.status().running, true)
})

test('login manager deduplicates concurrent login launches', () => {
  const fake = createFakeSpawn()
  const manager = createFeishuLoginManager({
    nodePath: 'node',
    scriptPath: 'login.mjs',
    cwd: '/package',
    spawnProcess: fake.spawnProcess,
  })

  manager.start()
  const second = manager.start()

  assert.equal(second.ok, true)
  assert.equal(second.started, false)
  assert.equal(second.alreadyRunning, true)
  assert.equal(fake.processes.length, 1)
})

test('login manager records process failure for status polling', () => {
  const fake = createFakeSpawn()
  const manager = createFeishuLoginManager({
    nodePath: 'node',
    scriptPath: 'login.mjs',
    cwd: '/package',
    spawnProcess: fake.spawnProcess,
  })

  manager.start()
  const proc = fake.processes[0]
  proc.stderr.emit('data', Buffer.from('Failed to fetch'))
  proc.exitCode = 1
  proc.emit('close', 1, null)

  assert.deepEqual(manager.status(), {
    running: false,
    lastExitCode: 1,
    lastSignal: null,
    lastError: 'Failed to fetch',
    lastFinishedAt: manager.status().lastFinishedAt,
  })
  assert.equal(typeof manager.status().lastFinishedAt, 'string')
})

test('login manager stops a running login process', async () => {
  const fake = createFakeSpawn()
  const manager = createFeishuLoginManager({
    nodePath: 'node',
    scriptPath: 'login.mjs',
    cwd: '/package',
    spawnProcess: fake.spawnProcess,
  })

  manager.start()
  const result = await manager.stop({ forceAfterMs: 0 })

  assert.equal(result.ok, true)
  assert.equal(result.stopped, true)
  assert.equal(fake.processes[0].killed, true)
  assert.equal(fake.processes[0].signal, 'SIGTERM')
})
