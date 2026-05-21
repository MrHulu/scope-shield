import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  getLocalDataDir,
  loadLocalBackup,
  saveLocalBackup,
} from './local-data-runtime.mjs'

test('getLocalDataDir uses stable per-user app data paths', () => {
  assert.equal(
    getLocalDataDir({ APPDATA: 'C:\\Users\\Boss\\AppData\\Roaming' }, 'win32'),
    'C:\\Users\\Boss\\AppData\\Roaming\\ScopeShield',
  )
  assert.match(getLocalDataDir({}, 'linux'), /ScopeShield$/)
})

test('saveLocalBackup and loadLocalBackup roundtrip backup JSON', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scope-shield-data-'))
  const dataPath = path.join(dir, 'backup.json')
  const backup = {
    version: '1.0',
    createdAt: '2026-05-20T00:00:00.000Z',
    projectCount: 1,
    requirementCount: 0,
    data: { version: '1.0', exportedAt: '2026-05-20T00:00:00.000Z', projects: [], personNameCache: [] },
  }

  try {
    await saveLocalBackup(backup, { dataPath })
    assert.deepEqual(loadLocalBackup({ dataPath }), {
      ok: true,
      exists: true,
      filePath: dataPath,
      backup,
    })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('saveLocalBackup rejects malformed payloads', async () => {
  await assert.rejects(() => saveLocalBackup({ version: 'x' }, { dataPath: 'unused.json' }), /version/)
})
