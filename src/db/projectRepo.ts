import { getDB } from './connection';
import type { Project, CreateProjectInput } from '../types';
import { generateId } from '../utils/id';
import { today, now } from '../utils/date';

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAll('projects');
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const db = await getDB();
  const project: Project = {
    id: generateId(),
    name: input.name,
    startDate: input.startDate || today(),
    status: 'active',
    isDemo: false,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.put('projects', project);
  return project;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('projects', id);
  if (!existing) throw new Error(`Project ${id} not found`);
  await db.put('projects', { ...existing, ...data, updatedAt: now() });
}

export async function putProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}
