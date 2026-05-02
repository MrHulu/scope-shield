import { create } from 'zustand';
import type { Project, Requirement } from '../types';
import * as projectRepo from '../db/projectRepo';
import * as requirementRepo from '../db/requirementRepo';
import { today, now } from '../utils/date';
import { generateId } from '../utils/id';

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  error: string | null;
  loadProjects: () => Promise<Project[]>;
  createProject: (name: string, startDate?: string) => Promise<Project>;
  duplicateProject: (sourceId: string) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await projectRepo.getAllProjects();
      set({ projects, loading: false });
      return projects;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      return [];
    }
  },

  createProject: async (name, startDate) => {
    const project = await projectRepo.createProject({
      name,
      startDate: startDate || today(),
    });
    set({ projects: [...get().projects, project] });
    return project;
  },

  /**
   * W2.8 — copy a project's structure (requirements only) into a new project
   * named "<source> · 副本". Skips changes/snapshots so the copy starts as a
   * clean baseline. Useful when iterating on similar projects (e.g. mobile
   * V1 → V2) without re-entering each requirement.
   */
  duplicateProject: async (sourceId) => {
    const source = get().projects.find((p) => p.id === sourceId);
    if (!source) return null;
    const newProject = await projectRepo.createProject({
      name: `${source.name} · 副本`,
      startDate: today(),
    });
    const sourceReqs = await requirementRepo.getRequirementsByProject(sourceId);
    // Map old requirement IDs → new IDs so dependsOn pointers stay valid.
    const idMap = new Map(sourceReqs.map((r) => [r.id, generateId()]));
    const newReqs: Requirement[] = sourceReqs
      .filter((r) => !r.isAddedByChange) // only baseline reqs, drop changes-added ones
      .map((r) => ({
        ...r,
        id: idMap.get(r.id)!,
        projectId: newProject.id,
        // Reset to clean baseline state — currentDays = originalDays, no pause/cancel
        currentDays: r.originalDays,
        status: 'active' as const,
        pausedRemainingDays: null,
        dependsOn: r.dependsOn ? idMap.get(r.dependsOn) ?? null : null,
        createdAt: now(),
        updatedAt: now(),
      }));
    await Promise.all(newReqs.map((r) => requirementRepo.putRequirement(r)));
    set({ projects: [...get().projects, newProject] });
    return newProject;
  },

  updateProject: async (id, data) => {
    await projectRepo.updateProject(id, data);
    set({
      projects: get().projects.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt: now() } : p,
      ),
    });
  },

  archiveProject: async (id) => {
    await projectRepo.updateProject(id, { status: 'archived' });
    set({
      projects: get().projects.map((p) =>
        p.id === id ? { ...p, status: 'archived', updatedAt: now() } : p,
      ),
    });
  },

  restoreProject: async (id) => {
    await projectRepo.updateProject(id, { status: 'active' });
    set({
      projects: get().projects.map((p) =>
        p.id === id ? { ...p, status: 'active', updatedAt: now() } : p,
      ),
    });
  },
}));
