import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, AlertTriangle, Tag, TrendingUp } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { getRequirementsByProject } from '../db/requirementRepo';
import { getChangesByProject } from '../db/changeRepo';
import { computeAnalytics, type AnalyticsSummary } from '../services/analytics';
import { TAG_COLORS, type ChangeTag } from '../constants/changeTags';

/**
 * Wave 5 W5.3 — cross-project analytics. Pulls requirements + changes for
 * every project once on mount and runs the aggregator. No persistent state;
 * the page recomputes whenever the user navigates back to it.
 */
export function AnalyticsPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await Promise.all(
        projects.map(async (project) => ({
          project,
          requirements: await getRequirementsByProject(project.id),
          changes: await getChangesByProject(project.id),
        })),
      );
      if (cancelled) return;
      setSummary(computeAnalytics(data));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        加载中...
      </div>
    );
  }

  const inflationDisplay =
    summary.avgInflationRate === null
      ? '—'
      : `${summary.avgInflationRate > 0 ? '+' : ''}${summary.avgInflationRate}%`;

  const inflationTone =
    summary.avgInflationRate === null
      ? 'text-gray-400'
      : summary.avgInflationRate > 20
        ? 'text-red-600'
        : summary.avgInflationRate > 0
          ? 'text-amber-600'
          : 'text-green-600';

  const maxTagCount = summary.topTags[0]?.count ?? 1;

  return (
    <div className="h-full overflow-y-auto" data-testid="analytics-page">
      <div className="max-w-5xl mx-auto py-6 px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-600" />
            数据看板
          </h1>
          <p className="text-sm text-gray-500 mt-1">跨项目累计指标 · 实时计算</p>
        </div>

        {/* 顶部 KPI 卡 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPI label="项目总数" value={summary.projectCount} sub={`进行中 ${summary.activeCount} / 已归档 ${summary.archivedCount}`} testid="kpi-project-count" />
          <KPI
            label="平均膨胀率"
            value={inflationDisplay}
            tone={inflationTone}
            sub="基于进行中项目"
            testid="kpi-avg-inflation"
          />
          <KPI label="累计变更" value={summary.totalChanges} sub="所有项目合计" testid="kpi-total-changes" />
          <KPI label="累计 +天数" value={summary.totalDaysAdded} sub="正向 daysDelta 之和" testid="kpi-total-days" />
        </div>

        {/* 按项目排行 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Panel
            title="逾期项目 Top 3"
            icon={<AlertTriangle size={14} className="text-red-500" />}
            empty={summary.topOverdue.length === 0 ? '没有逾期的进行中项目 — 都按计划交付' : null}
            testid="panel-top-overdue"
          >
            {summary.topOverdue.map((p) => (
              <button
                key={p.projectId}
                type="button"
                onClick={() => navigate(`/project/${p.projectId}`)}
                className="w-full flex items-center justify-between text-sm py-1.5 px-2 hover:bg-gray-50 rounded"
                data-testid={`overdue-row-${p.projectId}`}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-red-600 font-medium tabular-nums shrink-0 ml-2">
                  {p.overdueBy} 天
                </span>
              </button>
            ))}
          </Panel>

          <Panel
            title="标签分布 Top 5"
            icon={<Tag size={14} className="text-blue-500" />}
            empty={summary.topTags.length === 0 ? '尚无变更打标签' : null}
            testid="panel-top-tags"
          >
            {summary.topTags.map(({ tag, count }) => {
              const tone = TAG_COLORS[tag as ChangeTag] ?? 'bg-gray-100 text-gray-600';
              return (
                <div key={tag} className="flex items-center gap-2 py-1">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tone} shrink-0`}>{tag}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400"
                      style={{ width: `${(count / maxTagCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums w-6 text-right">{count}</span>
                </div>
              );
            })}
          </Panel>
        </div>

        {/* 全部项目（按膨胀率排序） */}
        <Panel
          title="全部项目"
          icon={<TrendingUp size={14} className="text-blue-500" />}
          testid="panel-all-projects"
        >
          <div className="text-[11px] text-gray-400 px-2 py-1 grid grid-cols-12 gap-2 border-b border-gray-200/60">
            <span className="col-span-5">名称</span>
            <span className="col-span-2 text-right">膨胀率</span>
            <span className="col-span-2 text-right">变更</span>
            <span className="col-span-2 text-right">+天数</span>
            <span className="col-span-1 text-right">逾期</span>
          </div>
          {[...summary.perProject]
            .sort((a, b) => (b.inflationRate ?? -999) - (a.inflationRate ?? -999))
            .map((p) => (
              <button
                key={p.projectId}
                type="button"
                onClick={() => navigate(`/project/${p.projectId}`)}
                className="w-full grid grid-cols-12 gap-2 text-sm py-1.5 px-2 hover:bg-gray-50 rounded items-center"
                data-testid={`project-row-${p.projectId}`}
              >
                <span className="col-span-5 truncate text-left flex items-center gap-1.5">
                  {p.name}
                  {p.status === 'archived' && (
                    <span className="text-[10px] text-gray-400">归档</span>
                  )}
                </span>
                <span className={`col-span-2 text-right tabular-nums ${
                  p.inflationRate === null ? 'text-gray-400'
                    : p.inflationRate > 20 ? 'text-red-600'
                      : p.inflationRate > 0 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {p.inflationRate === null ? '—' : `${p.inflationRate > 0 ? '+' : ''}${p.inflationRate}%`}
                </span>
                <span className="col-span-2 text-right text-gray-600 tabular-nums">{p.totalChanges}</span>
                <span className="col-span-2 text-right text-gray-600 tabular-nums">{p.totalDaysAdded}</span>
                <span className="col-span-1 text-right text-red-600 tabular-nums">
                  {p.overdueBy && p.overdueBy > 0 ? `${p.overdueBy}d` : ''}
                </span>
              </button>
            ))}
        </Panel>
      </div>
    </div>
  );
}

function KPI({
  label, value, tone, sub, testid,
}: {
  label: string;
  value: string | number;
  tone?: string;
  sub: string;
  testid: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-3" data-testid={testid}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-semibold mt-0.5 tabular-nums ${tone ?? 'text-gray-900'}`}>{value}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function Panel({
  title, icon, children, empty, testid,
}: {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  empty?: string | null;
  testid?: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-4" data-testid={testid}>
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
        {icon}{title}
      </h3>
      {empty ? <p className="text-xs text-gray-400 py-3 text-center">{empty}</p> : <div>{children}</div>}
    </div>
  );
}
