import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import * as snapshotRepo from '../../db/snapshotRepo';
import { onDataChange } from '../../db/changeNotifier';
import type { Change, Snapshot } from '../../types';
import { CHANGE_TYPE_LABELS } from '../../constants/changeTypes';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface SnapshotHistoryProps {
  projectId: string;
  changes: Change[];
}

/**
 * Wave 3 W3.4 — historical snapshot panel.
 *
 * The engine has been writing one Snapshot per Change all along (see
 * snapshotManager.ts). This drawer surfaces them as a read-only timeline:
 * each row shows the totalDays AT THE TIME and the originating change. No
 * rollback button — viewing only — to keep the data model intact.
 */
export function SnapshotHistory({ projectId, changes }: SnapshotHistoryProps) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const changeMap = new Map(changes.map((c) => [c.id, c]));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      const rows = await snapshotRepo.getSnapshotsByProject(projectId);
      if (cancelled) return;
      setSnapshots(
        [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    }
    void load();
    const off = onDataChange(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [open, projectId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
        title="按时间顺序查看每次变更后的工期快照"
        data-testid="open-snapshot-history"
      >
        <History size={14} />
        时光机
      </button>

      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40"
          style={{ zIndex: 'var(--z-modal)' }}
          onClick={() => setOpen(false)}
        >
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label="历史快照"
            className="glass-panel-strong rounded-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            data-testid="snapshot-history-modal"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
              <h3 className="text-lg font-semibold text-gray-900">
                时光机 · 历史快照
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {snapshots.length} 条
                </span>
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4">
              {snapshots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  暂无快照 — 记录第一次变更后会自动生成
                </p>
              ) : (
                <ol className="relative border-l-2 border-gray-200 ml-2 space-y-3">
                  {snapshots.map((s, i) => {
                    const change = changeMap.get(s.changeId);
                    const time = new Date(s.createdAt).toLocaleString('zh-CN');
                    const isExpanded = expandedId === s.id;
                    const prev = snapshots[i + 1]; // older snapshot
                    const delta = prev ? s.totalDays - prev.totalDays : 0;
                    const deltaTxt =
                      delta > 0 ? `+${delta}天`
                      : delta < 0 ? `${delta}天`
                      : '工期不变';
                    const deltaTone =
                      delta > 0 ? 'text-red-600'
                      : delta < 0 ? 'text-green-600'
                      : 'text-gray-500';
                    return (
                      <li
                        key={s.id}
                        className="ml-4"
                        data-testid="snapshot-row"
                      >
                        <div className="absolute -left-[7px] mt-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="text-left w-full hover:bg-gray-50/60 -mx-2 px-2 py-1.5 rounded-lg"
                        >
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-medium tabular-nums">
                              {s.totalDays}天
                            </span>
                            <span className={`text-xs tabular-nums ${deltaTone}`}>
                              {prev ? deltaTxt : '初始'}
                            </span>
                            <span className="text-xs text-gray-500 ml-auto">{time}</span>
                          </div>
                          {change && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="text-gray-500 mr-1">
                                {CHANGE_TYPE_LABELS[change.type]}
                              </span>
                              {change.description}
                            </div>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 mb-1 rounded-lg bg-gray-50/60 p-3 text-xs text-gray-700">
                            <div className="font-semibold mb-1.5">需求状态：</div>
                            <ul className="space-y-0.5">
                              {s.data.requirements.slice(0, 12).map((r) => (
                                <li key={r.id} className="flex justify-between gap-2">
                                  <span className={r.status === 'cancelled' ? 'line-through text-gray-400' : ''}>
                                    {r.name}
                                    {r.status === 'paused' && ' ⏸'}
                                  </span>
                                  <span className="tabular-nums text-gray-500">
                                    {r.currentDays}天
                                  </span>
                                </li>
                              ))}
                              {s.data.requirements.length > 12 && (
                                <li className="text-gray-400">…以及其他 {s.data.requirements.length - 12} 条</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-200/60 text-[11px] text-gray-500">
              快照只读，不支持回滚 — 保护项目状态完整性
            </div>
          </div>
        </div>
      )}
    </>
  );
}
