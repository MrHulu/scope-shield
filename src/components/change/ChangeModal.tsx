import { useState } from 'react';
import { X } from 'lucide-react';
import type { ChangeType, Role, Requirement, CreateChangeInput } from '../../types';
import { CHANGE_TYPE_LABELS, CHANGE_TYPES } from '../../constants/changeTypes';
import { ROLE_LABELS, ROLES } from '../../constants/roles';
import { PersonNameInput } from './PersonNameInput';
import { today } from '../../utils/date';

interface ChangeModalProps {
  open: boolean;
  projectId: string;
  requirements: Requirement[];
  onSave: (input: CreateChangeInput) => Promise<void>;
  onClose: () => void;
}

export function ChangeModal({ open, projectId, requirements, onSave, onClose }: ChangeModalProps) {
  const [type, setType] = useState<ChangeType>('add_days');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('pm');
  const [personName, setPersonName] = useState('');
  const [description, setDescription] = useState('');
  const [daysDelta, setDaysDelta] = useState('');
  const [date, setDate] = useState(today());
  const [newReqName, setNewReqName] = useState('');
  const [newReqDays, setNewReqDays] = useState('');
  const [remainingDays, setRemainingDays] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const activeReqs = requirements.filter((r) => r.status === 'active');
  const pausedReqs = requirements.filter((r) => r.status === 'paused');
  const needsTarget = ['add_days', 'cancel_requirement', 'pause'].includes(type);
  const needsResume = type === 'resume';

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!description.trim()) e.description = '描述不能为空';
    if (type === 'add_days' && (!daysDelta || parseInt(daysDelta) < 1)) e.daysDelta = '天数必须 ≥ 1';
    if (type === 'new_requirement') {
      if (!newReqName.trim()) e.newReqName = '名称不能为空';
      if (!newReqDays || parseInt(newReqDays) < 1) e.newReqDays = '天数必须 ≥ 1';
    }
    if (needsTarget && !targetId) e.target = '请选择需求';
    if (needsResume && !targetId) e.target = '请选择已暂停的需求';

    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setSaving(true);
    try {
      const input: CreateChangeInput = {
        projectId,
        type,
        targetRequirementId: needsTarget || needsResume ? targetId : null,
        role,
        personName: personName.trim() || null,
        description: description.trim(),
        daysDelta: type === 'add_days' ? parseInt(daysDelta) : type === 'new_requirement' ? parseInt(newReqDays) : 0,
        date,
        metadata: type === 'pause' && remainingDays ? { remainingDays: parseInt(remainingDays) } : null,
        newRequirementName: type === 'new_requirement' ? newReqName.trim() : undefined,
        newRequirementDays: type === 'new_requirement' ? parseInt(newReqDays) : undefined,
      };
      await onSave(input);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const targetReq = targetId ? requirements.find((r) => r.id === targetId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">记录变更</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          {/* Type selection */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">变更类型</label>
            <div className="flex flex-wrap gap-1.5">
              {CHANGE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => { setType(t); setTargetId(null); }}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    type === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {CHANGE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Target requirement */}
          {needsTarget && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">目标需求</label>
              <select
                value={targetId ?? ''}
                onChange={(e) => {
                  setTargetId(e.target.value || null);
                  if (type === 'pause' && e.target.value) {
                    const r = activeReqs.find((x) => x.id === e.target.value);
                    if (r) setRemainingDays(String(r.currentDays));
                  }
                }}
                className={`w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 ${
                  errors.target ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <option value="">选择需求...</option>
                {activeReqs.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.currentDays}天)</option>
                ))}
              </select>
            </div>
          )}

          {/* Resume target */}
          {needsResume && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">恢复需求</label>
              <select
                value={targetId ?? ''}
                onChange={(e) => setTargetId(e.target.value || null)}
                className={`w-full text-sm border rounded px-2 py-1.5 ${
                  errors.target ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <option value="">选择已暂停的需求...</option>
                {pausedReqs.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Days delta for add_days */}
          {type === 'add_days' && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">增加天数</label>
              <input
                type="number"
                min={1}
                value={daysDelta}
                onChange={(e) => setDaysDelta(e.target.value)}
                className={`w-32 text-sm border rounded px-2 py-1.5 ${errors.daysDelta ? 'border-red-300' : 'border-gray-200'}`}
                placeholder="天数"
              />
            </div>
          )}

          {/* New requirement fields */}
          {type === 'new_requirement' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1.5 block">需求名称</label>
                <input
                  type="text"
                  value={newReqName}
                  onChange={(e) => setNewReqName(e.target.value)}
                  className={`w-full text-sm border rounded px-2 py-1.5 ${errors.newReqName ? 'border-red-300' : 'border-gray-200'}`}
                  placeholder="新需求名称"
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-500 mb-1.5 block">天数</label>
                <input
                  type="number"
                  min={1}
                  value={newReqDays}
                  onChange={(e) => setNewReqDays(e.target.value)}
                  className={`w-full text-sm border rounded px-2 py-1.5 ${errors.newReqDays ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
            </div>
          )}

          {/* Pause remaining days */}
          {type === 'pause' && targetReq && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">剩余天数</label>
              <input
                type="number"
                min={1}
                max={targetReq.currentDays}
                value={remainingDays}
                onChange={(e) => setRemainingDays(e.target.value)}
                className="w-32 text-sm border border-gray-200 rounded px-2 py-1.5"
              />
              <span className="text-xs text-gray-400 ml-2">默认 = 当前天数 {targetReq.currentDays}</span>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">责任角色</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {/* Person name */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">责任人</label>
            <PersonNameInput value={personName} onChange={setPersonName} />
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="一句话描述变更原因"
              className={`w-full text-sm border rounded px-2 py-1.5 ${errors.description ? 'border-red-300' : 'border-gray-200'}`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="text-sm text-gray-600 px-4 py-2 hover:bg-gray-100 rounded-lg">取消</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
