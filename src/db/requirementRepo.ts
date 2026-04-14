import { getDB } from './connection';
import type { Requirement, CreateRequirementInput } from '../types';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

export async function getRequirementsByProject(projectId: string): Promise<Requirement[]> {
  const db = await getDB();
  return db.getAllFromIndex('requirements', 'projectId', projectId);
}

export async function getRequirement(id: string): Promise<Requirement | undefined> {
  const db = await getDB();
  return db.get('requirements', id);
}

export async function createRequirement(input: CreateRequirementInput): Promise<Requirement> {
  const db = await getDB();
  const existing = await db.getAllFromIndex('requirements', 'projectId', input.projectId);
  const maxSort = existing.reduce((max, r) => Math.max(max, r.sortOrder), -1);

  const req: Requirement = {
    id: generateId(),
    projectId: input.projectId,
    name: input.name,
    originalDays: input.originalDays,
    isAddedByChange: false,
    currentDays: input.originalDays,
    status: 'active',
    sortOrder: maxSort + 1,
    dependsOn: input.dependsOn ?? null,
    pausedRemainingDays: null,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.put('requirements', req);
  return req;
}

export async function updateRequirement(id: string, data: Partial<Requirement>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('requirements', id);
  if (!existing) throw new Error(`Requirement ${id} not found`);
  await db.put('requirements', { ...existing, ...data, updatedAt: now() });
}

export async function putRequirement(req: Requirement): Promise<void> {
  const db = await getDB();
  await db.put('requirements', req);
}

export async function deleteRequirement(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('requirements', id);
}

export async function deleteRequirementsByProject(projectId: string): Promise<void> {
  const db = await getDB();
  const reqs = await db.getAllFromIndex('requirements', 'projectId', projectId);
  const tx = db.transaction('requirements', 'readwrite');
  for (const r of reqs) {
    tx.store.delete(r.id);
  }
  await tx.done;
}
