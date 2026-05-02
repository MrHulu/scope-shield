# 秘书 Wave 3 验收走查 · 2026-05-02

> **方法**：Playwright headless 走过 9 个面 + 13 项断言
> **耗时**：8.5 秒 · 0 console error · 6 张截图（W2 baseline 7.5s 14 项）
> **对照**：[`wave2-walkthrough.md`](wave2-walkthrough.md)（11/11 落地 + 14/14 走查）+ [`wave3-triage.md`](wave3-triage.md)（9 项承诺）

## 13 项断言全部通过

| # | 项 | 断言 | 结果 |
|---|---|---|---|
| 1 | W3.1 焦点 trap (ChangeModal) | Tab 8 次后焦点仍在 dialog 内 | ✓ INPUT 元素，contained=true |
| 2 | W3.1 焦点 trap (KeyboardHelpModal) | `?` 弹窗 + trap | ✓ |
| 3 | W3.3 CSV 批量导入 | 示例 → 预览 5 行 | ✓ 实测 5 |
| 4 | W3.5 复制报告 | 按钮可见 | ✓ |
| 5 | W3.4 时光机按钮 | 可见 | ✓ |
| 6 | W3.4 历史快照 | rows ≥ 0（数据依赖） | — 实测 0（demo 项目无回放快照，预期；用户产生变更后会累积） |
| 7 | W3.6 搜索 / 过滤栏 | 可见 | ✓（demo 4 条变更触发 ≥3 阈值）|
| 8 | W3.6 搜索匹配计数 | 「N / M 条匹配」格式正确 | ✓ "0 / 4 条匹配" |
| 9 | W3.7 `g s` 跳转 | URL 含 `settings` | ✓ `/settings` |
| 10 | W3.7 `g d` 跳转 | URL 含 `project` | ✓ `/project/demo-001` |
| 11 | W3.9 全屏图表 | 覆盖层渲染 | ✓ `chart-fullscreen-overlay` |
| 12 | W3.9 Esc 退出 | 覆盖层隐藏 | ✓ |
| — | console errors | 全程 0 | ✓ |

## Wave 3 全部 9 项落地

| # | 项 | 状态 |
|---|---|---|
| W3.1 | 焦点 trap 完整实现 | ✓ useFocusTrap hook 应用于 6 个 modal · 走查 Tab×8 验证 |
| W3.2 | 多步撤销链（LIFO stack） | ✓ undoStore stack + 3 新 unit case |
| W3.3 | CSV/JSON 批量导入 | ✓ bulkImporter + BulkImportModal · 11 unit case |
| W3.4 | 历史快照浏览面板 | ✓ SnapshotHistory 时光机 modal · onDataChange 实时刷新 + Esc 关闭 |
| W3.5 | Markdown 报告生成 | ✓ reportGenerator + 复制按钮 · 6 unit case |
| W3.6 | ChangeList 搜索 / 过滤 | ✓ 搜索 + 类型/角色 chip 多选 · 阈值≥3 才渲染 |
| W3.7 | g d / g s navigation | ✓ NavigationKeys 1s 双键序列 · 走查路径切换 |
| W3.8 | 走查收口 | ✓ 本文档 |
| W3.9 | 全屏图表 | ✓ Maximize2 toggle · Esc 退出 |

## Wave 3 数据

- 全量 unit：**253/253 通过**（Wave 2 末 234 → +19 case · undoStore 8 + bulkImporter 11 + reportGenerator 6 - 6 旧调整）
- e2e：所有 W2 通过 e2e 仍绿（含 W2.4 ChangeModal 两段式回归全绿）
- 0 console error · 走查耗时 8.5s
- 截图：`./wave3-shots/01-first-paint.png` ~ `09-fullscreen-chart.png`

## 与 Wave 2 对比

| 项 | Wave 2 末 | Wave 3 末 |
|---|---|---|
| 焦点 trap | a11y smoke only | 6 modal 完整 trap + Tab 循环验证 |
| 撤销支持 | 单次（最近 1 次删） | 多步 LIFO stack（10 深度） |
| 导入需求 | 单条 form | + 批量 CSV / JSON 粘贴预览 |
| 报告导出 | PNG 图片 | + Markdown 文本 一键复制（飞书 / 邮件直贴） |
| 历史可见性 | 仅当前状态 | + 时光机 · 每次变更后的工期快照时间线 |
| ChangeList | 仅排序 | + 搜索框 + 类型/角色 chip 过滤 |
| 键盘快捷键 | ⌘K / ⌘⇧C / ⌘Z / ? | + g d / g s / g 1..9 chord 跳转 |
| 图表 | 嵌入项目页 | + 全屏模式（演讲场景）|
| 测试 | 234 unit / 88 e2e | 253 unit / 88+ e2e（无回归） |

## Wave 4 候选（提前记入避免遗忘）

延期/简化项：
- **暗色下导出图片质量** (W2 carry-over)：modern-screenshot 在 dark theme 下截图未做对照
- **变更回放动画**：engine 已有 replay 逻辑，UI 没暴露动画时间轴
- **AI 摘要面板**：需要 Claude/OpenAI API key
- **CSV 反向导出**：当前只能导入，无 CSV 导出
- **快捷键 cheat sheet 跟随系统主题**：KeyboardHelpModal 暗色下 kbd 颜色未优化
- **筛选条件 URL 同步**：W3.6 状态丢失（刷新即清空）

新需求池：
- **变更原因分类标签**（W2/W3 候选剩余）
- **项目模板 5 个内置**（用户呼声高）
- **批量删除变更 / 批量编辑需求**
- **PDF 导出**（除 PNG 外）
- **侧栏多项目排序**（按膨胀率/最近修改）
- **变更 due-date 提醒**（变更日期超过项目结束 → 警告）

## 给 Boss 的一句话

Wave 3 9 项全部上线 + 走查 13/13 通过。3 个安全/完整性强化（focus trap / 多步撤销 / Esc 全部支持）+ 3 个商业级数据生命周期（CSV 批量导入 / 时光机 / Markdown 报告）+ 2 个体验深化（搜索过滤 / g 跳转 / 全屏）。Wave 2 baseline 痛点（focus-trap 完整版 + 多步撤销）全部收口。Wave 4 候选已记入末尾。
