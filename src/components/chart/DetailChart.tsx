import { useId } from 'react';
import type { Change, Requirement, ScheduleResult, Role, RequirementSchedule } from '../../types';
import { APP_ROLE_COLORS, APP_COLORS } from '../../constants/colors';
import { ROLE_LABELS } from '../../constants/roles';

interface DetailChartProps {
  requirements: Requirement[];
  changes: Change[];
  schedule: ScheduleResult;
  roleColors?: Record<Role, string>;
  planColor?: string;
  saveColor?: string;
  newReqColor?: string;
  supplementColor?: string;
  isExport?: boolean;
}

interface TimelineEntry {
  change: Change;
  color: string;
  text: string;
}

interface GanttSegment {
  color: string;
  widthDays: number;
  changeId: string;
}

interface GanttRow {
  requirement: Requirement;
  scheduleItem: RequirementSchedule | null;
  originalWidth: number;
  segments: GanttSegment[];
  isCancelled: boolean;
  isPaused: boolean;
  isNew: boolean;
}

function getChangeColor(
  c: Change,
  roleColors: Record<Role, string>,
  saveColor: string,
  newReqColor: string,
  supplementColor: string,
): string {
  if (c.type === 'cancel_requirement') return saveColor;
  if (c.type === 'new_requirement') return newReqColor;
  if (c.type === 'supplement') return supplementColor;
  return roleColors[c.role];
}

function buildTimeline(
  changes: Change[],
  roleColors: Record<Role, string>,
  saveColor: string,
  newReqColor: string,
  supplementColor: string,
): TimelineEntry[] {
  const sorted = [...changes].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.createdAt.localeCompare(b.createdAt);
  });

  return sorted.map((c) => {
    const person = c.personName ? ` ${c.personName}` : '';
    const deltaStr =
      c.daysDelta > 0
        ? ` +${c.daysDelta}天`
        : c.daysDelta < 0
          ? ` ${c.daysDelta}天`
          : '';
    const typeNote =
      c.type === 'new_requirement'
        ? '（新需求）'
        : c.type === 'cancel_requirement'
          ? '（节省）'
          : c.type === 'supplement'
            ? '（补充）'
            : c.type === 'pause'
              ? '（暂停）'
              : c.type === 'resume'
                ? '（恢复）'
                : '';
    return {
      change: c,
      color: getChangeColor(c, roleColors, saveColor, newReqColor, supplementColor),
      text: `${c.date}  ${ROLE_LABELS[c.role]}${person}：${c.description}${deltaStr}${typeNote}`,
    };
  });
}

function buildGanttRows(
  requirements: Requirement[],
  changes: Change[],
  schedule: ScheduleResult,
  roleColors: Record<Role, string>,
  saveColor: string,
  newReqColor: string,
  supplementColor: string,
): GanttRow[] {
  const schedMap = new Map(schedule.requirementSchedules.map((s) => [s.requirementId, s]));

  // Y 轴顺序跟需求列表（useRequirements）保持一致 — 都按 sortOrder 升序。
  // 用户在列表里看到的顺序 = 图表里看到的顺序，最直观。
  // 早期版本曾按 "first change date" 排序，导致没 change 涉及的需求（比如刚直接
  // 添加的）反而显示在最前面，跟列表顺序不一致。
  const sorted = [...requirements].sort((a, b) => a.sortOrder - b.sortOrder);

  const changesByReq = new Map<string, Change[]>();
  for (const c of changes) {
    if (!c.targetRequirementId) continue;
    if (c.daysDelta === 0) continue;
    const list = changesByReq.get(c.targetRequirementId) || [];
    list.push(c);
    changesByReq.set(c.targetRequirementId, list);
  }

  return sorted.map((req) => {
    const reqChanges = (changesByReq.get(req.id) || []).sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.createdAt.localeCompare(b.createdAt);
    });

    const segments: GanttSegment[] = reqChanges
      .filter((c) => c.type !== 'cancel_requirement')
      .map((c) => ({
        color: getChangeColor(c, roleColors, saveColor, newReqColor, supplementColor),
        widthDays: Math.abs(c.daysDelta),
        changeId: c.id,
      }));

    return {
      requirement: req,
      scheduleItem: schedMap.get(req.id) ?? null,
      originalWidth: req.originalDays,
      segments,
      isCancelled: req.status === 'cancelled',
      isPaused: req.status === 'paused',
      isNew: req.isAddedByChange,
    };
  });
}

function buildRoleSummary(changes: Change[]): string {
  const counts: Record<string, number> = {};
  for (const c of changes) {
    if (c.daysDelta === 0) continue;
    const name = c.type === 'new_requirement' ? '新增需求' : ROLE_LABELS[c.role];
    counts[name] = (counts[name] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name}×${count}`)
    .join(' · ');
}

export function DetailChart({
  requirements,
  changes,
  schedule,
  roleColors = APP_ROLE_COLORS,
  planColor = APP_COLORS.plan,
  saveColor = APP_COLORS.save,
  newReqColor = APP_COLORS.newRequirement,
  supplementColor = APP_COLORS.supplement,
}: DetailChartProps) {
  const { originalTotalDays, totalDays } = schedule;
  // Stable per-instance prefix for SVG <clipPath> ids (one clip per gantt row).
  const clipPrefix = useId().replace(/:/g, '_');

  if (requirements.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        添加需求后即可看到图表
      </div>
    );
  }

  const timeline = buildTimeline(changes, roleColors, saveColor, newReqColor, supplementColor);
  const ganttRows = buildGanttRows(requirements, changes, schedule, roleColors, saveColor, newReqColor, supplementColor);
  const maxScheduledEndDay = schedule.requirementSchedules.reduce(
    (max, item) => Math.max(max, item.endDay),
    0,
  );
  const maxValidRequirementDays = requirements.reduce((max, requirement) => {
    if (requirement.status === 'cancelled') return max;
    return Math.max(max, requirement.currentDays);
  }, 0);

  const maxEndDay = Math.max(
    maxScheduledEndDay,
    totalDays,
    originalTotalDays,
    maxValidRequirementDays,
    1,
  );

  // All coordinates in pixel-level units (reference width = 800)
  const VB_W = 800;
  const PAD_L = 20;
  const PAD_R = 80;
  const LABEL_W = 150;
  const BAR_START = LABEL_W + 12;
  const BAR_W = VB_W - BAR_START - PAD_R;
  const ROW_H = 28;
  const ROW_GAP = 6;
  const TL_LINE_H = 22;
  const MIN_SEG_W = 4;

  const timelineH = timeline.length > 0 ? timeline.length * TL_LINE_H + 16 : 36;
  const ganttH = ganttRows.length * (ROW_H + ROW_GAP);
  // Bottom summary — give it extra room when the critical-path hint shows.
  const summaryH = 28 + (schedule.criticalPath.length > 0 ? 18 : 0);
  const totalH = timelineH + 12 + ganttH + 16 + summaryH;

  const changeCount = changes.filter((c) => c.daysDelta !== 0).length;
  const roleSummary = buildRoleSummary(changes);

  const dayToX = (day: number) => BAR_START + (day / maxEndDay) * BAR_W;
  const dayToW = (days: number) => Math.max((days / maxEndDay) * BAR_W, MIN_SEG_W);

  return (
    <div className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${VB_W} ${totalH}`}
        preserveAspectRatio="xMinYMin meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ fontFamily: "-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" }}
      >
        {/* === Timeline === */}
        <g transform={`translate(${PAD_L}, 0)`}>
          {timeline.length === 0 ? (
            <text x={0} y={20} fontSize={11} fill="#9CA3AF">
              暂无变更记录
            </text>
          ) : (
            timeline.map((entry, i) => (
              <g key={entry.change.id} transform={`translate(0, ${i * TL_LINE_H})`}>
                <circle cx={5} cy={11} r={4} fill={entry.color} />
                <text x={16} y={14} fontSize={11} fill="#4B5563">
                  {entry.text}
                </text>
              </g>
            ))
          )}
        </g>

        {/* Divider — JSX `stroke` attr renders the light value reliably
         * (literal rgba). Dark mode overrides via .svg-chart-divider in
         * tokens.css. */}
        <line
          x1={PAD_L}
          y1={timelineH}
          x2={VB_W - PAD_R}
          y2={timelineH}
          stroke="rgba(15, 23, 42, 0.07)"
          className="svg-chart-divider"
          strokeWidth={1}
        />

        {/* === Gantt === */}
        <g transform={`translate(0, ${timelineH + 12})`}>
          {/* Time axis ticks and grid lines */}
          {(() => {
            const tickInterval = maxEndDay <= 10 ? 1 : maxEndDay <= 30 ? 5 : 10;
            const ticks: number[] = [];
            for (let d = 0; d <= maxEndDay; d += tickInterval) {
              ticks.push(d);
            }
            if (ticks[ticks.length - 1] !== maxEndDay) ticks.push(maxEndDay);
            return ticks.map((day) => {
              const x = dayToX(day);
              return (
                <g key={`tick-${day}`}>
                  {/* Vertical grid line — same dual-source pattern as divider. */}
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={ganttH}
                    stroke="rgba(15, 23, 42, 0.05)"
                    className="svg-chart-grid"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  {/* Tick label */}
                  <text
                    x={x}
                    y={-6}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#9CA3AF"
                  >
                    D{day}
                  </text>
                </g>
              );
            });
          })()}

          {ganttRows.map((row, i) => {
            const y = i * (ROW_H + ROW_GAP);
            const sched = row.scheduleItem;
            const startX = sched ? dayToX(sched.startDay) : BAR_START;
            // Critical path = the dependency chain that determines totalDays.
            // We outline these rows in red and prepend 🔥 so the user can see
            // at a glance which reqs to cut/parallelize for fastest impact.
            const isCritical =
              !row.isCancelled &&
              !row.isPaused &&
              schedule.criticalPath.includes(row.requirement.id);

            if (row.isNew) {
              const w = dayToW(row.requirement.currentDays);
              const timeLabel = sched ? `@D${sched.startDay}` : '';
              return (
                <g
                  key={row.requirement.id}
                  transform={`translate(0, ${y})`}
                  data-critical={isCritical || undefined}
                  data-req-id={row.requirement.id}
                >
                  <text
                    x={LABEL_W - 4}
                    y={ROW_H / 2 + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill={row.isCancelled ? '#9CA3AF' : '#374151'}
                    textDecoration={row.isCancelled ? 'line-through' : 'none'}
                  >
                    {isCritical && <tspan fill="#DC2626"> 🔥</tspan>}
                    {row.requirement.name}
                    {timeLabel && <tspan fill="#9CA3AF" fontSize={9}> {timeLabel}</tspan>}
                  </text>
                  <rect
                    x={startX}
                    y={2}
                    width={w}
                    height={ROW_H - 4}
                    rx={4}
                    fill={newReqColor}
                    opacity={0.85}
                  />
                  {isCritical && (
                    <rect
                      x={startX - 1}
                      y={1}
                      width={w + 2}
                      height={ROW_H - 2}
                      rx={5}
                      fill="none"
                      stroke="#DC2626"
                      strokeWidth={1.5}
                    />
                  )}
                  <text
                    x={startX + w + 6}
                    y={ROW_H / 2 + 4}
                    fontSize={10}
                    fill="#6B7280"
                  >
                    新增 {row.requirement.currentDays}天
                  </text>
                </g>
              );
            }

            const origW = dayToW(row.originalWidth);
            const timeLabel = sched ? `@D${sched.startDay}` : '';

            const totalRowW = origW + row.segments.reduce((a, s) => a + dayToW(s.widthDays), 0);

            return (
              <g
                key={row.requirement.id}
                transform={`translate(0, ${y})`}
                data-critical={isCritical || undefined}
                data-req-id={row.requirement.id}
              >
                {/* Req name with time label */}
                <text
                  x={LABEL_W - 4}
                  y={ROW_H / 2 + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={row.isCancelled || row.isPaused ? '#9CA3AF' : '#374151'}
                  textDecoration={row.isCancelled ? 'line-through' : 'none'}
                >
                  {isCritical && <tspan fill="#DC2626"> 🔥</tspan>}
                  {row.requirement.name}
                  {row.isPaused && ' ⏸'}
                  {timeLabel && <tspan fill="#9CA3AF" fontSize={9}> {timeLabel}</tspan>}
                </text>

                {/* clipPath — gives the original bar + all segments a single
                    rounded silhouette so segment edges butt up flush. Eliminates
                    the "moon-sliver" gap that used to leak panel background. */}
                {(() => {
                  const rowClipId = `gantt-clip-${clipPrefix}-${i}`;
                  return (
                    <>
                      <defs>
                        <clipPath id={rowClipId}>
                          <rect
                            x={startX}
                            y={2}
                            width={totalRowW}
                            height={ROW_H - 4}
                            rx={4}
                          />
                        </clipPath>
                      </defs>
                      <g clipPath={`url(#${rowClipId})`}>
                        {/* Original-days base — no individual rx, clip handles it */}
                        <rect
                          x={startX}
                          y={2}
                          width={origW}
                          height={ROW_H - 4}
                          fill={row.isCancelled ? '#D1D5DB' : planColor}
                          opacity={row.isPaused ? 0.4 : 0.85}
                        />
                        {/* Change segments — flat, clipPath rounds the outer edge */}
                        {(() => {
                          let offset = origW;
                          return row.segments.map((seg) => {
                            const w = dayToW(seg.widthDays);
                            const xPos = startX + offset;
                            offset += w;
                            return (
                              <rect
                                key={seg.changeId}
                                x={xPos}
                                y={2}
                                width={w}
                                height={ROW_H - 4}
                                fill={seg.color}
                                opacity={0.85}
                              />
                            );
                          });
                        })()}
                      </g>
                    </>
                  );
                })()}

                {/* Cancelled overlay line — strikethrough across the bar. */}
                {row.isCancelled && (
                  <line
                    x1={startX}
                    y1={ROW_H / 2}
                    x2={startX + origW}
                    y2={ROW_H / 2}
                    stroke="#9CA3AF"
                    strokeWidth={1.5}
                  />
                )}

                {/* W-bug-fix: critical-path red border + paused dashed border
                    were both visually heavy. Status is already conveyed by the
                    🔥 / ⏸ emoji + opacity dimming on the row label, which is
                    cleaner. */}

                {/* Day count label */}
                {!row.isCancelled && (
                  <text
                    x={startX + origW + row.segments.reduce((a, s) => a + dayToW(s.widthDays), 0) + 6}
                    y={ROW_H / 2 + 4}
                    fontSize={10}
                    fill="#6B7280"
                  >
                    {row.requirement.currentDays}天
                    {row.segments.length > 0 && ` (原${row.originalWidth})`}
                  </text>
                )}

                {row.isCancelled && (
                  <text
                    x={startX + origW + 6}
                    y={ROW_H / 2 + 4}
                    fontSize={10}
                    fill={saveColor}
                  >
                    节省 {row.requirement.currentDays}天
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* === Bottom summary === */}
        <g transform={`translate(${PAD_L}, ${timelineH + 12 + ganttH + 16})`}>
          <text x={0} y={14} fontSize={11} fill="#6B7280">
            原计划 {originalTotalDays}天 → 实际 {totalDays}天 · {changeCount}次变更
            {roleSummary ? ` · ${roleSummary}` : ''}
          </text>
          {schedule.criticalPath.length > 0 && (
            <text x={0} y={30} fontSize={10} fill="#DC2626">
              🔥 关键路径 {schedule.criticalPath.length} 项 · 决定项目工期，缩短任一项即可整体提前
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
