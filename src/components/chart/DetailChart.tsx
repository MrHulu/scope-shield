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
): string {
  if (c.type === 'cancel_requirement') return saveColor;
  if (c.type === 'new_requirement') return newReqColor;
  return roleColors[c.role];
}

function buildTimeline(
  changes: Change[],
  roleColors: Record<Role, string>,
  saveColor: string,
  newReqColor: string,
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
          : c.type === 'pause'
            ? '（暂停）'
            : c.type === 'resume'
              ? '（恢复）'
              : '';
    return {
      change: c,
      color: getChangeColor(c, roleColors, saveColor, newReqColor),
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
): GanttRow[] {
  const sorted = [...requirements].sort((a, b) => a.sortOrder - b.sortOrder);
  const schedMap = new Map(schedule.requirementSchedules.map((s) => [s.requirementId, s]));

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
        color: getChangeColor(c, roleColors, saveColor, newReqColor),
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
}: DetailChartProps) {
  const { originalTotalDays, totalDays } = schedule;

  if (requirements.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        添加需求后即可看到图表
      </div>
    );
  }

  const timeline = buildTimeline(changes, roleColors, saveColor, newReqColor);
  const ganttRows = buildGanttRows(requirements, changes, schedule, roleColors, saveColor, newReqColor);

  const maxEndDay = Math.max(
    ...schedule.requirementSchedules.map((s) => s.endDay),
    totalDays,
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
  const summaryH = 28;
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

        {/* Divider */}
        <line
          x1={PAD_L}
          y1={timelineH}
          x2={VB_W - PAD_R}
          y2={timelineH}
          stroke="#E5E7EB"
          strokeWidth={1}
        />

        {/* === Gantt === */}
        <g transform={`translate(0, ${timelineH + 12})`}>
          {ganttRows.map((row, i) => {
            const y = i * (ROW_H + ROW_GAP);
            const sched = row.scheduleItem;
            const startX = sched ? dayToX(sched.startDay) : BAR_START;

            if (row.isNew) {
              const w = dayToW(row.requirement.currentDays);
              return (
                <g key={row.requirement.id} transform={`translate(0, ${y})`}>
                  <text
                    x={LABEL_W - 4}
                    y={ROW_H / 2 + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill={row.isCancelled ? '#9CA3AF' : '#374151'}
                    textDecoration={row.isCancelled ? 'line-through' : 'none'}
                  >
                    {row.requirement.name}
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

            return (
              <g key={row.requirement.id} transform={`translate(0, ${y})`}>
                {/* Req name */}
                <text
                  x={LABEL_W - 4}
                  y={ROW_H / 2 + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={row.isCancelled || row.isPaused ? '#9CA3AF' : '#374151'}
                  textDecoration={row.isCancelled ? 'line-through' : 'none'}
                >
                  {row.requirement.name}
                  {row.isPaused ? ' ⏸' : ''}
                </text>

                {/* Original days bar */}
                <rect
                  x={startX}
                  y={2}
                  width={origW}
                  height={ROW_H - 4}
                  rx={4}
                  fill={row.isCancelled ? '#D1D5DB' : planColor}
                  opacity={row.isPaused ? 0.4 : 0.85}
                />

                {/* Cancelled overlay line */}
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

                {/* Paused dashed border */}
                {row.isPaused && (
                  <rect
                    x={startX}
                    y={2}
                    width={origW}
                    height={ROW_H - 4}
                    rx={4}
                    fill="none"
                    stroke="#9CA3AF"
                    strokeWidth={1}
                    strokeDasharray="4,2"
                  />
                )}

                {/* Change segments */}
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
                        rx={2}
                        fill={seg.color}
                        opacity={0.85}
                      />
                    );
                  });
                })()}

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
            {roleSummary ? ` · ${roleSummary}` : ''} · 0天来自开发
          </text>
        </g>
      </svg>
    </div>
  );
}
