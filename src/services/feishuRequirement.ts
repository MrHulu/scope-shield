import type { RequirementSource } from '../types';

export interface FeishuUrlParseResult {
  ok: boolean;
  source?: RequirementSource;
  error?: string;
}

export interface RequirementDraft {
  name: string;
  originalDays: number | null;
  source: RequirementSource;
  status: 'url_only' | 'fetched';
  error?: string;
}

export interface FeishuAnalyzeSettings {
  baseUrl?: string;
}

export interface AnalyzeFeishuRequirementOptions {
  settings?: FeishuAnalyzeSettings;
  fetcher?: typeof fetch;
}

const FEISHU_HOST_HINTS = ['feishu.cn', 'larksuite.com', 'meegle.com'];
const FEISHU_API_HOSTS = new Set([
  'project.feishu.cn',
  'project.larksuite.com',
  'project.meegle.com',
]);

const KNOWN_WORK_ITEM_TYPES = new Set([
  'story', 'issue', 'requirement', 'task', 'bug', 'epic', 'sub_task',
]);

const GENERIC_PATH_SEGMENTS = new Set([
  'project',
  'proj',
  'work_item',
  'workitem',
  'detail',
  'issue',
  'story',
  'requirement',
  'task',
  'view',
  'item',
]);

export function parseFeishuProjectUrl(input: string): FeishuUrlParseResult {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, error: '请输入有效的飞书项目 URL' };
  }

  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') {
    return { ok: false, error: '飞书项目 URL 必须使用 https' };
  }

  if (!FEISHU_HOST_HINTS.some((hint) => isSameOrSubdomain(host, hint))) {
    return { ok: false, error: '当前仅支持飞书项目 URL' };
  }

  const params = collectUrlParams(url);
  const segmentsResult = collectPathSegments(url);
  if (!segmentsResult.ok) return { ok: false, error: segmentsResult.error };
  const segments = segmentsResult.segments;
  const workItemIndex = segments.findIndex((s) => s === 'work_item' || s === 'workitem');

  const source: RequirementSource = {
    provider: 'feishu_project',
    url: url.toString(),
    projectKey:
      pickParam(params, ['project_key', 'projectKey', 'simple_name', 'project']) ??
      inferProjectKey(segments),
    workItemTypeKey:
      pickParam(params, ['work_item_type_key', 'workItemTypeKey', 'type_key', 'type']) ??
      inferWorkItemType(segments, workItemIndex),
    workItemId:
      pickParam(params, ['work_item_id', 'workItemId', 'issue_id', 'task_id', 'id']) ??
      inferWorkItemId(segments, workItemIndex),
  };

  return { ok: true, source };
}

export function sanitizeRequirementSource(value: unknown): RequirementSource | null {
  const record = asRecord(value);
  if (!record || record.provider !== 'feishu_project' || typeof record.url !== 'string') {
    return null;
  }

  const parsed = parseFeishuProjectUrl(record.url);
  if (!parsed.ok || !parsed.source) return null;

  return {
    ...parsed.source,
    rawTitle: optionalString(record.rawTitle),
    ownerNames: Array.isArray(record.ownerNames)
      ? uniqueStrings(record.ownerNames.filter((n): n is string => typeof n === 'string')).slice(0, 20)
      : [],
    startDate: optionalIsoDate(record.startDate),
    endDate: optionalIsoDate(record.endDate),
    fetchedAt: optionalString(record.fetchedAt),
  };
}

export function buildFeishuRequirementSource(input: string): RequirementSource {
  const parsed = parseFeishuProjectUrl(input);
  if (!parsed.ok || !parsed.source) {
    throw new Error(parsed.error ?? '无法解析飞书项目 URL');
  }
  return parsed.source;
}

export function mapFeishuWorkItemToDraft(raw: unknown, sourceUrl: string): RequirementDraft {
  const source = buildFeishuRequirementSource(sourceUrl);
  const item = unwrapWorkItem(raw);
  const fields = normalizeFields(item);

  const name =
    firstString([
      getValue(item, ['name']),
      getValue(item, ['title']),
      getValue(item, ['summary']),
      getValue(fields, ['name']),
      getValue(fields, ['title']),
      getValue(fields, ['summary']),
      getValue(fields, ['requirement_name']),
    ]) ?? '';

  const estimate = firstNumber([
    getValue(item, ['estimate']),
    getValue(item, ['estimated_days']),
    getValue(item, ['story_points']),
    getValue(fields, ['estimate']),
    getValue(fields, ['estimated_days']),
    getValue(fields, ['story_points']),
    getValue(fields, ['dev_days']),
    getValue(fields, ['工期']),
  ]) ?? inferEstimateByKeyword(fields) ?? inferEstimateByKeyword(item);

  if (estimate === null && import.meta?.env?.DEV) {
    // 帮排查飞书自定义字段名 — 拿不到工期时把字段表打到浏览器 console
    // eslint-disable-next-line no-console
    console.info('[feishu] estimate not found. item keys:', Object.keys(item),
      'field keys:', Object.keys(fields), 'sample fields:', fields);
  }

  const ownerNames = uniqueStrings([
    ...extractNames(getValue(item, ['owner'])),
    ...extractNames(getValue(item, ['assignee'])),
    ...extractNames(getValue(fields, ['owner'])),
    ...extractNames(getValue(fields, ['assignee'])),
    ...extractNames(getValue(fields, ['developer'])),
  ]);

  const startDate = firstIsoDate([
    getValue(item, ['start_date']),
    getValue(item, ['startTime']),
    getValue(fields, ['start_date']),
    getValue(fields, ['start_time']),
    getValue(fields, ['plan_start']),
  ]);

  const endDate = firstIsoDate([
    getValue(item, ['end_date']),
    getValue(item, ['due_date']),
    getValue(item, ['dueDate']),
    getValue(fields, ['end_date']),
    getValue(fields, ['due_date']),
    getValue(fields, ['deadline']),
    getValue(fields, ['plan_end']),
  ]);

  return {
    name,
    originalDays: estimate && estimate >= 0.5 ? estimate : null,
    status: 'fetched',
    source: {
      ...source,
      rawTitle: name || null,
      ownerNames,
      startDate,
      endDate,
      fetchedAt: new Date().toISOString(),
    },
  };
}

/**
 * Cached login probe state — populated by prefetchLoginStatus() and consumed
 * by analyzeFeishuRequirementUrl() to short-circuit the slow demand_fetch
 * round trip when we already know the user is unauthenticated.
 *
 * The 30s TTL is a balance: long enough that the user opening the form,
 * pasting a URL, and clicking 解析 all reuse one probe; short enough that
 * a successful 一键登录 mid-session invalidates the cache reasonably fast
 * (clearLoginCache() also gets called explicitly after the login flow).
 */
let _loginCache: { authed: boolean; expiresAt: number } | null = null;
const LOGIN_CACHE_TTL = 30_000;

/**
 * Probe `/goapi/v1/project/trans_simple_name` and cache the auth state for
 * 30s. Cheap (~50ms when cookies are good, ~200ms when not), and dropping
 * the result into a module-level cache means analyzeFeishuRequirementUrl()
 * can skip its 3-second demand_fetch round trip when we already know the
 * user isn't logged in.
 *
 * Returns `true` only when the API responds with `code: 0`. All other
 * shapes (HTTP errors, network errors, code != 0) cache as unauthenticated
 * so the UI degrades to the url-only path.
 */
export async function prefetchLoginStatus(
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (_loginCache && _loginCache.expiresAt > Date.now()) {
    return _loginCache.authed;
  }
  try {
    const r = await fetcher('/api/feishu/v1/project/trans_simple_name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simple_name_list: [] }),
    });
    if (!r.ok) {
      _loginCache = { authed: false, expiresAt: Date.now() + LOGIN_CACHE_TTL };
      return false;
    }
    const j = (await r.json().catch(() => null)) as { code?: number } | null;
    const authed = j?.code === 0;
    _loginCache = { authed, expiresAt: Date.now() + LOGIN_CACHE_TTL };
    return authed;
  } catch {
    _loginCache = { authed: false, expiresAt: Date.now() + LOGIN_CACHE_TTL };
    return false;
  }
}

/** Drop the cached probe result. Call this right after a one-click login
 *  so the next analyze attempt re-probes instead of returning stale data. */
export function clearLoginCache(): void {
  _loginCache = null;
}

/** Test-only: read the current cache contents (or null if none). */
export function _getLoginCacheForTest(): typeof _loginCache {
  return _loginCache;
}

export async function analyzeFeishuRequirementUrl(
  url: string,
  options: AnalyzeFeishuRequirementOptions = {},
): Promise<RequirementDraft> {
  const source = buildFeishuRequirementSource(url);

  if (!source.projectKey || !source.workItemTypeKey || !source.workItemId) {
    return urlOnlyDraft(source);
  }

  const fetcher = options.fetcher ?? fetch;
  const proxyBase = '/api/feishu';

  // Fast path: prefetched cache says we're not logged in → skip the slow
  // demand_fetch round trip entirely (was 3-4s on the secretary walkthrough).
  if (_loginCache && _loginCache.expiresAt > Date.now() && !_loginCache.authed) {
    return urlOnlyDraft(source, '飞书未登录，登录后会自动拉取需求信息');
  }

  try {
    const response = await fetcher(`${proxyBase}/v5/workitem/v1/demand_fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_simple_name: source.projectKey,
        work_item_api_name: source.workItemTypeKey,
        work_item_id: Number(source.workItemId),
        modules: [{ key: 'detail', params: { first_screen: true, visible_area: { enable: true } } }],
        version: '2',
      }),
    });

    if (!response.ok) {
      return urlOnlyDraft(source, `飞书代理请求失败：HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.code && json.code !== 0) {
      return urlOnlyDraft(source, `飞书 API 错误 ${json.code}：${json.msg || '未知错误'}`);
    }

    return mapDemandFetchToDraft(json, source);
  } catch (err) {
    return urlOnlyDraft(source, err instanceof Error ? err.message : '飞书代理请求失败');
  }
}

function mapDemandFetchToDraft(json: unknown, source: RequirementSource): RequirementDraft {
  const root = asRecord(json) ?? {};
  const data = asRecord(root.data) ?? {};

  const bizWorkItem = extractBizWorkItem(data);
  const fieldMap = extractFieldValueMap(data);
  const nodeSchedule = extractScheduleFromNodes(data);

  const name =
    firstString([
      bizWorkItem.name, bizWorkItem.title,
      fieldMap.name, fieldMap.title, fieldMap.summary,
    ]) ?? '';

  const estimate =
    firstNumber([
      bizWorkItem.estimate, bizWorkItem.story_points, bizWorkItem.estimated_days,
      fieldMap.estimate, fieldMap.estimated_days, fieldMap.story_points, fieldMap.dev_days,
    ])
    ?? nodeSchedule.points
    ?? inferEstimateByKeyword(fieldMap)
    ?? inferEstimateByKeyword(bizWorkItem);

  // 取"当前实现节点的负责人"，按精度从高到低分层：
  //   1. workitem.current_status_operator（飞书直接给的当前状态操作人）
  //   2. node[doing].owner.value → role_key → workitem.role_owners[role].owners
  //   3. 最后回退到 workitem.owner / assignee / fieldMap.owner / assignee
  const currentNodeOwners = extractNames(bizWorkItem.current_status_operator);
  const roleBasedOwners = currentNodeOwners.length === 0
    ? extractCurrentNodeOwnersByRole(data, bizWorkItem)
    : [];
  const legacyOwners = currentNodeOwners.length === 0 && roleBasedOwners.length === 0
    ? [
        ...extractNames(bizWorkItem.owner),
        ...extractNames(bizWorkItem.assignee),
        ...extractNames(fieldMap.owner),
        ...extractNames(fieldMap.assignee),
      ]
    : [];

  const ownerNames = uniqueStrings([
    ...currentNodeOwners,
    ...roleBasedOwners,
    ...legacyOwners,
  ]);

  const startDate =
    firstIsoDate([
      bizWorkItem.start_date, bizWorkItem.start_time,
      fieldMap.start_date, fieldMap.plan_start,
    ])
    ?? msToIsoDate(nodeSchedule.startMs);
  const endDate =
    firstIsoDate([
      bizWorkItem.end_date, bizWorkItem.due_date,
      fieldMap.end_date, fieldMap.due_date, fieldMap.deadline, fieldMap.plan_end,
    ])
    ?? msToIsoDate(nodeSchedule.endMs);

  const enrichedSource: RequirementSource = {
    ...source,
    rawTitle: name || null,
    ownerNames,
    startDate,
    endDate,
    fetchedAt: new Date().toISOString(),
  };

  if (!name && !estimate) {
    return mapFeishuWorkItemToDraft(json, source.url);
  }

  return {
    name,
    originalDays: estimate && estimate >= 0.5 ? estimate : null,
    status: 'fetched',
    source: enrichedSource,
  };
}

function extractBizWorkItem(data: Record<string, unknown>): Record<string, unknown> {
  const bizData = Array.isArray(data.biz_data) ? data.biz_data : [];
  const workitemEntry = bizData.find(
    (entry: unknown) => asRecord(entry)?.key === 'workitem',
  );
  return asRecord(asRecord(workitemEntry)?.value) ?? {};
}

/**
 * 飞书 Project demand_fetch 把工期 / 排期信息放在 biz_data 里 key='node' 的
 * 流程节点上（而不是 workitem 主体）。每个节点有 work_hour.attributes 或
 * scheduleV3.attributes，包含 points (工时数值) + schedule_start/end (排期时间)。
 * 取第一个 points >= 0.5 的节点视为该需求的主排期。
 */
export function extractScheduleFromNodes(
  data: Record<string, unknown>,
): { points: number | null; startMs: number | null; endMs: number | null } {
  const bizData = Array.isArray(data.biz_data) ? data.biz_data : [];
  for (const entry of bizData) {
    const rec = asRecord(entry);
    if (!rec || rec.key !== 'node') continue;
    const value = asRecord(rec.value) ?? {};
    const workHourAttrs = asRecord(
      asRecord(asRecord(value.data)?.work_hour)?.attributes,
    );
    const scheduleV3Attrs = asRecord(asRecord(value.scheduleV3)?.attributes);
    const attrs = workHourAttrs ?? scheduleV3Attrs;
    if (!attrs) continue;
    const pointsValue = asRecord(attrs.points)?.value;
    const points =
      typeof pointsValue === 'number'
        ? pointsValue
        : typeof pointsValue === 'string'
          ? Number(pointsValue)
          : NaN;
    if (!Number.isFinite(points) || points < 0.5) continue;
    const startMs = Number(asRecord(attrs.schedule_start)?.timestamp_in_ms);
    const endMs = Number(asRecord(attrs.schedule_end)?.timestamp_in_ms);
    return {
      points,
      startMs: Number.isFinite(startMs) ? startMs : null,
      endMs: Number.isFinite(endMs) ? endMs : null,
    };
  }
  return { points: null, startMs: null, endMs: null };
}

/**
 * 兜底：从 biz_data 里的 node entries 找当前流程节点（uuid 含 "doing" 或最后一个
 * 非 archived 节点），解析它的 owner.value JSON → role_key → 在 workitem.role_owners
 * 中查那个 role 的 owners。仅当 workitem.current_status_operator 为空时调用。
 */
export function extractCurrentNodeOwnersByRole(
  data: Record<string, unknown>,
  bizWorkItem: Record<string, unknown>,
): string[] {
  const bizData = Array.isArray(data.biz_data) ? data.biz_data : [];
  const nodes = bizData
    .map((e: unknown) => asRecord(e))
    .filter((rec): rec is Record<string, unknown> => rec?.key === 'node');

  // 优先 doing 节点；否则取最后一个 node（流程末尾）
  const doingNode = nodes.find((n) => String(n.uuid ?? '').includes('doing'));
  const targetNode = doingNode ?? nodes[nodes.length - 1];
  if (!targetNode) return [];

  const ownerField = asRecord(asRecord(targetNode.value)?.owner);
  const ownerValueRaw = ownerField?.value;
  let roleKeys: string[] = [];
  if (typeof ownerValueRaw === 'string') {
    try {
      const parsed = JSON.parse(ownerValueRaw);
      const roles = asRecord(parsed)?.roles;
      if (Array.isArray(roles)) {
        roleKeys = roles.filter((r): r is string => typeof r === 'string');
      }
    } catch { /* malformed JSON — ignore */ }
  }
  if (roleKeys.length === 0) return [];

  const roleOwners = Array.isArray(bizWorkItem.role_owners) ? bizWorkItem.role_owners : [];
  const names: string[] = [];
  for (const entry of roleOwners) {
    const rec = asRecord(entry);
    const role = typeof rec?.role === 'string' ? rec.role : undefined;
    if (!role || !roleKeys.includes(role)) continue;
    names.push(...extractNames(rec.owners));
  }
  return names;
}

export function msToIsoDate(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function extractFieldValueMap(data: Record<string, unknown>): Record<string, unknown> {
  const modules = Array.isArray(data.modules) ? data.modules : [];
  const detailModule = modules.find(
    (m: unknown) => asRecord(m)?.key === 'detail',
  );
  const detailData = asRecord(asRecord(detailModule)?.data) ?? {};
  return asRecord(detailData.field_value_map) ?? {};
}

function collectUrlParams(url: URL): URLSearchParams {
  const params = new URLSearchParams(url.search);
  const hashQueryIndex = url.hash.indexOf('?');
  if (hashQueryIndex >= 0) {
    const hashParams = new URLSearchParams(url.hash.slice(hashQueryIndex + 1));
    hashParams.forEach((value, key) => params.set(key, value));
  }
  return params;
}

function collectPathSegments(url: URL): { ok: true; segments: string[] } | { ok: false; error: string } {
  const fullPath = `${url.pathname}/${url.hash.replace(/^#/, '').split('?')[0]}`;
  try {
    return {
      ok: true,
      segments: fullPath
        .split('/')
        .map((s) => decodeURIComponent(s.trim()))
        .filter(Boolean),
    };
  } catch {
    return { ok: false, error: '请输入有效的飞书项目 URL' };
  }
}

function pickParam(params: URLSearchParams, keys: string[]): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return null;
}

function inferProjectKey(segments: string[]): string | null {
  const segment = segments.find((s, index) => {
    if (index > 3) return false;
    if (GENERIC_PATH_SEGMENTS.has(s.toLowerCase())) return false;
    return /[a-zA-Z]/.test(s);
  });
  return segment ?? null;
}

function inferWorkItemType(segments: string[], workItemIndex: number): string | null {
  if (workItemIndex >= 0 && segments[workItemIndex + 1]) {
    return segments[workItemIndex + 1];
  }
  const found = segments.find((s) => KNOWN_WORK_ITEM_TYPES.has(s.toLowerCase()));
  return found?.toLowerCase() ?? null;
}

function inferWorkItemId(segments: string[], workItemIndex: number): string | null {
  if (workItemIndex >= 0 && segments[workItemIndex + 2]) {
    return segments[workItemIndex + 2];
  }
  return segments.find((s) => /^\d{4,}$/.test(s)) ?? null;
}

function unwrapWorkItem(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw) ?? {};
  const data = asRecord(root.data) ?? root;
  return (
    asRecord(data.work_item) ??
    asRecord(data.workItem) ??
    asRecord(data.item) ??
    data
  );
}

function normalizeFields(item: Record<string, unknown>): Record<string, unknown> {
  const fields = item.fields;
  if (Array.isArray(fields)) {
    return fields.reduce<Record<string, unknown>>((acc, field) => {
      const record = asRecord(field);
      if (!record) return acc;
      const key = firstString([
        record.field_key,
        record.fieldKey,
        record.key,
        record.name,
        record.alias,
      ]);
      if (key) acc[key] = record.value ?? record.field_value ?? record.fieldValue;
      return acc;
    }, {});
  }
  return asRecord(fields) ?? {};
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getValue(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

/**
 * 兜底：扫描所有字段，找名字包含工期关键词且值为正数的字段。
 * 飞书 Project 自定义字段名各家不同，写死匹配很难覆盖；
 * 此函数只在精确匹配失败时调用，避免误中字段（如 `created_day`）。
 */
function inferEstimateByKeyword(source: Record<string, unknown>): number | null {
  const RE = /(estimate|estimat|day|hour|point|effort|workload|man[_-]?day|工[期时]|天数|工时|预估|排期)/i;
  for (const [key, raw] of Object.entries(source)) {
    if (!RE.test(key)) continue;
    // value 可能是数字、字符串、或 {value: ..., display_value: ...} 包装
    const candidates: unknown[] = [raw];
    const rec = asRecord(raw);
    if (rec) {
      candidates.push(rec.value, rec.display_value, rec.raw_value, rec.number_value);
    }
    for (const v of candidates) {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
      // 合理的工期范围：0.5 天 ~ 365 天
      if (Number.isFinite(n) && n >= 0.5 && n <= 365) return n;
    }
  }
  return null;
}

function firstNumber(values: unknown[]): number | null {
  for (const value of values) {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function firstIsoDate(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value);
    const match = text.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return null;
}

function extractNames(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(extractNames);
  const record = asRecord(value);
  if (!record) return [];
  const name = firstString([record.name, record.nickname, record.name_en, record.en_name, record.email, record.id]);
  return name ? [name] : [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function isSameOrSubdomain(host: string, root: string): boolean {
  return host === root || host.endsWith(`.${root}`);
}

export function normalizeFeishuApiBaseUrl(input?: string): string {
  let url: URL;
  try {
    url = new URL(input?.trim() || 'https://project.feishu.cn');
  } catch {
    throw new Error('飞书 API 地址无效');
  }

  const host = url.hostname.toLowerCase();
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const isOfficialHost = FEISHU_API_HOSTS.has(host);

  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('飞书 API 地址不能包含路径、参数或账号信息');
  }
  if (isOfficialHost && url.protocol === 'https:') return url.origin;
  if (isLocalhost && (url.protocol === 'http:' || url.protocol === 'https:')) return url.origin;
  throw new Error('飞书 API 地址仅支持官方域名或本机地址');
}

export function urlOnlyDraft(source: RequirementSource, error?: string): RequirementDraft {
  // 未登录时给一个占位名（仅 workItemId）— projectKey 推断容易误判，不拼进来
  const placeholderName = source.workItemId ? `飞书需求 #${source.workItemId}` : '';
  return {
    name: placeholderName,
    originalDays: null,
    source,
    status: 'url_only',
    error,
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalIsoDate(value: unknown): string | null {
  return firstIsoDate([value]);
}
