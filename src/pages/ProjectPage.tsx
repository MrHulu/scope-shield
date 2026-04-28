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
import { RequirementList } from '../components/requirement/RequirementList';
import { ChartArea } from '../components/chart/ChartArea';
import { ChangeList } from '../components/change/ChangeList';
import { ExportModal } from '../components/chart/ExportModal';
import { ExportRenderer } from '../components/export/ExportRenderer';
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
  const { exportPng, exporting, error: exportError } = useExport();
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(
    async (width: number) => {
      setExportWidth(width);
      setShowExportModal(false);

      // Wait for render
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 100)));

      await exportPng('scope-shield-export', {
        width,
        projectName: project?.name ?? 'project',
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

        <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm">
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

        <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm">
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

        <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <ChartArea
            requirements={requirements}
            changes={changes}
            schedule={scheduleResult}
            isArchived={isArchived}
            onExport={() => setShowExportModal(true)}
          />
        </div>
      </div>

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
            <ExportRenderer
              projectName={project.name}
              requirements={requirements}
              changes={changes}
              schedule={scheduleResult}
              stats={fullStats}
              chartTab={chartTab}
              width={exportWidth}
            />
          </div>
        </div>
      )}
    </div>
  );
}
