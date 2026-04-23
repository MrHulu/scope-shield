import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
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
}

export function RequirementList({ projectId, requirements, isArchived, onAdd, onUpdate, onDelete, onReorder }: RequirementListProps) {
  const [showForm, setShowForm] = useState(false);
  const reqMap = new Map(requirements.map((r) => [r.id, r]));

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
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm"
          >
            <Plus size={14} />
            添加需求
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-4 pb-2">
          <RequirementForm
            projectId={projectId}
            requirements={requirements}
            onSave={async (input) => {
              const r = await onAdd(input);
              if (r) setShowForm(false);
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
    </div>
  );
}
