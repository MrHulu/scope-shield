import { getDB } from './connection';
import type { Change } from '../types';

export async function getChangesByProject(projectId: string): Promise<Change[]> {
  const db = await getDB();
  return db.getAllFromIndex('changes', 'projectId', projectId);
}

export async function getChange(id: string): Promise<Change | undefined> {
  const db = await getDB();
  return db.get('changes', id);
}

export async function putChange(change: Change): Promise<void> {
  const db = await getDB();
  await db.put('changes', change);
}

export async function deleteChange(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('changes', id);
}

export async function deleteChangesByProject(projectId: string): Promise<void> {
  const db = await getDB();
  const changes = await db.getAllFromIndex('changes', 'projectId', projectId);
  const tx = db.transaction('changes', 'readwrite');
  for (const c of changes) {
    tx.store.delete(c.id);
  }
  await tx.done;
}
