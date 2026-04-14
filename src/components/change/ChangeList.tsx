import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Change, Requirement, CreateChangeInput } from '../../types';
import { ChangeRow } from './ChangeRow';
import { ChangeModal } from './ChangeModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';

interface ChangeListProps {
  projectId: string;
  changes: Change[];
  requirements: Requirement[];
  isArchived: boolean;
  onRecord: (input: CreateChangeInput) => Promise<void>;
  onDelete: (id: string) => void;
}

export function ChangeList({ projectId, changes, requirements, isArchived, onRecord, onDelete }: ChangeListProps) {
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteTarget = deleteId ? changes.find((c) => c.id === deleteId) : null;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">变更记录</h2>
        {!isArchived && requirements.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg"
          >
            <Plus size={12} />
            记录变更
          </button>
        )}
      </div>

      {changes.length === 0 ? (
        <EmptyState message="暂无变更记录" />
      ) : (
        <div className="flex flex-col gap-0.5 px-2">
          {changes.map((c) => (
            <ChangeRow
              key={c.id}
              change={c}
              requirements={requirements}
              isArchived={isArchived}
              onEdit={() => {/* TODO: edit modal */}}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      <ChangeModal
        open={showModal}
        projectId={projectId}
        requirements={requirements}
        onSave={async (input) => { await onRecord(input); }}
        onClose={() => setShowModal(false)}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="删除变更记录"
        message={`确定要删除「${deleteTarget?.description ?? ''}」吗？此操作将触发全量重算。`}
        destructive
        confirmLabel="删除"
        onConfirm={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
