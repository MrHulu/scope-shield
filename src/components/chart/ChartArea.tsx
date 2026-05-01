import { Download } from 'lucide-react';
import type { Change, ProjectStats, Requirement, ScheduleResult } from '../../types';
import { useUIStore } from '../../stores/uiStore';
import { SimpleChart } from './SimpleChart';
import { DetailChart } from './DetailChart';

interface ChartAreaProps {
  requirements: Requirement[];
  changes: Change[];
  schedule: ScheduleResult;
  isArchived?: boolean;
  onExport: () => void;
  /** Optional — when present, render the title's data-driven subtitle. */
  stats?: ProjectStats;
}

export function ChartArea({ requirements, changes, schedule, onExport, stats }: ChartAreaProps) {
  const chartTab = useUIStore((s) => s.chartTab);
  const setChartTab = useUIStore((s) => s.setChartTab);

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
      <div className="flex items-start justify-between px-5 pt-4 pb-2 gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">工期对比</h2>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
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
        </div>
      </div>

      <div className="px-4 pb-4" data-testid="chart-content">
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
  );
}
