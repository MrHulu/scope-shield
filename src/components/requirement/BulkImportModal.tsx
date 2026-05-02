import { useEffect, useState } from 'react';
import { X, Upload } from 'lucide-react';
import type { CreateRequirementInput, Requirement } from '../../types';
import { parseBulkImport, type ImportedDraft } from '../../services/bulkImporter';
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

export function BulkImportModal({
  open,
  projectId,
  existingRequirements,
  onAdd,
  onClose,
}: BulkImportModalProps) {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<ImportedDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    setText('');
    setDrafts([]);
    setErrors([]);
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

  if (!open) return null;

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

  const handleImport = async () => {
    if (drafts.length === 0) return;
    setImporting(true);
    try {
      // Build a name → id map as we go so subsequent drafts can wire dependsOn.
      const nameToId = new Map<string, string>();
      // Seed with existing requirements so cross-row deps work too.
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
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
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
        className="glass-panel-strong rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
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

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200/60">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 px-4 py-2 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={importing || drafts.length === 0}
            className="text-sm text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
            data-testid="bulk-import-submit"
          >
            <Upload size={14} />
            {importing ? '导入中...' : `导入 ${drafts.length} 条`}
          </button>
        </div>
      </div>
    </div>
  );
}
