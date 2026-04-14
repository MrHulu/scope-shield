import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useProjectStore } from './stores/projectStore';
import { useRequirementStore } from './stores/requirementStore';
import { useChangeStore } from './stores/changeStore';
import { MainLayout } from './components/layout/MainLayout';
import { ProjectPage } from './pages/ProjectPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundRedirect } from './pages/NotFoundRedirect';
import { ToastContainer } from './components/shared/Toast';
import { seedDemoData } from './db/seedDemo';
import { cleanupOldNames } from './db/personNameRepo';

export default function App() {
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const loadRequirements = useRequirementStore((s) => s.loadRequirements);
  const loadChanges = useChangeStore((s) => s.loadChanges);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadProjects();
      if (cancelled) return;
      // First load with no projects → seed demo data + pre-load stores
      if (loaded.length === 0) {
        await seedDemoData();
        await loadProjects();
        await loadRequirements('demo-001');
        await loadChanges('demo-001');
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [loadProjects, loadRequirements, loadChanges]);

  // PersonNameCache 90-day cleanup
  useEffect(() => {
    cleanupOldNames();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-gray-400">
        加载中...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/project/:id" element={<ProjectPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<NotFoundRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
