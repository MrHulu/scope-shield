# Wave 4 Triage · Scope Shield 商业级别打磨深化（续）

> 来源：Wave 3 残留候选 + 用户呼声 + 项目级数据生命周期增强
> 9 项 · 约 6 工作日 · 4 阶段执行
> Wave 3 收口：9/9 落地 + 253 unit + 87/88 e2e + 13/13 走查

## Wave 4 候选来源

| 项 | 来源 |
|---|---|
| CSV 反向导出 | Wave 3 候选 — 已支持导入但无导出 |
| 项目模板 5 个内置 | 用户呼声高 — 减少新建项目时的空白页焦虑 |
| 变更回放动画 | engine 已有 replay 逻辑，UI 未暴露时间轴 |
| 变更原因分类标签 | Wave 2/3 候选剩余 — 老板汇报场景刚需 |
| 批量删除变更 | Wave 3 候选 — 50+ 变更后必需 |
| 筛选条件 URL 同步 | W3.6 状态丢失 — power-user 痛点 |
| 暗色 polish | W2.3 carry-over — 暗色下导出 + kbd 颜色未优化 |
| 变更 due-date 警告 | 新增 — 变更日期超过预计完工 → 红条提醒 |

## Wave 4 全量 9 项（约 6 天）

### 📤 Phase 1 · 数据生命周期增强（3 项 · 2 天）

#### W4.1 · CSV 反向导出（项目 → CSV）
- **位置**：扩展 `src/services/bulkImporter.ts` 加 `exportToCsv()`；ProjectHeader 加「CSV 导出」按钮
- **目标**：把当前项目的需求结构以 CSV 格式下载，用于 Excel/Notion 编辑后再导入
- **改动**：CSV 列：name, days, dependsOn, status；UTF-8 BOM 让 Excel 正确显示中文；文件名 `{projectName}-requirements-YYYY-MM-DD.csv`
- **测试**：unit 测 csv 头/转义/UTF-8 BOM；e2e 点导出 → 下载文件名匹配
- **工作量**：S (0.5d)

#### W4.2 · 项目模板（5 个内置）
- **位置**：新建 `src/constants/projectTemplates.ts`；Sidebar 新建项目时加「使用模板」选择
- **目标**：减少新建项目空白页焦虑 — 一键创建预填好的项目骨架
- **改动**：5 个模板：移动 App 0→1 / SaaS Dashboard / 内部工具 / 数据看板 / E-commerce 后台。每个模板含 6-10 条需求（带 dependsOn 链）
- **测试**：unit 测 template metadata + apply；e2e 选模板 → 项目创建 + 需求列表非空
- **工作量**：M (1d)

#### W4.3 · 变更回放动画
- **位置**：新建 `src/components/replay/ReplayPlayer.tsx`；ChartArea 加「▶ 回放」按钮
- **目标**：暴露 engine 已有 replay 逻辑 — 时间轴拖动看每次变更后的工期变化
- **改动**：
  1. 横向时间轴 + 进度条 + ▶/⏸ 按钮
  2. 拖动到某一帧 → 用 snapshots[i].data 渲染当时的 SimpleChart
  3. 自动播放 1s/帧，可暂停 / 后退
- **测试**：unit 测 frame index 计算；e2e 点回放 → 时间轴可见 + 拖动后图表更新
- **工作量**：M (1d) — UI heavy，复用 engine 逻辑

### 🏷️ Phase 2 · 批量操作 + 标签（2 项 · 1.5 天）

#### W4.4 · 变更原因分类标签 + 统计 panel
- **位置**：扩展 `Change.metadata.tags?: string[]` 类型；ChangeRow 显示 chip；新建 `ChangeStatsPanel.tsx`
- **目标**：变更可贴标签（如「需求方反复」「技术债」「上线问题」），项目状态报告可按 tag 聚合
- **改动**：
  1. ChangeModal 加多选 tag chip（5 个预设 + 自定义）
  2. ChangeRow 显示 tag chip 列
  3. ProjectHeader 加 stats panel: 「按标签：需求方反复 8 / 技术债 3 / 其他 1」
- **测试**：unit 测 tag aggregator；e2e 加变更带 tag → panel 数字更新
- **工作量**：M (1d)

#### W4.5 · 批量删除变更（多选 + 一次删）
- **位置**：`ChangeList.tsx` 加 multi-select mode；ChangeRow 加 checkbox
- **目标**：50+ 变更后清理冗余高效
- **改动**：
  1. ChangeList 顶部加「批量管理」开关
  2. 开关打开 → 每行 checkbox + 顶部「全选」「删除选中（N）」「取消」
  3. 删除走现有 deleteChange × N（每个走 undoStore，但不弹 N 次 toast）
- **测试**：e2e 选 3 条 → 删除 → 列表减少 3 行
- **工作量**：S (0.5d)

### ⚡ Phase 3 · 力量用户 + Polish（3 项 · 1.5 天）

#### W4.6 · ChangeList 筛选 URL 同步
- **位置**：扩展 `ChangeList.tsx` 用 `useSearchParams`
- **目标**：W3.6 状态在刷新 + 分享 URL 后保留 — 「这条筛选链接发给同事」
- **改动**：query / type / role filter 同步到 URL `?q=...&types=add_days,supplement&roles=pm`；初始读 URL 设置初始状态
- **测试**：e2e 设过滤 → 刷新 → 状态保留；URL 含 query params
- **工作量**：S (0.5d)

#### W4.7 · 暗色 polish（导出 + KeyboardHelp kbd）
- **位置**：`src/components/export/*.tsx`；`KeyboardHelpModal.tsx` kbd
- **目标**：W2.3 carry-over — 暗色下导出图片背景白底（modern-screenshot 默认）；KeyboardHelp 的 kbd 标签暗色下太亮
- **改动**：
  1. useExport 检查 dataset.theme=dark → 改 backgroundColor='#1a1a1f'
  2. KeyboardHelpModal kbd 用 var(--glass-bg) 而非 bg-gray-100
- **测试**：手测 + e2e 切暗色 → 导出 PNG · kbd 颜色对照
- **工作量**：S (0.5d)

#### W4.8 · 变更 due-date 警告（变更日期 > 项目预计完工 → 红条）
- **位置**：`ChangeRow.tsx` + 计算 expectedEndDate from `useSchedule.stats.endDate`
- **目标**：变更日期超过预计完工日 → 提醒「这变更其实记错日期了，或者项目早该结束」
- **改动**：每行如果 change.date > project endDate → 显示 ⚠️ 红角标 + tooltip
- **测试**：e2e 创建超期变更 → 红角标可见
- **工作量**：S (0.5d)

### 🛡️ Phase 4 · 收口（1 项 · 0.5 天）

#### W4.9 · Wave 4 走查 + 收口报告
- **位置**：`.review/wave4-walkthrough.mjs/.md/.json` + `.review/wave4-shots/`
- **目标**：和 W1/W2/W3 一样的断言 walkthrough，对照 baseline 验收
- **工作量**：S (0.5d)

## 完成顺序

W4.1 CSV 导出 → W4.5 批量删除 → W4.6 URL 同步 → W4.4 标签 + 统计 → W4.2 项目模板 → W4.3 回放动画 → W4.7 暗色 polish → W4.8 due-date 警告 → W4.9 走查收口

## Wave 4 工作量预算

| 阶段 | 项数 | 估时 |
|---|---|---|
| Phase 1 | 3 | 2d |
| Phase 2 | 2 | 1.5d |
| Phase 3 | 3 | 1.5d |
| Phase 4 | 1 | 0.5d |
| 合计 | 9 | 5.5d |
