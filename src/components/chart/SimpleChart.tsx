import { useId } from 'react';
import type { Change, Requirement, ScheduleResult, Role } from '../../types';
import { APP_ROLE_COLORS, APP_COLORS } from '../../constants/colors';
import { ROLE_LABELS } from '../../constants/roles';
import { CHANGE_TYPE_LABELS } from '../../constants/changeTypes';

interface SimpleChartProps {
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

interface Segment {
  change: Change;
  width: number; // in days
  color: string;
  label: string;
}

function getSegmentColor(
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

function buildSegments(
  changes: Change[],
  roleColors: Record<Role, string>,
  saveColor: string,
  newReqColor: string,
  supplementColor: string,
): Segment[] {
  return changes
    .filter((c) => c.daysDelta !== 0)
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.createdAt.localeCompare(b.createdAt);
    })
    .map((c) => {
      const person = c.personName ? ` ${c.personName}` : '';
      const label =
        c.type === 'cancel_requirement'
          ? `${c.date} 节省${Math.abs(c.daysDelta)}天`
          : `${c.date} ${ROLE_LABELS[c.role]}${person}: ${c.description} ${c.daysDelta > 0 ? '+' : ''}${c.daysDelta}天`;
      return {
        change: c,
        width: Math.abs(c.daysDelta),
        color: getSegmentColor(c, roleColors, saveColor, newReqColor, supplementColor),
        label,
      };
    });
}

function buildRoleSummary(changes: Change[]): string {
  const counts: Record<string, number> = {};
  for (const c of changes) {
    if (c.daysDelta === 0) continue;
    const name =
      c.type === 'new_requirement'
        ? CHANGE_TYPE_LABELS.new_requirement
        : ROLE_LABELS[c.role];
    counts[name] = (counts[name] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name}×${count}`)
    .join(' · ');
}

export function SimpleChart({
  requirements,
  changes,
  schedule,
  roleColors = APP_ROLE_COLORS,
  planColor = APP_COLORS.plan,
  saveColor = APP_COLORS.save,
  newReqColor = APP_COLORS.newRequirement,
  supplementColor = APP_COLORS.supplement,
}: SimpleChartProps) {
  const { originalTotalDays, totalDays } = schedule;
  const segments = buildSegments(changes, roleColors, saveColor, newReqColor, supplementColor);
  const segmentDaysSum = segments.reduce((s, seg) => s + seg.width, 0);

  if (requirements.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        添加需求后即可看到图表
      </div>
    );
  }

  // All coordinates in pixel-level units (reference width = 800)
  const VB_W = 800;
  const PAD_L = 20;
  const PAD_R = 80; // room for "实际 XX天" marker text
  const BAR_W = VB_W - PAD_L - PAD_R;
  const barH = 36;
  const gap = 44;
  const MIN_SEG_W = 4;

  const baseDays = Math.max(originalTotalDays, totalDays, originalTotalDays + segmentDaysSum, 1);
  const totalDelay = totalDays - originalTotalDays;
  const changeCount = changes.filter((c) => c.daysDelta !== 0).length;
  const roleSummary = buildRoleSummary(changes);

  const segAnnotH = segments.length * 20 + 8;
  const summaryH = 72;
  const svgH = barH + gap + barH + 8 + segAnnotH + summaryH;

  const dayToX = (days: number) => PAD_L + (days / baseDays) * BAR_W;
  const dayToW = (days: number) => Math.max((days / baseDays) * BAR_W, MIN_SEG_W);

  // Bug-fix: actual bar = base + segments end-to-end. The old code rounded
  // each rect individually with `rx={isLast ? 6 : 0}`, which left a tiny
  // curved void between base.right (rounded) and segment[0].left (square)
  // → users saw the panel background "leaking" through. Wrap the whole bar
  // in a single rounded clipPath instead — segments stay flat, the silhouette
  // is one continuous pill.
  const clipUid = useId().replace(/:/g, '_');
  const actualClipId = `actual-clip-${clipUid}`;
  const actualBarPx = dayToW(originalTotalDays) + segments.reduce((sum, s) => sum + dayToW(s.width), 0);

  return (
    <div className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${VB_W} ${svgH}`}
        preserveAspectRatio="xMinYMin meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ fontFamily: "-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" }}
      >
        <defs>
          {/* clipPath operates in the local user space of the element it
           * clips. Since this clip is applied to a `<g>` already inside
           * `<g transform="translate(0, barH+gap)">`, the rect coords here
           * are in that translated frame → y=0 (NOT barH+gap). */}
          <clipPath id={actualClipId}>
            <rect
              x={PAD_L}
              y={0}
              width={actualBarPx}
              height={barH}
              rx={6}
            />
          </clipPath>
        </defs>
        {/* === Plan bar === */}
        <g>
          <rect
            x={PAD_L}
            y={0}
            width={dayToW(originalTotalDays)}
            height={barH}
            rx={6}
            fill={planColor}
            opacity={0.85}
          />
          <text x={PAD_L + 10} y={barH / 2 + 5} fontSize={13} fill="#fff" fontWeight={500}>
            原始计划 {originalTotalDays}天
          </text>
        </g>

        {/* === Actual bar === */}
        <g transform={`translate(0, ${barH + gap})`}>
          {/* Wrap the bar fills in a clipPath group → continuous rounded
              silhouette across base + all segments, no inter-segment seam. */}
          <g clipPath={`url(#${actualClipId})`}>
            {/* Blue base — no individual rx, clipPath handles rounding */}
            <rect
              x={PAD_L}
              y={0}
              width={dayToW(originalTotalDays)}
              height={barH}
              fill={planColor}
              opacity={0.85}
            />

            {/* Change segments */}
            {(() => {
              let offsetDays = originalTotalDays;
              return segments.map((seg) => {
                const x = dayToX(offsetDays);
                const w = dayToW(seg.width);
                offsetDays += seg.width;
                return (
                  <rect
                    key={`${seg.change.id}-fill`}
                    x={x}
                    y={0}
                    width={w}
                    height={barH}
                    fill={seg.color}
                    opacity={0.85}
                  />
                );
              });
            })()}
          </g>
          {/* Base label sits on top of the clipped bar */}
          <text x={PAD_L + 10} y={barH / 2 + 5} fontSize={13} fill="#fff" fontWeight={500}>
            {originalTotalDays}天
          </text>

          {/* Per-segment annotation lines + labels (outside clipPath so they
              extend below the bar). */}
          {(() => {
            let offsetDays = originalTotalDays;
            return segments.map((seg, i) => {
              const x = dayToX(offsetDays);
              const w = dayToW(seg.width);
              offsetDays += seg.width;
              const isSave = seg.change.type === 'cancel_requirement';
              return (
                <g key={seg.change.id}>
                  {/* Annotation line */}
                  <line
                    x1={x + w / 2}
                    y1={barH}
                    x2={x + w / 2}
                    y2={barH + 8 + i * 20}
                    stroke={seg.color}
                    strokeWidth={1}
                    opacity={0.4}
                  />
                  <text
                    x={x + w / 2 + 4}
                    y={barH + 8 + i * 20 + 13}
                    fontSize={10}
                    fill={isSave ? saveColor : '#6B7280'}
                  >
                    {seg.label}
                  </text>
                </g>
              );
            });
          })()}

          {/* Current total marker line */}
          <line
            x1={dayToX(totalDays)}
            y1={-6}
            x2={dayToX(totalDays)}
            y2={barH + 6}
            stroke="#111827"
            strokeWidth={2}
            strokeDasharray="4,3"
          />
          <text
            x={dayToX(totalDays)}
            y={-10}
            textAnchor="middle"
            fontSize={12}
            fill="#111827"
            fontWeight={600}
          >
            实际 {totalDays}天
          </text>
        </g>

        {/* === Bottom summary === */}
        <g transform={`translate(${PAD_L}, ${barH + gap + barH + 8 + segAnnotH})`}>
          <text
            x={0}
            y={18}
            fontSize={20}
            fontWeight={700}
            fill={totalDelay > 0 ? '#DC2626' : totalDelay < 0 ? '#059669' : '#6B7280'}
          >
            {totalDelay > 0
              ? `延期 ${totalDelay} 天`
              : totalDelay < 0
                ? `提前 ${Math.abs(totalDelay)} 天`
                : '工期不变'}
          </text>
          <text x={0} y={40} fontSize={12} fill="#9CA3AF">
            {changeCount} 次变更{roleSummary ? ` · ${roleSummary}` : ''}
          </text>
          <text
            x={0}
            y={58}
            fontSize={12}
            fill={totalDelay > 0 ? '#DC2626' : '#6B7280'}
            fontWeight={600}
          >
            {totalDelay > 0
              ? `100% 来自需求变更 · 0 天来自开发`
              : totalDelay === 0
                ? '需求变更未影响工期'
                : '需求变更被工期节省抵消'}
          </text>
        </g>
      </svg>
    </div>
  );
}
