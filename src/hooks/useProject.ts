import { useEffect, useCallback } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';

export function useProjects() {
  const { projects, loading, error, loadProjects, createProject, archiveProject, restoreProject, updateProject } =
    useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return { projects, loading, error, createProject, archiveProject, restoreProject, updateProject };
}

export function useCurrentProject() {
  const { projects } = useProjectStore();
  const { currentProjectId } = useUIStore();

  return projects.find((p) => p.id === currentProjectId) ?? null;
}

export function useNavigateToProject() {
  const { setCurrentProjectId } = useUIStore();

  return useCallback(
    (id: string) => {
      setCurrentProjectId(id);
    },
    [setCurrentProjectId],
  );
}
