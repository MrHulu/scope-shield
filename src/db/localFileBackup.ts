import type { AutoBackup } from './autoBackup';

export interface LocalFileBackupStatus {
  ok: boolean;
  exists: boolean;
  filePath?: string;
  error?: string;
}

export async function loadLocalFileBackup(): Promise<AutoBackup | null> {
  try {
    const resp = await fetch('/__local_data/backup', { cache: 'no-store' });
    if (resp.status === 404) return null;
    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.backup ?? null;
  } catch {
    return null;
  }
}

export async function saveLocalFileBackup(backup: AutoBackup): Promise<void> {
  try {
    await fetch('/__local_data/backup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backup),
    });
  } catch {
    // Browser-only mode or local server unavailable; IndexedDB/localStorage remain authoritative.
  }
}

export async function getLocalFileBackupStatus(): Promise<LocalFileBackupStatus | null> {
  try {
    const resp = await fetch('/__local_data/status', { cache: 'no-store' });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
