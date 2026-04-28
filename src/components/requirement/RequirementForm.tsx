import { useRef, useState } from 'react';
import { Link2, Wand2 } from 'lucide-react';
import type { Requirement, CreateRequirementInput } from '../../types';
import { validateDays } from '../../utils/validation';
import {
  analyzeFeishuRequirementUrl,
  buildFeishuRequirementSource,
} from '../../services/feishuRequirement';

interface RequirementFormProps {
  projectId: string;
  requirements: Requirement[];
  onSave: (input: CreateRequirementInput) => Promise<Requirement | null>;
  onCancel: () => void;
}

export function RequirementForm({ projectId, requirements, onSave, onCancel }: RequirementFormProps) {
  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  const lastActiveReq = requirements.filter((r) => r.status !== 'cancelled').at(-1);
  const [dependsOn, setDependsOn] = useState<string | null>(lastActiveReq?.id ?? null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [source, setSource] = useState<CreateRequirementInput['source']>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sourceHint, setSourceHint] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const analyzeSeqRef = useRef(0);
  const activeAnalyzeSeqRef = useRef<number | null>(null);
  const sourceUrlRef = useRef('');

  const handleAnalyzeUrl = async () => {
    const trimmedUrl = sourceUrl.trim();
    if (!trimmedUrl) return;
    const seq = ++analyzeSeqRef.current;
    activeAnalyzeSeqRef.current = seq;

    setAnalyzing(true);
    setSourceHint(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.sourceUrl;
      return next;
    });

    try {
      const draft = await analyzeFeishuRequirementUrl(trimmedUrl);
      if (seq !== analyzeSeqRef.current || sourceUrlRef.current.trim() !== trimmedUrl) return;
      setSource(draft.source);
      if (draft.name) setName(draft.name);
      if (draft.originalDays !== null) setDays(String(draft.originalDays));
      const ownerText = draft.source.ownerNames?.length
        ? ` · ${draft.source.ownerNames.join('、')}`
        : '';
      const scheduleText = draft.source.startDate || draft.source.endDate
        ? ` · ${draft.source.startDate ?? '?'} 至 ${draft.source.endDate ?? '?'}`
        : '';
      setSourceHint(
        draft.status === 'fetched'
          ? `已从飞书读取需求信息${ownerText}${scheduleText}`
          : draft.error
            ? `${draft.error}；已保留 URL 来源，可手动填写并保存`
            : '已解析 URL；代理不可用时可手动填写并保存来源',
      );
    } catch (err) {
      if (seq !== analyzeSeqRef.current || sourceUrlRef.current.trim() !== trimmedUrl) return;
      setErrors((prev) => ({
        ...prev,
        sourceUrl: err instanceof Error ? err.message : '飞书 URL 解析失败',
      }));
    } finally {
      if (activeAnalyzeSeqRef.current === seq) {
        activeAnalyzeSeqRef.current = null;
        setAnalyzing(false);
      }
    }
  };

  const handleSave = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = '名称不能为空';
    const dErr = validateDays(parseFloat(days));
    if (!days || dErr) e.days = dErr ?? '天数必须 ≥ 0.5';
    let nextSource = source;
    if (sourceUrl.trim() && !nextSource) {
      try {
        nextSource = buildFeishuRequirementSource(sourceUrl.trim());
      } catch (err) {
        e.sourceUrl = err instanceof Error ? err.message : '飞书 URL 解析失败';
      }
    }
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    await onSave({
      projectId,
      name: name.trim(),
      originalDays: parseFloat(days),
      dependsOn,
      source: nextSource ?? null,
    });
    setName('');
    setDays('');
    setDependsOn(null);
    setSourceUrl('');
    sourceUrlRef.current = '';
    setSource(null);
    setSourceHint(null);
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
        <div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 size={13} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                type="url"
                placeholder="飞书需求 URL（可选）"
                value={sourceUrl}
                onChange={(e) => {
                  analyzeSeqRef.current += 1;
                  activeAnalyzeSeqRef.current = null;
                  sourceUrlRef.current = e.target.value;
                  setAnalyzing(false);
                  setSourceUrl(e.target.value);
                  setSource(null);
                  setSourceHint(null);
                }}
                className={`w-full text-sm border rounded pl-7 pr-2 py-1.5 focus:outline-none focus:border-blue-400 ${
                  errors.sourceUrl ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
              />
            </div>
            <button
              type="button"
              onClick={handleAnalyzeUrl}
              disabled={!sourceUrl.trim() || analyzing}
              className="inline-flex items-center gap-1 text-xs text-blue-600 border border-blue-200 bg-white rounded px-2.5 py-1.5 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wand2 size={13} />
              {analyzing ? '解析中' : '解析'}
            </button>
          </div>
          {(sourceHint || errors.sourceUrl) && (
            <p className={`text-xs mt-1 ${errors.sourceUrl ? 'text-red-500' : 'text-blue-600'}`}>
              {errors.sourceUrl ?? sourceHint}
            </p>
          )}
        </div>
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
          <div className="flex-1">
            <select
              value={dependsOn ?? ''}
              onChange={(e) => setDependsOn(e.target.value || null)}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 text-gray-600"
            >
              <option value="">无前置（与其他需求并行）</option>
              {activeReqs.map((r) => (
                <option key={r.id} value={r.id}>排在「{r.name}」之后</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
              选择前置需求后，本需求会排在它后面；选「无前置」则与其他需求同时进行，不增加总工期
            </p>
          </div>
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
