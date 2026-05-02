# Wave 2 Triage · Scope Shield → 商业级别打磨

> 来源：Wave 1 triage 第 108-122 行（W2 候选 + W3+ 提前）+ 秘书 walkthrough 痛点 W2/W4/W5 + Wave 1 落地后产生的新需求
> 11 项 · 约 7-8 工作日 · 4 阶段执行
> Wave 1 收口：13/13 落地 + 200 unit + 80 e2e + 17/17 走查

## Wave 2 共识来源

| 项 | PM | QA | 秘书 | Wave1 衍生 |
|---|---|---|---|---|
| 暗色模式 | P1-1 | — | — | W1.1 token 已就位 |
| ChangeModal 两段式 | P0-4 | — | W5 | — |
| 性能基准 100/500 | P0-7 | — | — | — |
| 键盘快捷键体系 + ⌘K | P1-3 | — | — | W1.13 ⌘K 已落地 |
| cancel 级联 unit | — | P0-3+4+5 | — | — |
| flake 7 修 | — | P0-9 | — | Wave1 后已 80/80 绿 — 警惕 |
| a11y / focus trap e2e | — | P0-12 | — | — |
| 飞书未登录解析提速 | P1-4 | P0-10 | W2 | — |
| 撤销 Cmd+Z | P1-2 | — | — | — |
| 侧栏多项目状态 | P1-8 | — | — | — |

## Wave 2 全量 11 项（约 7.5 天）

### 🛡️ Phase 1 · 秘书痛点 + 单测保护（2 项 · 1 天）

#### W2.1 · 飞书未登录探活前置 [秘书 W2 + PM P1-4 + QA P0-10]
- **位置**：`src/services/feishuRequirement.ts` 加 `prefetchLoginStatus()`；`RequirementForm` 在「飞书 URL（可选）」输入框获得焦点时调用一次（去抖 30s）
- **目标**：秘书走查 baseline 中"3.6s 卡死感"消除 — 表单打开时已提前知道登录态
- **改动**：
  1. 新增 `prefetchLoginStatus()` 调用 `/goapi/v1/project/trans_simple_name` 探活，写入 module-level cache（30s 有效）
  2. `analyzeFeishuRequirementUrl()` 先看 cache，已知未登录 → 直接 url-only fallback（不再串行 trans_simple_name + demand_fetch）
  3. UI 文案：未登录时按钮显示「飞书未登录 · 仅保留 URL」而非「解析中…」
- **测试**：unit 测 cache TTL；e2e 模拟未登录 → 解析按钮 < 800ms 落定（baseline 3.6s）
- **工作量**：S (0.5d)

#### W2.2 · cancel 级联 + cascadeTargets + changeStore.deleteChange unit [QA P0-3+4+5]
- **位置**：`src/engine/__tests__/changeProcessor.test.ts` 加 `describe('cancel 级联')`；新增 `src/stores/__tests__/changeStore.test.ts`（首个 store unit）
- **核心断言**：
  - cancel 主需求 → 依赖它的下游需求级联标记（cascadeTargets）
  - cascadeTargets 里的需求 sortOrder 跑到末尾
  - applyChangeForReplay 同样级联
  - changeStore.deleteChange 调用全量 replay → state 一致
- **测试**：unit 12 case
- **工作量**：S (0.5d)

### 🎨 Phase 2 · 视觉 + 体验（3 项 · 2.5 天）

#### W2.3 · 暗色模式（system + manual toggle）[PM P1-1]
- **位置**：`src/styles/tokens.css` 加 `[data-theme="dark"]` overrides；新建 `src/stores/themeStore.ts` + `src/components/layout/ThemeToggle.tsx`；`Sidebar` footer 加切换按钮
- **目标**：暗色下视觉与 Apple 暗色磨砂玻璃风一致；W1.1 tokens 完全生效
- **改动**：CSS 变量逐项暗化（glass-bg、backdrop-app、shadow），三档：system / light / dark；persist localStorage
- **测试**：unit 测 themeStore 切换 + persist；e2e 验证 toggle 后 `data-theme` attr + 关键文字对比度
- **工作量**：M (1d)

#### W2.4 · ChangeModal 两段式拆分 [PM P0-4 + 秘书 W5]
- **位置**：`src/components/change/ChangeModal.tsx`
- **目标**：消除 8 段 form 拥挤感 — 第 1 段选类型，第 2 段填详情；保存按钮始终在视野内
- **改动**：modal 上方加 step 进度（① 选类型 → ② 填详情）；只有选完类型才出现下半部分；返回上一步可改类型；保留键盘 Tab 流畅度
- **测试**：e2e 验证两段流程 + 返回上一步切换类型
- **工作量**：M (1d)

#### W2.5 · 键盘快捷键 `?` 帮助 modal + 体系化 [PM P1-3]
- **位置**：新建 `src/components/shared/KeyboardHelpModal.tsx`；全局 `?` keydown
- **目标**：让所有快捷键浮出水面 + 商业级 SaaS 标配（Linear / Notion 同款）
- **改动**：表格列出 ⌘K / ⌘⇧C / ⌘Z / Esc / `?` / Tab / `g d` (跳转 demo) / `g s` (跳转 settings) 等
- **测试**：e2e `?` 键弹出 + Esc 关闭
- **工作量**：S (0.5d)

### ✨ Phase 3 · 新功能（3 项 · 2 天）

#### W2.6 · 撤销 Cmd+Z 撤销最近一次变更 [PM P1-2 简化版]
- **位置**：新建 `src/stores/undoStore.ts`（lastDeletedChange + lastDeletedAt）；`changeStore.deleteChange` 改写时存到 undoStore；全局 `Cmd+Z` 监听
- **目标**：误删变更可恢复 — 商业级标配
- **改动**：deleteChange 后弹 toast「已删除 — `按 Cmd+Z 撤销`（5s）」；按 Cmd+Z 调用 `restoreChange(lastDeleted)`；超过 5s 失效
- **测试**：unit 测 undoStore；e2e 删除 → 显示 toast → Cmd+Z → 列表恢复
- **工作量**：M (1d)

#### W2.7 · 侧栏多项目膨胀率彩色徽章 [PM P1-8]
- **位置**：`src/components/layout/Sidebar.tsx` + 新 `src/hooks/useAllProjectStats.ts`
- **目标**：跨项目可见性 — 每行项目右侧显示当前膨胀率（绿/黄/红）小色块，老板一眼扫描全部项目状态
- **改动**：load 所有 active 项目的 stats（非当前项目用懒加载或一次性预算）；Sidebar 项目按钮加 `<span class="bg-{color}-500">+31%</span>`
- **测试**：unit 测 useAllProjectStats；e2e 创建第二项目 + 验证侧栏显示
- **工作量**：S (0.5d)

#### W2.8 · 项目复制（duplicate） [新增 · 商业级标配]
- **位置**：`src/components/layout/Sidebar.tsx` 项目右键 / hover icon；`src/stores/projectStore.ts` 加 `duplicateProject()`
- **目标**：相似项目可一键复制结构 — 例如「移动版 V1」复制为「移动版 V2」
- **改动**：复制项目 + requirements（重置 currentDays = originalDays），不复制 changes/snapshots（白盒重新开始）
- **测试**：unit 测 duplicateProject；e2e 复制 → 列表多一个 + 同需求结构 + 0 变更
- **工作量**：S (0.5d)

### 🛡️ Phase 4 · 测试 + 性能 + 收口（3 项 · 2 天）

#### W2.9 · a11y + focus trap e2e [QA P0-12]
- **位置**：新建 `e2e/a11y.spec.ts`
- **目标**：所有 modal 在键盘 Tab 时焦点循环不溢出；ARIA 角色齐全
- **改动**：核心校验 ConfirmDialog / RecoveryDialog / ChangeModal / ExportModal / CommandPalette 焦点 trap；alt 属性 / aria-label 检查
- **测试**：6-8 个 e2e case
- **工作量**：S (0.5d)

#### W2.10 · 性能基准（vitest bench 100/500/1000 reqs）[PM P0-7]
- **位置**：新建 `src/engine/__tests__/scheduler.bench.ts` + `changeProcessor.bench.ts`
- **目标**：建立 baseline，未来回归即报警
- **改动**：使用 `vitest bench` 跑 schedule(100reqs) / schedule(500reqs) / processChange(1000changes)；将 baseline 写入 `.review/perf-baseline.txt`
- **测试**：bench 跑通 + 报告
- **工作量**：S (0.5d)

#### W2.11 · Wave 2 走查 + 收口报告
- **位置**：`.review/wave2-walkthrough.mjs/.md/.json` + `.review/wave2-shots/`
- **目标**：和 Wave 1 一样的 17 项断言 walkthrough，对照 baseline 验收
- **工作量**：S (0.5d)

## 完成顺序（秘书定）

W2.1 飞书探活 → W2.2 cancel unit → W2.3 暗色模式 → W2.4 ChangeModal 两段式 → W2.5 ? 帮助 → W2.7 侧栏徽章 → W2.8 项目复制 → W2.6 撤销 Cmd+Z → W2.9 a11y → W2.10 perf bench → W2.11 走查收口

## Wave 2 工作量预算

| 阶段 | 项数 | 估时 |
|---|---|---|
| Phase 1 | 2 | 1d |
| Phase 2 | 3 | 2.5d |
| Phase 3 | 3 | 2d |
| Phase 4 | 3 | 1.5d |
| 合计 | 11 | 7d |
