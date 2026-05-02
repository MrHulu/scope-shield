/**
 * Wave 3 W3.3 — bulk requirement import. Accepts CSV / TSV / JSON and
 * returns a list of typed drafts ready for sequential onAdd() calls.
 *
 * Supported shapes:
 *   1. JSON array:  [{ "name": "登录", "days": 3, "dependsOn": "需求A" }]
 *   2. CSV / TSV:   first row may be header (we auto-detect "name"/"需求"
 *                   keywords); columns we recognize are name | days | dependsOn.
 *
 * `dependsOn` may reference any earlier-row name — the importer rewrites it
 * to be column-position-relative for the caller. The actual ID-resolution
 * happens at insert time via the existing addRequirement() flow.
 */

export interface ImportedDraft {
  name: string;
  days: number;
  /** Name of an earlier row this depends on (or undefined for none). */
  dependsOn: string | undefined;
}

export interface ParseResult {
  drafts: ImportedDraft[];
  errors: string[];
}

const HEADER_TOKENS = ['name', '需求', '名称', 'task', 'item', '需求名'];
const DAYS_TOKENS = ['days', 'day', '天数', '工时', 'duration', 'estimate'];
const DEP_TOKENS = ['dependson', 'depends_on', 'depends-on', '前置', '依赖', 'dep'];

function looksLikeHeader(cells: string[]): boolean {
  return cells.some((c) =>
    HEADER_TOKENS.some((t) => c.toLowerCase().includes(t.toLowerCase())),
  );
}

function indexOfMatching(headers: string[], tokens: string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (let i = 0; i < norm.length; i++) {
    if (tokens.some((t) => norm[i].includes(t.toLowerCase()))) return i;
  }
  return -1;
}

function splitLine(line: string, delimiter: ',' | '\t'): string[] {
  // Minimal CSV split — supports double-quoted cells + escaped quotes.
  const out: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        buf += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === delimiter) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  out.push(buf);
  return out.map((c) => c.trim());
}

function detectDelimiter(sample: string): ',' | '\t' {
  const tabs = (sample.match(/\t/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

function parseCsv(text: string): ParseResult {
  const errors: string[] = [];
  const drafts: ImportedDraft[] = [];
  const delimiter = detectDelimiter(text);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { drafts, errors: ['未检测到任何行'] };

  let nameIdx = 0;
  let daysIdx = 1;
  let depIdx = 2;
  let dataStart = 0;

  const firstCells = splitLine(lines[0], delimiter);
  if (looksLikeHeader(firstCells)) {
    const ni = indexOfMatching(firstCells, HEADER_TOKENS);
    const di = indexOfMatching(firstCells, DAYS_TOKENS);
    const ei = indexOfMatching(firstCells, DEP_TOKENS);
    nameIdx = ni >= 0 ? ni : 0;
    daysIdx = di >= 0 ? di : 1;
    depIdx = ei; // -1 means "no dep column at all"
    dataStart = 1;
  }

  for (let row = dataStart; row < lines.length; row++) {
    const cells = splitLine(lines[row], delimiter);
    const name = (cells[nameIdx] ?? '').trim();
    const daysRaw = (cells[daysIdx] ?? '').trim();
    if (!name) {
      errors.push(`第 ${row + 1} 行：缺少需求名称`);
      continue;
    }
    const days = Number(daysRaw);
    if (!Number.isFinite(days) || days <= 0 || days % 0.5 !== 0) {
      errors.push(`第 ${row + 1} 行「${name}」：天数必须是 ≥0.5 且 0.5 倍数（实际：${daysRaw || '空'}）`);
      continue;
    }
    const dependsOn =
      depIdx >= 0 && cells[depIdx]?.trim() ? cells[depIdx].trim() : undefined;
    drafts.push({ name, days, dependsOn });
  }

  return { drafts, errors };
}

function parseJson(text: string): ParseResult {
  const errors: string[] = [];
  const drafts: ImportedDraft[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { drafts, errors: [`JSON 解析失败：${(e as Error).message}`] };
  }
  if (!Array.isArray(parsed)) {
    return { drafts, errors: ['JSON 顶层必须是数组'] };
  }
  parsed.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) {
      errors.push(`第 ${i + 1} 项：不是对象`);
      return;
    }
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const days = typeof rec.days === 'number' ? rec.days : Number(rec.days);
    if (!name) {
      errors.push(`第 ${i + 1} 项：缺少 name 字段`);
      return;
    }
    if (!Number.isFinite(days) || days <= 0 || days % 0.5 !== 0) {
      errors.push(`第 ${i + 1} 项「${name}」：days 必须是 ≥0.5 且 0.5 倍数`);
      return;
    }
    const dependsOn =
      typeof rec.dependsOn === 'string' && rec.dependsOn.trim()
        ? rec.dependsOn.trim()
        : undefined;
    drafts.push({ name, days, dependsOn });
  });
  return { drafts, errors };
}

/**
 * Auto-detect format: if input starts with `[` or `{` after trim, parse
 * as JSON; otherwise CSV/TSV.
 */
export function parseBulkImport(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { drafts: [], errors: ['粘贴内容为空'] };
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJson(trimmed);
  }
  return parseCsv(trimmed);
}
