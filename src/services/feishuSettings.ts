import type { FeishuAnalyzeSettings } from './feishuRequirement';

const STORAGE_KEY = 'scope-shield-feishu-settings';

export function getFeishuSettings(): FeishuAnalyzeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FeishuAnalyzeSettings;
    return { baseUrl: parsed.baseUrl || undefined };
  } catch {
    return {};
  }
}

export function saveFeishuSettings(settings: FeishuAnalyzeSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl: settings.baseUrl }));
}

export async function checkProxyStatus(): Promise<boolean> {
  try {
    const resp = await fetch('/api/feishu/v1/project/trans_simple_name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simple_name_list: [] }),
    });
    if (!resp.ok) return false;
    const json = await resp.json();
    return json.code === 0;
  } catch {
    return false;
  }
}
