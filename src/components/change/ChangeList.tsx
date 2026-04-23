import { useState, useMemo } from 'react';
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
  onUpdate: (id: string, data: Partial<Change>) => Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

export function ChangeList({ projectId, changes, requirements, isArchived, onRecord, onUpdate, onDelete }: ChangeListProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingChange, setEditingChange] = useState<Change | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteTarget = deleteId ? changes.find((c) => c.id === deleteId) : null;

  // Sort by date descending, then createdAt descending
  const sorted = useMemo(
    () => [...changes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [changes],
  );

  const handleEdit = (id: string) => {
    const c = changes.find((ch) => ch.id === id);
    if (c) {
      setEditingChange(c);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingChange(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">变更记录</h2>
        {!isArchived && requirements.length > 0 && (
          <button
            onClick={() => { setEditingChange(null); setShowModal(true); }}
            className="flex items-center gap-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm"
          >
            <Plus size={14} />
            记录变更
          </button>
        )}
      </div>

      {changes.length === 0 ? (
        <EmptyState message="暂无变更记录" />
      ) : (
        <div className="flex flex-col gap-0.5 px-2">
          {sorted.map((c) => (
            <ChangeRow
              key={c.id}
              change={c}
              requirements={requirements}
              isArchived={isArchived}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      <ChangeModal
        open={showModal}
        projectId={projectId}
        requirements={requirements}
        editingChange={editingChange}
        onSave={async (input) => { await onRecord(input); }}
        onUpdate={onUpdate}
        onClose={handleCloseModal}
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
