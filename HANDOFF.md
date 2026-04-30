# Scope Shield 项目交接文档

> 项目范围膨胀可视化工具 | 2026-04-29

---

## 1. 项目概况

| 属性 | 值 |
|------|-----|
| 路径 | `G:\HuluMan\scope-shield\` |
| 技术栈 | React 19 + TypeScript + Vite 8 + Zustand 5 + IndexedDB (idb) + Tailwind CSS v4 |
| 测试 | Playwright 1.58 (58 E2E tests) |
| Git | master, 已 commit base `64a3721` |
| 状态 | ✅ TypeScript 零错误，Build 通过，**11 文件已修改 + 大量新增待提交** |

---

## 2. 核心功能

### 已上线 (committed)

- 项目管理：创建、归档、删除
- 需求 CRUD：增删改查、依赖关系、并行调度
- 7 种变更类型：add_days / new_requirement / cancel / supplement / reprioritize / pause / resume
- 2 种图表：SimpleChart (膨胀对比条) + DetailChart (甘特时间线)
- 拖拽排序、截图证据、JSON 导入导出
- E2E 测试 58/58 全部通过

### 未提交新功能

**A. 数据持久化保障** (核心)

| 文件 | 功能 |
|------|------|
| `src/db/connection.ts` | 重写：navigator.storage.persist() 持久化申请 + DB_VERSION 迁移 |
| `src/db/autoBackup.ts` | localStorage 自动备份：5s 防抖、4MB 上限、三级级联 trim |
| `src/db/changeNotifier.ts` | 发布订阅：数据变更通知自动触发备份 |
| `src/db/snapshotRepo.ts` | IndexedDB 快照存储 |
| `src/db/personNameRepo.ts` | 人员姓名管理 |
| `src/components/shared/RecoveryDialog.tsx` | 空库启动时检测备份，一键恢复 |
| `src/App.tsx` | 启动时调用 persist() + 启动自动备份 + 恢复检测 |
| `src/pages/SettingsPage.tsx` | 增强导入导出，支持恢复选项 |
| `docs/data-durability-design.md` | 373行完整设计文档 |

设计目标：零静默丢失 + 自动备份 + Schema 可演进 + 一键恢复。

**B. 飞书 URL 需求导入** (设计阶段)

| 文件 | 说明 |
|------|------|
| `docs/vnext-feishu-url-requirement-design.md` | 304行设计文档 |
| `src/services/` | 飞书服务（API 调用层） |

支持粘贴飞书需求 URL 自动拉取名称/排期/负责人，本地保存 API 凭证。

**C. 测试增强**

- `src/db/__tests__/` — 数据库层单元测试
- `src/engine/__tests__/` — 引擎层单元测试
- `src/utils/__tests__/` — 工具层单元测试
- `e2e/` — E2E 测试用例

---

## 3. 验证结果

| 检查项 | 结果 |
|--------|------|
| TypeScript 类型检查 | ✅ 零错误 |
| Vite 生产构建 | ✅ dist/ 408KB (gzip 126KB) |
| npm run dev | 端口 5173，正常启动 |

---

## 4. 待提交文件清单

### 已修改 (11 files)

```
src/App.tsx                (+75 lines)
src/db/changeRepo.ts       (+4)
src/db/connection.ts       (+53)
src/db/exportImport.ts     (+22)
src/db/personNameRepo.ts   (+3)
src/db/projectRepo.ts      (+4)
src/db/requirementRepo.ts  (+7)
src/db/snapshotRepo.ts     (+3)
src/pages/SettingsPage.tsx (+54)
src/types/index.ts         (+17)
vite.config.ts             (+48)
```

### 新增源代码

```
src/db/autoBackup.ts
src/db/changeNotifier.ts
src/components/shared/RecoveryDialog.tsx
src/services/
src/utils/image.ts
src/engine/__tests__/
src/db/__tests__/
src/utils/__tests__/
```

### 设计文档

```
docs/data-durability-design.md (373行)
docs/vnext-feishu-url-requirement-design.md (304行)
```

### E2E 配置

```
e2e/
playwright.config.ts
```

### 忽略的临时文件

PNG 截图、test-results/、dist/、node_modules/、*.mjs 测试脚本未纳入打包。

---

## 5. 启动命令

```bash
export PATH="$PATH:/d/nodejs"
cd G:/HuluMan/scope-shield
npm run dev          # → http://localhost:5173/
npm run build        # 生产构建
npx playwright test  # E2E 测试
```

---

## 6. 下一步建议

1. 提交未提交改动（数据持久化 + 飞书 URL 需求）
2. 飞书 URL 需求从设计落地为代码
3. 补充 E2E 测试覆盖新增的 RecoveryDialog 和 autoBackup 流程
