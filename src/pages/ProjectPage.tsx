import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import { useRequirements } from '../hooks/useRequirements';
import { useChanges } from '../hooks/useChanges';
import { useSchedule } from '../hooks/useSchedule';
import { useExport } from '../hooks/useExport';
import { useSyncFeishu } from '../hooks/useSyncFeishu';
import { ProjectHeader } from '../components/project/ProjectHeader';
import { FloatingCTA } from '../components/project/FloatingCTA';
import { RequirementList } from '../components/requirement/RequirementList';
import { ChartArea } from '../components/chart/ChartArea';
import { ChangeList } from '../components/change/ChangeList';
import { ExportModal, type ExportMode } from '../components/chart/ExportModal';
import { ExportRenderer } from '../components/export/ExportRenderer';
import { ExportComparison } from '../components/export/ExportComparison';
import { showToast } from '../components/shared/Toast';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const archiveProject = useProjectStore((s) => s.archiveProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const setCurrentProjectId = useUIStore((s) => s.setCurrentProjectId);
  const chartTab = useUIStore((s) => s.chartTab);

  const project = projects.find((p) => p.id === id) ?? null;

  useEffect(() => {
    if (id && project) {
      setCurrentProjectId(id);
    } else if (id && !project && projects.length > 0) {
      // Invalid ID → redirect to first active project or demo
      const fallback = projects.find((p) => p.status === 'active') ?? projects[0];
      navigate(`/project/${fallback.id}`, { replace: true });
    }
  }, [id, project, projects, setCurrentProjectId, navigate]);

  const {
    requirements,
    addRequirement,
    updateRequirement,
    deleteRequirement,
    reorderRequirements,
  } = useRequirements(id ?? null);

  const {
    changes,
    recordChange,
    updateChange,
    deleteChange,
  } = useChanges(id ?? null);

  const { syncAll, syncing, hasFeishuRequirements } = useSyncFeishu(requirements, updateRequirement);

  const { scheduleResult, stats } = useSchedule(
    requirements,
    project?.startDate ?? '2026-01-01',
  );

  const fullStats = {
    ...stats,
    totalChanges: changes.length,
    supplementCount: changes.filter((c) => c.type === 'supplement').length,
  };

  // Export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportWidth, setExportWidth] = useState<number | null>(null);
  const [exportMode, setExportMode] = useState<ExportMode>('single');
  const { exportPng, exporting, error: exportError } = useExport();
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(
    async (width: number, mode: ExportMode) => {
      setExportWidth(width);
      setExportMode(mode);
      setShowExportModal(false);

      // Wait for render — comparison renders 2 ExportRenderer instances so
      // it needs a touch more time to settle.
      const settleMs = mode === 'comparison' ? 200 : 100;
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, settleMs)));

      const baseName = project?.name ?? 'project';
      await exportPng('scope-shield-export', {
        width,
        projectName: mode === 'comparison' ? `${baseName}-comparison` : baseName,
      });

      setExportWidth(null);
    },
    [exportPng, project?.name],
  );

  useEffect(() => {
    if (exportError) showToast(exportError, 'error');
  }, [exportError]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        选择一个项目
      </div>
    );
  }

  const isArchived = project.status === 'archived';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto py-4">
        <ProjectHeader
          project={project}
          stats={fullStats}
          onArchive={() => archiveProject(project.id)}
          onRestore={() => restoreProject(project.id)}
        />

        {/* Chart first — primary visual that should land in first-screen viewport */}
        <div className="mt-4 glass-panel glass-panel-hover rounded-2xl">
          <ChartArea
            requirements={requirements}
            changes={changes}
            schedule={scheduleResult}
            isArchived={isArchived}
            onExport={() => setShowExportModal(true)}
            stats={fullStats}
          />
        </div>

        <div className="mt-4 glass-panel glass-panel-hover rounded-2xl">
          <RequirementList
            projectId={project.id}
            requirements={requirements}
            isArchived={isArchived}
            onAdd={addRequirement}
            onUpdate={updateRequirement}
            onDelete={deleteRequirement}
            onReorder={reorderRequirements}
            onSyncFeishu={syncAll}
            syncing={syncing}
            hasFeishuRequirements={hasFeishuRequirements}
          />
        </div>

        <div className="mt-4 glass-panel glass-panel-hover rounded-2xl">
          <ChangeList
            projectId={project.id}
            changes={changes}
            requirements={requirements}
            isArchived={isArchived}
            onRecord={recordChange}
            onUpdate={updateChange}
            onDelete={deleteChange}
          />
        </div>
      </div>

      <FloatingCTA disabled={isArchived || requirements.length === 0} />

      {/* Export modal */}
      <ExportModal
        open={showExportModal}
        onExport={handleExport}
        onClose={() => setShowExportModal(false)}
        exporting={exporting}
      />

      {/* Off-screen export renderer */}
      {exportWidth !== null && (
        <div
          ref={exportContainerRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
          }}
        >
          <div id="scope-shield-export">
            {exportMode === 'comparison' ? (
              <ExportComparison
                projectName={project.name}
                requirements={requirements}
                changes={changes}
                schedule={scheduleResult}
                stats={fullStats}
                chartTab={chartTab}
                width={exportWidth}
              />
            ) : (
              <ExportRenderer
                projectName={project.name}
                requirements={requirements}
                changes={changes}
                schedule={scheduleResult}
                stats={fullStats}
                chartTab={chartTab}
                width={exportWidth}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
