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
  isPathInside,
  parseLocalDeployArgs,
} from './local-deploy-utils.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

function help() {
  return `
Scope Shield local static server

Usage:
  node scripts/serve-dist.mjs [--root dist] [--host 0.0.0.0] [--port 4173] [--no-open]

Options:
  --root <dir>     Built SPA directory. Default: dist
  --host <host>    Bind address. Use 0.0.0.0 for LAN. Default: 0.0.0.0
  --port <port>    First port to try. If busy, the next ports are tried. Default: 4173
  --no-open        Do not open the local browser automatically
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

function createServer(rootDir) {
  return http.createServer(async (req, res) => {
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

async function listenWithPortFallback(server, host, firstPort, attempts = 20) {
  let port = firstPort

  return new Promise((resolve, reject) => {
    const tryListen = () => {
      const cleanup = () => {
        server.off('error', onError)
        server.off('listening', onListening)
      }
      const onError = (error) => {
        cleanup()
        if (error.code === 'EADDRINUSE' && port < firstPort + attempts) {
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

async function main() {
  const options = parseLocalDeployArgs(process.argv.slice(2))
  if (options.help) {
    console.log(help())
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

  const server = createServer(rootDir)
  const actualPort = await listenWithPortFallback(server, options.host, options.port)
  const urls = getDisplayUrls({ host: options.host, port: actualPort })

  console.log('\nScope Shield local deploy is running.')
  console.log(`Serving: ${rootDir}`)
  for (const [index, url] of urls.entries()) {
    console.log(`${index === 0 ? 'Local' : 'LAN  '}: ${url}`)
  }
  console.log('\nKeep this window open. Press Ctrl+C to stop.\n')

  if (options.open) {
    openBrowser(getOpenUrl({ host: options.host, port: actualPort }))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
