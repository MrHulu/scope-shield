import { useState, useCallback, useEffect } from 'react';
import { Plus, RefreshCw, Upload } from 'lucide-react';
import { BulkImportModal } from './BulkImportModal';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Requirement, CreateRequirementInput } from '../../types';
import { RequirementRow } from './RequirementRow';
import { RequirementForm } from './RequirementForm';
import { EmptyState } from '../shared/EmptyState';

interface RequirementListProps {
  projectId: string;
  requirements: Requirement[];
  isArchived: boolean;
  onAdd: (input: CreateRequirementInput) => Promise<Requirement | null>;
  onUpdate: (id: string, data: Partial<Requirement>) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onSyncFeishu?: () => Promise<void>;
  syncing?: boolean;
  hasFeishuRequirements?: boolean;
}

export function RequirementList({ projectId, requirements, isArchived, onAdd, onUpdate, onDelete, onReorder, onSyncFeishu, syncing, hasFeishuRequirements }: RequirementListProps) {
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  // Pulse the row that was just added for ~1.5s so the user sees the
  // visual confirmation that their action landed (especially important
  // when stat cards don't budge — which is most of the time for added reqs).
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const reqMap = new Map(requirements.map((r) => [r.id, r]));

  useEffect(() => {
    if (!justAddedId) return;
    const t = setTimeout(() => setJustAddedId(null), 1500);
    return () => clearTimeout(t);
  }, [justAddedId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = requirements.findIndex((r) => r.id === active.id);
      const newIndex = requirements.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(requirements, oldIndex, newIndex);
      onReorder(reordered.map((r) => r.id));
    },
    [requirements, onReorder],
  );

  const sortableIds = requirements.map((r) => r.id);

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">需求列表</h2>
        {!isArchived && (
          <div className="flex items-center gap-2">
            {hasFeishuRequirements && onSyncFeishu && (
              <button
                onClick={onSyncFeishu}
                disabled={syncing}
                className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? '同步中…' : '同步飞书'}
              </button>
            )}
            <button
              onClick={() => setShowBulkImport(true)}
              className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg"
              title="批量导入（CSV / JSON）"
              data-testid="bulk-import-trigger"
            >
              <Upload size={14} />
              批量导入
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm"
            >
              <Plus size={14} />
              添加需求
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="px-4 pb-2">
          <RequirementForm
            projectId={projectId}
            requirements={requirements}
            onSave={async (input) => {
              const r = await onAdd(input);
              if (r) {
                setShowForm(false);
                setJustAddedId(r.id);
              }
              return r;
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {requirements.length === 0 && !showForm ? (
        <EmptyState message="暂无需求，点击上方「添加需求」开始" />
      ) : !isArchived ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5 px-2">
              {requirements.map((r) => (
                <RequirementRow
                  key={r.id}
                  requirement={r}
                  dependencyName={r.dependsOn ? (reqMap.get(r.dependsOn)?.name ?? '已删除') : null}
                  isArchived={isArchived}
                  justAdded={r.id === justAddedId}
                  onUpdate={(id, data) => onUpdate(id, data)}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-0.5 px-2">
          {requirements.map((r) => (
            <RequirementRow
              key={r.id}
              requirement={r}
              dependencyName={r.dependsOn ? (reqMap.get(r.dependsOn)?.name ?? '已删除') : null}
              isArchived={isArchived}
              onUpdate={(id, data) => onUpdate(id, data)}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <BulkImportModal
        open={showBulkImport}
        projectId={projectId}
        existingRequirements={requirements}
        onAdd={onAdd}
        onClose={() => setShowBulkImport(false)}
      />
    </div>
  );
}
