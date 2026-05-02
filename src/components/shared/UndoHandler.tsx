import { useEffect } from 'react';
import { useChangeStore } from '../../stores/changeStore';
import { useRequirementStore } from '../../stores/requirementStore';
import { useUIStore } from '../../stores/uiStore';
import { useUndoStore } from '../../stores/undoStore';
import { showToast } from './Toast';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * Global ⌘Z / Ctrl+Z listener that restores the most recently deleted change.
 * Companion to the toast shown by useChanges.deleteChange — both refer to
 * the same undoStore.
 */
export function UndoHandler() {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== 'z') return;
      if (e.shiftKey) return; // ⇧+Z is redo on most platforms — out of scope
      if (isTypingTarget(e.target)) return;
      const change = useUndoStore.getState().consume();
      if (!change) return; // nothing to undo (or expired)
      e.preventDefault();
      const projectId = useUIStore.getState().currentProjectId;
      if (!projectId) return;
      const restoreChange = useChangeStore.getState().restoreChange;
      const reqs = useRequirementStore.getState().requirements;
      const setRequirements = useRequirementStore.getState().setRequirements;
      try {
        const result = await restoreChange(change, projectId, reqs);
        if (result) setRequirements(result.requirements);
        showToast('变更已恢复', 'success');
      } catch (err) {
        showToast(`撤销失败：${(err as Error).message}`, 'error');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null;
}
