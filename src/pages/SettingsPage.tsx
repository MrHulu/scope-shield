import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportAllData, importData } from '../db/exportImport';
import { useProjectStore } from '../stores/projectStore';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { showToast } from '../components/shared/Toast';

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  const handleExportJson = async () => {
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `scope-shield-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('数据已导出');
    } catch {
      showToast('导出失败', 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowConfirm(true);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    try {
      const text = await pendingFile.text();
      const data = JSON.parse(text);
      await importData(data);
      await loadProjects();
      showToast('数据已导入');
    } catch (err) {
      showToast(`导入失败：${(err as Error).message}`, 'error');
    } finally {
      setPendingFile(null);
      setShowConfirm(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">设置</h1>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {/* Export */}
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-gray-900">导出数据</div>
              <div className="text-xs text-gray-400 mt-0.5">下载所有项目数据为 JSON 文件</div>
            </div>
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              <Download size={14} />
              导出
            </button>
          </div>

          {/* Import */}
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium text-gray-900">导入数据</div>
              <div className="text-xs text-gray-400 mt-0.5">从 JSON 文件恢复，将覆盖当前所有数据</div>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              <Upload size={14} />
              导入
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        <ConfirmDialog
          open={showConfirm}
          title="导入数据"
          message="导入将覆盖当前所有数据，是否继续？"
          destructive
          confirmLabel="确定导入"
          onConfirm={handleImport}
          onCancel={() => {
            setShowConfirm(false);
            setPendingFile(null);
          }}
        />
      </div>
    </div>
  );
}
