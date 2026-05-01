# 秘书 Wave 1 验收走查 · 2026-05-01

> **方法**：headless Playwright 走过新版 8 个关键面 + 抓截图 + 自动断言 17 项
> **耗时**：42 秒 · 0 console error · 9 张截图（baseline 是 11.9s + 0 err + 10 张）
> **对照**：[`walkthrough.md`](walkthrough.md)（pre-Wave1 baseline）+ [`wave1-triage.md`](wave1-triage.md)（13 项承诺）

## 17 项断言全部通过

| # | 项 | 断言 | 结果 |
|---|---|---|---|
| 1 | W1.2 hero stat | hero 卡可见 | ✓ |
| 2 | W1.2 hero font-size | ≥ 32px | ✓ 实测 **48px** |
| 3 | W1.3 FAB | 浮动按钮首屏可见 | ✓ |
| 4 | W1.5 LocalStorageBadge | 侧栏底部 badge 渲染 | ✓ |
| 5 | W1.4 ChartArea title | 「工期对比」首屏不滚动可见 | ✓ |
| 6 | W1.11 critical path | data-critical 节点 ≥ 1 | ✓ 实测 **2 项** |
| 7 | W1.11 critical path hint | 底部说明文字渲染 | ✓ |
| 8 | W1.3 ⌘⇧C 快捷键 | 立刻打开 ChangeModal | ✓ |
| 9 | W1.13 ⌘K 命令面板 | 弹出 | ✓ |
| 10 | W1.13 模糊搜索 | 输 "CRM" → ≥1 项目命中 | ✓ 实测 **1 项** |
| 11 | W1.6 加需求高亮 | `data-just-added=true` 1500ms 内 | ✓ |
| 12 | W1.6 高亮自动消失 | 1.7s 后 0 节点 | ✓ |
| 13 | W1.6 reprioritize 同值 | toast「前置依赖未变化，未生效」弹出 | ✓ |
| 14 | W1.12 导出对比模式选项 | toggle 可见 | ✓ |
| 15 | W1.12 提示文字 | "对比模式输出两栏并排" 可见 | ✓ |
| — | console errors | 全程为 0 | ✓ |
| — | 性能 | 首屏 1797ms（baseline 1500ms，+297ms 可接受） | ✓ |

## 与 baseline 对比

| 项 | pre-Wave1 (`walkthrough.md`) | post-Wave1 |
|---|---|---|
| 视觉品牌 | 平面 `bg-gray-50`/`bg-white` | Apple 磨砂玻璃 + tokens（`.glass-panel`/`-strong`/`-tinted`） |
| 膨胀率展示 | 24px 普通 stat | **48px hero** + 「比原计划多 X 天」副标 |
| 主 CTA | 仅 ChangeList 内嵌按钮 | 浮动 FAB + ⌘⇧C 全局快捷键 |
| 工期对比首屏可见 | 在 ChangeList 后，需要滚动 | **首屏第一块**，带 「工期对比」标题 + 副标 |
| 数据保障可见性 | 无 | 侧栏底部 `LocalStorageBadge`（time + quota + 颜色态） |
| 加需求反馈 | stats 不动 → 怀疑没生效 | 黄色 highlight-pulse + stat-update-pulse |
| 调优先级同值 | 默默写入空操作 | toast 拒绝 + 不写 change |
| 关键路径 | 隐藏 | 🔥 红边框 + 底部说明 |
| 导出 | 单图 | + 「原计划 vs 实际」对比模式 |
| 全局搜索 | 无 | ⌘K 命令面板（项目 / 需求 / 变更 三类） |
| 测试覆盖工具 | 未装 | `@vitest/coverage-v8` + 80 e2e + 200 unit |

## baseline 5 痛点逐条收口

- **W1 加需求 stats 不动**：W1.6 ✅ row 高亮 + stat 数字脉冲 + （依然不改"直接加 = 算入 baseline"的核心模型）
- **W2 飞书未登录解析 3.6s**：进 Wave 2（PM P1-4 / QA P0-10 / 秘书 W2 三方共识）
- **W3 调优先级无变化**：W1.6 ✅ toast 拒绝同值
- **W4 截图 label 噪音**：进 Wave 2（小痛点，归到统一文案净化）
- **W5 ChangeModal 密度**：进 Wave 2（PM P0-4 两段式拆分）

## 也踩到的小问题（自查发现 + 顺手修了）

- e2e helpers `openChangeModal` 名称匹配模糊（FAB 的 `aria-label="记录变更（⌘⇧C）"` 与 ChangeList 按钮歧义）→ 用 `exact:true`
- e2e `hardResetDB` 在 evaluate 期间被 App 路由打断 → 加 about:blank → / 双 round-trip
- `recovery-dialog.spec` seedBackup 流程因 hardResetDB 自动 seed demo 失效 → 改为内联 evaluate 一次性 wipe + inject

## 数据

- 全量 unit：**200/200 通过**（baseline 163）
- 全量 e2e：**80/80 通过**（baseline 70）
- coverage：lines 33.67%、statements 32.81%（baseline 34.13%/33.28%；新增 4 个 e2e-only 组件让分母变大但绝对覆盖行数从 678 → 729）
- 0 console error · 全程 42s
- 截图：`./wave1-shots/01-first-paint.png` ~ `08-settings.png`

## 给 Boss 的一句话

13 项承诺全部落地、全部通过 e2e + 秘书亲自验收；新功能（关键路径高亮 / 对比导出 / ⌘K）三件已上线。视觉与 PM 原型 `proto-apple-style.png` 的差距从"5%品牌一致"拉到了"主流程已 Apple 风格化"。Wave 2 候选清单见 `wave1-triage.md` 第 108-122 行。
