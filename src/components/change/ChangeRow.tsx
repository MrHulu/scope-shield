import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Change, Requirement } from '../../types';
import { CHANGE_TYPE_LABELS, SUPPLEMENT_SUBTYPE_LABELS } from '../../constants/changeTypes';
import { ROLE_LABELS } from '../../constants/roles';
import { APP_ROLE_COLORS, APP_COLORS } from '../../constants/colors';
import { TAG_COLORS, type ChangeTag } from '../../constants/changeTags';

interface ChangeRowProps {
  change: Change;
  requirements: Requirement[];
  isArchived: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** When set, render a checkbox at row start; clicking it calls onToggleSelect. */
  batchMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function ChangeRow({ change: c, requirements, isArchived, onEdit, onDelete, batchMode, selected, onToggleSelect }: ChangeRowProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const pics = c.screenshots ?? [];

  const target = c.targetRequirementId
    ? requirements.find((r) => r.id === c.targetRequirementId)
    : null;

  const targetName =
    target?.name ??
    c.metadata?.deletedRequirementName ??
    c.metadata?.newRequirementName ??
    c.metadata?.cancelledRequirementName ??
    null;

  const isDeleted = c.targetRequirementId && !target && !c.metadata?.newRequirementName;

  const color = c.type === 'new_requirement'
    ? APP_COLORS.newRequirement
    : c.type === 'cancel_requirement'
      ? APP_COLORS.save
      : c.type === 'supplement'
        ? APP_COLORS.supplement
        : APP_ROLE_COLORS[c.role];

  const deltaStr = c.daysDelta > 0
    ? `+${c.daysDelta}天`
    : c.daysDelta < 0
      ? `${c.daysDelta}天`
      : null;

  return (
    <div className={`group flex items-start gap-3 px-4 py-2.5 rounded-lg hover:bg-gray-50 ${selected ? 'bg-blue-50/60' : ''}`}>
      {batchMode && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.(c.id)}
          className="mt-1 cursor-pointer"
          data-testid={`change-row-checkbox-${c.id}`}
          aria-label={`选择变更：${c.description}`}
        />
      )}
      <div className="w-1 h-8 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: color }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">{c.date}</span>
          <span className="text-xs font-medium" style={{ color }}>{CHANGE_TYPE_LABELS[c.type]}</span>
          {c.type === 'supplement' && c.metadata?.subType && (
            <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">
              {SUPPLEMENT_SUBTYPE_LABELS[c.metadata.subType as keyof typeof SUPPLEMENT_SUBTYPE_LABELS]}
            </span>
          )}
          {targetName && (
            <span className={`text-xs ${isDeleted ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
              {targetName}
              {isDeleted && ' (已删除)'}
            </span>
          )}
          {deltaStr && <span className="text-xs font-semibold" style={{ color }}>{deltaStr}</span>}
        </div>
        <p className="text-sm text-gray-700 mt-0.5 truncate">{c.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {ROLE_LABELS[c.role]}
          {c.personName && ` · ${c.personName}`}
        </p>
        {Array.isArray(c.metadata?.tags) && c.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1" data-testid={`change-row-tags-${c.id}`}>
            {(c.metadata.tags as string[]).map((t) => {
              const tone = TAG_COLORS[t as ChangeTag] ?? 'bg-gray-100 text-gray-600';
              return (
                <span
                  key={t}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${tone}`}
                >
                  {t}
                </span>
              );
            })}
          </div>
        )}
        {pics.length > 0 && (
          <div className="flex gap-1 mt-1">
            {pics.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightboxSrc(src)}
                className="w-8 h-8 rounded border border-gray-200 overflow-hidden hover:border-blue-400 shrink-0"
              >
                <img src={src} alt={`证据${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {!isArchived && (
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex gap-1 shrink-0">
          <button onClick={() => onEdit(c.id)} aria-label="编辑" className="p-1 hover:bg-gray-200 rounded text-gray-400">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(c.id)} aria-label="删除" className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="截图证据" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
