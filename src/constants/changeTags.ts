/**
 * Wave 4 W4.4 — predefined change-cause tags. Stored on Change.metadata.tags
 * as a string[]. ChangeModal lets the user multi-select; ChangeStatsPanel
 * aggregates totals across all changes.
 *
 * The tag set is intentionally short — too many tags = nobody uses any of
 * them (the 「其他」 escape hatch handles edge cases).
 */

export const CHANGE_TAGS = [
  '需求方反复',
  '技术债',
  '上线问题',
  '范围扩大',
  '其他',
] as const;

export type ChangeTag = (typeof CHANGE_TAGS)[number];

export const TAG_COLORS: Record<ChangeTag, string> = {
  需求方反复: 'bg-rose-100 text-rose-700',
  技术债: 'bg-amber-100 text-amber-700',
  上线问题: 'bg-purple-100 text-purple-700',
  范围扩大: 'bg-blue-100 text-blue-700',
  其他: 'bg-gray-100 text-gray-600',
};
