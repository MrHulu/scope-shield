# Scope Shield 项目档案

> **项目范围膨胀可视化工具** — 把"需求被加 / 改 / 砍 / 重排"画成原计划 vs 现状的对比条 + 甘特时间线，让 scope creep 肉眼可见。
>
> 基于 2026-04-30 实际代码状态（HEAD `28320b1`）。这份是档案不是快照——若与代码不一致，**以代码为准**。

---

## 1. 现状速览

| 属性 | 值 |
|------|-----|
| 远端真源 | `https://github.com/MrHulu/scope-shield` (PUBLIC) |
| Mac 路径 | `/Users/hulu/huluman/scope-shield` (主开发) |
| Windows | `G:\HuluMan\scope-shield` (验收消费方，不再开发维护) |
| 分支 | `master` (无 develop) |
| HEAD | `28320b1 test: unit coverage for db/engine/utils + 14-spec Playwright e2e suite` |
| 工作树 | 干净 (`git status` 无输出) |
| 数据持久化 | IndexedDB (idb v8) + localStorage 自动备份 (4MB / 5s 防抖) |
| 端口 | dev: 5173 |

---

## 2. 技术栈（来自 package.json，非传闻）

| 层级 | 选型 | 版本 |
|------|------|------|
| 运行时 | React | 19.2 |
| 类型 | TypeScript | ~6.0 |
| 构建 | Vite | 8.0 |
| 样式 | Tailwind CSS | v4.2 |
| 状态 | Zustand | 5.0 |
| 路由 | react-router-dom | 7.14 |
| 持久化 | idb (IndexedDB wrapper) | 8.0 |
| 拖拽 | @dnd-kit/{core,sortable,utilities} | 6.3 / 10 / 3.2 |
| 时间 | date-fns | 4.1 |
| 截图导出 | modern-screenshot | 4.6 |
| 图标 | lucide-react | 1.8 |
| 单测 | Vitest | 4.1 |
| E2E | Playwright | 1.58 |
| Lint | ESLint + typescript-eslint | 9.39 / 8.58 |

---

## 3. 项目结构（src 67 文件）

```
src/
├── App.tsx                      # 启动 → persist() → 检查空库 → 弹 RecoveryDialog 或 seedDemo
├── main.tsx
├── pages/
│   ├── ProjectPage.tsx          # 主项目页（需求列表 + 图表 + 变更）
│   ├── SettingsPage.tsx         # 导入导出 + 自动备份状态 + 飞书代理状态
│   └── NotFoundRedirect.tsx
├── components/
│   ├── change/                  # ChangeList / ChangeModal / ChangeRow / PersonNameInput
│   ├── chart/                   # SimpleChart (对比条) / DetailChart (甘特) / ChartArea / ExportModal
│   ├── export/                  # ExportRenderer + Detail/Simple
│   ├── layout/                  # MainLayout / Sidebar
│   ├── project/                 # ProjectHeader / StatsCard
│   ├── requirement/             # RequirementForm / List / Row (已集成飞书 URL 输入)
│   └── shared/                  # ConfirmDialog / EmptyState / RecoveryDialog / Toast
├── stores/                      # zustand: project / requirement / change / ui
├── hooks/                       # useChanges / Export / Project / Requirements / Schedule / SyncFeishu
├── engine/                      # changeProcessor / replayEngine / scheduler / snapshotManager
├── db/                          # connection / schema (DB_VERSION) / 6 个 repo + autoBackup + changeNotifier + seedDemo + exportImport
├── services/                    # feishuRequirement (URL parse + API) / feishuSettings
├── constants/                   # changeTypes / colors / demo / roles
├── utils/                       # date / id / image / validation
└── types/index.ts               # Project / Requirement / Change / Snapshot + RequirementSource (飞书)
```

非源码：
- `e2e/` — 14 个 Playwright spec + helpers.ts
- `docs/` — acceptance / architecture / data-model / flows / mvp-prd / requirements / ui-spec / data-durability-design / vnext-feishu-url-requirement-design + prototypes/
- `scripts/` — 本地手动验证脚本（已 .gitignore）

---

## 4. 已上线功能（committed in HEAD）

### 4.1 项目核心
- 项目 CRUD + 归档
- 需求 CRUD（名称、原始天数、依赖关系、并行调度、暂停剩余天数）
- 7 种变更：`add_days` / `new_requirement` / `cancel_requirement` / `supplement` (3 子型) / `reprioritize` / `pause` / `resume`
- 拖拽排序、截图证据（最多 3 张 base64）
- JSON 导入导出（手动）
- 演示数据自动种子（`demo-001`）

### 4.2 数据持久化保障 ✅ 已落地（旧 HANDOFF 称"未提交"）
- `db/connection.ts` — `navigator.storage.persist()` + `DB_VERSION` migration 框架（只有 v1，v2 占位）
- `db/autoBackup.ts` — 5s 防抖、4MB 上限、**两级**级联 trim（旧 HANDOFF 写"三级"是错的）：
  - L1: 砍掉所有 `change.screenshots`
  - L2: 清空 `changes` + `snapshots`
  - 双 slot：`KEY_LATEST` + `KEY_PREV` 自动滚动
  - `beforeunload` 强制刷盘
  - 静默吞错（quota 满等）
- `db/changeNotifier.ts` — 发布订阅，所有 repo 写操作都触发 `notifyDataChange()`
- `components/shared/RecoveryDialog.tsx` — 空 DB 启动检测 backup → 三按钮（恢复 / 下载备份 / 跳过）
- `App.tsx` 启动流程：`persist() → loadProjects → 空则查 backup → 弹对话框 / seedDemo`
- `SettingsPage` 显示：`上次备份：YYYY-MM-DD HH:mm:ss` 或 `暂无自动备份`

### 4.3 飞书 URL 需求导入 ✅ 已落地（旧 HANDOFF 称"设计阶段"）
- `services/feishuRequirement.ts`：
  - 解析飞书 URL（query / path segments / hash 三路 fallback）
  - 提取 `projectKey` / `workItemTypeKey` / `workItemId`
  - 支持域名：`feishu.cn` / `larksuite.com` / `meegle.com`
  - 调用 `/api/feishu/v5/workitem/v1/demand_fetch`（vite proxy 转发）
  - 三种状态：`fetched`（拿到 name+工期+owner+日期） / `url_only`（缺 keys） / `url_only+error`（请求失败）
  - 工期最小 0.5 天
- `services/feishuSettings.ts` + `checkProxyStatus()` 探活
- `hooks/useSyncFeishu.ts` — 列表"一键同步"，`Promise.allSettled` 并发
- `components/requirement/RequirementForm.tsx`：飞书 URL 输入框 + Wand2 图标 + 解析按钮 + 状态提示
  - `analyzeSeqRef` 防 stale response 覆盖（race condition 防御）
- `components/requirement/RequirementList.tsx`：「同步飞书」批量按钮
- `pages/SettingsPage.tsx`：飞书代理状态指示（绿/红/灰 + 重新检测）
- vite dev proxy：从 `~/.credential-center/feishu_project_state.json` 读 cookies 注入 Cookie/CSRF/Referer/Origin

### 4.4 测试覆盖
- 单元测试（vitest，`src/**/*.test.ts`）：
  - `db/__tests__/exportImport.test.ts`
  - `engine/__tests__/{changeProcessor, replayEngine, scheduler}.test.ts`
  - `services/__tests__/feishuRequirement.test.ts`
  - `utils/__tests__/validation.test.ts`
- E2E（Playwright，14 specs）：
  - 7 个变更类型各一 spec
  - chart-export / dnd-reorder / gantt-after-reorder / project / requirement / requirement-feishu-url / screenshot / settings-import-export
- helpers 完整：resetDB / createProject / addRequirement / openChangeModal / saveChange / selectTarget / confirmDialog / goToSettings

---

## 5. 真实剩余路线图（依重要性）

### P0 — 测试缺口闭环（C 阶段最后一块）
旧 HANDOFF 第 6 节"补 RecoveryDialog 和 autoBackup 的 E2E"**确实没做**：

| 测试 | 类型 | 覆盖 |
|------|------|------|
| `e2e/recovery-dialog.spec.ts` | 缺 | 空 DB + 有 backup → 弹对话框 → 恢复/下载/跳过三路径 |
| `e2e/auto-backup.spec.ts` | 缺 | 写数据后 5s 内 localStorage 出现 backup；超 4MB 触发 trim |
| `src/db/__tests__/autoBackup.test.ts` | 缺 | 防抖逻辑、两级 trim、KEY_PREV 滚动 |
| `src/db/__tests__/changeNotifier.test.ts` | 缺 | 订阅/取消/批量通知 |

### P1 — 部署
公开仓没绑定 Pages / Vercel。可选（看 Boss 是否要发布）：
- GitHub Pages（vite build → gh-pages 分支 / Actions）
- Vercel（连 GitHub repo 自动部署）
- 当前 dev 环境依赖 `~/.credential-center/feishu_project_state.json`，部署到外网时**飞书代理失效**，需要降级为 `url_only` 模式（已实现，无需改代码）

### P2 — 治理（可选）
- 写项目自身 `CLAUDE.md`（让其他 AI 协作时有规范入口；当前根目录无）
- `AGENTS.md` 软链 + `.codex/skills` 双栈支持
- 替换 Vite 默认 `README.md`

---

## 6. 启动命令（Mac 实测）

```bash
cd /Users/hulu/huluman/scope-shield
npm install              # 首次或依赖变更后
npm run dev              # → http://localhost:5173/
npm run build            # tsc -b && vite build → dist/
npm run lint
npm test                 # vitest run
npm run test:watch
npm run test:e2e         # playwright test
npm run preview          # 预览生产构建
```

飞书代理生效条件（开发期）：
- `~/.credential-center/feishu_project_state.json` 存在且含 `cookies` 数组
- cookies 中至少有一个 `domain` 包含 `feishu.cn`
- 含 `meego_csrf_token` 的 cookie（用于 `x-meego-csrf-token` 头）

---

## 7. 数据流（一图理解）

```
┌──────────────┐
│  UI (React)  │ ─── 用户操作 ───▶ Stores (Zustand) ─── 调 ─▶ Repo (db/*)
└──────────────┘                                                │
       ▲                                                        ▼
       │                                                 IndexedDB (idb)
       │                                                        │
       │                                              changeNotifier.notify()
       │                                                        │
       │                                                        ▼
       │                                              autoBackup (5s 防抖)
       │                                                        │
       │                                                        ▼
       │                                              localStorage(KEY_LATEST/PREV)
       │                                                        │
   恢复对话框 ◀── 启动空 DB 检测 backup ────────────────────────┘
```

```
飞书 URL 输入 ─▶ parseFeishuProjectUrl
                       │
                       ▼
              source: {projectKey, workItemTypeKey, workItemId}
                       │
                       ▼
        fetch('/api/feishu/v5/workitem/v1/demand_fetch')
                       │
            vite proxy 注入 cookie + CSRF
                       │
                       ▼
                feishu-project API
                       │
        json.code === 0 ? mapDemandFetchToDraft : urlOnlyDraft
                       │
                       ▼
         RequirementDraft (status: fetched | url_only)
                       │
                       ▼
            RequirementForm 自动填名称 + 工期 + 提示
```

---

## 8. 关键约束 & 已知坑

- **DB_VERSION 升级必须写 migration**：`db/connection.ts` upgrade 回调按 oldVersion 分支；Schema 改动忘记升级 = 老用户库炸
- **localStorage 4MB 上限**：超过会两级 trim；浏览器配额不足时 `doBackup` 静默吞错（best effort）
- **飞书代理仅 dev 期**：production 环境 `/api/feishu` 没人转发，`analyzeFeishuRequirementUrl` 自动降级 `url_only`
- **e2e helpers 假设侧栏按钮文案**："新建项目" / "添加需求" / "记录变更" / "设置"——改文案要同步改 helpers
- **没有 git remote 之外的发布通道**：HEAD push 后 Windows 端 `git pull` 即拿到全部
- **scripts/test-*.ts 与 verify-*.ts 已 .gitignore**：本地一次性手动验证脚本，非回归套件

---

## 9. 历史交接

| 日期 | 事件 |
|------|------|
| 2026-04-29 | Windows → Mac 项目 zip 邮件交接（base commit `4945737`，11 mod + 1 del + 30 untracked） |
| 2026-04-30 | Mac 落盘整理：4 commit 推上 GitHub PUBLIC `MrHulu/scope-shield`，HEAD 推进到 `28320b1`，Windows 转为消费方 |

---

> 维护契约：本文档每次架构/功能变动后**必须刷新**；若秘书/AI 引用本文档与代码现实不一致，以代码为准并立刻修订本文。
