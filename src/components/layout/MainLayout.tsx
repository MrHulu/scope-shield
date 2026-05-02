import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useProjects } from '../../hooks/useProject';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';

export function MainLayout() {
  const { projects, createProject } = useProjects();
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const currentProjectId = useUIStore((s) => s.currentProjectId);

  return (
    <div className="flex h-screen app-backdrop">
      <Sidebar
        projects={projects}
        currentProjectId={currentProjectId}
        onCreateProject={createProject}
        onDuplicateProject={duplicateProject}
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
