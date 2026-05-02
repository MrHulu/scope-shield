# Wave 5 Triage · Scope Shield 从单项目工具进阶为跨项目平台

> 来源：Wave 4 暴露的"demo 无法演示回放"+"逾期 chip 没有真实数据"+"协作场景缺失"
> 6 项 · 约 4 工作日 · 4 阶段
> Wave 4 收口：9/9 落地 + 257 unit + 17/17 走查

## Wave 5 主题

**从单项目工具进阶为跨项目平台**。前 4 波把单项目体验打到商业级 baseline；
Wave 5 把视角拉高一档：项目目标层 + 跨项目 Analytics + 真实可演示 demo +
对外协作能力（只读分享）+ 移动端 baseline。

## Wave 5 候选与决策

| 候选 | 决定 | 理由 |
|---|---|---|
| Demo 走真实 changeService | ✅ 收 | Wave 4 走查 finding |
| 项目目标交付日 + 逾期识别 | ✅ 收 | 解锁 W4.8 真实场景 |
| 跨项目 Analytics 页面 | ✅ 收 | 用户呼声 |
| 移动端 responsive | ✅ 收 | 商业级 baseline |
| 只读分享链接 | ✅ 收 | 协作场景 |
| PDF 导出 | ❌ 砍 | 现有 PNG 已覆盖分享场景，jsPDF 250KB 边际收益低 |
| Onboarding tour | ❌ 砍 | EmptyState 已覆盖 first-time UX |

## Wave 5 全量 6 项（约 4 天）

### 🎯 Phase 1 · 项目目标层（2 项 · 1.5 天）

#### W5.1 · 项目目标交付日（targetEndDate）+ 项目级逾期识别
- **位置**：`Project.targetEndDate?: string`；ProjectHeader 加目标日字段；Sidebar 加红角标
- **目标**：让 W4.8 chip 真正发挥作用 — 用户主动设定预计交付日，超过即整体红条
- **改动**：
  1. types/index.ts: `Project.targetEndDate?: string | null`
  2. ProjectHeader: 编辑面板加"目标交付日"date 输入；当前日 > 目标 → 红色"已逾期 X 天" chip
  3. Sidebar: 项目名旁红圆点（项目级超期）
  4. ChangeRow 的 W4.8 chip 改成对照 `targetEndDate ?? stats.endDate`
- **测试**：unit + e2e 设目标 → 超期 chip 渲染
- **工作量**：M (1d)

#### W5.2 · Demo 项目升级（走真实 changeService）
- **位置**：`src/utils/seedDemo.ts` 或等价位置
- **目标**：让 demo 的回放、snapshot 历史、逾期 chip 都能演示
- **改动**：
  1. demo seed 不再 directWrite changes，改为按时间序调用 `recordChange`
  2. 加 1-2 条故意超期的变更（date 设为 targetEndDate 后）
- **测试**：e2e demo 项目 → 回放 dialog 帧标签非空 + 逾期 chip 数 ≥ 1
- **工作量**：S (0.5d)

### 📊 Phase 2 · 跨项目能力（1 项 · 1 天）

#### W5.3 · 跨项目 Analytics 页面 `/analytics`
- **位置**：新建 `src/pages/AnalyticsPage.tsx` + Sidebar"数据看板"入口
- **目标**：管理多个项目时的全局视角 — 累计变更 / 平均膨胀率 / tag 分布 top 5
- **改动**：
  1. 路由 `/analytics`
  2. 卡片式布局：
     - 项目总数 / 进行中 / 已归档
     - 累计变更数 / 累计 +天数 / 平均膨胀率
     - Tag 分布柱状图（top 5）
     - 最易超期项目 top 3（按 `(now - targetEndDate)` 排序）
  3. 每张卡片 click → 跳转对应项目（带筛选）
- **测试**：unit 测 aggregator；e2e 进 /analytics → 卡片渲染
- **工作量**：L (1d)

### 🤝 Phase 3 · 对外协作（1 项 · 0.5 天）

#### W5.4 · 只读分享链接（state encode 到 URL fragment）
- **位置**：新建 `src/services/shareLink.ts`；ProjectHeader 加"分享只读"按钮
- **目标**：把当前项目状态序列化到 URL，对方打开看到一样的视图（不能编辑）
- **改动**：
  1. 序列化：`btoa(JSON.stringify({project, requirements, changes}))` → URL fragment
  2. App.tsx: 检测 `#share=...` → 渲染只读视图（隐藏所有编辑/删除/CTA）
  3. 显眼"只读模式" banner + "复制为我的项目" CTA
- **测试**：unit encode/decode roundtrip；e2e 生成链接 → 只读 banner 可见
- **工作量**：S (0.5d)

### 📱 Phase 4 · 移动端 + 收口（2 项 · 1.5 天）

#### W5.5 · 移动端 responsive baseline
- **位置**：`Sidebar.tsx` (drawer)、`ChartArea.tsx` (overflow-x)、`FloatingCTA.tsx` (位置)
- **目标**：375 / 768 width 不破坏 happy path
- **改动**：
  1. Sidebar: 在 `md:` 断点下显示，<md 转抽屉（Hamburger 触发）
  2. ChartArea: 横向滚动 wrapper，时间轴最小宽度 600
  3. ProjectHeader: 信息卡片 grid 折叠成 1 列
  4. FAB: <md 时贴底部居中
- **测试**：e2e 切 375×667 viewport → 抽屉触发 + chart 滚动 + 不破坏首屏
- **工作量**：M (1d)

#### W5.6 · Wave 5 走查 + 收口报告
- **位置**：`.review/wave5-walkthrough.mjs/.md/.json` + `.review/wave5-shots/`
- **工作量**：S (0.5d)

## 完成顺序

W5.1 目标日 → W5.2 demo 升级 → W5.4 分享链接 → W5.3 Analytics → W5.5 移动端 → W5.6 走查

## Wave 5 工作量预算

| 阶段 | 项数 | 估时 |
|---|---|---|
| Phase 1 项目目标层 | 2 | 1.5d |
| Phase 2 跨项目 | 1 | 1d |
| Phase 3 对外协作 | 1 | 0.5d |
| Phase 4 移动端 + 收口 | 2 | 1.5d |
| 合计 | 6 | 4.5d |
