import { useMemo } from 'react';
import { Eye, Copy, X } from 'lucide-react';
import type { SharedSnapshot } from '../services/shareLink';
import { schedule, computeOriginalTotalDays } from '../engine/scheduler';
import { addCalendarDays } from '../utils/date';
import { ChartArea } from '../components/chart/ChartArea';
import { RequirementList } from '../components/requirement/RequirementList';
import { ChangeList } from '../components/change/ChangeList';
import { ProjectHeader } from '../components/project/ProjectHeader';
import { showToast } from '../components/shared/Toast';
import { useProjectStore } from '../stores/projectStore';
import { useRequirementStore } from '../stores/requirementStore';
import { useChangeStore } from '../stores/changeStore';

interface SharedViewPageProps {
  snapshot: SharedSnapshot;
  /** Called when the viewer wants to clone this share into their own
   * IndexedDB and exit share mode. */
  onClone: () => void;
}

/**
 * Wave 5 W5.4 — read-only view of a shared project. Reuses ChartArea /
 * RequirementList / ChangeList by forcing `isArchived=true`, which already
 * hides edit/delete affordances throughout the app.
 *
 * The viewer's own IndexedDB is not touched until they click "复制为我的项目".
 */
export function SharedViewPage({ snapshot, onClone }: SharedViewPageProps) {
  const { project, requirements, changes } = snapshot;
  const createProject = useProjectStore((s) => s.createProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const addRequirement = useRequirementStore((s) => s.addRequirement);
  const recordChange = useChangeStore((s) => s.recordChange);

  const scheduleResult = useMemo(() => {
    const r = schedule(requirements);
    const originalTotalDays = computeOriginalTotalDays(requirements);
    return { ...r, originalTotalDays };
  }, [requirements]);

  const stats = useMemo(() => {
    const { totalDays, originalTotalDays } = scheduleResult;
    const delay = totalDays - originalTotalDays;
    return {
      originalTotalDays,
      currentTotalDays: totalDays,
      inflationRate: originalTotalDays > 0 ? Math.round((delay / originalTotalDays) * 100) : null,
      totalChanges: changes.length,
      supplementCount: changes.filter((c) => c.type === 'supplement').length,
      endDate: totalDays > 0
        ? addCalendarDays(project.startDate, Math.max(0, Math.ceil(totalDays) - 1))
        : project.startDate,
    };
  }, [scheduleResult, project.startDate, changes]);

  const handleClone = async () => {
    try {
      const newProj = await createProject(
        `${project.name}（来自分享）`,
        project.startDate,
      );
      await updateProject(newProj.id, { targetEndDate: project.targetEndDate ?? null });
      const idMap = new Map<string, string>();
      // Recreate requirements (preserving dependsOn via id remap).
      for (const r of requirements.filter((x) => !x.isAddedByChange)) {
        const created = await addRequirement({
          projectId: newProj.id,
          name: r.name,
          originalDays: r.originalDays,
          dependsOn: r.dependsOn ? idMap.get(r.dependsOn) ?? null : null,
        });
        if (created) idMap.set(r.id, created.id);
      }
      // Replay changes via recordChange so snapshots get written and the
      // engine recalculates daysDelta from the new requirement ids.
      const projReqs = requirements
        .filter((x) => !x.isAddedByChange)
        .map((r) => ({ ...r, id: idMap.get(r.id) ?? r.id, projectId: newProj.id }));
      for (const c of changes) {
        const targetId = c.targetRequirementId ? idMap.get(c.targetRequirementId) ?? null : null;
        await recordChange(
          {
            projectId: newProj.id,
            type: c.type,
            targetRequirementId: targetId,
            role: c.role,
            personName: c.personName,
            description: c.description,
            daysDelta: c.daysDelta,
            date: c.date,
            metadata: c.metadata,
            screenshots: c.screenshots,
          },
          projReqs,
        );
      }
      showToast(`已复制为「${newProj.name}」`, 'success');
      onClone();
      // Navigate to the new project — caller flips the share flag, App
      // will render the normal router which picks up the new project.
      window.location.hash = '';
      window.location.pathname = `/project/${newProj.id}`;
    } catch (e) {
      showToast(`复制失败：${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Banner */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between gap-3 px-6 py-2.5 bg-blue-600 text-white text-sm"
        data-testid="share-mode-banner"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Eye size={14} />
          <span className="truncate">
            只读分享视图 · 项目「{project.name}」 · 来自 URL #share=… · 不影响你本地数据
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClone}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs"
            data-testid="share-clone-button"
          >
            <Copy size={12} />
            复制为我的项目
          </button>
          <button
            type="button"
            onClick={onClone}
            className="p-1 hover:bg-white/20 rounded"
            aria-label="关闭只读视图"
            data-testid="share-exit-button"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-4">
        <ProjectHeader
          project={project}
          stats={stats}
          requirements={requirements}
          changes={changes}
          criticalPath={scheduleResult.criticalPath}
          onArchive={() => {}}
          onRestore={() => {}}
        />
        <div className="mt-4 glass-panel rounded-2xl overflow-hidden">
          <ChartArea
            requirements={requirements}
            changes={changes}
            schedule={scheduleResult}
            isArchived
            onExport={() => {}}
            stats={stats}
          />
        </div>
        <div className="mt-4 glass-panel rounded-2xl overflow-hidden">
          <RequirementList
            projectId={project.id}
            requirements={requirements}
            isArchived
            onAdd={async () => null}
            onUpdate={async () => {}}
            onDelete={async () => {}}
            onReorder={async () => {}}
          />
        </div>
        <div className="mt-4 glass-panel rounded-2xl overflow-hidden">
          <ChangeList
            projectId={project.id}
            changes={changes}
            requirements={requirements}
            isArchived
            onRecord={async () => {}}
            onUpdate={async () => {}}
            onDelete={() => {}}
            projectEndDate={project.targetEndDate ?? stats.endDate}
          />
        </div>
      </div>
    </div>
  );
}
