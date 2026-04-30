import { describe, expect, it, vi } from 'vitest';
import {
  analyzeFeishuRequirementUrl,
  buildFeishuRequirementSource,
  mapFeishuWorkItemToDraft,
  normalizeFeishuApiBaseUrl,
  parseFeishuProjectUrl,
  sanitizeRequirementSource,
} from '../feishuRequirement';

describe('parseFeishuProjectUrl', () => {
  it('extracts Feishu project work item identifiers from query params', () => {
    const result = parseFeishuProjectUrl(
      'https://project.feishu.cn/proj/story/detail?project_key=CRM&work_item_type_key=story&work_item_id=12345',
    );

    expect(result.ok).toBe(true);
    expect(result.source?.projectKey).toBe('CRM');
    expect(result.source?.workItemTypeKey).toBe('story');
    expect(result.source?.workItemId).toBe('12345');
  });

  it('extracts identifiers from hash routes', () => {
    const result = parseFeishuProjectUrl(
      'https://project.feishu.cn/CRM#/work_item/issue/98765?work_item_type_key=issue',
    );

    expect(result.ok).toBe(true);
    expect(result.source?.projectKey).toBe('CRM');
    expect(result.source?.workItemTypeKey).toBe('issue');
    expect(result.source?.workItemId).toBe('98765');
  });

  it('rejects non-Feishu URLs', () => {
    const result = parseFeishuProjectUrl('https://example.com/task/123');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('飞书项目');
  });

  it('rejects spoofed Feishu-looking hosts', () => {
    const result = parseFeishuProjectUrl('https://evilfeishu.cn/proj?work_item_id=12345');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('飞书项目');
  });

  it('rejects malformed encoded path segments', () => {
    const result = parseFeishuProjectUrl('https://project.feishu.cn/%E0%A4%A');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('有效');
  });
});

describe('buildFeishuRequirementSource', () => {
  it('normalizes URL and stores parsed metadata', () => {
    const source = buildFeishuRequirementSource(
      'https://project.feishu.cn/proj?project_key=PAY&work_item_type_key=requirement&work_item_id=42',
    );

    expect(source.provider).toBe('feishu_project');
    expect(source.url).toContain('project.feishu.cn');
    expect(source.projectKey).toBe('PAY');
    expect(source.workItemTypeKey).toBe('requirement');
    expect(source.workItemId).toBe('42');
  });
});

describe('mapFeishuWorkItemToDraft', () => {
  it('maps common title, estimate, owner and schedule fields', () => {
    const draft = mapFeishuWorkItemToDraft(
      {
        name: '支付重构',
        fields: {
          estimate: 4,
          owner: [{ name: '张三' }, { name: '李四' }],
          start_date: '2026-05-01',
          due_date: '2026-05-06',
        },
      },
      'https://project.feishu.cn/item/42',
    );

    expect(draft.name).toBe('支付重构');
    expect(draft.originalDays).toBe(4);
    expect(draft.source.ownerNames).toEqual(['张三', '李四']);
    expect(draft.source.startDate).toBe('2026-05-01');
    expect(draft.source.endDate).toBe('2026-05-06');
  });

  it('supports Feishu field arrays', () => {
    const draft = mapFeishuWorkItemToDraft(
      {
        data: {
          work_item: {
            fields: [
              { field_key: 'name', value: '风控规则配置' },
              { field_key: 'story_points', value: '2.5' },
              { field_key: 'assignee', value: [{ name: '王五' }] },
            ],
          },
        },
      },
      'https://project.feishu.cn/item/99',
    );

    expect(draft.name).toBe('风控规则配置');
    expect(draft.originalDays).toBe(2.5);
    expect(draft.source.ownerNames).toEqual(['王五']);
  });
});

describe('analyzeFeishuRequirementUrl', () => {
  it('returns url_only when required URL fields are missing', async () => {
    const fetcher = vi.fn();

    const draft = await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj',
      { fetcher },
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(draft.status).toBe('url_only');
  });

  it('calls proxy demand_fetch and maps the response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          modules: [{
            key: 'detail',
            data: {
              field_value_map: {
                name: '飞书自动导入',
                estimate: 3,
                owner: [{ name: '张三' }],
                start_date: '2026-05-01',
                due_date: '2026-05-06',
              },
            },
          }],
        },
      }),
    });

    const draft = await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj?project_key=PAY&work_item_type_key=story&work_item_id=42',
      { fetcher },
    );

    expect(fetcher).toHaveBeenCalledOnce();
    expect(draft.status).toBe('fetched');
    expect(draft.name).toBe('飞书自动导入');
    expect(draft.originalDays).toBe(3);
    expect(draft.source.ownerNames).toEqual(['张三']);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/feishu/v5/workitem/v1/demand_fetch',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"project_simple_name":"PAY"'),
      }),
    );
  });

  it('maps biz_data workitem structure (v2 response)', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          biz_data: [{
            key: 'workitem',
            value: {
              name: 'CM2新增预设功能',
              owner: { nickname: '朱迪', name_en: '朱迪' },
              story_id: 6922009274,
            },
          }],
          modules: [{ key: 'detail', children: [] }],
        },
      }),
    });

    const draft = await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj?project_key=HOST&work_item_type_key=story&work_item_id=6922009274',
      { fetcher },
    );

    expect(draft.status).toBe('fetched');
    expect(draft.name).toBe('CM2新增预设功能');
    expect(draft.source.ownerNames).toEqual(['朱迪']);
  });

  it('falls back to URL-only draft on non-2xx API responses', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const draft = await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj?project_key=PAY&work_item_type_key=story&work_item_id=42',
      { fetcher },
    );

    expect(draft.status).toBe('url_only');
    expect(draft.error).toContain('HTTP 500');
  });

  it('falls back to URL-only draft on API error code', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 302000002, msg: 'no permission' }),
    });

    const draft = await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj?project_key=PAY&work_item_type_key=story&work_item_id=42',
      { fetcher },
    );

    expect(draft.status).toBe('url_only');
    expect(draft.error).toContain('302000002');
  });

  it('falls back to URL-only draft on network errors', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network blocked'));

    const draft = await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj?project_key=PAY&work_item_type_key=story&work_item_id=42',
      { fetcher },
    );

    expect(draft.status).toBe('url_only');
    expect(draft.error).toBe('Network blocked');
  });
});

describe('normalizeFeishuApiBaseUrl', () => {
  it('normalizes official hosts and local dev hosts', () => {
    expect(normalizeFeishuApiBaseUrl('https://project.feishu.cn')).toBe('https://project.feishu.cn');
    expect(normalizeFeishuApiBaseUrl('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('rejects paths, params and non-official hosts', () => {
    expect(() => normalizeFeishuApiBaseUrl('https://project.feishu.cn/open_api')).toThrow('不能包含路径');
    expect(() => normalizeFeishuApiBaseUrl('https://evil.example')).toThrow('官方域名');
  });
});

describe('sanitizeRequirementSource', () => {
  it('keeps only safe source fields', () => {
    const source = sanitizeRequirementSource({
      provider: 'feishu_project',
      url: 'https://project.feishu.cn/proj?project_key=PAY&work_item_type_key=story&work_item_id=42',
      rawTitle: '支付需求',
      ownerNames: ['张三', '张三', 123, '李四'],
      startDate: '2026-05-01 10:00:00',
      endDate: '2026-05-03',
      pluginToken: 'must-not-export',
      userKey: 'must-not-export',
    });

    expect(source).toEqual({
      provider: 'feishu_project',
      url: 'https://project.feishu.cn/proj?project_key=PAY&work_item_type_key=story&work_item_id=42',
      projectKey: 'PAY',
      workItemTypeKey: 'story',
      workItemId: '42',
      rawTitle: '支付需求',
      ownerNames: ['张三', '李四'],
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      fetchedAt: null,
    });
    expect(source).not.toHaveProperty('pluginToken');
    expect(source).not.toHaveProperty('userKey');
  });

  it('rejects unsafe source URLs', () => {
    expect(sanitizeRequirementSource({
      provider: 'feishu_project',
      url: 'javascript:alert(1)',
    })).toBeNull();
    expect(sanitizeRequirementSource({
      provider: 'feishu_project',
      url: 'https://evilfeishu.cn/proj?work_item_id=12345',
    })).toBeNull();
  });
});
