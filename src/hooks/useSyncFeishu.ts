import { useState, useCallback } from 'react';
import type { Requirement } from '../types';
import { analyzeFeishuRequirementUrl } from '../services/feishuRequirement';
import { showToast } from '../components/shared/Toast';

function isSyncable(r: Requirement): boolean {
  const s = r.source;
  return (
    s?.provider === 'feishu_project' &&
    !!s.projectKey &&
    !!s.workItemTypeKey &&
    !!s.workItemId
  );
}

export function useSyncFeishu(
  requirements: Requirement[],
  updateRequirement: (id: string, data: Partial<Requirement>) => void,
) {
  const [syncing, setSyncing] = useState(false);

  const syncAll = useCallback(async () => {
    const targets = requirements.filter(isSyncable);
    if (targets.length === 0) return;

    setSyncing(true);
    try {
      const results = await Promise.allSettled(
        targets.map((r) => analyzeFeishuRequirementUrl(r.source!.url)),
      );

      let success = 0;
      let failed = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const req = targets[i];

        if (result.status === 'rejected') {
          failed++;
          continue;
        }

        const draft = result.value;
        if (draft.status !== 'fetched') {
          failed++;
          continue;
        }

        const patch: Partial<Requirement> = { source: draft.source };
        if (draft.name) patch.name = draft.name;
        if (draft.originalDays !== null) patch.originalDays = draft.originalDays;

        updateRequirement(req.id, patch);
        success++;
      }

      if (failed === 0) {
        showToast(`已同步 ${success} 个飞书需求`, 'success');
      } else {
        showToast(`同步完成：${success} 成功，${failed} 失败`, failed > 0 ? 'error' : 'success');
      }
    } finally {
      setSyncing(false);
    }
  }, [requirements, updateRequirement]);

  const hasFeishuRequirements = requirements.some(isSyncable);

  return { syncAll, syncing, hasFeishuRequirements };
}
