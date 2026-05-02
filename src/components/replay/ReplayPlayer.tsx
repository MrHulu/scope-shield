import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

  // Full-viewport overlay portaled to <body> — true fullscreen feel, the
  // chart fills almost the entire screen instead of being squeezed into a
  // dialog at the same width as the regular ProjectPage chart panel.
  return createPortal(
    <div
      className="fixed inset-0 app-backdrop overflow-auto"
      style={{ zIndex: 'var(--z-modal)' }}
      role="dialog"
      aria-modal="true"
      aria-label="变更回放"
      data-testid="replay-player"
    >
      <div ref={trapRef} className="min-h-screen flex flex-col">
        {/* Header — title + frame info + close */}
        <div className="flex items-center justify-between gap-4 px-8 py-4 border-b border-gray-200/40 bg-white/40 backdrop-blur-md flex-wrap">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">变更回放</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              空格键播放/暂停 · Esc 退出
            </p>
          </div>
          {!noData && (
            <div className="text-sm text-gray-700 flex items-center gap-3 min-w-0" data-testid="replay-frame-label">
              <span className="font-semibold tabular-nums text-base">
                帧 {frame} / {maxFrame}
              </span>
              <span className="text-gray-400">·</span>
              {frame === 0 ? (
                <span className="text-gray-500">原计划 · {view.schedule.totalDays} 天</span>
              ) : (
                <span className="text-gray-700 truncate">
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
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stage — chart fills all available height. */}
        <div className="flex-1 flex items-center justify-center px-8 py-6">
          {noData ? (
            <p className="text-base text-gray-400 text-center">
              暂无快照 — 记录变更后会自动累积。当前项目还没有任何变更。
            </p>
          ) : (
            <div className="w-full max-w-7xl mx-auto">
              <SimpleChart
                requirements={view.requirements}
                changes={view.changes}
                schedule={view.schedule}
              />
            </div>
          )}
        </div>

        {/* Controls — sticky at bottom of viewport. */}
        {!noData && (
          <div className="border-t border-gray-200/40 bg-white/50 backdrop-blur-md px-8 py-4 flex items-center gap-4 sticky bottom-0">
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
              <ChevronsLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="p-2.5 hover:bg-gray-100 rounded-full text-gray-700 bg-gray-100/60"
              aria-label={playing ? '暂停' : '播放'}
              data-testid="replay-toggle"
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
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
            <span className="text-xs text-gray-500 tabular-nums shrink-0 w-20 text-right">
              {frame}/{maxFrame}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
