# Scope Shield — AI 协作入口

> 任何 AI（Claude / Codex / Cursor / Windsurf 等）在本仓库工作前必读本文。
>
> 配套：[HANDOFF.md](HANDOFF.md) 项目当前状态档案 / [README.md](README.md) 对外产品介绍 / [docs/](docs/) 设计与规范。

---

## 🎯 项目使命

**让项目范围蔓延（scope creep）肉眼可见**。每个需求加 / 改 / 砍 / 重排都被记录、归因、可视化。原计划 vs 现状两条线，复盘时谁在膨胀一目了然。

### 核心原则（违反任意一条 = 偏离方向）

1. **隐私优先** — 数据全在浏览器 IndexedDB，零账号 / 零遥测 / 零云同步
2. **本地为先** — 离线完整可用，飞书代理失败自动降级 url_only
3. **零静默丢失** — 任何写入都触发自动备份，空库启动检测备份并主动恢复
4. **变更可解释** — 不允许"无主"修改：每次 change 必含 type / role / 描述
5. **范围可演进** — DB schema 升级走 `db/connection.ts` 的 migration，不许暴力清库

---

## 🚫 红线（需 Boss 明示批准才能动）

| 行为 | 状态 | 原因 |
|------|------|------|
| 添加遥测 / analytics / 第三方追踪 SDK | ❌ 禁止 | 隐私优先原则 |
| 引入云端账号体系 / 远程同步 | ❌ 禁止 | 本地为先原则 |
| 把飞书凭证写进仓库（包括 .env、example、注释） | ❌ 禁止 | 凭证只能从 `~/.credential-center/` 读 |
| 跳过 DB_VERSION migration 直接改 schema | ❌ 禁止 | 老用户库会炸 |
| 改 `~/.credential-center/feishu_project_state.json` | ❌ 禁止 | 全局凭证仓，归 credential-center 管 |
| 切换 / 配置 / 建议任何代理（proxy）和节点 | ❌ 死命令 | Boss 跨项目死命令 |
| 在公开仓暴露内部 URL / 邮箱 / 真实人名 | ❌ 禁止 | 仓库是 PUBLIC |

---

## 🏗️ 架构概览

### 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 8 |
| 状态 | Zustand 5（4 个 store: project / requirement / change / ui） |
| 持久化 | IndexedDB (idb 8) + localStorage 自动备份 |
| 样式 | Tailwind CSS v4 |
| 路由 | react-router-dom 7 |
| 拖拽 | @dnd-kit |
| 测试 | Vitest（单元）+ Playwright 1.58（14 e2e specs） |

### 三层职责

```
UI (pages/components)  ←──  接收用户操作
       │
       ▼
Stores (zustand)        ←──  内存状态 + 调 repo
       │
       ▼
Repo (db/*Repo.ts)      ←──  IndexedDB 读写 + 触发 changeNotifier
       │
       ▼
changeNotifier ─▶ autoBackup (5s 防抖) ─▶ localStorage 双 slot
       │
       ▼
Engine (engine/*)       ←──  纯函数：scheduler / changeProcessor / replayEngine
```

**约束**：UI 只调 hook，hook 调 store，store 调 repo，repo 调 idb；engine 是纯函数，不依赖任何 IO。**不许跨层调用**（例如 component 直接 `import { getDB }`）。

### 关键模块

| 文件 | 职责 |
|------|------|
| `src/App.tsx` | 启动流程：`persist()` → 空库检测 → 弹 RecoveryDialog 或 seedDemo |
| `src/db/connection.ts` | DB_VERSION migration 框架（当前只有 v1） |
| `src/db/autoBackup.ts` | 5s 防抖、4MB 上限、两级 trim（L1 砍 screenshots / L2 砍 changes+snapshots） |
| `src/db/changeNotifier.ts` | 发布订阅，所有 repo 写入触发 `notifyDataChange()` |
| `src/services/feishuRequirement.ts` | URL 解析 + `/api/feishu` 代理调用 + 三态降级 |
| `src/engine/scheduler.ts` | 排期算法（依赖串行 + 并行 + 关键路径） |
| `src/engine/changeProcessor.ts` | 7 类 change 应用到需求列表 |
| `src/engine/replayEngine.ts` | 从 0 重放所有 change → 当前状态（用于校验一致性） |

---

## 📋 工作流

### Boss-Secretary-Subordinate 模式

| 角色 | 职责 |
|------|------|
| **Boss** | Hulu — 决策 / 审批 / 验收 |
| **Secretary** | ai-center 仓库的 Claude / Codex — 协调，**不在本项目写代码** |
| **本项目 Subordinate AI** | 在 `/Users/hulu/huluman/scope-shield` 直接执行的 AI（Claude Code / Codex / Cursor 等） |

### 控制接口

| 文件 | 用途 |
|------|------|
| `CLAUDE.md` | 本文件，AI 协作入口 |
| `HANDOFF.md` | 当前状态档案（功能完成度 / 未做项 / 数据流 / 已知坑） |
| `README.md` | 对外产品介绍 |
| `docs/*.md` | 设计与规范（PRD / 架构 / 数据模型 / 流程 / UI / 验收 / 持久化） |

### 周期规则

每次开发循环必须：

1. ✅ 读 `HANDOFF.md` 第 5 节"真实剩余路线图"
2. ✅ `git status` 看工作树
3. ✅ 执行一项任务（功能 / bug / 重构 / 测试）
4. ✅ 跑 `npm test` + `npm run test:e2e`（影响逻辑时）
5. ✅ Commit（小步、按主题）
6. ✅ 完成后**回写** HANDOFF.md（功能上线 / 测试新增 / 已知坑刷新）
7. ✅ Push 到 `origin/master`

### 验证标准（声称完成前必跑）

| 改动类型 | 必跑 |
|---------|------|
| 改 `src/engine/*` 纯函数 | `npm test` 通过 |
| 改 `src/db/*` repo | `npm test` 通过 + 手动 dev 验证写入持久化 |
| 改 `src/components/*` UI | `npm run dev` 实测交互 + 影响的 e2e 通过 |
| 改 `vite.config.ts` / 依赖 | `npm run build` 通过 |
| 改 `src/services/feishuRequirement.ts` | `feishuRequirement.test.ts` 全过 |

---

## 🧭 当前状态

| 项 | 值 |
|---|---|
| 主分支 | `master` |
| HEAD | 见 `git log --oneline -1`（每次 push 后会变） |
| 远端 | https://github.com/MrHulu/scope-shield (PUBLIC) |
| Mac 路径 | `/Users/hulu/huluman/scope-shield` (主开发) |
| Windows | `G:\HuluMan\scope-shield` (验收消费方，git pull only) |
| E2E | 58/58 passing |
| 测试缺口 | autoBackup + RecoveryDialog 单元/E2E 待补（HANDOFF P0） |

---

## 🎯 成功指标

### 隐私指标
- 零账号、零云同步、零追踪
- 凭证不入仓
- 离线完整功能

### 质量指标
- E2E 通过率 100%（当前 58/58）
- TypeScript 零错误（`tsc -b`）
- Build 体积 < 500 KB（gzip < 130 KB）

### 维护指标
- HANDOFF.md 与代码不同步 → 立即修订（这是契约）
- 每次 PR / commit 影响公共行为时同步更新 README + CLAUDE.md

---

## 📞 联系

- **仓库**：https://github.com/MrHulu/scope-shield
- **协作总枢纽（不直接写本项目代码）**：`/Users/hulu/huluman/ai-center` 的 Secretary AI

---

> **Remember**: 隐私优先 · 本地为先 · 零静默丢失 · 变更可解释 · 范围可演进
