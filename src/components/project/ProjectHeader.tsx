import { Archive, RotateCcw, Settings } from 'lucide-react';
import type { Project, ProjectStats } from '../../types';
import { StatsCard } from './StatsCard';
import { useState } from 'react';
import { ConfirmDialog } from '../shared/ConfirmDialog';

interface ProjectHeaderProps {
  project: Project;
  stats: ProjectStats;
  onArchive: () => void;
  onRestore: () => void;
}

export function ProjectHeader({ project, stats, onArchive, onRestore }: ProjectHeaderProps) {
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

  return (
    <div className="px-6 py-4 border-b border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          <p className="text-xs text-gray-500">
            {project.startDate} 开始
            {isArchived && <span className="ml-2 text-amber-600">已归档</span>}
          </p>
        </div>
        <div className="flex gap-2">
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

      <div className="flex gap-3">
        <StatsCard label="原始工期" value={stats.originalTotalDays} suffix="天" />
        <StatsCard label="当前工期" value={stats.currentTotalDays} suffix="天" />
        <StatsCard label="膨胀率" value={inflationDisplay} color={inflationColor} />
        <StatsCard label="变更次数" value={stats.totalChanges} suffix="次" />
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
