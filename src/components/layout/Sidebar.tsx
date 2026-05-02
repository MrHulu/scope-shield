import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Archive, Shield, Copy } from 'lucide-react';
import type { Project } from '../../types';
import { LocalStorageBadge } from './LocalStorageBadge';
import { ThemeToggle } from './ThemeToggle';
import { useAllProjectStats } from '../../hooks/useAllProjectStats';
import { PROJECT_TEMPLATES, type ProjectTemplate } from '../../constants/projectTemplates';
import { useProjectStore } from '../../stores/projectStore';

interface SidebarProps {
  projects: Project[];
  currentProjectId: string | null;
  onCreateProject: (name: string, startDate: string) => Promise<Project>;
  onDuplicateProject?: (sourceId: string) => Promise<Project | null>;
}

export function Sidebar({ projects, currentProjectId, onCreateProject, onDuplicateProject }: SidebarProps) {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [templateId, setTemplateId] = useState<string>(''); // '' = blank project
  const createFromTemplate = useProjectStore((s) => s.createFromTemplate);

  const active = projects.filter((p) => p.status === 'active');
  const archived = projects.filter((p) => p.status === 'archived');
  // W2.7 — colored inflation chip per project. Computed live; updates as the
  // user records changes via the changeNotifier hook.
  const projectStats = useAllProjectStats(active);

  function inflationChip(projectId: string): JSX.Element | null {
    const s = projectStats.get(projectId);
    if (!s || s.inflationRate === null) return null;
    const tone =
      s.inflationRate > 20
        ? 'bg-red-100 text-red-700'
        : s.inflationRate > 0
          ? 'bg-amber-100 text-amber-700'
          : s.inflationRate < 0
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-gray-100 text-gray-500';
    const sign = s.inflationRate > 0 ? '+' : '';
    return (
      <span
        data-testid={`project-inflation-${projectId}`}
        data-inflation={s.inflationRate}
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums ${tone}`}
      >
        {sign}{s.inflationRate}%
      </span>
    );
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    const tpl: ProjectTemplate | undefined =
      templateId ? PROJECT_TEMPLATES.find((t) => t.id === templateId) : undefined;
    const project = tpl
      ? await createFromTemplate(tpl, { name: name.trim(), startDate })
      : await onCreateProject(name.trim(), startDate);
    setName('');
    setTemplateId('');
    setShowForm(false);
    navigate(`/project/${project.id}`);
  };

  return (
    <aside className="w-64 glass-panel-tinted flex flex-col h-full">
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
              {/* W4.2 — pick a template (or leave blank for empty project) */}
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 mb-2 focus:outline-none focus:border-blue-400"
                data-testid="project-template-select"
              >
                <option value="">空白项目（不预填）</option>
                {PROJECT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.requirements.length} 条
                  </option>
                ))}
              </select>
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
            <div
              key={p.id}
              className={`group relative flex items-center rounded-lg mb-0.5 ${
                p.id === currentProjectId
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <button
                onClick={() => navigate(`/project/${p.id}`)}
                className="flex-1 min-w-0 text-left text-sm px-3 py-2 flex items-center gap-2"
              >
                <FolderOpen size={14} />
                <span className="truncate flex-1">{p.name}</span>
                {p.isDemo && <span className="text-[10px] text-gray-400">Demo</span>}
                {inflationChip(p.id)}
              </button>
              {onDuplicateProject && (
                <button
                  type="button"
                  data-testid={`project-duplicate-${p.id}`}
                  aria-label={`复制 ${p.name}`}
                  title="复制项目结构"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const created = await onDuplicateProject(p.id);
                    if (created) navigate(`/project/${created.id}`);
                  }}
                  className="opacity-0 group-hover:opacity-100 mr-1 p-1 text-gray-400 hover:text-gray-700 hover:bg-white/60 rounded"
                >
                  <Copy size={12} />
                </button>
              )}
            </div>
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
      <div className="p-3 border-t border-gray-200/60 space-y-2">
        <LocalStorageBadge />
        <ThemeToggle />
        <button
          onClick={() => navigate('/settings')}
          className="w-full text-left text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100/60"
        >
          设置
        </button>
      </div>
    </aside>
  );
}
