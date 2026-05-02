import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { Change, Requirement, CreateChangeInput, ChangeType, Role } from '../../types';
import { ChangeRow } from './ChangeRow';
import { ChangeModal } from './ChangeModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';
import { CHANGE_TYPE_LABELS, CHANGE_TYPES } from '../../constants/changeTypes';
import { ROLE_LABELS, ROLES } from '../../constants/roles';
import { TAG_COLORS, type ChangeTag } from '../../constants/changeTags';

interface ChangeListProps {
  projectId: string;
  changes: Change[];
  requirements: Requirement[];
  isArchived: boolean;
  onRecord: (input: CreateChangeInput) => Promise<void>;
  onUpdate: (id: string, data: Partial<Change>) => Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  /** Project's expected end date — passed through to ChangeRow for the
   * W4.8 逾期 warning chip. */
  projectEndDate?: string;
}

export function ChangeList({ projectId, changes, requirements, isArchived, onRecord, onUpdate, onDelete, projectEndDate }: ChangeListProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingChange, setEditingChange] = useState<Change | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // W3.6 + W4.6 — search + filter state, hydrated from URL ?q=&types=&roles=
  // and pushed back to the URL so a refresh / shared link preserves state.
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [typeFilters, setTypeFilters] = useState<Set<ChangeType>>(
    () => new Set((searchParams.get('types')?.split(',').filter(Boolean) ?? []) as ChangeType[]),
  );
  const [roleFilters, setRoleFilters] = useState<Set<Role>>(
    () => new Set((searchParams.get('roles')?.split(',').filter(Boolean) ?? []) as Role[]),
  );
  // W4.5 — batch select state.
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

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

  // W4.4 — aggregate tag counts across all changes (not just filtered, so
  // the stats panel shows the project-wide picture).
  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of changes) {
      const tags = (c.metadata?.tags as string[] | undefined) ?? [];
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [changes]);

  // Push filter state back to URL (replace, not push, so back-button doesn't
  // accumulate every keystroke).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set('q', query.trim());
    else next.delete('q');
    if (typeFilters.size > 0) next.set('types', Array.from(typeFilters).join(','));
    else next.delete('types');
    if (roleFilters.size > 0) next.set('roles', Array.from(roleFilters).join(','));
    else next.delete('roles');
    // Avoid infinite loop — only call setSearchParams if string changed
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // Intentionally exclude searchParams from deps — only react to filter
    // state churn, not external URL changes (e.g. browser back).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilters, roleFilters]);

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

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map((c) => c.id)));
  }
  function exitBatchMode() {
    setBatchMode(false);
    setSelectedIds(new Set());
  }
  async function confirmBatchDelete() {
    setShowBatchConfirm(false);
    // Sequential — each delete triggers a full replay; the engine isn't
    // designed for batched mutation. UX-wise the user clicked once, so we
    // keep going regardless of intermediate failures.
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await onDelete(id);
      } catch {
        /* surface failure once at the end */
      }
    }
    exitBatchMode();
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
          <div className="flex items-center gap-2">
            {sorted.length >= 3 && (
              <button
                type="button"
                onClick={() => (batchMode ? exitBatchMode() : setBatchMode(true))}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                  batchMode
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                data-testid="change-list-batch-toggle"
              >
                {batchMode ? '退出批量' : '批量管理'}
              </button>
            )}
            <button
              onClick={() => { setEditingChange(null); setShowModal(true); }}
              className="flex items-center gap-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm"
            >
              <Plus size={14} />
              记录变更
            </button>
          </div>
        )}
      </div>

      {tagStats.length > 0 && (
        <div
          className="mx-4 mb-2 px-3 py-2 rounded-lg bg-gray-50/60 border border-gray-200/60 flex flex-wrap items-center gap-2 text-[11px]"
          data-testid="change-tag-stats"
        >
          <span className="text-gray-500">原因分布</span>
          {tagStats.map(([tag, count]) => {
            const tone = TAG_COLORS[tag as ChangeTag] ?? 'bg-gray-100 text-gray-600';
            return (
              <span
                key={tag}
                className={`px-1.5 py-0.5 rounded-full ${tone}`}
                data-testid={`tag-stat-${tag}`}
              >
                {tag} ×{count}
              </span>
            );
          })}
        </div>
      )}

      {batchMode && (
        <div
          className="mx-4 mb-2 px-3 py-2 rounded-lg bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs"
          data-testid="change-list-batch-toolbar"
        >
          <div className="flex items-center gap-3">
            <span className="text-blue-700 font-medium">
              已选 {selectedIds.size} / {filtered.length}
            </span>
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-blue-600 hover:underline"
              data-testid="change-list-select-all"
            >
              全选当前结果
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-500 hover:underline"
              disabled={selectedIds.size === 0}
            >
              清空
            </button>
          </div>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setShowBatchConfirm(true)}
            className="flex items-center gap-1 text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg disabled:opacity-50"
            data-testid="change-list-batch-delete"
          >
            <Trash2 size={12} />
            删除选中 ({selectedIds.size})
          </button>
        </div>
      )}

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
              batchMode={batchMode}
              selected={selectedIds.has(c.id)}
              onToggleSelect={toggleSelected}
              projectEndDate={projectEndDate}
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

      <ConfirmDialog
        open={showBatchConfirm}
        title="批量删除变更"
        message={`确定要删除选中的 ${selectedIds.size} 条变更吗？每条都会触发全量重算，可按 ⌘Z 逐条撤销。`}
        destructive
        confirmLabel={`删除 ${selectedIds.size} 条`}
        onConfirm={confirmBatchDelete}
        onCancel={() => setShowBatchConfirm(false)}
      />
    </div>
  );
}
