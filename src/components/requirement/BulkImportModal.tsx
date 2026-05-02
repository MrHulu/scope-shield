import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Link2, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2, Download } from 'lucide-react';
import type { CreateRequirementInput, Requirement, RequirementSource } from '../../types';
import { parseBulkImport, type ImportedDraft } from '../../services/bulkImporter';
import { analyzeFeishuRequirementUrl, parseFeishuProjectUrl } from '../../services/feishuRequirement';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface BulkImportModalProps {
  open: boolean;
  projectId: string;
  existingRequirements: Requirement[];
  onAdd: (input: CreateRequirementInput) => Promise<Requirement | null>;
  onClose: () => void;
}

const SAMPLE_CSV = `name,days,dependsOn
登录鉴权,3,
商品列表,5,
购物车,4,商品列表
下单流程,6,购物车
支付结算,4,下单流程`;

type Mode = 'text' | 'feishu';

type FeishuRowState =
  | 'pending'    // parsed from textarea, not yet fetched
  | 'fetching'   // in flight
  | 'fetched'    // metadata pulled, name + days available
  | 'url_only'   // proxy unavailable / not logged in — only URL preserved
  | 'error';     // parse failed or network error

interface FeishuRow {
  url: string;
  state: FeishuRowState;
  name?: string;
  days?: number | null;
  source?: RequirementSource;
  error?: string;
}

const FETCH_CONCURRENCY = 5;

export function BulkImportModal({
  open,
  projectId,
  existingRequirements,
  onAdd,
  onClose,
}: BulkImportModalProps) {
  const [mode, setMode] = useState<Mode>('text');

  // Text-mode state (CSV / JSON)
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<ImportedDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Feishu-mode state (URL list)
  const [urlText, setUrlText] = useState('');
  const [feishuRows, setFeishuRows] = useState<FeishuRow[]>([]);
  const [fetching, setFetching] = useState(false);

  const [importing, setImporting] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    setMode('text');
    setText('');
    setDrafts([]);
    setErrors([]);
    setUrlText('');
    setFeishuRows([]);
    setFetching(false);
    setImporting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const onTextChange = (value: string) => {
    setText(value);
    if (!value.trim()) {
      setDrafts([]);
      setErrors([]);
      return;
    }
    const result = parseBulkImport(value);
    setDrafts(result.drafts);
    setErrors(result.errors);
  };

  // ─── Feishu URL parsing ───────────────────────────────────────────────
  const parseUrlListToRows = (raw: string): FeishuRow[] => {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const parsed = parseFeishuProjectUrl(line);
      if (!parsed.ok) {
        return { url: line, state: 'error' as const, error: parsed.error ?? '无法识别为飞书 URL' };
      }
      return { url: line, state: 'pending' as const, source: parsed.source };
    });
  };

  const onUrlTextChange = (value: string) => {
    setUrlText(value);
    if (!value.trim()) {
      setFeishuRows([]);
      return;
    }
    setFeishuRows(parseUrlListToRows(value));
  };

  // Concurrency-bounded fetch — up to FETCH_CONCURRENCY in flight at once.
  const handleFetchAll = async () => {
    const initial = parseUrlListToRows(urlText);
    setFeishuRows(initial);
    setFetching(true);
    try {
      // Use indices instead of mutating shared array; updates happen via setFeishuRows.
      const indices = initial
        .map((r, i) => (r.state === 'pending' ? i : -1))
        .filter((i) => i >= 0);
      let cursor = 0;

      const updateRow = (i: number, patch: Partial<FeishuRow>) => {
        setFeishuRows((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], ...patch };
          return next;
        });
      };

      const worker = async () => {
        while (cursor < indices.length) {
          const i = indices[cursor++];
          updateRow(i, { state: 'fetching' });
          try {
            const draft = await analyzeFeishuRequirementUrl(initial[i].url);
            if (draft.status === 'fetched') {
              updateRow(i, {
                state: 'fetched',
                name: draft.name || `飞书需求 ${draft.source.workItemId ?? ''}`,
                days: draft.originalDays,
                source: draft.source,
              });
            } else {
              updateRow(i, {
                state: 'url_only',
                name: draft.name || `飞书需求 ${draft.source.workItemId ?? ''}`,
                days: draft.originalDays,
                source: draft.source,
                error: draft.error,
              });
            }
          } catch (err) {
            updateRow(i, {
              state: 'error',
              error: err instanceof Error ? err.message : '拉取失败',
            });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(FETCH_CONCURRENCY, indices.length) }, () => worker()),
      );
    } finally {
      setFetching(false);
    }
  };

  const importableFeishuRows = useMemo(
    () => feishuRows.filter((r) => r.state === 'fetched' || r.state === 'url_only'),
    [feishuRows],
  );

  const handleImport = async () => {
    setImporting(true);
    try {
      if (mode === 'text') {
        const nameToId = new Map<string, string>();
        for (const r of existingRequirements) nameToId.set(r.name, r.id);
        for (const draft of drafts) {
          const depId = draft.dependsOn ? nameToId.get(draft.dependsOn) ?? null : null;
          const created = await onAdd({
            projectId,
            name: draft.name,
            originalDays: draft.days,
            dependsOn: depId,
          });
          if (created) nameToId.set(created.name, created.id);
        }
      } else {
        // Feishu mode — no inter-row deps. URL-only rows still go in (with
        // 0 days and just the source preserved); the user can fill in days
        // later via the existing inline edit UI.
        for (const row of importableFeishuRows) {
          await onAdd({
            projectId,
            name: row.name || row.url,
            originalDays: row.days ?? 0,
            dependsOn: null,
            source: row.source,
          });
        }
      }
      onClose();
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  // Counts for preview header
  const fetchedCount = feishuRows.filter((r) => r.state === 'fetched').length;
  const urlOnlyCount = feishuRows.filter((r) => r.state === 'url_only').length;
  const errorCount = feishuRows.filter((r) => r.state === 'error').length;
  const fetchingCount = feishuRows.filter((r) => r.state === 'fetching').length;

  const submitDisabled =
    importing ||
    fetching ||
    (mode === 'text' ? drafts.length === 0 : importableFeishuRows.length === 0);

  const submitLabel = importing
    ? '导入中...'
    : mode === 'text'
      ? `导入 ${drafts.length} 条`
      : `导入 ${importableFeishuRows.length} 条${errorCount > 0 ? `（跳过 ${errorCount} 条失败）` : ''}`;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40"
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="批量导入需求"
        className="glass-panel-strong rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="bulk-import-modal"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <h3 className="text-lg font-semibold text-gray-900">批量导入需求</h3>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-3 flex items-center gap-1 border-b border-gray-200/60">
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              mode === 'text'
                ? 'border-blue-500 text-blue-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="bulk-import-tab-text"
          >
            <FileText size={14} />
            文本格式（CSV / JSON）
          </button>
          <button
            type="button"
            onClick={() => setMode('feishu')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              mode === 'feishu'
                ? 'border-blue-500 text-blue-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="bulk-import-tab-feishu"
          >
            <Link2 size={14} />
            飞书 URL 列表
          </button>
        </div>

        {/* Body — text mode */}
        {mode === 'text' && (
          <div className="px-6 py-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>支持 CSV / TSV / JSON。CSV 示例：</span>
              <button
                type="button"
                onClick={() => onTextChange(SAMPLE_CSV)}
                className="text-blue-600 hover:underline"
                data-testid="bulk-import-sample"
              >
                使用示例
              </button>
            </div>

            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder={`粘贴 CSV 或 JSON\n\n${SAMPLE_CSV}`}
              className="w-full h-40 text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              data-testid="bulk-import-textarea"
            />

            {errors.length > 0 && (
              <div
                className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-xs text-red-700"
                data-testid="bulk-import-errors"
              >
                <div className="font-semibold mb-1">{errors.length} 条错误：</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {drafts.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50/60 border-b border-gray-200">
                  预览 · {drafts.length} 条将被导入
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-1.5 w-8">#</th>
                        <th className="text-left px-3 py-1.5">需求名称</th>
                        <th className="text-left px-3 py-1.5 w-20">天数</th>
                        <th className="text-left px-3 py-1.5">前置依赖</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map((d, i) => (
                        <tr
                          key={i}
                          className="border-t border-gray-100 odd:bg-gray-50/40"
                          data-testid={`bulk-import-row-${i}`}
                        >
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5 text-gray-800">{d.name}</td>
                          <td className="px-3 py-1.5 tabular-nums">{d.days}</td>
                          <td className="px-3 py-1.5 text-gray-600">
                            {d.dependsOn ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body — feishu mode */}
        {mode === 'feishu' && (
          <div className="px-6 py-4 flex flex-col gap-4">
            <div className="text-xs text-gray-500 leading-relaxed">
              一行一个飞书需求 URL（支持 <code>feishu.cn</code> / <code>larksuite.com</code> / <code>meegle.com</code>）。
              <br />
              本机配置了飞书代理时会自动同步需求名 / 工期 / 负责人；否则只保留 URL（可后续手动补天数）。
            </div>

            <textarea
              value={urlText}
              onChange={(e) => onUrlTextChange(e.target.value)}
              placeholder={`https://your-domain.feishu.cn/.../work_item/story/123\nhttps://your-domain.feishu.cn/.../work_item/story/456`}
              className="w-full h-32 text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              data-testid="bulk-import-feishu-textarea"
            />

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                {feishuRows.length === 0 && '粘贴 URL 后点"拉取元数据"开始解析'}
                {feishuRows.length > 0 && (
                  <span>
                    共 {feishuRows.length} 行 · {fetchedCount} 已拉取
                    {urlOnlyCount > 0 && ` · ${urlOnlyCount} 仅链接`}
                    {errorCount > 0 && ` · ${errorCount} 失败`}
                    {fetchingCount > 0 && ` · ${fetchingCount} 进行中`}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleFetchAll}
                disabled={fetching || feishuRows.filter((r) => r.state !== 'error').length === 0}
                className="text-xs text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
                data-testid="bulk-import-feishu-fetch"
              >
                {fetching ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    拉取中…
                  </>
                ) : (
                  <>
                    <Download size={12} />
                    拉取元数据
                  </>
                )}
              </button>
            </div>

            {feishuRows.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50/60 border-b border-gray-200">
                  预览 · {importableFeishuRows.length} 条可导入
                  {errorCount > 0 && (
                    <span className="text-red-600 font-normal ml-2">
                      （{errorCount} 条失败将被跳过）
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-1.5 w-8">#</th>
                        <th className="text-left px-3 py-1.5 w-8">状态</th>
                        <th className="text-left px-3 py-1.5">需求名称</th>
                        <th className="text-left px-3 py-1.5 w-16">天数</th>
                        <th className="text-left px-3 py-1.5">备注 / URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feishuRows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-t border-gray-100 odd:bg-gray-50/40"
                          data-testid={`bulk-import-feishu-row-${i}`}
                        >
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <StatusIcon state={row.state} />
                          </td>
                          <td className="px-3 py-1.5 text-gray-800 truncate max-w-[200px]">
                            {row.name ?? <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-gray-700">
                            {row.days ?? <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 truncate max-w-[260px]" title={row.error ?? row.url}>
                            {row.error ? (
                              <span className="text-red-600">{row.error}</span>
                            ) : (
                              row.url
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200/60">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 px-4 py-2 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={submitDisabled}
            className="text-sm text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
            data-testid="bulk-import-submit"
          >
            <Upload size={14} />
            {submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatusIcon({ state }: { state: FeishuRowState }) {
  switch (state) {
    case 'fetched':
      return <CheckCircle2 size={14} className="text-green-600" aria-label="已拉取" />;
    case 'url_only':
      return <AlertTriangle size={14} className="text-amber-600" aria-label="仅链接" />;
    case 'error':
      return <XCircle size={14} className="text-red-600" aria-label="失败" />;
    case 'fetching':
      return <Loader2 size={14} className="animate-spin text-blue-600" aria-label="拉取中" />;
    case 'pending':
    default:
      return <span className="inline-block w-2 h-2 rounded-full bg-gray-300" aria-label="待拉取" />;
  }
}
