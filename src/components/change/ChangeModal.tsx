import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ImagePlus } from 'lucide-react';
import type { Change, ChangeType, Role, Requirement, CreateChangeInput, SupplementSubType } from '../../types';
import { CHANGE_TYPE_LABELS, CHANGE_TYPES, SUPPLEMENT_SUBTYPE_LABELS } from '../../constants/changeTypes';
import { ROLE_LABELS, ROLES } from '../../constants/roles';
import { PersonNameInput } from './PersonNameInput';
import { today } from '../../utils/date';
import { validateDays, validateSupplementDays, validatePausedRemainingDays } from '../../utils/validation';
import { compressImage, MAX_SCREENSHOTS } from '../../utils/image';
import { showToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ChangeModalProps {
  open: boolean;
  projectId: string;
  requirements: Requirement[];
  editingChange?: Change | null;
  onSave: (input: CreateChangeInput) => Promise<void>;
  onUpdate?: (id: string, data: Partial<Change>) => Promise<void>;
  onClose: () => void;
}

export function ChangeModal({ open, projectId, requirements, editingChange, onSave, onUpdate, onClose }: ChangeModalProps) {
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
  const [supplementSubType, setSupplementSubType] = useState<SupplementSubType>('feature_addition');
  // reprioritize: 直接选目标需求 + 新前置依赖（'' = 未选 / '__null__' = 无前置 / <reqId> = 选了某条）
  const [reprioritizeTarget, setReprioritizeTarget] = useState<string>('');
  const [reprioritizeNewDep, setReprioritizeNewDep] = useState<string>('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // W2.4 — two-step UX. Create mode starts at 'type' (pick category) and
  // auto-advances to 'details' once a type is clicked. Edit mode skips
  // straight to 'details'.
  const [step, setStep] = useState<'type' | 'details'>('details');
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const isEditing = !!editingChange;

  // Reset / populate state when modal opens
  useEffect(() => {
    if (open) {
      if (editingChange) {
        // Edit mode: populate from existing change
        setType(editingChange.type);
        setTargetId(editingChange.targetRequirementId);
        setRole(editingChange.role);
        setPersonName(editingChange.personName ?? '');
        setDescription(editingChange.description);
        setDaysDelta(editingChange.daysDelta ? String(editingChange.daysDelta) : '');
        setDate(editingChange.date);
        setNewReqName(editingChange.metadata?.newRequirementName ?? '');
        setNewReqDays(editingChange.type === 'new_requirement' ? String(editingChange.daysDelta) : '');
        setRemainingDays(editingChange.metadata?.remainingDays ? String(editingChange.metadata.remainingDays) : '');
        setSupplementSubType((editingChange.metadata?.subType as SupplementSubType) ?? 'feature_addition');
        setReprioritizeTarget(editingChange.metadata?.reprioritizeTargetId ?? '');
        setReprioritizeNewDep(
          editingChange.metadata?.reprioritizeNewDependsOn === undefined
            ? ''
            : editingChange.metadata.reprioritizeNewDependsOn === null
              ? '__null__'
              : editingChange.metadata.reprioritizeNewDependsOn,
        );
        setScreenshots(editingChange.screenshots ?? []);
        setStep('details'); // editing — fields populated, skip type selection
      } else {
        // Create mode: reset all. Default to step='details' with type=add_days
        // so the form is immediately usable; users who want a different type
        // click "← 选其他类型" to expand the picker grid.
        setType('add_days');
        setTargetId(null);
        setRole('pm');
        setPersonName('');
        setDescription('');
        setDaysDelta('');
        setDate(today());
        setNewReqName('');
        setNewReqDays('');
        setRemainingDays('');
        setSupplementSubType('feature_addition');
        setReprioritizeTarget('');
        setReprioritizeNewDep('');
        setScreenshots([]);
        setStep('details');
      }
      setErrors({});
      setSaving(false);
    }
  }, [open, editingChange]);

  // Escape key handler via global listener (div onKeyDown doesn't work on non-focusable elements)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const addScreenshot = useCallback(async (file: File) => {
    if (screenshots.length >= MAX_SCREENSHOTS) return;
    setErrors((prev) => { const { screenshots: _, ...rest } = prev; return rest; });
    try {
      const dataUrl = await compressImage(file);
      setScreenshots((prev) => prev.length >= MAX_SCREENSHOTS ? prev : [...prev, dataUrl]);
    } catch (err) {
      setErrors((prev) => ({ ...prev, screenshots: err instanceof Error ? err.message : '图片处理失败' }));
    }
  }, [screenshots.length]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) addScreenshot(blob);
        break;
      }
    }
  }, [addScreenshot]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [open, handlePaste]);

  if (!open) return null;

  const activeReqs = requirements.filter((r) => r.status === 'active');
  const pausedReqs = requirements.filter((r) => r.status === 'paused');
  const needsTarget = ['add_days', 'cancel_requirement', 'pause'].includes(type);
  const needsResume = type === 'resume';
  const needsSupplement = type === 'supplement';

  // Supplement target: all statuses (active/paused/cancelled)
  const supplementReqs = requirements;

  const targetReq = targetId ? requirements.find((r) => r.id === targetId) : null;

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!description.trim()) e.description = '描述不能为空';
    if (type === 'add_days') {
      const dErr = validateDays(parseFloat(daysDelta));
      if (!daysDelta || dErr) e.daysDelta = dErr ?? '天数必须 ≥ 0.5';
    }
    if (type === 'new_requirement') {
      if (!newReqName.trim()) e.newReqName = '名称不能为空';
      const dErr = validateDays(parseFloat(newReqDays));
      if (!newReqDays || dErr) e.newReqDays = dErr ?? '天数必须 ≥ 0.5';
    }
    if (type === 'supplement') {
      if (!targetId) e.target = '请选择需求';
      const sErr = validateSupplementDays(daysDelta ? parseFloat(daysDelta) : 0);
      if (sErr) e.daysDelta = sErr;
    }
    if (type === 'pause' && targetReq && remainingDays) {
      const pErr = validatePausedRemainingDays(parseFloat(remainingDays), targetReq.currentDays);
      if (pErr) e.remainingDays = pErr;
    }
    if (type === 'reprioritize') {
      if (!reprioritizeTarget) e.reprioritizeTarget = '请选择需求';
      if (!reprioritizeNewDep) e.reprioritizeNewDep = '请选择新前置';
      if (reprioritizeTarget && reprioritizeNewDep && reprioritizeNewDep !== '__null__' && reprioritizeTarget === reprioritizeNewDep) {
        e.reprioritizeNewDep = '前置不能是自己';
      }
      // No-op detection: when newDep equals the target's existing dependsOn,
      // saving this as a change would record nothing meaningful — toast and
      // bail instead so the user understands why stats don't move.
      if (
        reprioritizeTarget &&
        reprioritizeNewDep &&
        Object.keys(e).length === 0 &&
        !isEditing
      ) {
        const currentDep = requirements.find((r) => r.id === reprioritizeTarget)?.dependsOn ?? null;
        const requestedDep = reprioritizeNewDep === '__null__' ? null : reprioritizeNewDep;
        if (currentDep === requestedDep) {
          showToast('前置依赖未变化，未生效', 'info');
          return;
        }
      }
    }
    if (needsTarget && !targetId) e.target = '请选择需求';
    if (needsResume && !targetId) e.target = '请选择已暂停的需求';

    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setSaving(true);
    try {
      if (isEditing && onUpdate) {
        // Edit mode: only send fields that actually changed to avoid unnecessary replay + updatedAt churn
        const data: Partial<Change> = {};
        if (description.trim() !== editingChange!.description) data.description = description.trim();
        if (role !== editingChange!.role) data.role = role;
        const trimmedPerson = personName.trim() || null;
        if (trimmedPerson !== editingChange!.personName) data.personName = trimmedPerson;
        // Only include replay-triggering fields if they actually changed
        const newDaysDelta = type === 'add_days' ? parseFloat(daysDelta)
          : type === 'new_requirement' ? parseFloat(newReqDays)
          : type === 'supplement' ? (daysDelta ? parseFloat(daysDelta) : 0)
          : 0;
        if (newDaysDelta !== editingChange!.daysDelta) data.daysDelta = newDaysDelta;
        if (date !== editingChange!.date) data.date = date;
        const newTargetId = needsTarget || needsResume || needsSupplement
          ? targetId
          : type === 'new_requirement'
            ? editingChange!.targetRequirementId  // preserve for new_requirement
            : null;
        if (newTargetId !== editingChange!.targetRequirementId) data.targetRequirementId = newTargetId;
        // Metadata
        const newMetadata = type === 'pause' && remainingDays ? { remainingDays: parseFloat(remainingDays) }
          : type === 'new_requirement' ? { ...editingChange!.metadata, newRequirementName: newReqName.trim() }
          : type === 'supplement' ? { subType: supplementSubType }
          : type === 'reprioritize' ? {
              reprioritizeTargetId: reprioritizeTarget,
              reprioritizeNewDependsOn: reprioritizeNewDep === '__null__' ? null : reprioritizeNewDep,
            }
          : null;
        if (JSON.stringify(newMetadata) !== JSON.stringify(editingChange!.metadata)) data.metadata = newMetadata;
        const oldScreenshots = editingChange!.screenshots ?? [];
        if (JSON.stringify(screenshots) !== JSON.stringify(oldScreenshots)) data.screenshots = screenshots;
        await onUpdate(editingChange!.id, data);
      } else {
        // Create mode
        const input: CreateChangeInput = {
          projectId,
          type,
          targetRequirementId: needsTarget || needsResume || needsSupplement ? targetId : null,
          role,
          personName: personName.trim() || null,
          description: description.trim(),
          daysDelta: type === 'add_days' ? parseFloat(daysDelta)
            : type === 'new_requirement' ? parseFloat(newReqDays)
            : type === 'supplement' ? (daysDelta ? parseFloat(daysDelta) : 0)
            : 0,
          date,
          metadata: type === 'pause' && remainingDays ? { remainingDays: parseFloat(remainingDays) }
            : type === 'supplement' ? { subType: supplementSubType }
            : type === 'reprioritize' ? {
              reprioritizeTargetId: reprioritizeTarget,
              reprioritizeNewDependsOn: reprioritizeNewDep === '__null__' ? null : reprioritizeNewDep,
            }
            : null,
          screenshots,
          newRequirementName: type === 'new_requirement' ? newReqName.trim() : undefined,
          newRequirementDays: type === 'new_requirement' ? parseFloat(newReqDays) : undefined,
        };
        await onSave(input);
      }
      onClose();
    } catch (err) {
      setErrors({ description: (err as Error).message || '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40"
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={onClose}
    >
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={isEditing ? '编辑变更' : '记录变更'} className="glass-panel-strong rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{isEditing ? '编辑变更' : '记录变更'}</h3>
          <button onClick={onClose} aria-label="关闭" className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>

        {/* W2.4 step indicator (create mode only — edit mode stays single-step) */}
        {!isEditing && (
          <div className="px-6 pt-3 pb-2 flex items-center gap-3 text-[11px] text-gray-500" data-testid="change-modal-stepper">
            <span className={step === 'type' ? 'text-blue-700 font-semibold' : ''}>① 选类型</span>
            <span className="text-gray-300">→</span>
            <span className={step === 'details' ? 'text-blue-700 font-semibold' : ''}>② 填详情</span>
          </div>
        )}

        <div className="px-6 pb-4 flex flex-col gap-4">
          {/* Step 1: Type picker — also shown in edit mode (locked) for context */}
          {step === 'type' && !isEditing && (
            <div data-testid="change-modal-step-type">
              <label className="text-xs text-gray-500 mb-2 block">想记录什么类型的变更？</label>
              <div className="grid grid-cols-2 gap-2">
                {CHANGE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setType(t);
                      setTargetId(null);
                      setStep('details');
                    }}
                    className={`text-sm px-3 py-2.5 rounded-lg border text-left ${
                      type === t
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                    data-testid={`change-type-${t}`}
                  >
                    {CHANGE_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: locked-in type chip + back link */}
          {step === 'details' && !isEditing && (
            <div className="flex items-center justify-between border-b border-gray-200/50 pb-3">
              <div className="text-sm text-gray-700">
                <span className="text-xs text-gray-500 mr-2">类型</span>
                <span className="font-medium">{CHANGE_TYPE_LABELS[type]}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('type')}
                className="text-xs text-blue-600 hover:underline"
                data-testid="change-modal-back-to-type"
              >
                ← 选其他类型
              </button>
            </div>
          )}

          {/* Edit mode: keep the original locked-in type strip so users see what
              they're editing without exposing the selector grid. */}
          {isEditing && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">变更类型</label>
              <div className="text-sm text-gray-700 px-3 py-1.5 rounded-lg bg-gray-50 inline-block">
                {CHANGE_TYPE_LABELS[type]}
              </div>
            </div>
          )}

          {/* W2.4 — wrap all detail-step fields in a fragment that's only
              rendered when step==='details'. Edit mode always renders. */}
          {step === 'details' && <>

          {/* Target requirement (active only) */}
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

          {/* Supplement target (all statuses) */}
          {needsSupplement && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">目标需求</label>
              <select
                value={targetId ?? ''}
                onChange={(e) => setTargetId(e.target.value || null)}
                className={`w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 ${
                  errors.target ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <option value="">选择需求...</option>
                {supplementReqs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.currentDays}天){r.status === 'paused' ? ' [暂停]' : r.status === 'cancelled' ? ' [已砍]' : ''}
                  </option>
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

          {/* Reprioritize: 选需求 + 选新前置依赖 */}
          {type === 'reprioritize' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1.5 block">需求</label>
                <select
                  value={reprioritizeTarget}
                  onChange={(e) => setReprioritizeTarget(e.target.value)}
                  className={`w-full text-sm border rounded px-2 py-1.5 ${errors.reprioritizeTarget ? 'border-red-300' : 'border-gray-200'}`}
                >
                  <option value="">选择需求...</option>
                  {requirements.filter((r) => r.status !== 'cancelled').map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {errors.reprioritizeTarget && (
                  <p className="text-xs text-red-500 mt-1">{errors.reprioritizeTarget}</p>
                )}
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1.5 block">新前置依赖</label>
                <select
                  value={reprioritizeNewDep}
                  onChange={(e) => setReprioritizeNewDep(e.target.value)}
                  className={`w-full text-sm border rounded px-2 py-1.5 ${errors.reprioritizeNewDep ? 'border-red-300' : 'border-gray-200'}`}
                >
                  <option value="">选择新前置...</option>
                  <option value="__null__">无前置（与其他需求并行）</option>
                  {requirements
                    .filter((r) => r.status !== 'cancelled' && r.id !== reprioritizeTarget)
                    .map((r) => (
                      <option key={r.id} value={r.id}>排在「{r.name}」之后</option>
                    ))}
                </select>
                {errors.reprioritizeNewDep && (
                  <p className="text-xs text-red-500 mt-1">{errors.reprioritizeNewDep}</p>
                )}
              </div>
            </div>
          )}

          {/* Supplement sub-type */}
          {needsSupplement && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">补充类型</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(SUPPLEMENT_SUBTYPE_LABELS) as Array<[SupplementSubType, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSupplementSubType(key)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      supplementSubType === key ? 'border-rose-600 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Days delta for add_days (now supports negative for reducing days) */}
          {type === 'add_days' && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">调整天数</label>
              <input
                type="number"
                step={0.5}
                value={daysDelta}
                onChange={(e) => setDaysDelta(e.target.value)}
                className={`w-32 text-sm border rounded px-2 py-1.5 ${errors.daysDelta ? 'border-red-300' : 'border-gray-200'}`}
                placeholder="正数增加，负数减少"
              />
            </div>
          )}

          {/* Days delta for supplement (allows 0) */}
          {needsSupplement && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">增加天数（可为 0）</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={daysDelta}
                onChange={(e) => setDaysDelta(e.target.value)}
                className={`w-32 text-sm border rounded px-2 py-1.5 ${errors.daysDelta ? 'border-red-300' : 'border-gray-200'}`}
                placeholder="0"
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
                  disabled={isEditing}
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-500 mb-1.5 block">天数</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
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
                min={0.5}
                step={0.5}
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

          {/* Screenshots */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              截图证据 <span className="text-gray-400">({screenshots.length}/{MAX_SCREENSHOTS}，可粘贴)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {screenshots.map((src, i) => (
                <div key={i} className="relative group w-16 h-16 rounded border border-gray-200 overflow-hidden">
                  <img src={src} alt={`截图${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setScreenshots((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100"
                    aria-label="删除截图"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {screenshots.length < MAX_SCREENSHOTS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400"
                >
                  <ImagePlus size={16} />
                  <span className="text-[10px] mt-0.5">添加</span>
                </button>
              )}
            </div>
            {errors.screenshots && (
              <p className="text-xs text-red-500 mt-1">{errors.screenshots}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                setErrors((prev) => { const { screenshots: _, ...rest } = prev; return rest; });
                const files = e.target.files;
                if (files) Array.from(files).forEach((f) => addScreenshot(f));
                e.target.value = '';
              }}
            />
          </div>
          </>}
          {/* W2.4 details fragment closes */}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="text-sm text-gray-600 px-4 py-2 hover:bg-gray-100 rounded-lg">
            {step === 'type' && !isEditing ? '关闭' : '取消'}
          </button>
          {(step === 'details' || isEditing) && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : isEditing ? '更新' : '保存'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
