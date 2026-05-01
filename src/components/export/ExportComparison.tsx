import type { Change, ProjectStats, Requirement, ScheduleResult } from '../../types';
import { schedule as computeSchedule } from '../../engine/scheduler';
import { ExportRenderer } from './ExportRenderer';

interface ExportComparisonProps {
  projectName: string;
  requirements: Requirement[];
  changes: Change[];
  schedule: ScheduleResult;
  stats: ProjectStats;
  chartTab: 'simple' | 'detail';
  width: number;
}

const FONT_FAMILY = "-apple-system, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif";

/**
 * Reconstruct what the schedule looked like "before any changes":
 *   - Drop requirements that were created via new_requirement changes
 *   - Reset currentDays to originalDays for the remaining ones
 *   - Run the scheduler with no changes applied
 * The resulting ScheduleResult is what the project promised on day-1.
 */
function buildBaseline(requirements: Requirement[]): {
  requirements: Requirement[];
  schedule: ScheduleResult;
  stats: ProjectStats;
} {
  const baselineReqs = requirements
    .filter((r) => !r.isAddedByChange)
    .map((r) => ({ ...r, currentDays: r.originalDays, status: 'active' as const }));
  const baselineSchedule = computeSchedule(baselineReqs);
  const originalTotalDays = baselineSchedule.totalDays;
  return {
    requirements: baselineReqs,
    schedule: { ...baselineSchedule, originalTotalDays },
    stats: {
      originalTotalDays,
      currentTotalDays: originalTotalDays,
      inflationRate: 0,
      totalChanges: 0,
      supplementCount: 0,
    },
  };
}

export function ExportComparison({
  projectName,
  requirements,
  changes,
  schedule,
  stats,
  chartTab,
  width,
}: ExportComparisonProps) {
  // Each side renders at this width; the container is twice the panel width
  // plus the divider gap. We aim for ~720px per side at 1440 export width.
  const panelW = Math.floor((width - 32) / 2);
  const baseline = buildBaseline(requirements);
  const inflationDisplay =
    stats.inflationRate === null
      ? '—'
      : `${stats.inflationRate > 0 ? '+' : ''}${stats.inflationRate}%`;
  const arrowColor =
    stats.inflationRate === null
      ? '#8E8E93'
      : stats.inflationRate > 0
        ? '#FF3B30'
        : stats.inflationRate < 0
          ? '#34C759'
          : '#8E8E93';

  return (
    <div
      style={{
        width: `${width}px`,
        backgroundColor: '#ffffff',
        fontFamily: FONT_FAMILY,
        padding: '20px 16px',
      }}
    >
      <div style={{ marginBottom: '8px' }}>
        <div
          style={{
            fontSize: '11px',
            color: '#8E8E93',
            fontWeight: 600,
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}
        >
          SCOPE SHIELD · 对比导出
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#1C1C1E' }}>
          {projectName}
        </div>
      </div>

      {/* Hero arrow band: original → current */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          padding: '14px 16px',
          margin: '8px 0 16px 0',
          background: 'linear-gradient(135deg, #F0F4FF 0%, #FFF5F0 100%)',
          borderRadius: '14px',
          fontSize: '14px',
          color: '#1C1C1E',
          fontWeight: 600,
        }}
      >
        <span>原计划 {baseline.schedule.totalDays} 天</span>
        <span style={{ color: arrowColor, fontSize: '20px', fontWeight: 700 }}>→</span>
        <span>实际 {stats.currentTotalDays} 天</span>
        <span
          style={{
            color: arrowColor,
            fontSize: '15px',
            fontWeight: 700,
            marginLeft: '4px',
          }}
        >
          膨胀 {inflationDisplay}
        </span>
      </div>

      {/* Two panels side by side */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            flex: 1,
            border: '1px solid #E5E5EA',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: '#3B82F6',
              letterSpacing: '0.3px',
            }}
          >
            原计划（项目启动时）
          </div>
          <ExportRenderer
            projectName={projectName}
            requirements={baseline.requirements}
            changes={[]}
            schedule={baseline.schedule}
            stats={baseline.stats}
            chartTab={chartTab}
            width={panelW}
          />
        </div>

        <div
          style={{
            flex: 1,
            border: '1px solid #E5E5EA',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: arrowColor,
              letterSpacing: '0.3px',
            }}
          >
            实际（含 {stats.totalChanges} 次变更）
          </div>
          <ExportRenderer
            projectName={projectName}
            requirements={requirements}
            changes={changes}
            schedule={schedule}
            stats={stats}
            chartTab={chartTab}
            width={panelW}
          />
        </div>
      </div>
    </div>
  );
}
