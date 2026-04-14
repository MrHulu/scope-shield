import { useEffect, useMemo, useCallback } from 'react';
import { useRequirementStore } from '../stores/requirementStore';
import type { CreateRequirementInput, Requirement } from '../types';

export function useRequirements(projectId: string | null) {
  const { requirements, loading, error, loadRequirements, addRequirement: storeAdd, updateRequirement: storeUpdate, deleteRequirement: storeDelete, reorderRequirements } =
    useRequirementStore();

  useEffect(() => {
    if (projectId) loadRequirements(projectId);
  }, [projectId, loadRequirements]);

  const sorted = useMemo(
    () => [...requirements].sort((a, b) => a.sortOrder - b.sortOrder),
    [requirements],
  );

  // Bind projectId so components don't need to pass it
  const addRequirement = useCallback(
    (input: CreateRequirementInput) => storeAdd(input),
    [storeAdd],
  );

  const updateRequirement = useCallback(
    (id: string, data: Partial<Requirement>) => {
      if (projectId) storeUpdate(id, data, projectId);
    },
    [storeUpdate, projectId],
  );

  const deleteRequirement = useCallback(
    (id: string) => {
      if (projectId) storeDelete(id, projectId);
    },
    [storeDelete, projectId],
  );

  return {
    requirements: sorted,
    loading,
    error,
    addRequirement,
    updateRequirement,
    deleteRequirement,
    reorderRequirements,
  };
}
