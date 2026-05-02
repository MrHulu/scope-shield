import { useState } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export type ExportMode = 'single' | 'comparison';

interface ExportModalProps {
  open: boolean;
  onExport: (width: number, mode: ExportMode) => void;
  onClose: () => void;
  exporting: boolean;
}

type Preset = 'mobile' | 'desktop' | 'custom';

export function ExportModal({ open, onExport, onClose, exporting }: ExportModalProps) {
  const [preset, setPreset] = useState<Preset>('mobile');
  const [customWidth, setCustomWidth] = useState('600');
  const [mode, setMode] = useState<ExportMode>('single');
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  if (!open) return null;

  const baseWidth =
    preset === 'mobile'
      ? 390
      : preset === 'desktop'
        ? 800
        : Math.max(200, Math.min(2000, parseInt(customWidth) || 390));

  // Comparison mode renders two panels side-by-side, so it needs roughly
  // double the canvas. Cap at 1600 so absurd custom widths don't blow up.
  const width = mode === 'comparison' ? Math.min(baseWidth * 2 + 32, 1600) : baseWidth;

  const handleExport = () => {
    onExport(width, mode);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40"
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="导出图片"
        className="glass-panel-strong rounded-2xl w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <h3 className="text-lg font-semibold text-gray-900">导出图片</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-3">
          <label className="text-xs text-gray-500">导出模式</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 text-sm rounded-lg px-3 py-2 border ${
                mode === 'single'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              当前状态
            </button>
            <button
              type="button"
              onClick={() => setMode('comparison')}
              className={`flex-1 text-sm rounded-lg px-3 py-2 border ${
                mode === 'comparison'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              data-testid="export-mode-comparison"
            >
              原计划 vs 实际
            </button>
          </div>

          <label className="text-xs text-gray-500 mt-2">单图尺寸</label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="preset"
              checked={preset === 'mobile'}
              onChange={() => setPreset('mobile')}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-700">手机 (390px)</span>
            <span className="text-xs text-gray-400 ml-auto">默认</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="preset"
              checked={preset === 'desktop'}
              onChange={() => setPreset('desktop')}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-700">桌面 (800px)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="preset"
              checked={preset === 'custom'}
              onChange={() => setPreset('custom')}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-700">自定义</span>
            {preset === 'custom' && (
              <div className="flex items-center gap-1 ml-2">
                <input
                  type="number"
                  min={200}
                  max={2000}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  className="w-20 text-sm border border-gray-200 rounded px-2 py-1"
                />
                <span className="text-xs text-gray-400">px</span>
              </div>
            )}
          </label>

          {mode === 'comparison' && (
            <p className="text-[11px] text-gray-500 mt-1">
              对比模式输出两栏并排（{width}px），适合钉钉/飞书汇报
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200/60">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 px-4 py-2 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-sm text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {exporting ? '导出中...' : '导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
