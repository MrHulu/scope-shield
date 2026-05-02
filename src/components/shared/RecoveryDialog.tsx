import { useEffect } from 'react';
import type { AutoBackup } from '../../db/autoBackup';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface RecoveryDialogProps {
  open: boolean;
  backup: AutoBackup;
  onRestore: () => void;
  onDownload: () => void;
  onSkip: () => void;
}

export function RecoveryDialog({
  open,
  backup,
  onRestore,
  onDownload,
  onSkip,
}: RecoveryDialogProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onSkip]);

  if (!open) return null;

  const time = new Date(backup.createdAt).toLocaleString('zh-CN');

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40"
      style={{ zIndex: 'var(--z-modal)' }}
    >
      <div
        ref={trapRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="数据恢复"
        className="glass-panel-strong rounded-2xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-1">检测到历史数据</h3>
        <p className="text-sm text-gray-500 mb-4">
          当前数据库为空，但发现一份自动备份，是否恢复？
        </p>

        <div className="bg-gray-50 rounded-lg px-4 py-3 mb-5 text-sm text-gray-700 space-y-1">
          <div>备份时间：{time}</div>
          <div>项目数：{backup.projectCount}</div>
          <div>需求数：{backup.requirementCount}</div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onRestore}
            className="w-full px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
          >
            恢复备份
          </button>
          <button
            onClick={onDownload}
            className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            下载备份文件
          </button>
          <button
            onClick={onSkip}
            className="w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            从零开始
          </button>
        </div>
      </div>
    </div>
  );
}
