import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Archive, Shield } from 'lucide-react';
import type { Project } from '../../types';

interface SidebarProps {
  projects: Project[];
  currentProjectId: string | null;
  onCreateProject: (name: string, startDate: string) => Promise<Project>;
}

export function Sidebar({ projects, currentProjectId, onCreateProject }: SidebarProps) {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const active = projects.filter((p) => p.status === 'active');
  const archived = projects.filter((p) => p.status === 'archived');

  const handleCreate = async () => {
    if (!name.trim()) return;
    const project = await onCreateProject(name.trim(), startDate);
    setName('');
    setShowForm(false);
    navigate(`/project/${project.id}`);
  };

  return (
    <aside className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-2">
        <Shield size={20} className="text-blue-600" />
        <span className="font-semibold text-gray-900 text-sm">Scope Shield</span>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto">
        {/* Active */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">进行中</span>
            <button
              onClick={() => setShowForm(true)}
              className="p-1 hover:bg-gray-200 rounded text-gray-500"
              title="新建项目"
            >
              <Plus size={14} />
            </button>
          </div>

          {showForm && (
            <div className="mb-2 p-2 bg-white rounded-lg border border-gray-200">
              <input
                type="text"
                placeholder="项目名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1 mb-1.5 focus:outline-none focus:border-blue-400"
                autoFocus
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1 mb-2 focus:outline-none focus:border-blue-400"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleCreate}
                  className="flex-1 text-xs bg-blue-600 text-white rounded py-1 hover:bg-blue-700"
                >
                  创建
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 text-xs text-gray-600 rounded py-1 hover:bg-gray-100"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {active.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/project/${p.id}`)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg mb-0.5 flex items-center gap-2 ${
                p.id === currentProjectId
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FolderOpen size={14} />
              <span className="truncate">{p.name}</span>
              {p.isDemo && <span className="text-[10px] text-gray-400">Demo</span>}
            </button>
          ))}

          {active.length === 0 && !showForm && (
            <p className="text-xs text-gray-400 px-3 py-2">暂无项目</p>
          )}
        </div>

        {/* Archived */}
        {archived.length > 0 && (
          <div className="p-3 border-t border-gray-200">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">已归档</span>
            {archived.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg mb-0.5 flex items-center gap-2 text-gray-500 hover:bg-gray-100 ${
                  p.id === currentProjectId ? 'bg-gray-200' : ''
                }`}
              >
                <Archive size={14} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={() => navigate('/settings')}
          className="w-full text-left text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          设置
        </button>
      </div>
    </aside>
  );
}
