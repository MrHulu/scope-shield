import { useEffect, useMemo, useCallback } from 'react';
import { useChangeStore } from '../stores/changeStore';
import { useRequirementStore } from '../stores/requirementStore';
import { useUndoStore, UNDO_TTL_SECONDS } from '../stores/undoStore';
import { showToast } from '../components/shared/Toast';
import type { Change, CreateChangeInput } from '../types';

export function useChanges(projectId: string | null) {
  const { changes, loading, error, loadChanges, recordChange: storeRecord, updateChange: storeUpdate, deleteChange: storeDelete } =
    useChangeStore();
  const setRequirements = useRequirementStore((s) => s.setRequirements);

  useEffect(() => {
    if (projectId) loadChanges(projectId);
  }, [projectId, loadChanges]);

  const sorted = useMemo(
    () =>
      [...changes].sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.createdAt.localeCompare(b.createdAt);
      }),
    [changes],
  );

  // Use getState() to read fresh requirements at call time — avoids stale closure
  // Errors propagate to callers (e.g. ChangeModal catch block)
  const recordChange = useCallback(
    async (input: CreateChangeInput) => {
      const reqs = useRequirementStore.getState().requirements;
      const result = await storeRecord(input, reqs);
      if (result) setRequirements(result.updatedRequirements);
    },
    [storeRecord, setRequirements],
  );

  const updateChange = useCallback(
    async (id: string, data: Partial<Change>) => {
      if (!projectId) return;
      const reqs = useRequirementStore.getState().requirements;
      const result = await storeUpdate(id, data, projectId, reqs);
      if (result) setRequirements(result.requirements);
    },
    [storeUpdate, projectId, setRequirements],
  );

  const deleteChange = useCallback(
    async (id: string) => {
      if (!projectId) return;
      const target = useChangeStore.getState().changes.find((c) => c.id === id);
      const reqs = useRequirementStore.getState().requirements;
      const result = await storeDelete(id, projectId, reqs);
      if (result) {
        setRequirements(result.requirements);
        // W2.6 — let user undo within UNDO_TTL_SECONDS via Cmd+Z. The
        // deleted Change is held in undoStore until consumed or expired.
        if (target) {
          useUndoStore.getState().recordDeletion(target);
          showToast(`已删除 — ${UNDO_TTL_SECONDS}s 内按 ⌘Z 撤销`, 'info');
        }
      }
    },
    [storeDelete, projectId, setRequirements],
  );

  return { changes: sorted, loading, error, recordChange, updateChange, deleteChange };
}
