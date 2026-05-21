import os from 'node:os'
import path from 'node:path'

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

export function parseLocalDeployArgs(argv, defaults = {}) {
  const options = {
    host: '0.0.0.0',
    port: 4173,
    root: 'dist',
    open: true,
    skipBuild: false,
    noZip: false,
    feishu: false,
    strictPort: false,
    shutdownOnIdle: false,
    idleTimeoutMs: 20_000,
    autoFeishuLogin: false,
    help: false,
    ...defaults,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    const [name, inlineValue] = token.split('=', 2)

    const readValue = () => {
      if (inlineValue != null) return inlineValue
      i += 1
      if (i >= argv.length) {
        throw new Error(`Missing value for ${token}`)
      }
      return argv[i]
    }

    if (token === '--help' || token === '-h') {
      options.help = true
    } else if (name === '--host') {
      options.host = readValue()
    } else if (name === '--port') {
      options.port = parsePort(readValue())
    } else if (name === '--root') {
      options.root = readValue()
    } else if (token === '--open') {
      options.open = true
    } else if (token === '--no-open') {
      options.open = false
    } else if (token === '--skip-build') {
      options.skipBuild = true
    } else if (token === '--no-zip') {
      options.noZip = true
    } else if (token === '--feishu') {
      options.feishu = true
    } else if (token === '--no-feishu') {
      options.feishu = false
    } else if (token === '--strict-port') {
      options.strictPort = true
    } else if (token === '--shutdown-on-idle') {
      options.shutdownOnIdle = true
    } else if (name === '--idle-timeout-ms') {
      options.idleTimeoutMs = parsePositiveInteger(readValue(), '--idle-timeout-ms')
    } else if (token === '--auto-feishu-login') {
      options.autoFeishuLogin = true
    } else {
      throw new Error(`Unknown option: ${token}`)
    }
  }

  return options
}

export function parsePort(value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`)
  }
  return port
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return parsed
}

export function getLanAddresses(interfaces = os.networkInterfaces()) {
  const addresses = []
  const seen = new Set()

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      if (seen.has(entry.address)) continue
      seen.add(entry.address)
      addresses.push(entry.address)
    }
  }

  return addresses
}

export function getDisplayUrls({ host, port, interfaces = os.networkInterfaces() }) {
  const normalizedHost = host === '::' ? '0.0.0.0' : host
  if (normalizedHost === '0.0.0.0') {
    return [
      `http://localhost:${port}/`,
      ...getLanAddresses(interfaces).map((address) => `http://${address}:${port}/`),
    ]
  }
  return [`http://${normalizedHost}:${port}/`]
}

export function getOpenUrl({ host, port }) {
  if (host === '0.0.0.0' || host === '::') {
    return `http://localhost:${port}/`
  }
  return `http://${host}:${port}/`
}

export function isLoopbackHost(host) {
  return ['localhost', '127.0.0.1', '::1'].includes(host)
}

export function getContentType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream'
}

export function isPathInside(rootDir, targetPath) {
  const relative = path.relative(rootDir, targetPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function localDeployStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}
