import { useState } from 'react';
import { GripVertical, Pencil, Trash2, Pause, ArrowRight } from 'lucide-react';
import type { Requirement } from '../../types';
import { ConfirmDialog } from '../shared/ConfirmDialog';

interface RequirementRowProps {
  requirement: Requirement;
  dependencyName: string | null;
  isArchived: boolean;
  onUpdate: (id: string, data: Partial<Requirement>) => void;
  onDelete: (id: string) => void;
}

export function RequirementRow({ requirement: r, dependencyName, isArchived, onUpdate, onDelete }: RequirementRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [days, setDays] = useState(String(r.originalDays));
  const [showDelete, setShowDelete] = useState(false);

  const handleSave = () => {
    if (!name.trim() || parseInt(days) < 1) return;
    onUpdate(r.id, { name: name.trim(), originalDays: parseInt(days) });
    setEditing(false);
  };

  const statusIcon = r.status === 'paused' ? <Pause size={12} className="text-amber-500" /> : null;
  const isCancelled = r.status === 'cancelled';

  if (editing && !isArchived) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
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
          min={1}
          className="w-20 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
        />
        <button onClick={handleSave} className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700">保存</button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-2 py-1 hover:bg-gray-100 rounded">取消</button>
      </div>
    );
  }

  return (
    <>
      <div className={`group flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 ${isCancelled ? 'opacity-50' : ''}`}>
        {!isArchived && (
          <div className="cursor-grab text-gray-300 group-hover:text-gray-500">
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
              <span>依赖：{dependencyName}</span>
            </div>
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
          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
            <button onClick={() => setEditing(true)} className="p-1 hover:bg-gray-200 rounded text-gray-400">
              <Pencil size={12} />
            </button>
            <button onClick={() => setShowDelete(true)} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
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
