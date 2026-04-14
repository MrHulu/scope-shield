import { Download } from 'lucide-react';
import type { Change, Requirement, ScheduleResult } from '../../types';
import { useUIStore } from '../../stores/uiStore';
import { SimpleChart } from './SimpleChart';
import { DetailChart } from './DetailChart';

interface ChartAreaProps {
  requirements: Requirement[];
  changes: Change[];
  schedule: ScheduleResult;
  isArchived: boolean;
  onExport: () => void;
}

export function ChartArea({ requirements, changes, schedule, isArchived, onExport }: ChartAreaProps) {
  const chartTab = useUIStore((s) => s.chartTab);
  const setChartTab = useUIStore((s) => s.setChartTab);

  const hasRequirements = requirements.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setChartTab('simple')}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              chartTab === 'simple'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
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
          >
            详细版
          </button>
        </div>

        <button
          onClick={onExport}
          disabled={!hasRequirements}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={12} />
          导出图片
        </button>
      </div>

      <div className="px-4 pb-4">
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
