#!/usr/bin/env node
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  getContentType,
  getDisplayUrls,
  getOpenUrl,
  isLoopbackHost,
  isPathInside,
  parseLocalDeployArgs,
} from './local-deploy-utils.mjs'
import {
  buildFeishuProxyHeaders,
  buildFeishuTargetUrl,
  CREDENTIAL_PATH,
  loadFeishuCookies,
} from './feishu-runtime.mjs'
import { createFeishuLoginManager } from './feishu-login-manager.mjs'
import {
  getLocalDataPath,
  loadLocalBackup,
  saveLocalBackup,
} from './local-data-runtime.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const feishuLoginManager = createFeishuLoginManager({
  scriptPath: process.env.SCOPE_SHIELD_FEISHU_LOGIN_SCRIPT
    || path.join(repoRoot, 'scripts', 'feishu-login.mjs'),
  cwd: repoRoot,
})

function help() {
  return `
Scope Shield local static server

Usage:
  node scripts/serve-dist.mjs [--root dist] [--host 0.0.0.0] [--port 4173] [--no-open] [--feishu]

Options:
  --root <dir>     Built SPA directory. Default: dist
  --host <host>    Bind address. Use 0.0.0.0 for LAN. Default: 0.0.0.0
  --port <port>    First port to try. If busy, the next ports are tried. Default: 4173
  --no-open        Do not open the local browser automatically
  --feishu         Enable local-only Feishu login/proxy endpoints. Requires loopback host.
  --strict-port    Fail instead of trying the next port. Use this for stable browser storage.
  --shutdown-on-idle
                   Stop this server after the browser stops sending heartbeats.
  --idle-timeout-ms <ms>
                   Idle shutdown timeout. Default: 20000
  --auto-feishu-login
                   Open the Feishu login window automatically when credentials are missing.
`.trim()
}

async function resolveFile(rootDir, requestUrl) {
  const url = new URL(requestUrl ?? '/', 'http://scope-shield.local')
  const decodedPath = decodeURIComponent(url.pathname)
  const requestPath = decodedPath === '/' ? '/index.html' : decodedPath
  let targetPath = path.resolve(rootDir, `.${requestPath}`)

  if (!isPathInside(rootDir, targetPath)) {
    return { status: 403, filePath: null }
  }

  try {
    const stat = await fsp.stat(targetPath)
    if (stat.isDirectory()) {
      targetPath = path.join(targetPath, 'index.html')
    }
    await fsp.access(targetPath, fs.constants.R_OK)
    return { status: 200, filePath: targetPath }
  } catch {
    if (path.extname(requestPath)) {
      return { status: 404, filePath: null }
    }
    return { status: 200, filePath: path.join(rootDir, 'index.html') }
  }
}

function createServer(rootDir, options) {
  return http.createServer(async (req, res) => {
    if (isRuntimePath(req.url)) {
      await handleRuntime(req, res, options.runtime)
      return
    }

    if (isLocalDataPath(req.url)) {
      await handleLocalData(req, res, options)
      return
    }

    if (isFeishuRuntimePath(req.url)) {
      await handleFeishuRuntime(req, res, options)
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      res.end('Method Not Allowed')
      return
    }

    let resolved
    try {
      resolved = await resolveFile(rootDir, req.url)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Bad Request')
      return
    }

    if (!resolved.filePath) {
      const message = resolved.status === 403 ? 'Forbidden' : 'Not Found'
      res.writeHead(resolved.status, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(message)
      return
    }

    res.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': getContentType(resolved.filePath),
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    fs.createReadStream(resolved.filePath).pipe(res)
  })
}

function isRuntimePath(requestUrl) {
  const url = new URL(requestUrl ?? '/', 'http://scope-shield.local')
  return url.pathname.startsWith('/__runtime/')
}

async function handleRuntime(req, res, runtime) {
  const url = new URL(req.url ?? '/', 'http://scope-shield.local')
  if (url.pathname !== '/__runtime/heartbeat') {
    writeJson(res, 404, { ok: false, error: 'Not Found' })
    return
  }

  if (!['GET', 'POST', 'HEAD'].includes(req.method ?? '')) {
    writeJson(res, 405, { ok: false, error: 'Method Not Allowed' }, { Allow: 'GET, POST, HEAD' })
    return
  }

  const status = runtime?.heartbeat?.()
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  if (req.method === 'HEAD') {
    res.end()
  } else {
    res.end(JSON.stringify({ ok: true, ...(status ?? {}) }))
  }
}

function isFeishuRuntimePath(requestUrl) {
  const url = new URL(requestUrl ?? '/', 'http://scope-shield.local')
  return url.pathname.startsWith('/__feishu/') || url.pathname.startsWith('/api/feishu')
}

function isLocalDataPath(requestUrl) {
  const url = new URL(requestUrl ?? '/', 'http://scope-shield.local')
  return url.pathname.startsWith('/__local_data/')
}

async function handleLocalData(req, res, options) {
  if (!options.localData) {
    writeJson(res, 403, {
      ok: false,
      enabled: false,
      reason: 'Local file backup is disabled in LAN share/static mode.',
    })
    return
  }

  const url = new URL(req.url ?? '/', 'http://scope-shield.local')
  if (url.pathname === '/__local_data/status') {
    const loaded = loadLocalBackup()
    writeJson(res, loaded.ok ? 200 : 500, {
      ok: loaded.ok,
      exists: loaded.exists,
      filePath: loaded.filePath,
      error: loaded.error,
    })
    return
  }

  if (url.pathname !== '/__local_data/backup') {
    writeJson(res, 404, { ok: false, error: 'Not Found' })
    return
  }

  if (req.method === 'GET') {
    const loaded = loadLocalBackup()
    if (!loaded.ok) {
      writeJson(res, 500, loaded)
      return
    }
    if (!loaded.exists) {
      writeJson(res, 404, {
        ok: false,
        exists: false,
        filePath: loaded.filePath,
      })
      return
    }
    writeJson(res, 200, loaded)
    return
  }

  if (req.method === 'PUT') {
    try {
      const body = await readRequestBody(req)
      const backup = JSON.parse(body.toString('utf-8'))
      const saved = await saveLocalBackup(backup)
      writeJson(res, 200, saved)
    } catch (error) {
      writeJson(res, 400, {
        ok: false,
        filePath: getLocalDataPath(),
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return
  }

  writeJson(res, 405, { ok: false, error: 'Method Not Allowed' }, { Allow: 'GET, PUT' })
}

async function handleFeishuRuntime(req, res, options) {
  const url = new URL(req.url ?? '/', 'http://scope-shield.local')
  if (!options.feishu) {
    writeJson(res, 403, {
      ok: false,
      enabled: false,
      reason: 'Feishu is disabled in LAN share/static mode. Run the app locally to use your own Feishu account.',
    })
    return
  }

  if (url.pathname === '/__feishu/status') {
    const creds = loadFeishuCookies()
    writeJson(res, 200, {
      ok: true,
      enabled: true,
      credentialPath: CREDENTIAL_PATH,
      loggedIn: Boolean(creds),
      setupNeeded: false,
      login: feishuLoginManager.status(),
    })
    return
  }

  if (url.pathname === '/__feishu/login') {
    await handleFeishuLogin(req, res)
    return
  }

  if (url.pathname.startsWith('/api/feishu')) {
    await handleFeishuProxy(req, res)
    return
  }

  writeJson(res, 404, { ok: false, error: 'Not Found' })
}

async function handleFeishuLogin(req, res) {
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: 'Method Not Allowed' }, { Allow: 'POST' })
    return
  }

  const result = feishuLoginManager.start()
  writeJson(res, result.ok ? 202 : 500, result)
}

async function handleFeishuProxy(req, res) {
  const creds = loadFeishuCookies()
  if (!creds) {
    writeJson(res, 401, {
      ok: false,
      error: 'Feishu is not logged in on this computer.',
      credentialPath: CREDENTIAL_PATH,
    })
    return
  }

  try {
    const targetUrl = buildFeishuTargetUrl(req.url ?? '/')
    const body = ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : await readRequestBody(req)
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: buildFeishuProxyHeaders(creds, req.headers),
      body,
    })
    const contentType = response.headers.get('content-type') ?? 'application/json; charset=utf-8'
    const buffer = Buffer.from(await response.arrayBuffer())
    res.writeHead(response.status, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    })
    if (req.method === 'HEAD') {
      res.end()
    } else {
      res.end(buffer)
    }
  } catch (error) {
    writeJson(res, 502, {
      ok: false,
      error: error instanceof Error ? error.message : 'Feishu proxy failed',
    })
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function writeJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(JSON.stringify(payload))
}

async function listenWithPortFallback(server, host, firstPort, attempts = 20, strictPort = false) {
  let port = firstPort

  return new Promise((resolve, reject) => {
    const tryListen = () => {
      const cleanup = () => {
        server.off('error', onError)
        server.off('listening', onListening)
      }
      const onError = (error) => {
        cleanup()
        if (!strictPort && error.code === 'EADDRINUSE' && port < firstPort + attempts) {
          port += 1
          tryListen()
          return
        }
        reject(error)
      }
      const onListening = () => {
        cleanup()
        resolve(port)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, host)
    }
    tryListen()
  })
}

function openBrowser(url) {
  const command =
    process.platform === 'win32' ? 'cmd'
      : process.platform === 'darwin' ? 'open'
        : 'xdg-open'
  const args =
    process.platform === 'win32' ? ['/c', 'start', '', url]
      : [url]

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  } catch {
    // Opening the browser is best-effort; the printed URL is authoritative.
  }
}

function createRuntimeHeartbeat({ enabled, idleTimeoutMs, onIdle }) {
  let lastHeartbeatAt = null
  let timer = null
  let stopped = false

  function stop() {
    stopped = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function scheduleIdleShutdown() {
    if (!enabled || stopped) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (!stopped) onIdle()
    }, idleTimeoutMs)
    timer.unref?.()
  }

  function heartbeat() {
    lastHeartbeatAt = new Date().toISOString()
    scheduleIdleShutdown()
    return {
      shutdownOnIdle: enabled,
      idleTimeoutMs,
      lastHeartbeatAt,
    }
  }

  return { heartbeat, stop }
}

async function main() {
  const options = parseLocalDeployArgs(process.argv.slice(2))
  if (options.help) {
    console.log(help())
    return
  }
  if (options.feishu && !isLoopbackHost(options.host)) {
    console.error('Refusing to enable Feishu endpoints on a non-loopback host.')
    console.error('Use --host 127.0.0.1 --feishu for private local mode, or omit --feishu for LAN share mode.')
    process.exitCode = 1
    return
  }

  const rootDir = path.resolve(repoRoot, options.root)
  const indexPath = path.join(rootDir, 'index.html')
  try {
    await fsp.access(indexPath, fs.constants.R_OK)
  } catch {
    console.error(`Missing build output: ${indexPath}`)
    console.error('Run npm run build first, or use npm run deploy:local.')
    process.exitCode = 1
    return
  }

  let shutdownStarted = false
  let server
  const sockets = new Set()
  const runtime = createRuntimeHeartbeat({
    enabled: options.shutdownOnIdle,
    idleTimeoutMs: options.idleTimeoutMs,
    onIdle: () => {
      void shutdown('browser heartbeat timed out', 0)
    },
  })

  async function shutdown(reason, exitCode) {
    if (shutdownStarted) return Promise.resolve()
    shutdownStarted = true
    runtime.stop()
    if (reason) console.log(`\nStopping Scope Shield local deploy: ${reason}`)
    await feishuLoginManager.stop?.()

    return new Promise((resolve) => {
      const hardExit = setTimeout(() => {
        resolve()
        process.exit(exitCode)
      }, 2_000)
      hardExit.unref?.()

      for (const socket of sockets) {
        socket.destroy()
      }

      server?.close(() => {
        clearTimeout(hardExit)
        resolve()
        process.exit(exitCode)
      })
    })
  }

  process.once('SIGINT', () => { void shutdown('SIGINT', 130) })
  process.once('SIGTERM', () => { void shutdown('SIGTERM', 143) })

  server = createServer(rootDir, {
    ...options,
    localData: isLoopbackHost(options.host),
    runtime,
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  const actualPort = await listenWithPortFallback(server, options.host, options.port, 20, options.strictPort)
  const urls = getDisplayUrls({ host: options.host, port: actualPort })

  console.log('\nScope Shield local deploy is running.')
  console.log(`Serving: ${rootDir}`)
  console.log(`Feishu: ${options.feishu ? 'enabled for this computer only' : 'disabled (LAN share/static mode)'}`)
  console.log(`Data:    ${isLoopbackHost(options.host) ? getLocalDataPath() : 'disabled (LAN share/static mode)'}`)
  if (options.shutdownOnIdle) {
    console.log(`Idle:    stops ${Math.ceil(options.idleTimeoutMs / 1000)}s after the browser is closed`)
  }
  for (const [index, url] of urls.entries()) {
    console.log(`${index === 0 ? 'Local' : 'LAN  '}: ${url}`)
  }
  console.log(options.shutdownOnIdle
    ? '\nClose the browser to stop, or press Ctrl+C.\n'
    : '\nKeep this window open. Press Ctrl+C to stop.\n')

  if (options.open) {
    openBrowser(getOpenUrl({ host: options.host, port: actualPort }))
  }

  if (options.autoFeishuLogin && options.feishu && !loadFeishuCookies()) {
    const result = feishuLoginManager.start()
    if (result.ok) {
      console.log('Feishu login window: opening automatically because no local credentials were found.')
    } else {
      console.log(`Feishu login window: failed to open automatically: ${result.error ?? 'unknown error'}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
