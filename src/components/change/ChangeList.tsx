import { useState, useMemo, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import type { Change, Requirement, CreateChangeInput, ChangeType, Role } from '../../types';
import { ChangeRow } from './ChangeRow';
import { ChangeModal } from './ChangeModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';
import { CHANGE_TYPE_LABELS, CHANGE_TYPES } from '../../constants/changeTypes';
import { ROLE_LABELS, ROLES } from '../../constants/roles';

interface ChangeListProps {
  projectId: string;
  changes: Change[];
  requirements: Requirement[];
  isArchived: boolean;
  onRecord: (input: CreateChangeInput) => Promise<void>;
  onUpdate: (id: string, data: Partial<Change>) => Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

export function ChangeList({ projectId, changes, requirements, isArchived, onRecord, onUpdate, onDelete }: ChangeListProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingChange, setEditingChange] = useState<Change | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // W3.6 — search + filter state.
  const [query, setQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<ChangeType>>(new Set());
  const [roleFilters, setRoleFilters] = useState<Set<Role>>(new Set());

  const deleteTarget = deleteId ? changes.find((c) => c.id === deleteId) : null;

  // Sort by date descending, then createdAt descending. Then filter by
  // search query (description / personName) + active type/role chips.
  const sorted = useMemo(
    () => [...changes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [changes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((c) => {
      if (typeFilters.size > 0 && !typeFilters.has(c.type)) return false;
      if (roleFilters.size > 0 && !roleFilters.has(c.role)) return false;
      if (q) {
        const haystack = `${c.description} ${c.personName ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, query, typeFilters, roleFilters]);

  const filterActive =
    query.trim().length > 0 || typeFilters.size > 0 || roleFilters.size > 0;

  function toggleType(t: ChangeType) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }
  function toggleRole(r: Role) {
    setRoleFilters((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }
  function clearFilters() {
    setQuery('');
    setTypeFilters(new Set());
    setRoleFilters(new Set());
  }

  const handleEdit = (id: string) => {
    const c = changes.find((ch) => ch.id === id);
    if (c) {
      setEditingChange(c);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingChange(null);
  };

  // Listen for window-level "open record-change modal" requests dispatched
  // by the floating CTA and ⌘⇧C keyboard shortcut. Uses a custom event to
  // avoid lifting modal state up the tree (single source of truth here).
  useEffect(() => {
    if (isArchived || requirements.length === 0) return;
    const handler = () => {
      setEditingChange(null);
      setShowModal(true);
    };
    window.addEventListener('scope-shield:open-change-modal', handler);
    return () => window.removeEventListener('scope-shield:open-change-modal', handler);
  }, [isArchived, requirements.length]);

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          变更记录
          {filterActive && (
            <span className="ml-2 text-xs font-normal text-gray-500" data-testid="change-filter-count">
              {filtered.length} / {sorted.length} 条匹配
            </span>
          )}
        </h2>
        {!isArchived && requirements.length > 0 && (
          <button
            onClick={() => { setEditingChange(null); setShowModal(true); }}
            className="flex items-center gap-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm"
          >
            <Plus size={14} />
            记录变更
          </button>
        )}
      </div>

      {/* W3.6 — search + filter chip bar. Renders only when there are at
          least 3 changes (small projects don't need the noise). */}
      {sorted.length >= 3 && (
        <div className="px-4 pb-3 space-y-2" data-testid="change-list-filter">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索描述 / 责任人..."
              className="w-full text-xs border border-gray-200 rounded pl-7 pr-2 py-1.5 focus:outline-none focus:border-blue-400"
              data-testid="change-list-search"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {CHANGE_TYPES.map((t) => {
              const active = typeFilters.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  data-testid={`change-filter-type-${t}`}
                >
                  {CHANGE_TYPE_LABELS[t]}
                </button>
              );
            })}
            <span className="mx-1 text-gray-300">·</span>
            {ROLES.map((r) => {
              const active = roleFilters.has(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRole(r)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  data-testid={`change-filter-role-${r}`}
                >
                  {ROLE_LABELS[r]}
                </button>
              );
            })}
            {filterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] px-2 py-0.5 text-gray-500 hover:text-gray-700"
              >
                清除
              </button>
            )}
          </div>
        </div>
      )}

      {changes.length === 0 ? (
        <EmptyState message="暂无变更记录" />
      ) : filtered.length === 0 ? (
        <EmptyState message="无匹配的变更 — 调整筛选条件试试" />
      ) : (
        <div className="flex flex-col gap-0.5 px-2">
          {filtered.map((c) => (
            <ChangeRow
              key={c.id}
              change={c}
              requirements={requirements}
              isArchived={isArchived}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      <ChangeModal
        open={showModal}
        projectId={projectId}
        requirements={requirements}
        editingChange={editingChange}
        onSave={async (input) => { await onRecord(input); }}
        onUpdate={onUpdate}
        onClose={handleCloseModal}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="删除变更记录"
        message={`确定要删除「${deleteTarget?.description ?? ''}」吗？此操作将触发全量重算。`}
        destructive
        confirmLabel="删除"
        onConfirm={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
