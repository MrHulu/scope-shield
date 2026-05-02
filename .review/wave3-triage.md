# Wave 3 Triage · Scope Shield 商业级别打磨深化

> 来源：Wave 2 残留候选 + 秘书 Wave 2 走查 + 商业级 SaaS 标配
> 9 项 · 约 7 工作日 · 4 阶段执行
> Wave 2 收口：11/11 落地 + 234 unit + 87/88 e2e + 8 bench + 14/14 走查

## Wave 3 候选来源

| 项 | 来源 |
|---|---|
| 焦点 trap 完整实现 | Wave 2 W2.9 延期，仅做了 a11y smoke |
| 多步撤销链 | Wave 2 W2.6 简化版（仅最近 1 次） |
| CSV / JSON 批量导入 | 商业级 SaaS 标配（用户呼声）|
| 历史快照浏览 | engine 已存 snapshots，UI 未暴露 |
| Markdown 报告自动生成 | 老板汇报场景刚需 |
| ChangeList 搜索/过滤 | 50+ 变更后必需 |
| g d / g s navigation 快捷键 | W2.5 帮助 modal 已列、handler 未实现 |
| 全屏图表 | 演讲/汇报场景 |
| AI 摘要面板 | Boss 期待 Wave 3（需 API key，最后再看） |

## Wave 3 全量 9 项（约 7 天）

### 🛡️ Phase 1 · 安全 + 完整性（3 项 · 1.5 天）

#### W3.1 · 焦点 trap 完整实现 [Wave 2 carry-over]
- **位置**：新建 `src/hooks/useFocusTrap.ts`；应用于 ChangeModal / ConfirmDialog / RecoveryDialog / ExportModal / CommandPalette / KeyboardHelpModal
- **目标**：Tab 在 modal 内循环，不溢出到下层；Shift+Tab 反向；初次焦点落在第一个 focusable 元素
- **改动**：
  1. useFocusTrap(active: boolean) hook — 用 querySelectorAll('input,select,textarea,button,[href],[tabindex]:not([tabindex="-1"])') 收集，处理 Tab + Shift+Tab
  2. 每个 modal 在打开时调用 useFocusTrap(open)
  3. 关闭时还原焦点到触发元素
- **测试**：e2e — Tab 5 次后焦点仍在 modal 内；Shift+Tab 也然
- **工作量**：M (1d)

#### W3.2 · 多步撤销链（Cmd+Z 历史 stack）[Wave 2 carry-over]
- **位置**：扩展 `src/stores/undoStore.ts`：单值 → stack；UndoHandler 改为 pop
- **目标**：连续删 3 个变更，连按 Cmd+Z 3 次按 LIFO 顺序撤销；超过 stack 上限（10）丢最早的
- **改动**：
  1. undoStore 改 `pending: PendingUndo[]`，FIFO drop @ MAX_STACK=10
  2. recordDeletion → push；consume → pop（LIFO）
  3. 每个 entry 有自己的 expiresAt（仍 8s）
  4. UndoHandler 不变（只 consume 一次）
- **测试**：unit — push 3 → consume 3 顺序对；超 10 丢最早；过期单 entry 单独失效
- **工作量**：S (0.5d)

### 📥 Phase 2 · 数据生命周期（3 项 · 3 天）

#### W3.3 · CSV/JSON 批量导入需求 [商业级标配]
- **位置**：新建 `src/components/requirement/BulkImportModal.tsx`；`RequirementList` 工具栏加「批量导入」按钮
- **目标**：粘贴 CSV / JSON 一次创建多个需求；自动解析 name / days / dependsOn 列；预览 + 校验后入库
- **改动**：
  1. 简单 CSV 解析（comma/tab，去引号），首行为 header 自动检测
  2. JSON 数组接受 `[{name, days, dependsOn?}]`
  3. 预览表格展示解析结果 + 错误标红
  4. 调用 onAdd 多次（顺序，dependsOn 在 sortOrder 之前）
- **测试**：unit 测 parser；e2e 粘贴 CSV → 预览 → 导入 N 条
- **工作量**：M (1d)

#### W3.4 · 历史快照浏览面板 [engine 已有]
- **位置**：新建 `src/components/snapshot/SnapshotHistory.tsx`；ProjectPage 加「时光机」标签 / drawer
- **目标**：把 engine 一直在写的 snapshots 暴露出来 — 每个变更 1 条快照，可看当时的工期 + reqs 状态
- **改动**：
  1. 列出快照（按 createdAt desc），每条显示 totalDays / 触发的 change description
  2. 点击展开看当时 reqs 的 currentDays / status
  3. 不支持回滚（保护数据）— 仅查看
- **测试**：unit 测 hook 排序；e2e 验证 N 个变更后 N 条快照可见
- **工作量**：M (1d)

#### W3.5 · Markdown 报告自动生成 + 复制 [老板汇报场景]
- **位置**：新建 `src/services/reportGenerator.ts`；ProjectPage 工具栏加「复制 Markdown 报告」按钮
- **目标**：一键生成项目状态 Markdown，复制到剪贴板，可直接贴飞书/钉钉/邮件
- **改动**：
  1. 模板：`# 项目名 \n\n - 原计划 X 天 \n - 实际 Y 天 \n - 膨胀 Z% \n\n## 关键变更\n - DATE 类型 描述 (+N天)\n`
  2. navigator.clipboard.writeText
  3. 成功 toast「已复制 Markdown 报告」
- **测试**：unit 测 generateReport(stats, changes) → string 包含正确字段
- **工作量**：S (0.5d)

### ⚡ Phase 3 · 体验深化（2 项 · 1.5 天）

#### W3.6 · ChangeList 搜索 / 过滤 [50+ 变更后必需]
- **位置**：`src/components/change/ChangeList.tsx` + 新建 `src/components/change/ChangeListFilter.tsx`
- **目标**：按描述文本搜 / 按类型过滤 / 按角色过滤
- **改动**：
  1. 顶部加搜索框（防抖 200ms）+ 类型 / 角色 chip 多选
  2. useMemo 过滤 sorted changes
  3. 显示「N / M 条匹配」
- **测试**：e2e 输入关键词 + 选 chip → 行数变化
- **工作量**：S (0.5d)

#### W3.7 · g d / g s 跳转快捷键 [W2.5 已宣传]
- **位置**：扩展 KeyboardHelpModal 已列的快捷键；新建 `src/components/shared/NavigationKeys.tsx`
- **目标**：g d → demo 项目；g s → 设置；g 1/2/3 → 第 N 个项目
- **改动**：双键序列检测（< 1s 内连按）+ navigate
- **测试**：e2e 按 g 然后 d → URL 变化
- **工作量**：S (0.5d)

### 🛡️ Phase 4 · 收口（1 项 · 0.5 天）

#### W3.8 · Wave 3 走查 + 收口报告
- **位置**：`.review/wave3-walkthrough.mjs/.md/.json` + `.review/wave3-shots/`
- **目标**：和 W1/W2 一样的断言 walkthrough，对照 baseline 验收
- **工作量**：S (0.5d)

#### W3.9 · 全屏图表模式 [演讲场景，bonus]
- **位置**：`src/components/chart/ChartArea.tsx` 加「全屏」按钮
- **目标**：F11-style 全屏图表 + Esc 退出
- **改动**：div fullscreen API 或 fixed 100vw/100vh 覆盖
- **测试**：e2e 点全屏 → 元素 viewport 占满 → Esc 退出
- **工作量**：S (0.5d)

## 完成顺序（秘书定）

W3.1 焦点 trap → W3.2 多步撤销 → W3.3 批量导入 → W3.5 Markdown 报告 → W3.4 历史快照 → W3.6 搜索过滤 → W3.7 跳转快捷键 → W3.9 全屏图表 → W3.8 走查收口

## Wave 3 工作量预算

| 阶段 | 项数 | 估时 |
|---|---|---|
| Phase 1 | 2 | 1.5d |
| Phase 2 | 3 | 2.5d |
| Phase 3 | 3 | 2d (含 bonus W3.9) |
| Phase 4 | 1 | 0.5d |
| 合计 | 9 | 6.5d |
