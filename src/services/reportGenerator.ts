import type { Change, Project, ProjectStats, Requirement } from '../types';
import { CHANGE_TYPE_LABELS } from '../constants/changeTypes';
import { ROLE_LABELS } from '../constants/roles';

/**
 * Wave 3 W3.5 — Markdown report builder. Output is suitable for direct
 * paste into Feishu / DingTalk / email. Sections (collapsed when empty):
 *   - Header (project name, generation timestamp)
 *   - Summary (original/current/inflation)
 *   - Key changes (sorted by abs(daysDelta) desc, top 10 capped)
 *   - Critical path
 *   - Active vs cancelled requirement counts
 */
export interface ReportInput {
  project: Project;
  stats: ProjectStats;
  requirements: Requirement[];
  changes: Change[];
  /** schedule.criticalPath ids — used to flag rows. Optional. */
  criticalPath?: string[];
}

const MAX_CHANGES_IN_REPORT = 10;

function fmtPercent(rate: number | null): string {
  if (rate === null) return '—';
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate}%`;
}

function fmtDelta(d: number): string {
  if (d > 0) return `+${d}天`;
  if (d < 0) return `${d}天`;
  return '记录变更';
}

export function generateMarkdownReport(input: ReportInput): string {
  const { project, stats, requirements, changes, criticalPath } = input;
  const reqMap = new Map(requirements.map((r) => [r.id, r.name]));
  const lines: string[] = [];

  lines.push(`# ${project.name} · 项目状态报告`);
  lines.push('');
  lines.push(`> 生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  // ── Summary ──
  lines.push('## 概览');
  lines.push('');
  lines.push(`- 原始工期：**${stats.originalTotalDays} 天**`);
  lines.push(`- 当前工期：**${stats.currentTotalDays} 天**`);
  lines.push(`- 膨胀率：**${fmtPercent(stats.inflationRate)}**`);
  lines.push(`- 变更次数：${stats.totalChanges}`);
  if (stats.supplementCount > 0) {
    lines.push(`- 需求补充次数：${stats.supplementCount}`);
  }
  lines.push('');

  // ── Critical path ──
  if (criticalPath && criticalPath.length > 0) {
    lines.push('## 🔥 关键路径');
    lines.push('');
    lines.push('> 决定项目工期，缩短任一项即可整体提前。');
    lines.push('');
    for (const id of criticalPath) {
      const name = reqMap.get(id) ?? id;
      lines.push(`- ${name}`);
    }
    lines.push('');
  }

  // ── Key changes ──
  const meaningfulChanges = changes.filter((c) => c.daysDelta !== 0);
  if (meaningfulChanges.length > 0) {
    lines.push('## 关键变更');
    lines.push('');
    const sorted = [...meaningfulChanges].sort(
      (a, b) => Math.abs(b.daysDelta) - Math.abs(a.daysDelta),
    );
    const top = sorted.slice(0, MAX_CHANGES_IN_REPORT);
    for (const c of top) {
      const target = c.targetRequirementId ? reqMap.get(c.targetRequirementId) ?? '已删除' : '';
      const targetTxt = target ? `「${target}」 ` : '';
      const personTxt = c.personName ? ` (${c.personName})` : '';
      const role = ROLE_LABELS[c.role] ?? c.role;
      lines.push(
        `- ${c.date} · ${CHANGE_TYPE_LABELS[c.type]} · ${role}${personTxt} · ${targetTxt}${c.description} · ${fmtDelta(c.daysDelta)}`,
      );
    }
    if (sorted.length > MAX_CHANGES_IN_REPORT) {
      lines.push(`- _(共 ${sorted.length} 条变更，仅展示影响最大的 ${MAX_CHANGES_IN_REPORT} 条)_`);
    }
    lines.push('');
  }

  // ── Requirements summary ──
  const active = requirements.filter((r) => r.status === 'active').length;
  const cancelled = requirements.filter((r) => r.status === 'cancelled').length;
  const paused = requirements.filter((r) => r.status === 'paused').length;
  lines.push('## 需求结构');
  lines.push('');
  lines.push(`- 进行中：${active}`);
  if (paused > 0) lines.push(`- 已暂停：${paused}`);
  if (cancelled > 0) lines.push(`- 已砍：${cancelled}`);
  lines.push('');

  lines.push('---');
  lines.push('_由 Scope Shield 生成_');

  return lines.join('\n');
}
