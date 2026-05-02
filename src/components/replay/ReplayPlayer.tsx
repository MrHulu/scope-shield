import { useEffect, useMemo, useState } from 'react';
import { Play, Pause, X, ChevronsLeft } from 'lucide-react';
import * as snapshotRepo from '../../db/snapshotRepo';
import type { Change, Requirement, Snapshot } from '../../types';
import { SimpleChart } from '../chart/SimpleChart';
import { schedule as computeSchedule, computeOriginalTotalDays } from '../../engine/scheduler';
import { CHANGE_TYPE_LABELS } from '../../constants/changeTypes';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ReplayPlayerProps {
  open: boolean;
  projectId: string;
  requirements: Requirement[];
  changes: Change[];
  onClose: () => void;
}

const FRAME_MS = 1100;

/**
 * Wave 4 W4.3 — replay animation. Reads the engine's per-change snapshots
 * and lets the user scrub a timeline to see the project's totalDays
 * evolution. No engine changes needed — snapshots have always existed.
 *
 * Frame model:
 *   frame 0  = baseline (before any change)
 *   frame i  = state right after the i-th change (= snapshots[i-1])
 *
 * The chart at each frame is built from the snapshot's `requirements`
 * field; we re-derive the schedule via `computeSchedule()` so we don't
 * have to trust the snapshot's `data.schedule.criticalPath` (older
 * snapshots may predate the critical-path field).
 */
export function ReplayPlayer({ open, projectId, requirements, changes, onClose }: ReplayPlayerProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const rows = await snapshotRepo.getSnapshotsByProject(projectId);
      if (cancelled) return;
      setSnapshots([...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setFrame(0);
      setPlaying(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Auto-advance when playing.
  useEffect(() => {
    if (!playing) return;
    const tick = setInterval(() => {
      setFrame((f) => {
        const max = snapshots.length;
        if (f >= max) {
          setPlaying(false);
          return f;
        }
        return f + 1;
      });
    }, FRAME_MS);
    return () => clearInterval(tick);
  }, [playing, snapshots.length]);

  // Sort changes the same way the replay engine does (date+createdAt asc)
  const orderedChanges = useMemo(
    () =>
      [...changes].sort(
        (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
      ),
    [changes],
  );

  // Build the per-frame view. Frame 0 = baseline; frame i = post-change i.
  const view = useMemo(() => {
    if (frame === 0 || snapshots.length === 0) {
      // Baseline: original requirements at originalDays, no changes applied.
      const baselineReqs = requirements
        .filter((r) => !r.isAddedByChange)
        .map((r) => ({
          ...r,
          currentDays: r.originalDays,
          status: 'active' as const,
          pausedRemainingDays: null,
        }));
      const sched = computeSchedule(baselineReqs);
      const original = computeOriginalTotalDays(baselineReqs);
      return {
        requirements: baselineReqs,
        changes: [] as Change[],
        schedule: { ...sched, originalTotalDays: original },
        triggerChange: null as Change | null,
      };
    }
    const snap = snapshots[Math.min(frame - 1, snapshots.length - 1)];
    const snapReqs: Requirement[] = snap.data.requirements.map((r) => ({
      ...r,
      projectId,
      isAddedByChange: r.isAddedByChange ?? false,
      createdAt: snap.createdAt,
      updatedAt: snap.createdAt,
    }));
    const sched = computeSchedule(snapReqs);
    const original = computeOriginalTotalDays(snapReqs);
    const triggerChange = orderedChanges.find((c) => c.id === snap.changeId) ?? null;
    return {
      requirements: snapReqs,
      changes: orderedChanges.slice(0, frame),
      schedule: { ...sched, originalTotalDays: original },
      triggerChange,
    };
  }, [frame, snapshots, requirements, orderedChanges, projectId]);

  if (!open) return null;

  const maxFrame = snapshots.length;
  const noData = snapshots.length === 0;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="变更回放"
      data-testid="replay-player"
    >
      <div
        ref={trapRef}
        className="glass-panel-strong rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <div>
            <h3 className="text-base font-semibold text-gray-900">变更回放</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              空格键播放/暂停 · Esc 退出
            </p>
          </div>
          <button onClick={onClose} aria-label="关闭" className="p-1 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {noData ? (
            <p className="text-sm text-gray-400 text-center py-12">
              暂无快照 — 记录变更后会自动累积。当前项目还没有任何变更。
            </p>
          ) : (
            <>
              <div className="mb-3 text-sm text-gray-700 flex items-center gap-3" data-testid="replay-frame-label">
                <span className="font-medium tabular-nums">
                  帧 {frame} / {maxFrame}
                </span>
                {frame === 0 ? (
                  <span className="text-gray-500">原计划 · {view.schedule.totalDays} 天</span>
                ) : (
                  <span className="text-gray-700">
                    当前 {view.schedule.totalDays} 天
                    {view.triggerChange && (
                      <>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-gray-500">
                          {CHANGE_TYPE_LABELS[view.triggerChange.type]} · {view.triggerChange.description}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <SimpleChart
                requirements={view.requirements}
                changes={view.changes}
                schedule={view.schedule}
              />
            </>
          )}
        </div>

        {!noData && (
          <div className="border-t border-gray-200/60 px-6 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFrame(0);
                setPlaying(false);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
              aria-label="回到开始"
              data-testid="replay-restart"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
              aria-label={playing ? '暂停' : '播放'}
              data-testid="replay-toggle"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={maxFrame}
              value={frame}
              onChange={(e) => {
                setFrame(parseInt(e.target.value, 10));
                setPlaying(false);
              }}
              className="flex-1"
              data-testid="replay-slider"
              aria-label="时间轴"
            />
            <span className="text-[11px] text-gray-500 tabular-nums shrink-0 w-16 text-right">
              {frame}/{maxFrame}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
