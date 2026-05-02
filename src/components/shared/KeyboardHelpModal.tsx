import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface Shortcut {
  keys: string[];
  label: string;
  group: 'global' | 'modal' | 'list';
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['⌘', 'K'], label: '打开命令面板（搜索项目/需求/变更）', group: 'global' },
  { keys: ['⌘', '⇧', 'C'], label: '记录变更', group: 'global' },
  { keys: ['⌘', 'Z'], label: '撤销最近一次变更删除', group: 'global' },
  { keys: ['?'], label: '显示快捷键帮助', group: 'global' },
  { keys: ['Esc'], label: '关闭当前弹窗 / 帮助', group: 'modal' },
  { keys: ['↑', '↓'], label: '在命令面板中切换选项', group: 'modal' },
  { keys: ['↵'], label: '在命令面板中跳转到选中项', group: 'modal' },
  { keys: ['Tab'], label: '在表单中按顺序聚焦', group: 'modal' },
];

const GROUP_LABEL: Record<Shortcut['group'], string> = {
  global: '全局',
  modal: '弹窗内',
  list: '列表内',
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * Keyboard shortcut cheat sheet, summoned by `?`. Linear / Notion / Slack
 * all ship one — Wave 2 商业级 baseline.
 */
export function KeyboardHelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Esc closes when open.
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      // `?` toggles when not typing. Note: `?` requires Shift on most layouts,
      // so check `e.key === '?'` rather than the keyCode.
      if (e.key === '?' && !isTypingTarget(e.target)) {
        // Don't compete with command palette / FAB chord (those use modifiers).
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  // Group shortcuts by category for the table.
  const groups = (Object.keys(GROUP_LABEL) as Shortcut['group'][])
    .map((g) => ({ key: g, items: SHORTCUTS.filter((s) => s.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40"
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="键盘快捷键"
      data-testid="keyboard-help-modal"
    >
      <div
        className="glass-panel-strong rounded-2xl w-full max-w-md mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">键盘快捷键</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 hover:bg-gray-100 rounded"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.key} className="mb-4 last:mb-0">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {GROUP_LABEL[g.key]}
            </div>
            <div className="space-y-1.5">
              {g.items.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{s.label}</span>
                  <span className="flex gap-1">
                    {s.keys.map((k, i) => (
                      <kbd
                        key={i}
                        className="px-1.5 py-0.5 text-xs font-mono rounded bg-gray-100 text-gray-700 border border-gray-200"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-4 pt-3 border-t border-gray-200/60 text-[11px] text-gray-500">
          按 <kbd className="px-1 py-0.5 font-mono rounded bg-gray-100 border border-gray-200">?</kbd> 随时打开此窗口
        </div>
      </div>
    </div>
  );
}
