import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  getContentType,
  getDisplayUrls,
  getLanAddresses,
  isPathInside,
  localDeployStamp,
  parseLocalDeployArgs,
} from './local-deploy-utils.mjs'

test('parseLocalDeployArgs reads host, port, root and booleans', () => {
  assert.deepEqual(
    parseLocalDeployArgs([
      '--host',
      '127.0.0.1',
      '--port=8080',
      '--root',
      'public-build',
      '--no-open',
      '--skip-build',
      '--no-zip',
    ]),
    {
      host: '127.0.0.1',
      port: 8080,
      root: 'public-build',
      open: false,
      skipBuild: true,
      noZip: true,
      help: false,
    },
  )
})

test('parseLocalDeployArgs rejects invalid ports', () => {
  assert.throws(() => parseLocalDeployArgs(['--port', '0']), /Invalid port/)
  assert.throws(() => parseLocalDeployArgs(['--port', 'abc']), /Invalid port/)
})

test('getLanAddresses returns unique non-internal IPv4 addresses', () => {
  const interfaces = {
    Ethernet: [
      { family: 'IPv4', internal: false, address: '192.168.1.8' },
      { family: 'IPv4', internal: false, address: '192.168.1.8' },
      { family: 'IPv6', internal: false, address: 'fe80::1' },
    ],
    Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    WiFi: [{ family: 'IPv4', internal: false, address: '10.0.0.12' }],
  }
  assert.deepEqual(getLanAddresses(interfaces), ['192.168.1.8', '10.0.0.12'])
})

test('getDisplayUrls includes localhost and LAN URLs for 0.0.0.0', () => {
  const interfaces = {
    Ethernet: [{ family: 'IPv4', internal: false, address: '192.168.1.8' }],
  }
  assert.deepEqual(getDisplayUrls({ host: '0.0.0.0', port: 4173, interfaces }), [
    'http://localhost:4173/',
    'http://192.168.1.8:4173/',
  ])
})

test('isPathInside rejects directory traversal targets', () => {
  const root = path.resolve('dist')
  assert.equal(isPathInside(root, path.join(root, 'index.html')), true)
  assert.equal(isPathInside(root, path.resolve('outside.js')), false)
})

test('getContentType maps common static assets', () => {
  assert.equal(getContentType('index.html'), 'text/html; charset=utf-8')
  assert.equal(getContentType('assets/app.js'), 'text/javascript; charset=utf-8')
  assert.equal(getContentType('assets/app.woff2'), 'font/woff2')
  assert.equal(getContentType('assets/app.unknown'), 'application/octet-stream')
})

test('localDeployStamp is stable and filesystem-safe', () => {
  assert.equal(localDeployStamp(new Date('2026-05-20T09:08:07')), '20260520-090807')
})
