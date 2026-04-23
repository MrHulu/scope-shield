import { useState } from 'react';
import type { Requirement, CreateRequirementInput } from '../../types';
import { validateDays } from '../../utils/validation';

interface RequirementFormProps {
  projectId: string;
  requirements: Requirement[];
  onSave: (input: CreateRequirementInput) => Promise<Requirement | null>;
  onCancel: () => void;
}

export function RequirementForm({ projectId, requirements, onSave, onCancel }: RequirementFormProps) {
  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  const [dependsOn, setDependsOn] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = '名称不能为空';
    const dErr = validateDays(parseFloat(days));
    if (!days || dErr) e.days = dErr ?? '天数必须 ≥ 0.5';
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    await onSave({
      projectId,
      name: name.trim(),
      originalDays: parseFloat(days),
      dependsOn,
    });
    setName('');
    setDays('');
    setDependsOn(null);
    setErrors({});
  };

  const activeReqs = requirements.filter((r) => r.status !== 'cancelled');

  return (
    <div className="flex items-start gap-2 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-lg">
      <div className="flex-1 flex flex-col gap-1.5">
        <input
          type="text"
          placeholder="需求名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className={`text-sm border rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 ${
            errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
          }`}
          autoFocus
        />
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="天数"
            min={0.5}
            step={0.5}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className={`w-24 text-sm border rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 ${
              errors.days ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
          <select
            value={dependsOn ?? ''}
            onChange={(e) => setDependsOn(e.target.value || null)}
            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 text-gray-600"
          >
            <option value="">无依赖</option>
            {activeReqs.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 pt-0.5">
        <button
          onClick={handleSave}
          className="text-xs bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
        >
          添加
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 rounded px-3 py-1.5 hover:bg-gray-100"
        >
          取消
        </button>
      </div>
    </div>
  );
}
