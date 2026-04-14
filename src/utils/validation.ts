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

export function validateDays(days: number): string | null {
  if (!Number.isInteger(days) || days < 1) return '天数必须为 ≥1 的整数';
  return null;
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
