import { getDB } from './connection';
import type { ExportData, Project, Requirement, Change, Snapshot, PersonNameCache } from '../types';

/**
 * Export all data as ExportData JSON.
 */
export async function exportAllData(): Promise<ExportData> {
  const db = await getDB();
  const projects = await db.getAll('projects');
  const allReqs = await db.getAll('requirements');
  const allChanges = await db.getAll('changes');
  const allSnaps = await db.getAll('snapshots');
  const personNameCache = await db.getAll('personNameCache');

  const projectsWithData = projects.map((p) => ({
    ...p,
    requirements: allReqs.filter((r) => r.projectId === p.id),
    changes: allChanges.filter((c) => c.projectId === p.id),
    snapshots: allSnaps.filter((s) => s.projectId === p.id),
  }));

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projects: projectsWithData,
    personNameCache,
  };
}

/**
 * Validate and import data. Atomic: all-or-nothing.
 */
export async function importData(data: unknown): Promise<void> {
  const errors = validateImportData(data);
  if (errors.length > 0) {
    throw new Error(`导入失败：${errors.join('; ')}`);
  }

  const typed = data as ExportData;
  const db = await getDB();

  // Clear all stores in a single transaction
  const storeNames: Array<'projects' | 'requirements' | 'changes' | 'snapshots' | 'personNameCache'> = [
    'projects', 'requirements', 'changes', 'snapshots', 'personNameCache',
  ];
  const tx = db.transaction(storeNames, 'readwrite');

  try {
    // Clear
    for (const name of storeNames) {
      await tx.objectStore(name).clear();
    }

    // Write projects
    for (const p of typed.projects) {
      const { requirements, changes, snapshots, ...project } = p;
      await tx.objectStore('projects').put(project);

      for (const r of requirements) {
        await tx.objectStore('requirements').put(r);
      }
      for (const c of changes) {
        await tx.objectStore('changes').put(c);
      }
      for (const s of snapshots) {
        await tx.objectStore('snapshots').put(s);
      }
    }

    // Write person name cache
    for (const pnc of typed.personNameCache) {
      await tx.objectStore('personNameCache').put(pnc);
    }

    await tx.done;
  } catch (e) {
    // Transaction auto-aborts on error
    throw new Error(`导入写入失败：${(e as Error).message}`);
  }
}

function validateImportData(data: unknown): string[] {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return ['数据格式无效'];
  }

  const d = data as Record<string, unknown>;

  // Version check
  if (d.version !== '1.0') {
    errors.push(`不支持的版本: ${d.version ?? '缺失'}`);
  }

  if (!Array.isArray(d.projects)) {
    errors.push('projects 必须为数组');
    return errors;
  }

  const projectIds = new Set<string>();
  const reqIds = new Set<string>();

  const validStatuses = ['active', 'archived'];
  const validReqStatuses = ['active', 'paused', 'cancelled'];
  const validChangeTypes = ['add_days', 'new_requirement', 'cancel_requirement', 'reprioritize', 'pause', 'resume'];
  const validRoles = ['pm', 'leader', 'qa', 'other'];

  for (const p of d.projects as Array<Record<string, unknown>>) {
    // Required project fields
    for (const field of ['id', 'name', 'startDate', 'status', 'createdAt', 'updatedAt']) {
      if (!p[field]) errors.push(`Project 缺少 ${field}`);
    }
    if (p.id) {
      if (projectIds.has(p.id as string)) errors.push(`Project id 重复: ${p.id}`);
      projectIds.add(p.id as string);
    }
    if (p.status && !validStatuses.includes(p.status as string)) {
      errors.push(`Project 无效 status: ${p.status}`);
    }

    // Requirements
    const reqs = (p.requirements ?? []) as Array<Record<string, unknown>>;
    const changes = (p.changes ?? []) as Array<Record<string, unknown>>;

    if (reqs.length > 50) errors.push(`项目 ${p.name} 需求数超过上限(50)`);
    if (changes.length > 200) errors.push(`项目 ${p.name} 变更数超过上限(200)`);

    const projectReqIds = new Set<string>();

    for (const r of reqs) {
      for (const field of ['id', 'projectId', 'name', 'originalDays', 'currentDays', 'status', 'sortOrder', 'createdAt', 'updatedAt']) {
        if (r[field] === undefined || r[field] === null) {
          if (field !== 'sortOrder') errors.push(`Requirement 缺少 ${field}`);
        }
      }
      if (r.id) {
        if (reqIds.has(r.id as string)) errors.push(`Requirement id 重复: ${r.id}`);
        reqIds.add(r.id as string);
        projectReqIds.add(r.id as string);
      }
      if (r.projectId && r.projectId !== p.id) {
        errors.push(`Requirement ${r.id} projectId 不匹配`);
      }
      if (r.status && !validReqStatuses.includes(r.status as string)) {
        errors.push(`Requirement 无效 status: ${r.status}`);
      }
      if (typeof r.originalDays === 'number' && r.originalDays < 1) {
        errors.push(`Requirement ${r.id} originalDays < 1`);
      }
      if (typeof r.currentDays === 'number' && r.currentDays < 1) {
        errors.push(`Requirement ${r.id} currentDays < 1`);
      }
    }

    // Check dependsOn within project
    for (const r of reqs) {
      if (r.dependsOn && !projectReqIds.has(r.dependsOn as string)) {
        errors.push(`Requirement ${r.id} dependsOn 引用不存在: ${r.dependsOn}`);
      }
    }

    const changeIds = new Set<string>();
    for (const c of changes) {
      for (const field of ['id', 'projectId', 'type', 'role', 'description', 'date', 'createdAt', 'updatedAt']) {
        if (!c[field]) errors.push(`Change 缺少 ${field}`);
      }
      if (c.id) {
        if (changeIds.has(c.id as string)) errors.push(`Change id 重复: ${c.id}`);
        changeIds.add(c.id as string);
      }
      if (c.type && !validChangeTypes.includes(c.type as string)) {
        errors.push(`Change 无效 type: ${c.type}`);
      }
      if (c.role && !validRoles.includes(c.role as string)) {
        errors.push(`Change 无效 role: ${c.role}`);
      }
    }

    // Snapshots
    const snaps = (p.snapshots ?? []) as Array<Record<string, unknown>>;
    for (const s of snaps) {
      for (const field of ['id', 'projectId', 'changeId', 'data', 'totalDays', 'createdAt']) {
        if (s[field] === undefined || s[field] === null) {
          errors.push(`Snapshot 缺少 ${field}`);
        }
      }
      if (s.changeId && !changeIds.has(s.changeId as string)) {
        errors.push(`Snapshot ${s.id} changeId 引用不存在: ${s.changeId}`);
      }
    }
  }

  return errors;
}
