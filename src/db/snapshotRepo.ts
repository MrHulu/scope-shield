import { getDB } from './connection';
import { notifyDataChange } from './changeNotifier';
import type { Snapshot } from '../types';

export async function getSnapshotsByProject(projectId: string): Promise<Snapshot[]> {
  const db = await getDB();
  return db.getAllFromIndex('snapshots', 'projectId', projectId);
}

export async function putSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await getDB();
  await db.put('snapshots', snapshot);
  notifyDataChange();
}

export async function deleteSnapshotsByProject(projectId: string): Promise<void> {
  const db = await getDB();
  const snaps = await db.getAllFromIndex('snapshots', 'projectId', projectId);
  const tx = db.transaction('snapshots', 'readwrite');
  for (const s of snaps) {
    tx.store.delete(s.id);
  }
  await tx.done;
  notifyDataChange();
}
