import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Maximize2, Minimize2, Play } from 'lucide-react';
import type { Change, ProjectStats, Requirement, ScheduleResult } from '../../types';
import { useUIStore } from '../../stores/uiStore';
import { SimpleChart } from './SimpleChart';
import { DetailChart } from './DetailChart';
import { ReplayPlayer } from '../replay/ReplayPlayer';

interface ChartAreaProps {
  requirements: Requirement[];
  changes: Change[];
  schedule: ScheduleResult;
  isArchived?: boolean;
  onExport: () => void;
  /** Optional — when present, render the title's data-driven subtitle. */
  stats?: ProjectStats;
  /** Optional — when present, enable W4.3 replay button. */
  projectId?: string;
}

export function ChartArea({ requirements, changes, schedule, onExport, stats, projectId }: ChartAreaProps) {
  const chartTab = useUIStore((s) => s.chartTab);
  const setChartTab = useUIStore((s) => s.setChartTab);
  const [fullscreen, setFullscreen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);

  // W3.9 — Esc closes fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const hasRequirements = requirements.length > 0;

  // Subtitle reads the story behind the chart so the user gets the punchline
  // before they parse the bars. Falls back to a neutral hint when no data.
  const subtitle = (() => {
    if (!stats) return null;
    if (stats.inflationRate === null) return '尚未发生变更';
    const sign = stats.inflationRate > 0 ? '+' : '';
    return `原计划 ${stats.originalTotalDays} 天 → 实际 ${stats.currentTotalDays} 天，膨胀 ${sign}${stats.inflationRate}%`;
  })();

  return (
    <div>
      <div className="flex items-start justify-between px-5 pt-4 pb-2 gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">工期对比</h2>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <div
            className="flex items-center gap-1 bg-gray-100/80 rounded-lg p-0.5"
            role="tablist"
            aria-label="图表样式"
          >
            <button
              onClick={() => setChartTab('simple')}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                chartTab === 'simple'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              role="tab"
              aria-selected={chartTab === 'simple'}
            >
              简洁版
            </button>
            <button
              onClick={() => setChartTab('detail')}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                chartTab === 'detail'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              role="tab"
              aria-selected={chartTab === 'detail'}
            >
              详细版
            </button>
          </div>

          <button
            onClick={onExport}
            disabled={!hasRequirements}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100/70 px-2 py-1 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            导出图片
          </button>

          {projectId && (
            <button
              type="button"
              onClick={() => setReplayOpen(true)}
              disabled={!hasRequirements}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100/70 px-2 py-1 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              title="按时间线回放每次变更后的工期变化"
              data-testid="replay-trigger"
            >
              <Play size={12} />
              回放
            </button>
          )}

          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            disabled={!hasRequirements}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100/70 px-2 py-1 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            title={fullscreen ? '退出全屏 (Esc)' : '全屏图表'}
            data-testid="chart-fullscreen-toggle"
          >
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {fullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 overflow-x-auto" data-testid="chart-content">
        <div className="min-w-[560px]">
          {chartTab === 'simple' ? (
            <SimpleChart
              requirements={requirements}
              changes={changes}
              schedule={schedule}
            />
          ) : (
            <DetailChart
              requirements={requirements}
              changes={changes}
              schedule={schedule}
            />
          )}
        </div>
      </div>

      {projectId && (
        <ReplayPlayer
          open={replayOpen}
          projectId={projectId}
          requirements={requirements}
          changes={changes}
          onClose={() => setReplayOpen(false)}
        />
      )}

      {/* W3.9 — Fullscreen overlay, portaled to <body> so it actually fills
          the viewport (escape any glass-panel-hover ancestor whose :hover
          transform would otherwise turn it into the containing block for
          fixed positioning). Esc closes (handled in the effect above). */}
      {fullscreen && createPortal(
        <div
          className="fixed inset-0 bg-white app-backdrop overflow-auto"
          style={{ zIndex: 'var(--z-modal)' }}
          data-testid="chart-fullscreen-overlay"
        >
          <div className="max-w-7xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">工期对比</h2>
                {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg"
              >
                <Minimize2 size={14} />
                退出全屏 (Esc)
              </button>
            </div>
            {chartTab === 'simple' ? (
              <SimpleChart requirements={requirements} changes={changes} schedule={schedule} />
            ) : (
              <DetailChart requirements={requirements} changes={changes} schedule={schedule} />
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
