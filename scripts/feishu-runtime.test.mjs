import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildFeishuProxyHeaders,
  buildFeishuTargetUrl,
  loadFeishuCookies,
  rewriteFeishuProxyPath,
} from './feishu-runtime.mjs'

test('loadFeishuCookies extracts only Feishu cookies and csrf token', () => {
  const file = path.join(os.tmpdir(), `scope-shield-feishu-${Date.now()}.json`)
  fs.writeFileSync(file, JSON.stringify({
    cookies: [
      { name: 'session', value: 'abc', domain: '.feishu.cn' },
      { name: 'meego_csrf_token', value: 'csrf', domain: 'project.feishu.cn' },
      { name: 'other', value: 'ignore', domain: 'example.com' },
    ],
  }))
  try {
    assert.deepEqual(loadFeishuCookies(file), {
      cookieHeader: 'session=abc; meego_csrf_token=csrf',
      csrfToken: 'csrf',
    })
  } finally {
    fs.rmSync(file, { force: true })
  }
})

test('loadFeishuCookies returns null for missing or malformed credential files', () => {
  assert.equal(loadFeishuCookies(path.join(os.tmpdir(), 'missing-scope-shield-feishu.json')), null)
})

test('buildFeishuProxyHeaders injects cookie, csrf and Feishu origin headers', () => {
  assert.deepEqual(
    buildFeishuProxyHeaders(
      { cookieHeader: 'a=b', csrfToken: 'csrf' },
      { 'content-type': 'application/custom+json' },
    ),
    {
      'Content-Type': 'application/custom+json',
      Cookie: 'a=b',
      Referer: 'https://project.feishu.cn/',
      Origin: 'https://project.feishu.cn',
      'x-meego-csrf-token': 'csrf',
    },
  )
})

test('rewriteFeishuProxyPath maps /api/feishu to /goapi and rejects unsafe paths', () => {
  assert.equal(rewriteFeishuProxyPath('/api/feishu/v1/project/x'), '/goapi/v1/project/x')
  assert.equal(buildFeishuTargetUrl('/api/feishu/v1/project/x?a=1'), 'https://project.feishu.cn/goapi/v1/project/x?a=1')
  assert.throws(() => rewriteFeishuProxyPath('/api/other/v1'), /Not a Feishu proxy path/)
  assert.throws(() => rewriteFeishuProxyPath('/api/feishu/../secret'), /Unsafe Feishu proxy path/)
})
