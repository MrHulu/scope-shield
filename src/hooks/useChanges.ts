import { useEffect, useMemo, useCallback } from 'react';
import { useChangeStore } from '../stores/changeStore';
import { useRequirementStore } from '../stores/requirementStore';
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
      const reqs = useRequirementStore.getState().requirements;
      const result = await storeDelete(id, projectId, reqs);
      if (result) setRequirements(result.requirements);
    },
    [storeDelete, projectId, setRequirements],
  );

  return { changes: sorted, loading, error, recordChange, updateChange, deleteChange };
}
