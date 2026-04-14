import { useState } from 'react';
import { Plus } from 'lucide-react';
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
}

export function RequirementList({ projectId, requirements, isArchived, onAdd, onUpdate, onDelete }: RequirementListProps) {
  const [showForm, setShowForm] = useState(false);
  const reqMap = new Map(requirements.map((r) => [r.id, r]));

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">需求列表</h2>
        {!isArchived && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg"
          >
            <Plus size={12} />
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
