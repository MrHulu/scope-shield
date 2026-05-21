import { spawn } from 'node:child_process'

export function createFeishuLoginManager({
  nodePath = process.execPath,
  scriptPath,
  cwd,
  env = process.env,
  spawnProcess = spawn,
} = {}) {
  let current = null
  let lastResult = null

  function status() {
    return {
      running: Boolean(current),
      lastExitCode: lastResult?.exitCode ?? null,
      lastSignal: lastResult?.signal ?? null,
      lastError: lastResult?.error ?? null,
      lastFinishedAt: lastResult?.finishedAt ?? null,
    }
  }

  function start() {
    if (current) {
      return {
        ok: true,
        started: false,
        alreadyRunning: true,
        status: status(),
      }
    }

    let proc
    try {
      proc = spawnProcess(nodePath, [scriptPath], {
        cwd,
        env: { ...env, FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      lastResult = failedResult(error instanceof Error ? error.message : String(error))
      return {
        ok: false,
        started: false,
        alreadyRunning: false,
        error: lastResult.error,
        status: status(),
      }
    }

    current = { proc, stdout: '', stderr: '' }
    lastResult = null

    proc.stdout?.on('data', (data) => {
      if (current?.proc === proc) current.stdout += data.toString()
    })
    proc.stderr?.on('data', (data) => {
      if (current?.proc === proc) current.stderr += data.toString()
    })
    proc.on('error', (error) => {
      if (current?.proc === proc) current = null
      lastResult = failedResult(error.message)
    })
    proc.on('close', (code, signal) => {
      const snapshot = current?.proc === proc ? current : null
      if (current?.proc === proc) current = null
      lastResult = {
        exitCode: code,
        signal: signal ?? null,
        error: code === 0 ? null : compactProcessError(snapshot, code, signal),
        finishedAt: new Date().toISOString(),
      }
    })

    return {
      ok: true,
      started: true,
      alreadyRunning: false,
      status: status(),
    }
  }

  function stop({ signal = 'SIGTERM', forceAfterMs = 1_500 } = {}) {
    if (!current) {
      return { ok: true, stopped: false, status: status() }
    }

    const snapshot = current
    let killed = false
    try {
      killed = snapshot.proc.kill(signal)
    } catch (error) {
      return Promise.resolve({
        ok: false,
        stopped: false,
        error: error instanceof Error ? error.message : String(error),
        status: status(),
      })
    }

    return new Promise((resolve) => {
      let forceTimer = null
      let giveUpTimer = null
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        if (forceTimer) clearTimeout(forceTimer)
        if (giveUpTimer) clearTimeout(giveUpTimer)
        resolve({ ok: true, stopped: killed, status: status() })
      }

      snapshot.proc.once?.('close', finish)
      snapshot.proc.once?.('exit', finish)

      if (forceAfterMs > 0) {
        forceTimer = setTimeout(() => {
          if (current?.proc === snapshot.proc) {
            forceKillProcessTree(snapshot.proc)
          }
        }, forceAfterMs)
        giveUpTimer = setTimeout(finish, forceAfterMs + 2_000)
      }

      if (!snapshot.proc.once) {
        finish()
      }
    })
  }

  return { start, status, stop }
}

function forceKillProcessTree(proc) {
  if (process.platform === 'win32' && proc.pid) {
    try {
      const taskkill = spawn('taskkill.exe', ['/PID', String(proc.pid), '/T', '/F'], {
        stdio: 'ignore',
      })
      taskkill.on('error', () => {
        try { proc.kill('SIGKILL') } catch { /* best effort */ }
      })
      return
    } catch {
      // Fall through to direct process kill.
    }
  }
  try { proc.kill('SIGKILL') } catch { /* best effort */ }
}

function failedResult(error) {
  return {
    exitCode: null,
    signal: null,
    error,
    finishedAt: new Date().toISOString(),
  }
}

function compactProcessError(snapshot, code, signal) {
  const output = (snapshot?.stderr || snapshot?.stdout || '').trim()
  if (output) return output
  if (signal) return `killed by ${signal}`
  return `exit ${code}`
}
