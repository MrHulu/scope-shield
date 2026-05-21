import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const FEISHU_ORIGIN = 'https://project.feishu.cn'
export const FEISHU_PROXY_PREFIX = '/api/feishu'
export const FEISHU_GOAPI_PREFIX = '/goapi'
export const CREDENTIAL_PATH = path.join(
  process.env.SCOPE_SHIELD_FEISHU_STATE_PATH
    ? path.dirname(process.env.SCOPE_SHIELD_FEISHU_STATE_PATH)
    : path.join(os.homedir(), '.credential-center'),
  process.env.SCOPE_SHIELD_FEISHU_STATE_PATH
    ? path.basename(process.env.SCOPE_SHIELD_FEISHU_STATE_PATH)
    : 'feishu_project_state.json',
)

export function loadFeishuCookies(statePath = CREDENTIAL_PATH) {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
    const cookies = Array.isArray(raw.cookies) ? raw.cookies : []
    const parts = cookies
      .filter((cookie) => isFeishuCookie(cookie))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
    const csrfToken =
      cookies.find((cookie) => isFeishuCookie(cookie) && cookie.name === 'meego_csrf_token')?.value ?? ''
    return parts.length ? { cookieHeader: parts.join('; '), csrfToken } : null
  } catch {
    return null
  }
}

export function buildFeishuProxyHeaders(creds, incomingHeaders = {}) {
  const incomingContentType = incomingHeaders['content-type']
  const contentType = Array.isArray(incomingContentType)
    ? incomingContentType[0]
    : incomingContentType
  const headers = {
    'Content-Type': contentType ?? 'application/json',
    Cookie: creds.cookieHeader,
    Referer: `${FEISHU_ORIGIN}/`,
    Origin: FEISHU_ORIGIN,
  }
  if (creds.csrfToken) {
    headers['x-meego-csrf-token'] = creds.csrfToken
  }
  return headers
}

export function rewriteFeishuProxyPath(pathname) {
  if (pathname === FEISHU_PROXY_PREFIX) {
    return FEISHU_GOAPI_PREFIX
  }
  if (!pathname.startsWith(`${FEISHU_PROXY_PREFIX}/`)) {
    throw new Error(`Not a Feishu proxy path: ${pathname}`)
  }
  const suffix = pathname.slice(FEISHU_PROXY_PREFIX.length)
  if (suffix.includes('..') || suffix.includes('\\')) {
    throw new Error(`Unsafe Feishu proxy path: ${pathname}`)
  }
  return `${FEISHU_GOAPI_PREFIX}${suffix}`
}

export function buildFeishuTargetUrl(requestUrl) {
  const url = new URL(requestUrl, 'http://scope-shield.local')
  const targetPath = rewriteFeishuProxyPath(url.pathname)
  return `${FEISHU_ORIGIN}${targetPath}${url.search}`
}

function isFeishuCookie(cookie) {
  return (
    cookie &&
    typeof cookie.name === 'string' &&
    typeof cookie.value === 'string' &&
    typeof cookie.domain === 'string' &&
    cookie.domain.includes('feishu.cn')
  )
}
