import { useRef, useState, useEffect } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportAllData, importData } from '../db/exportImport';
import { useProjectStore } from '../stores/projectStore';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { showToast } from '../components/shared/Toast';
import { checkProxyStatus } from '../services/feishuSettings';
import { getBackupTime } from '../db/autoBackup';

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [proxyOk, setProxyOk] = useState<boolean | null>(null);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  useEffect(() => {
    checkProxyStatus().then(setProxyOk);
  }, []);

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

          {/* Auto-backup status */}
          <div className="px-6 py-4">
            <div className="text-sm font-medium text-gray-900">自动备份</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {(() => {
                const t = getBackupTime();
                return t
                  ? `上次备份：${new Date(t).toLocaleString('zh-CN')}`
                  : '暂无自动备份';
              })()}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mt-4">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-900">飞书项目</div>
            <div className="text-xs text-gray-400 mt-0.5">粘贴飞书需求 URL 时自动读取名称、负责人和工期</div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${
                proxyOk === null ? 'bg-gray-300' : proxyOk ? 'bg-green-500' : 'bg-red-400'
              }`} />
              <span className="text-sm text-gray-700">
                {proxyOk === null ? '检测中…' : proxyOk ? '本地代理可用' : '本地代理不可用'}
              </span>
            </div>
            <button
              onClick={() => { setProxyOk(null); checkProxyStatus().then(setProxyOk); }}
              className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
            >
              重新检测
            </button>
          </div>
          {proxyOk === false && (
            <div className="px-6 pb-4">
              <p className="text-xs text-gray-400">
                需要 <code className="bg-gray-100 px-1 rounded">npm run dev</code> 启动开发服务器，并确保本地浏览器 Cookie 有效。
              </p>
            </div>
          )}
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
