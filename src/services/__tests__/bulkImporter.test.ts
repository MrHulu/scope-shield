import { describe, it, expect } from 'vitest';
import { parseBulkImport, exportToCsv } from '../bulkImporter';

describe('parseBulkImport (W3.3)', () => {
  it('parses CSV with explicit header', () => {
    const out = parseBulkImport(`name,days,dependsOn
登录,3,
列表,5,
购物车,4,列表`);
    expect(out.errors).toEqual([]);
    expect(out.drafts).toEqual([
      { name: '登录', days: 3, dependsOn: undefined },
      { name: '列表', days: 5, dependsOn: undefined },
      { name: '购物车', days: 4, dependsOn: '列表' },
    ]);
  });

  it('parses CSV without header (positional name,days,dependsOn)', () => {
    const out = parseBulkImport(`登录,3
列表,5`);
    expect(out.drafts.map((d) => d.name)).toEqual(['登录', '列表']);
    expect(out.drafts.map((d) => d.days)).toEqual([3, 5]);
  });

  it('parses TSV (tab-separated)', () => {
    const out = parseBulkImport('name\tdays\n登录\t3\n列表\t5');
    expect(out.errors).toEqual([]);
    expect(out.drafts).toHaveLength(2);
  });

  it('parses JSON array', () => {
    const out = parseBulkImport(
      JSON.stringify([
        { name: '登录', days: 3 },
        { name: '列表', days: 5, dependsOn: '登录' },
      ]),
    );
    expect(out.errors).toEqual([]);
    expect(out.drafts).toEqual([
      { name: '登录', days: 3, dependsOn: undefined },
      { name: '列表', days: 5, dependsOn: '登录' },
    ]);
  });

  it('rejects rows with missing name', () => {
    const out = parseBulkImport(`name,days
,3
列表,5`);
    expect(out.errors[0]).toMatch(/缺少需求名称/);
    expect(out.drafts).toHaveLength(1);
    expect(out.drafts[0].name).toBe('列表');
  });

  it('rejects non-half-step days', () => {
    const out = parseBulkImport(`name,days
登录,3.7`);
    expect(out.errors[0]).toMatch(/0.5 倍数/);
    expect(out.drafts).toHaveLength(0);
  });

  it('rejects empty input', () => {
    expect(parseBulkImport('').errors).toEqual(['粘贴内容为空']);
    expect(parseBulkImport('   \n\n').errors).toEqual(['粘贴内容为空']);
  });

  it('rejects invalid JSON cleanly', () => {
    const out = parseBulkImport('[{not valid json}]');
    expect(out.errors[0]).toMatch(/JSON 解析失败/);
  });

  it('rejects JSON that is not an array', () => {
    const out = parseBulkImport('{ "name": "登录" }');
    expect(out.errors).toEqual(['JSON 顶层必须是数组']);
  });

  it('handles quoted CSV cells with commas inside', () => {
    const out = parseBulkImport(`name,days
"登录, OAuth",3`);
    expect(out.drafts[0].name).toBe('登录, OAuth');
  });

  it('detects "需求名" / "天数" / "前置" Chinese headers', () => {
    const out = parseBulkImport(`需求名,天数,前置
登录,3,
列表,5,登录`);
    expect(out.errors).toEqual([]);
    expect(out.drafts[1].dependsOn).toBe('登录');
  });
});

describe('exportToCsv (W4.1)', () => {
  it('emits header + rows with UTF-8 BOM', () => {
    const csv = exportToCsv([
      { name: '登录', days: 3, dependsOn: undefined, status: 'active' },
      { name: '列表', days: 5, dependsOn: '登录', status: 'active' },
    ]);
    // Starts with BOM character (﻿)
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    // Header row
    expect(csv).toContain('name,days,dependsOn,status');
    // Data rows
    expect(csv).toContain('登录,3,,active');
    expect(csv).toContain('列表,5,登录,active');
  });

  it('quotes cells containing commas', () => {
    const csv = exportToCsv([
      { name: '登录, OAuth', days: 3, dependsOn: undefined, status: 'active' },
    ]);
    expect(csv).toContain('"登录, OAuth"');
  });

  it('escapes embedded double-quotes', () => {
    const csv = exportToCsv([
      { name: 'click "go"', days: 2, dependsOn: undefined, status: 'active' },
    ]);
    expect(csv).toContain('"click ""go"""');
  });

  it('exportToCsv → parseBulkImport round-trips data', () => {
    const csv = exportToCsv([
      { name: '登录', days: 3, dependsOn: undefined, status: 'active' },
      { name: '列表', days: 5, dependsOn: '登录', status: 'active' },
    ]);
    // Drop BOM for parser
    const parsed = parseBulkImport(csv.replace(/^﻿/, ''));
    expect(parsed.errors).toEqual([]);
    expect(parsed.drafts).toEqual([
      { name: '登录', days: 3, dependsOn: undefined },
      { name: '列表', days: 5, dependsOn: '登录' },
    ]);
  });
});
