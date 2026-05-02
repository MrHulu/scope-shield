import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useProjectStore } from './stores/projectStore';
import { useRequirementStore } from './stores/requirementStore';
import { useChangeStore } from './stores/changeStore';
import { MainLayout } from './components/layout/MainLayout';
import { ProjectPage } from './pages/ProjectPage';
import { SettingsPage } from './pages/SettingsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotFoundRedirect } from './pages/NotFoundRedirect';
import { ToastContainer, showToast } from './components/shared/Toast';
import { RecoveryDialog } from './components/shared/RecoveryDialog';
import { CommandPalette } from './components/command/CommandPalette';
import { KeyboardHelpModal } from './components/shared/KeyboardHelpModal';
import { UndoHandler } from './components/shared/UndoHandler';
import { NavigationKeys } from './components/shared/NavigationKeys';
import { startSystemThemeListener } from './stores/themeStore';
import { seedDemoData } from './db/seedDemo';
import { cleanupOldNames } from './db/personNameRepo';
import { getLatestBackup, startAutoBackup } from './db/autoBackup';
import { importData } from './db/exportImport';
import type { AutoBackup } from './db/autoBackup';
import { decodeShareLink, readShareTokenFromHash, type SharedSnapshot } from './services/shareLink';
import { SharedViewPage } from './pages/SharedViewPage';

export default function App() {
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const loadRequirements = useRequirementStore((s) => s.loadRequirements);
  const loadChanges = useChangeStore((s) => s.loadChanges);
  const [ready, setReady] = useState(false);
  const [recoveryBackup, setRecoveryBackup] = useState<AutoBackup | null>(null);
  // W5.4 — read-only share view. When the URL has `#share=<token>`, decode
  // the snapshot and render SharedViewPage instead of the normal router.
  const [sharedSnapshot, setSharedSnapshot] = useState<SharedSnapshot | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = readShareTokenFromHash();
    return token ? decodeShareLink(token) : null;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Request persistent storage so browser won't auto-evict IndexedDB
      try { await navigator.storage?.persist?.(); } catch { /* best effort */ }

      const loaded = await loadProjects();
      if (cancelled) return;

      if (loaded.length === 0) {
        const backup = getLatestBackup();
        if (backup && backup.data.projects.length > 0) {
          setRecoveryBackup(backup);
          return;
        }
        await seedDemoData();
        await loadProjects();
        await loadRequirements('demo-001');
        await loadChanges('demo-001');
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [loadProjects, loadRequirements, loadChanges]);

  useEffect(() => {
    cleanupOldNames();
    const cleanup = startAutoBackup();
    const stopThemeListener = startSystemThemeListener();
    return () => {
      cleanup();
      stopThemeListener();
    };
  }, []);

  const handleRestore = useCallback(async () => {
    if (!recoveryBackup) return;
    try {
      await importData(recoveryBackup.data);
      await loadProjects();
      showToast('数据已恢复', 'success');
    } catch {
      showToast('恢复失败', 'error');
    }
    setRecoveryBackup(null);
    setReady(true);
  }, [recoveryBackup, loadProjects]);

  const handleDownload = useCallback(() => {
    if (!recoveryBackup) return;
    const json = JSON.stringify(recoveryBackup.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scope-shield-recovery-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('备份文件已下载');
    handleSkip();
  }, [recoveryBackup]);

  const handleSkip = useCallback(async () => {
    setRecoveryBackup(null);
    await seedDemoData();
    await loadProjects();
    await loadRequirements('demo-001');
    await loadChanges('demo-001');
    setReady(true);
  }, [loadProjects, loadRequirements, loadChanges]);

  if (sharedSnapshot) {
    // Share mode renders ChangeList/RequirementList which call
    // useSearchParams, so it needs a router context. MemoryRouter keeps the
    // share URL fragment from getting overwritten by react-router-dom.
    return (
      <MemoryRouter>
        <SharedViewPage
          snapshot={sharedSnapshot}
          onClone={() => {
            setSharedSnapshot(null);
            window.location.hash = '';
          }}
        />
        <ToastContainer />
      </MemoryRouter>
    );
  }

  if (recoveryBackup) {
    return (
      <>
        <RecoveryDialog
          open
          backup={recoveryBackup}
          onRestore={handleRestore}
          onDownload={handleDownload}
          onSkip={handleSkip}
        />
        <ToastContainer />
      </>
    );
  }

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
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<NotFoundRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <CommandPalette />
      <KeyboardHelpModal />
      <UndoHandler />
      <NavigationKeys />
      <ToastContainer />
    </BrowserRouter>
  );
}
