/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

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
  plugins: [react(), tailwindcss()],
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
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', '**/*.spec.ts', 'node_modules/**', 'dist/**'],
  },
})
