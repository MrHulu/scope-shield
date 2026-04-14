import { create } from 'zustand';
import type { Project } from '../types';
import * as projectRepo from '../db/projectRepo';
import { today, now } from '../utils/date';

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  error: string | null;
  loadProjects: () => Promise<Project[]>;
  createProject: (name: string, startDate?: string) => Promise<Project>;
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
