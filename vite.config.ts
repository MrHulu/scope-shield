/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * Dev-only endpoint that spawns the feishu-login Playwright script.
 * Frontend hits POST /__feishu/login; this proxies to the script and waits
 * for it to finish. The user only sees the popped-up Chromium window —
 * never the terminal.
 */
function feishuLoginPlugin(): Plugin {
  return {
    name: 'scope-shield:feishu-login',
    configureServer(server) {
      server.middlewares.use('/__feishu/login', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        const scriptPath = path.join(here, 'scripts', 'feishu-login.mjs')
        const proc = spawn(process.execPath, [scriptPath], {
          cwd: here,
          env: { ...process.env, FORCE_COLOR: '0' },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        proc.stdout?.on('data', (d) => { stdout += d.toString() })
        proc.stderr?.on('data', (d) => { stderr += d.toString() })
        proc.on('error', (err) => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: err.message }))
        })
        proc.on('close', (code) => {
          res.setHeader('Content-Type', 'application/json')
          if (code === 0) {
            res.end(JSON.stringify({ ok: true, log: stdout.trim() }))
          } else {
            res.statusCode = 500
            res.end(
              JSON.stringify({
                ok: false,
                error: (stderr || stdout || `exit ${code}`).trim(),
              }),
            )
          }
        })
        // Abort the spawned chromium if the browser navigates away
        req.on('close', () => {
          if (proc.exitCode === null) proc.kill('SIGTERM')
        })
      })
    },
  }
}

function loadFeishuCookies(): { cookieHeader: string; csrfToken: string } | null {
  const statePath = path.join(
    os.homedir(),
    '.credential-center',
    'feishu_project_state.json',
  )
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
    const cookies: Array<{ name: string; value: string; domain: string }> =
      raw.cookies ?? []
    const parts = cookies
      .filter((c) => c.domain.includes('feishu.cn'))
      .map((c) => `${c.name}=${c.value}`)
    const csrf =
      cookies.find((c) => c.name === 'meego_csrf_token')?.value ?? ''
    return parts.length ? { cookieHeader: parts.join('; '), csrfToken: csrf } : null
  } catch {
    return null
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), feishuLoginPlugin()],
  server: {
    proxy: {
      '/api/feishu': {
        target: 'https://project.feishu.cn',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/feishu/, '/goapi'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, _req) => {
            const creds = loadFeishuCookies()
            if (!creds) return
            proxyReq.setHeader('Cookie', creds.cookieHeader)
            if (creds.csrfToken) {
              proxyReq.setHeader('x-meego-csrf-token', creds.csrfToken)
            }
            proxyReq.setHeader('Referer', 'https://project.feishu.cn/')
            proxyReq.setHeader('Origin', 'https://project.feishu.cn')
          })
          // DEV-only debug: dump demand_fetch response so we can find which
          // custom field carries the estimate. Removed once mapping is correct.
          proxy.on('proxyRes', (proxyRes, req) => {
            if (!req.url?.includes('demand_fetch')) return
            const chunks: Buffer[] = []
            proxyRes.on('data', (c: Buffer) => chunks.push(c))
            proxyRes.on('end', () => {
              let buf = Buffer.concat(chunks)
              const enc = String(proxyRes.headers['content-encoding'] ?? '').toLowerCase()
              try {
                if (enc.includes('gzip')) buf = zlib.gunzipSync(buf)
                else if (enc.includes('deflate')) buf = zlib.inflateSync(buf)
                else if (enc.includes('br')) buf = zlib.brotliDecompressSync(buf)
              } catch (e) {
                // eslint-disable-next-line no-console
                console.log(`[feishu-debug] decompress (${enc}) failed: ${(e as Error).message}`)
              }
              const body = buf.toString('utf8')
              // eslint-disable-next-line no-console
              console.log(`\n[feishu-debug] ${req.method} ${req.url} (encoding=${enc || 'identity'})\n${body.slice(0, 32000)}\n`)
            })
          })
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', '**/*.spec.ts', 'node_modules/**', 'dist/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**',
      ],
      // Ratcheting baseline: thresholds set just under 2026-05-01 numbers
      // (lines 34 / branches 32 / functions 20 / statements 33). Wave 1 will
      // push these up; raise here whenever a new floor is reached.
      thresholds: {
        lines: 30,
        branches: 30,
        functions: 18,
        statements: 30,
      },
    },
  },
})
