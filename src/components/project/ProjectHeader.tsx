import { Archive, RotateCcw, ClipboardCopy, FileDown, AlertTriangle, CalendarClock, Share2 } from 'lucide-react';
import type { Change, Project, ProjectStats, Requirement } from '../../types';
import { StatsCard } from './StatsCard';
import { useState } from 'react';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { generateMarkdownReport } from '../../services/reportGenerator';
import { exportToCsv } from '../../services/bulkImporter';
import { showToast } from '../shared/Toast';
import { SnapshotHistory } from '../snapshot/SnapshotHistory';
import { useProjectStore } from '../../stores/projectStore';
import { buildShareUrl } from '../../services/shareLink';

interface ProjectHeaderProps {
  project: Project;
  stats: ProjectStats;
  /** Pass requirements + changes + criticalPath to enable the "复制 Markdown
   *  报告" action. Optional — header degrades to summary-only when omitted. */
  requirements?: Requirement[];
  changes?: Change[];
  criticalPath?: string[];
  onArchive: () => void;
  onRestore: () => void;
}

export function ProjectHeader({ project, stats, requirements, changes, criticalPath, onArchive, onRestore }: ProjectHeaderProps) {
  const [showArchive, setShowArchive] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);
  const [draftTarget, setDraftTarget] = useState(project.targetEndDate ?? '');
  const updateProject = useProjectStore((s) => s.updateProject);
  const isArchived = project.status === 'archived';

  // W5.1 — overdue if today > targetEndDate.
  const today = new Date().toISOString().slice(0, 10);
  const overdueDays = project.targetEndDate && today > project.targetEndDate
    ? Math.floor((Date.parse(today) - Date.parse(project.targetEndDate)) / 86400000)
    : 0;

  const inflationDisplay =
    stats.inflationRate === null ? '—' : `${stats.inflationRate > 0 ? '+' : ''}${stats.inflationRate}%`;

  const inflationColor =
    stats.inflationRate === null
      ? 'text-gray-400'
      : stats.inflationRate > 0
        ? 'text-red-600'
        : stats.inflationRate < 0
          ? 'text-green-600'
          : 'text-gray-900';

  // Hero card caption: tells the story behind the inflation number.
  const inflationCaption =
    stats.inflationRate === null
      ? '尚未发生变更'
      : stats.inflationRate > 0
        ? `比原计划多 ${stats.currentTotalDays - stats.originalTotalDays} 天`
        : stats.inflationRate < 0
          ? `比原计划少 ${stats.originalTotalDays - stats.currentTotalDays} 天`
          : '与原计划持平';

  return (
    <div className="px-6 py-4 border-b border-gray-200/70">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
            {overdueDays > 0 && !isArchived && (
              <span
                className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium"
                title={`目标交付日 ${project.targetEndDate}，已超过 ${overdueDays} 天`}
                data-testid="project-overdue-chip"
              >
                <AlertTriangle size={12} />
                已逾期 {overdueDays} 天
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>{project.startDate} 开始</span>
            {!isArchived && !editingTarget && (
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-gray-700"
                onClick={() => {
                  setDraftTarget(project.targetEndDate ?? '');
                  setEditingTarget(true);
                }}
                data-testid="target-end-date-edit"
                title="设置项目目标交付日"
              >
                <CalendarClock size={11} />
                {project.targetEndDate ? `目标 ${project.targetEndDate}` : '设置目标日'}
              </button>
            )}
            {editingTarget && (
              <span className="inline-flex items-center gap-1">
                <input
                  type="date"
                  value={draftTarget}
                  onChange={(e) => setDraftTarget(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5"
                  data-testid="target-end-date-input"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={async () => {
                    await updateProject(project.id, {
                      targetEndDate: draftTarget || null,
                    });
                    setEditingTarget(false);
                    showToast(draftTarget ? '目标日已保存' : '目标日已清除', 'success');
                  }}
                  className="text-xs text-blue-600 hover:underline"
                  data-testid="target-end-date-save"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTarget(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  取消
                </button>
              </span>
            )}
            {isArchived && <span className="text-amber-600">已归档</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {requirements && changes && (
            <>
              <SnapshotHistory projectId={project.id} changes={changes} />
              <button
                type="button"
                onClick={() => {
                  const idToName = new Map(requirements.map((r) => [r.id, r.name]));
                  const rows = requirements.map((r) => ({
                    name: r.name,
                    days: r.originalDays,
                    dependsOn: r.dependsOn ? idToName.get(r.dependsOn) ?? '' : undefined,
                    status: r.status,
                  }));
                  const csv = exportToCsv(rows);
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  const safeName = project.name.replace(/[^a-zA-Z0-9一-鿿-]/g, '_');
                  const date = new Date().toISOString().slice(0, 10);
                  link.href = url;
                  link.download = `${safeName}-requirements-${date}.csv`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                  showToast('CSV 已下载', 'success');
                }}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                data-testid="export-csv"
                title="导出当前需求为 CSV（Excel 可读）"
              >
                <FileDown size={14} />
                CSV 导出
              </button>
              <button
                onClick={async () => {
                  const md = generateMarkdownReport({
                    project,
                    stats,
                    requirements,
                    changes,
                    criticalPath,
                  });
                  try {
                    await navigator.clipboard.writeText(md);
                    showToast('已复制 Markdown 报告（可贴到飞书 / 邮件）', 'success');
                  } catch {
                    showToast('复制失败 — 浏览器拒绝访问剪贴板', 'error');
                  }
                }}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                data-testid="copy-markdown-report"
                title="生成项目状态 Markdown，复制到剪贴板"
              >
                <ClipboardCopy size={14} />
                复制报告
              </button>
              <button
                onClick={async () => {
                  const url = buildShareUrl({ v: 1, project, requirements, changes });
                  try {
                    await navigator.clipboard.writeText(url);
                    showToast('只读分享链接已复制（任何人打开即看到当前状态）', 'success');
                  } catch {
                    showToast('复制失败 — 浏览器拒绝访问剪贴板', 'error');
                  }
                }}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                data-testid="copy-share-link"
                title="生成项目当前状态的只读分享链接"
              >
                <Share2 size={14} />
                分享只读
              </button>
            </>
          )}
          {isArchived ? (
            <button
              onClick={onRestore}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <RotateCcw size={14} />
              恢复
            </button>
          ) : (
            <button
              onClick={() => setShowArchive(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Archive size={14} />
              归档
            </button>
          )}
        </div>
      </div>

      {/* 1 hero (膨胀率) + 4 default chips. Hero spans 1.5x and uses the
          headline font size so the number that matters most reads first. */}
      <div className="flex gap-3 flex-wrap items-stretch">
        <StatsCard
          variant="hero"
          label="膨胀率"
          value={inflationDisplay}
          color={inflationColor}
          caption={inflationCaption}
          testid="hero-stat-inflation"
        />
        <StatsCard label="原始工期" value={stats.originalTotalDays} suffix="天" />
        <StatsCard label="当前工期" value={stats.currentTotalDays} suffix="天" />
        <StatsCard label="变更次数" value={stats.totalChanges} suffix="次" />
        {stats.supplementCount > 0 && (
          <StatsCard label="需求补充" value={stats.supplementCount} suffix="次" />
        )}
      </div>

      <ConfirmDialog
        open={showArchive}
        title="归档项目"
        message={`确定要归档「${project.name}」吗？归档后项目变为只读。`}
        onConfirm={() => { onArchive(); setShowArchive(false); }}
        onCancel={() => setShowArchive(false)}
      />
    </div>
  );
}
