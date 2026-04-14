import { Pencil, Trash2 } from 'lucide-react';
import type { Change, Requirement } from '../../types';
import { CHANGE_TYPE_LABELS } from '../../constants/changeTypes';
import { ROLE_LABELS } from '../../constants/roles';
import { APP_ROLE_COLORS, APP_COLORS } from '../../constants/colors';

interface ChangeRowProps {
  change: Change;
  requirements: Requirement[];
  isArchived: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ChangeRow({ change: c, requirements, isArchived, onEdit, onDelete }: ChangeRowProps) {
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
      : APP_ROLE_COLORS[c.role];

  const deltaStr = c.daysDelta > 0
    ? `+${c.daysDelta}天`
    : c.daysDelta < 0
      ? `${c.daysDelta}天`
      : null;

  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 rounded-lg hover:bg-gray-50">
      <div className="w-1 h-8 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: color }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">{c.date}</span>
          <span className="text-xs font-medium" style={{ color }}>{CHANGE_TYPE_LABELS[c.type]}</span>
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
      </div>

      {!isArchived && (
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
          <button onClick={() => onEdit(c.id)} className="p-1 hover:bg-gray-200 rounded text-gray-400">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(c.id)} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
