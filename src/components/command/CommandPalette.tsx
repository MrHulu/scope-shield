import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderOpen, ListChecks, FileText } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useProjectStore } from '../../stores/projectStore';
import { useRequirementStore } from '../../stores/requirementStore';
import { useChangeStore } from '../../stores/changeStore';
import { useUIStore } from '../../stores/uiStore';
import { CHANGE_TYPE_LABELS } from '../../constants/changeTypes';

type Item =
  | { kind: 'project'; id: string; label: string; sub: string; href: string }
  | { kind: 'requirement'; id: string; label: string; sub: string; href: string }
  | { kind: 'change'; id: string; label: string; sub: string; href: string };

const KIND_ICON: Record<Item['kind'], typeof FolderOpen> = {
  project: FolderOpen,
  requirement: ListChecks,
  change: FileText,
};

const KIND_LABEL: Record<Item['kind'], string> = {
  project: '项目',
  requirement: '需求',
  change: '变更',
};

function fuzzyMatch(target: string, query: string): boolean {
  if (!query.trim()) return true;
  return target.toLowerCase().includes(query.toLowerCase());
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const projects = useProjectStore((s) => s.projects);
  const requirements = useRequirementStore((s) => s.requirements);
  const changes = useChangeStore((s) => s.changes);
  const currentProjectId = useUIStore((s) => s.currentProjectId);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  // Global ⌘K / Ctrl+K opens; Escape closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Reset query/active row each time the palette opens, then focus input.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIdx(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const p of projects) {
      if (!fuzzyMatch(p.name, query)) continue;
      out.push({
        kind: 'project',
        id: p.id,
        label: p.name,
        sub: p.startDate ? `${p.startDate} 开始` : '项目',
        href: `/project/${p.id}`,
      });
    }
    // Requirements + changes are loaded per-project; only show them when the
    // user is inside a project so we don't surface stale data.
    if (currentProjectId) {
      for (const r of requirements) {
        if (!fuzzyMatch(r.name, query)) continue;
        out.push({
          kind: 'requirement',
          id: r.id,
          label: r.name,
          sub: `${r.currentDays}天 · 需求`,
          href: `/project/${currentProjectId}#req-${r.id}`,
        });
      }
      for (const c of changes) {
        const text = c.description || CHANGE_TYPE_LABELS[c.type] || '变更';
        if (!fuzzyMatch(text, query)) continue;
        out.push({
          kind: 'change',
          id: c.id,
          label: text,
          sub: `${c.date} · ${CHANGE_TYPE_LABELS[c.type]}`,
          href: `/project/${currentProjectId}#change-${c.id}`,
        });
      }
    }
    return out.slice(0, 30); // cap so keyboard nav stays snappy
  }, [projects, requirements, changes, query, currentProjectId]);

  const select = (item: Item) => {
    setOpen(false);
    navigate(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((idx) => Math.min(items.length - 1, idx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((idx) => Math.max(0, idx - 1));
    } else if (e.key === 'Enter') {
      const item = items[activeIdx];
      if (item) {
        e.preventDefault();
        select(item);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center bg-black/30 pt-[15vh]"
      style={{ zIndex: 'var(--z-command-palette)' }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
    >
      <div
        ref={trapRef}
        className="glass-panel-strong rounded-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200/60">
          <Search size={16} className="text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="搜索项目 / 需求 / 变更…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            data-testid="command-palette-input"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
            esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              {query.trim() ? '未找到匹配项' : '开始输入以搜索'}
            </div>
          ) : (
            items.map((item, i) => {
              const Icon = KIND_ICON[item.kind];
              const isActive = i === activeIdx;
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => select(item)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 ${
                    isActive ? 'bg-blue-100/70' : 'hover:bg-gray-100/60'
                  }`}
                  data-testid={`command-palette-item-${item.kind}`}
                  data-active={isActive ? 'true' : undefined}
                >
                  <Icon
                    size={14}
                    className={isActive ? 'text-blue-600' : 'text-gray-400'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">{item.label}</div>
                    <div className="text-[11px] text-gray-500 truncate">{item.sub}</div>
                  </div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {KIND_LABEL[item.kind]}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200/60 text-[10px] text-gray-500 bg-gray-50/50">
          <span>
            <kbd className="px-1 py-0.5 bg-white rounded font-mono">↑↓</kbd> 选择
            <kbd className="ml-2 px-1 py-0.5 bg-white rounded font-mono">↵</kbd> 跳转
          </span>
          <span>{items.length} 项结果</span>
        </div>
      </div>
    </div>
  );
}
