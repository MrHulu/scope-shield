import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const LOCAL_DATA_FILENAME = 'scope-shield-backup.json'

export function getLocalDataDir(env = process.env, platform = process.platform) {
  const base = platform === 'win32'
    ? env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    : platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
  return path.join(base, 'ScopeShield')
}

export function getLocalDataPath(options = {}) {
  const env = options.env || process.env
  return options.dataPath
    || env.SCOPE_SHIELD_LOCAL_DATA_PATH
    || path.join(getLocalDataDir(env, options.platform), LOCAL_DATA_FILENAME)
}

export function loadLocalBackup(options = {}) {
  const filePath = getLocalDataPath(options)
  try {
    const backup = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return { ok: true, exists: true, filePath, backup }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { ok: true, exists: false, filePath, backup: null }
    }
    return {
      ok: false,
      exists: false,
      filePath,
      backup: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function saveLocalBackup(backup, options = {}) {
  const filePath = getLocalDataPath(options)
  validateBackupShape(backup)
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.tmp`
  await fsp.writeFile(tempPath, JSON.stringify(backup, null, 2), 'utf-8')
  await fsp.rename(tempPath, filePath)
  return { ok: true, filePath }
}

function validateBackupShape(backup) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Backup payload must be an object')
  }
  if (backup.version !== '1.0') {
    throw new Error('Backup version must be 1.0')
  }
  if (!backup.data || typeof backup.data !== 'object') {
    throw new Error('Backup data is missing')
  }
  if (!Array.isArray(backup.data.projects)) {
    throw new Error('Backup data.projects must be an array')
  }
}
