import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useProjects } from '../../hooks/useProject';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';

export function MainLayout() {
  const { projects, createProject } = useProjects();
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const currentProjectId = useUIStore((s) => s.currentProjectId);
  // W5.5 — mobile drawer toggle. md+ shows sidebar permanently; <md it's a
  // backdrop drawer so chart area can use full width.
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen app-backdrop">
      {/* Mobile hamburger — visible only <md, when drawer is closed. */}
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="md:hidden fixed top-3 left-3 z-30 p-2 bg-white/90 hover:bg-white rounded-lg shadow border border-gray-200"
          aria-label="打开侧边栏"
          data-testid="mobile-drawer-open"
        >
          <Menu size={16} />
        </button>
      )}
      {/* Drawer backdrop — only renders <md when open. */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setDrawerOpen(false)}
          data-testid="mobile-drawer-backdrop"
        />
      )}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 transition-transform md:transition-none md:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="relative h-full">
          {drawerOpen && (
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="md:hidden absolute top-3 right-3 z-50 p-1.5 bg-white hover:bg-gray-100 rounded shadow border border-gray-200"
              aria-label="关闭侧边栏"
              data-testid="mobile-drawer-close"
            >
              <X size={14} />
            </button>
          )}
          <Sidebar
            projects={projects}
            currentProjectId={currentProjectId}
            onCreateProject={createProject}
            onDuplicateProject={duplicateProject}
          />
        </div>
      </div>
      <main className="flex-1 overflow-y-auto" onClick={() => drawerOpen && setDrawerOpen(false)}>
        <Outlet />
      </main>
    </div>
  );
}
