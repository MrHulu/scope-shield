import { Archive, RotateCcw, ClipboardCopy } from 'lucide-react';
import type { Change, Project, ProjectStats, Requirement } from '../../types';
import { StatsCard } from './StatsCard';
import { useState } from 'react';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { generateMarkdownReport } from '../../services/reportGenerator';
import { showToast } from '../shared/Toast';

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
  const isArchived = project.status === 'archived';

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          <p className="text-xs text-gray-500">
            {project.startDate} 开始
            {isArchived && <span className="ml-2 text-amber-600">已归档</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {requirements && changes && (
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
