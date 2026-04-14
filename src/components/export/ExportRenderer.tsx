import type { Change, Requirement, ScheduleResult, ProjectStats } from '../../types';
import { ExportSimple } from './ExportSimple';
import { ExportDetail } from './ExportDetail';

interface ExportRendererProps {
  projectName: string;
  requirements: Requirement[];
  changes: Change[];
  schedule: ScheduleResult;
  stats: ProjectStats;
  chartTab: 'simple' | 'detail';
  width: number;
}

const FONT_FAMILY = "-apple-system, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif";

export function ExportRenderer({
  projectName,
  requirements,
  changes,
  schedule,
  stats,
  chartTab,
  width,
}: ExportRendererProps) {
  const totalDelay = stats.currentTotalDays - stats.originalTotalDays;

  return (
    <div
      style={{
        width: `${width}px`,
        backgroundColor: '#ffffff',
        fontFamily: FONT_FAMILY,
        padding: '24px 20px',
      }}
    >
      {/* Brand + Title */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '11px',
            color: '#8E8E93',
            fontWeight: 600,
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}
        >
          SCOPE SHIELD
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#1C1C1E',
          }}
        >
          {projectName}
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        <StatCard label="原计划" value={`${stats.originalTotalDays}天`} color="#1C1C1E" />
        <StatCard label="当前" value={`${stats.currentTotalDays}天`} color="#1C1C1E" />
        <StatCard
          label="膨胀率"
          value={
            stats.inflationRate !== null
              ? `${stats.inflationRate > 0 ? '+' : ''}${stats.inflationRate}%`
              : '—'
          }
          color={
            stats.inflationRate !== null && stats.inflationRate > 0
              ? '#FF3B30'
              : stats.inflationRate !== null && stats.inflationRate < 0
                ? '#34C759'
                : '#8E8E93'
          }
        />
      </div>

      {/* Chart */}
      <div style={{ marginBottom: '20px' }}>
        {chartTab === 'simple' ? (
          <ExportSimple
            requirements={requirements}
            changes={changes}
            schedule={schedule}
          />
        ) : (
          <ExportDetail
            requirements={requirements}
            changes={changes}
            schedule={schedule}
          />
        )}
      </div>

      {/* Bottom conclusion */}
      <div
        style={{
          borderTop: '1px solid #E5E5EA',
          paddingTop: '12px',
        }}
      >
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: totalDelay > 0 ? '#FF3B30' : totalDelay < 0 ? '#34C759' : '#8E8E93',
            marginBottom: '4px',
          }}
        >
          {totalDelay > 0
            ? `结论：延期 ${totalDelay} 天`
            : totalDelay < 0
              ? `结论：提前 ${Math.abs(totalDelay)} 天`
              : '结论：工期不变'}
        </div>
        <div style={{ fontSize: '12px', color: totalDelay > 0 ? '#FF3B30' : '#8E8E93', fontWeight: 600 }}>
          {totalDelay > 0
            ? '= 100% 来自需求变更'
            : totalDelay < 0
              ? '需求变更被工期节省抵消'
              : '需求变更未影响工期'}
        </div>
        <div style={{ fontSize: '12px', color: '#8E8E93', marginTop: '2px' }}>
          0 天来自开发
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#F2F2F7',
        borderRadius: '12px',
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: '10px', color: '#8E8E93', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
