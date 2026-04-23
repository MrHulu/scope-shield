export function validateProjectName(name: string): string | null {
  if (!name.trim()) return '项目名称不能为空';
  if (name.length > 100) return '项目名称不能超过 100 字';
  return null;
}

export function validateRequirementName(name: string): string | null {
  if (!name.trim()) return '需求名称不能为空';
  if (name.length > 200) return '需求名称不能超过 200 字';
  return null;
}

/**
 * Validate days with 0.5-step granularity, minimum 0.5.
 * Used for requirement days, add_days daysDelta, pause remainingDays.
 */
export function validateDays(days: number): string | null {
  if (typeof days !== 'number' || isNaN(days)) return '请输入有效天数';
  if (days < 0.5) return '天数最小为 0.5';
  if (!isValidHalfStep(days)) return '天数须为 0.5 的倍数（0.5, 1, 1.5, 2...）';
  return null;
}

/**
 * Validate supplement daysDelta: allows 0, minimum step 0.5 when > 0.
 */
export function validateSupplementDays(days: number): string | null {
  if (typeof days !== 'number' || isNaN(days)) return '请输入有效天数';
  if (days < 0) return '天数不能为负数';
  if (days > 0 && !isValidHalfStep(days)) return '天数须为 0.5 的倍数（0, 0.5, 1, 1.5...）';
  return null;
}

/**
 * Validate paused remaining days: 0.5 <= value <= currentDays, 0.5 step.
 */
export function validatePausedRemainingDays(days: number, currentDays: number): string | null {
  if (typeof days !== 'number' || isNaN(days)) return '请输入有效天数';
  if (days < 0.5 || days > currentDays) return `剩余天数须在 0.5~${currentDays} 之间`;
  if (!isValidHalfStep(days)) return '天数须为 0.5 的倍数';
  return null;
}

/**
 * Check if a number is a valid 0.5-step value (0, 0.5, 1, 1.5, 2, ...).
 */
function isValidHalfStep(n: number): boolean {
  // Multiply by 2 and check if integer (avoids floating-point issues)
  return Number.isInteger(n * 2);
}

export function validateDescription(desc: string): string | null {
  if (!desc.trim()) return '请填写变更描述';
  if (desc.length > 500) return '描述不能超过 500 字';
  return null;
}

export function validateExportWidth(width: number): string | null {
  if (width < 200 || width > 2000) return '宽度范围 200–2000px';
  return null;
}
