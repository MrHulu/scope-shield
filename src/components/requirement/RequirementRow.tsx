import { useState } from 'react';
import { ArrowRight, ExternalLink, GripVertical, Pencil, Trash2, Pause } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Requirement } from '../../types';
import { validateDays } from '../../utils/validation';
import { sanitizeRequirementSource } from '../../services/feishuRequirement';
import { ConfirmDialog } from '../shared/ConfirmDialog';

interface RequirementRowProps {
  requirement: Requirement;
  dependencyName: string | null;
  isArchived: boolean;
  /** True for ~1.5s after this row is created — applies the highlight pulse. */
  justAdded?: boolean;
  onUpdate: (id: string, data: Partial<Requirement>) => void;
  onDelete: (id: string) => void;
}

export function RequirementRow({ requirement: r, dependencyName, isArchived, justAdded = false, onUpdate, onDelete }: RequirementRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [days, setDays] = useState(String(r.originalDays));
  const [showDelete, setShowDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: r.id, disabled: isArchived || editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleSave = () => {
    if (!name.trim() || validateDays(parseFloat(days))) return;
    onUpdate(r.id, { name: name.trim(), originalDays: parseFloat(days) });
    setEditing(false);
  };

  const statusIcon = r.status === 'paused' ? <Pause size={12} className="text-amber-500" /> : null;
  const isCancelled = r.status === 'cancelled';
  const safeSource = sanitizeRequirementSource(r.source);

  if (editing && !isArchived) {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
          autoFocus
        />
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          min={0.5}
          step={0.5}
          className="w-20 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
        />
        <button onClick={handleSave} className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700">保存</button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-2 py-1 hover:bg-gray-100 rounded">取消</button>
      </div>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        data-just-added={justAdded ? 'true' : undefined}
        className={`group flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 ${isCancelled ? 'opacity-50' : ''} ${justAdded ? 'highlight-pulse' : ''}`}
      >
        {!isArchived && (
          <div
            className="cursor-grab active:cursor-grabbing text-gray-300 group-hover:text-gray-500 touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {statusIcon}
            <span className={`text-sm ${isCancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {r.name}
            </span>
            {r.isAddedByChange && (
              <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">变更新增</span>
            )}
          </div>
          {dependencyName && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <ArrowRight size={10} />
              <span>前置：{dependencyName}</span>
            </div>
          )}
          {safeSource?.url && (
            <a
              href={safeSource.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} />
              飞书需求
              {safeSource.ownerNames && safeSource.ownerNames.length > 0 && (
                <span className="text-gray-400">· {safeSource.ownerNames.join('、')}</span>
              )}
            </a>
          )}
        </div>
        <div className="text-sm text-gray-600 tabular-nums">
          {r.originalDays !== r.currentDays ? (
            <>
              <span className="text-gray-400 line-through">{r.originalDays}</span>
              <span className="ml-1">{r.currentDays}天</span>
            </>
          ) : (
            <span>{r.currentDays}天</span>
          )}
        </div>
        {!isArchived && (
          <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex gap-1">
            <button onClick={() => setEditing(true)} aria-label="编辑" className="p-1 hover:bg-gray-200 rounded text-gray-400">
              <Pencil size={12} />
            </button>
            <button onClick={() => setShowDelete(true)} aria-label="删除" className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        title="删除需求"
        message={`确定要删除「${r.name}」吗？此操作不可撤销。相关变更记录将保留并标注"已删除"。`}
        destructive
        confirmLabel="删除"
        onConfirm={() => { onDelete(r.id); setShowDelete(false); }}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
}
