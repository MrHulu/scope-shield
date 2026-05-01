# Wave 1 Triage · Scope Shield → Commercial Grade

> 来源：PM 7 P0 / 8 P1 + QA 12 P0 / 10 P1 + 秘书走查 5 痛点 = **共 32 项**
> 第一波必须**控制在 10 项以内**，每项 ≤ 1 天，互不冲突，每项配 unit + e2e

## 三方共识（同时被 ≥ 2 方点名）

| 项 | PM | QA | 秘书 |
|---|---|---|---|
| 视觉品牌落地（磨砂玻璃 + tokens） | P0-1 | — | — |
| reprioritize 新语义保护 | — | P0-1 | W3 |
| ChangeModal 密度 / 体验 | P0-4 | — | W5 |
| "操作即反馈" 反馈缺位 | (隐含 P1-2 撤销 / P1-6 错误恢复) | — | W1（核心痛） |
| 飞书未登录场景 | P1-4 | P0-10 | W2 |
| 测试基础设施（coverage / hardResetDB） | — | infra 1+2 | — |

## Wave 1 推荐 10 项（5.75 工作日预算）

### 🎨 视觉品牌升级（4 项 · 2.25 天）

#### W1.1 · 设计 token 系统 + 磨砂玻璃落地核心容器 [PM P0-1]
- **位置**: 新建 `src/styles/tokens.css`；改 Sidebar / StatsCard / ProjectHeader / ChangeModal / RecoveryDialog / ConfirmDialog
- **目标**：与 `proto-apple-style.png` 并排截图差异肉眼难辨
- **改动**：定义 `--glass-bg / --glass-blur / --glass-saturate / --gradient-plan / --gradient-actual / --shadow-card`；侧栏 + 三大卡片 + 模态启用 `backdrop-filter: blur(20px) saturate(180%)`
- **测试**：visual regression e2e（toHaveScreenshot baseline 2 张）+ Lighthouse a11y > 95
- **工作量**：M (1d)

#### W1.2 · StatsCard hero variant，膨胀率信息层级提升 [PM P0-2]
- **位置**: `ProjectHeader.tsx` + `StatsCard.tsx`
- **目标**：膨胀率 +31% 字号 ≥ 36px，宽度占 1.5x，色彩跟正负变化
- **改动**：StatsCard 加 `variant: 'hero' | 'default' | 'chip'`；ProjectHeader 重排 5 → 1 主 + 4 副
- **测试**：e2e 断言 `[data-testid=hero-stat-inflation]` 字号 ≥ 32px + 文案显示"比原计划多 X 天"
- **工作量**：S (0.5d)

#### W1.3 · 主 CTA 浮动 FAB「记录变更」+ ⌘⇧C 快捷键 [PM P0-3]
- **位置**: 新建 `src/components/project/FloatingCTA.tsx`；`ProjectPage.tsx` 挂载
- **目标**：任意滚动位置 1 步触达；商业级 SaaS 标配
- **改动**：fixed bottom-right 红色 pill 按钮 z-50；全局 keydown listener 绑 ⌘⇧C；移除 ChangeList 内嵌按钮（保留 ghost 入口）
- **测试**：e2e 在 3 个不同滚动位置都能点 FAB 打开 modal；按 ⌘⇧C 同样触发
- **工作量**：S (0.5d)

#### W1.4 · ChartArea 加 section 标题 + 副标题解读 [PM P0-5]
- **位置**: `ChartArea.tsx` + `ProjectPage.tsx`
- **目标**：进入项目页首屏（不滚动）就能看到"工期对比"标题 + 完整图表
- **改动**：加头部行 `<h2>工期对比</h2>` + 副标题 "原计划 18 天 → 实际 23.5 天，膨胀 31%"；tab 改 segmented control
- **测试**：e2e 断言 viewport 1280×720 时 ChartArea 在首屏 visible
- **工作量**：XS (0.25d)

### ⚡ 体验细节（2 项 · 1 天）

#### W1.5 · Sidebar 底部数据保障可见性 [PM P0-6]
- **位置**: 新建 `src/components/layout/LocalStorageBadge.tsx`；`Sidebar.tsx` 底部挂载
- **目标**：让 "100% 本地" 隐私承诺在 UI 永远 visible
- **改动**：显示 "🔒 本地存储 · 上次备份 14:35 · 已用 12MB / 50MB"；备份失败时变橙色 + Toast
- **测试**：unit mock `getBackupTime` + `navigator.storage.estimate`；e2e 模拟 quota near full → badge 变橙
- **工作量**：S (0.5d)

#### W1.6 · 操作即反馈：加需求高亮 + 调优先级无变化提示 [秘书 W1+W3]
- **位置**: `useRequirements.ts` + `RequirementRow.tsx` + `ChangeModal.tsx`（reprioritize 校验）
- **目标**：每次操作 100ms 内有视觉/文案反馈，消除"没生效"焦虑
- **改动**：
  - 加需求成功后新行 1.5s 黄色高亮（`animation: highlight-pulse`）
  - reprioritize 保存前如果 `newDep === target.dependsOn` → toast "前置依赖未变化，未生效" + 不写 change
  - 加需求/记变更/调优先级后，stats 数字闪一下（`animation: stat-update`）
- **测试**：e2e 断言新增 row 有 `data-just-added` attr 1500ms；reprioritize 同值 → 不入库 + toast 出现
- **工作量**：S (0.5d)

### 🛡️ 测试覆盖核心（4 项 · 2.5 天）

#### W1.7 · reprioritize 新语义 unit 8 case [QA P0-1]
- **位置**: `src/engine/__tests__/changeProcessor.test.ts` 加 `describe('reprioritize 新语义 (by dep)')`
- **核心断言**：
  - target.dependsOn = newDep 设置成功
  - newDep=null 时 sortOrder=0 链头
  - newDep 在 cancelled → fallback 到末尾
  - cancelled requirements sortOrder 始终在末尾
  - target 自身 cancelled → early return（不 mutate）
  - 别的需求 dependsOn **完全不动**（这是新旧语义核心区别）
  - applyChangeForReplay 同样断言
- **工作量**：S (0.5d)

#### W1.8 · 飞书节点解析三层链 unit [QA P0-2]
- **位置**: 新增 `src/services/__tests__/feishuRequirement.nodes.test.ts`
- **核心断言**：
  - work_hour.attributes.points.value 数字/字符串 → 数字
  - work_hour 缺失 → fallback scheduleV3.attributes
  - points < 0.5 跳过下一个 node
  - msToIsoDate(NaN/null/Infinity) → null
  - current_status_operator 优先 → roleBased fallback → legacy fallback **三层不跳级**
  - owner.value 损坏 JSON → 静默吞 + 空名单
- **工作量**：M (1d)

#### W1.9 · journey-full e2e 端到端 happy path [QA P0-8]
- **位置**: 新建 `e2e/journey-full.spec.ts`
- **流程**：新建项目 → 加 5 条需求 → 7 类变更各一 → 切两个图表 → 导出 PNG → reload → 断言全部数据完整
- **核心断言**：ChangeList 显示 7 行；导出 PNG blob.size > 100KB；reload 后 backup-latest 存在 + projectCount=1 + reqCount=5
- **工作量**：S (0.5d)

#### W1.10 · 测试基础设施立 CI gate [QA infra]
- **改动**：
  1. `npm i -D @vitest/coverage-v8 fake-indexeddb @testing-library/react @testing-library/user-event @testing-library/jest-dom`
  2. `vite.config.ts` test 块加 coverage thresholds（lines/branches/functions/statements 各 80% 起，渐进上调）
  3. `e2e/helpers.ts` 抽出 `hardResetDB`（清 IDB + localStorage + sessionStorage + cookies + Service Worker），所有 spec 切换
  4. recovery-dialog.spec.ts 删除 spec-local hardWipe
- **测试**：跑 `npx vitest run --coverage` 出基线数字（baseline 写入 `.review/coverage-baseline.txt`）
- **工作量**：S (0.5d)

## 未进 Wave 1 但记入 Wave 2+ 的（避免被遗忘）

| # | 来源 | 项 | 安排 |
|---|---|---|---|
| W2 候选 | PM P0-4 | ChangeModal 两段式拆分 | Wave 2（视觉先稳定再动 modal） |
| W2 候选 | PM P0-7 | 性能基准（100/500 条数据） | Wave 2 |
| W2 候选 | PM P1-1 | 暗色模式（与 token 协同） | Wave 2（W1.1 完成后启动） |
| W2 候选 | PM P1-3 | 键盘快捷键体系 + ⌘K | Wave 2 |
| W2 候选 | QA P0-3+P0-4+P0-5 | cancel 级联/cascadeTargets/changeStore.deleteChange unit | Wave 2 |
| W2 候选 | QA P0-9 | flake 7 个全修 | Wave 2 |
| W2 候选 | QA P0-12 | a11y / focus trap e2e | Wave 2 |
| W2 候选 | 秘书 W2 | 飞书未登录解析提速（探活前置） | Wave 2 |
| W3+ | PM P1-2 | 撤销/重做 | Wave 3 |
| W3+ | PM P1-7 | onboarding tour | Wave 3 |
| W3+ | PM P1-8 | 侧栏多项目状态 | Wave 3 |

## 三方总评

- **PM 视角**：18 个组件视觉一致性只 5%（1 🟢 / 13 🟡 / 4 🔴）—— 核心债是品牌落地
- **QA 视角**：163 unit 但 stores/hooks/components 0 测；coverage 工具未装 → 没数字就没"95%"
- **秘书走查**：0 console error / 11.9s 全程跑通 ✓ —— 但 W1（加需求工期没变化）是真痛点

## 立项请求

**请 Boss 拍板**：
1. Wave 1 这 10 项是否合理？
2. 工作量预算 5.75 天能接受？
3. 完成顺序建议：基础设施先（W1.10）→ 视觉打底（W1.1）→ 单测保护新代码（W1.7/W1.8）→ 体验细节（W1.2-1.6）→ journey e2e 收口（W1.9）—— 用不用调？
4. 是否要先归档当前未提交的 reprioritize/UI 工作（commit boundary），再开 Wave 1？

报告路径：
- PM 详报：`.review/pm-report.md`（241 行）
- QA 详报：`.review/qa-report.md`（418 行）
- 秘书走查：`.review/walkthrough.md`（截图 10 张 + walkthrough.json 时序）
- 本 Triage：`.review/wave1-triage.md`
