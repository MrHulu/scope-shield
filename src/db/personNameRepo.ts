import { getDB } from './connection';
import type { PersonNameCache, Role } from '../types';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

export async function getPersonNames(): Promise<PersonNameCache[]> {
  const db = await getDB();
  const all = await db.getAll('personNameCache');
  return all.sort((a, b) => b.usageCount - a.usageCount);
}

export async function upsertPersonName(name: string, role: Role): Promise<void> {
  if (!name.trim()) return;
  const db = await getDB();
  const all = await db.getAllFromIndex('personNameCache', 'name', name);
  if (all.length > 0) {
    const existing = all[0];
    await db.put('personNameCache', {
      ...existing,
      role,
      usageCount: existing.usageCount + 1,
      lastUsedAt: now(),
    });
  } else {
    await db.put('personNameCache', {
      id: generateId(),
      name,
      role,
      usageCount: 1,
      lastUsedAt: now(),
    });
  }
}

export async function cleanupOldNames(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('personNameCache');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString();

  const tx = db.transaction('personNameCache', 'readwrite');
  for (const entry of all) {
    if (entry.lastUsedAt < cutoffStr) {
      tx.store.delete(entry.id);
    }
  }
  await tx.done;
}
