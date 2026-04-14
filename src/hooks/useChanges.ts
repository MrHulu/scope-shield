import { useEffect, useMemo, useCallback } from 'react';
import { useChangeStore } from '../stores/changeStore';
import { useRequirementStore } from '../stores/requirementStore';
import type { CreateChangeInput } from '../types';

export function useChanges(projectId: string | null) {
  const { changes, loading, error, loadChanges, recordChange: storeRecord, deleteChange: storeDelete } =
    useChangeStore();
  const requirements = useRequirementStore((s) => s.requirements);
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

  // Wrap recordChange to auto-pass requirements and sync requirement state
  const recordChange = useCallback(
    async (input: CreateChangeInput) => {
      const result = await storeRecord(input, requirements);
      if (result) {
        setRequirements(result.updatedRequirements);
      }
    },
    [storeRecord, requirements, setRequirements],
  );

  // Wrap deleteChange to auto-pass projectId and requirements, and sync
  const deleteChange = useCallback(
    async (id: string) => {
      if (!projectId) return;
      const result = await storeDelete(id, projectId, requirements);
      if (result) {
        setRequirements(result.requirements);
      }
    },
    [storeDelete, projectId, requirements, setRequirements],
  );

  return { changes: sorted, loading, error, recordChange, deleteChange };
}
