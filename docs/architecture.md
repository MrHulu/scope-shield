# Scope Shield — 技术架构

## 范围

MVP 的技术栈、仓库结构、模块边界、状态管理、数据层、图表引擎、导出方案、错误处理、测试策略。

## 非范围

- CI/CD 流水线配置
- 云部署架构
- 后端 API 设计

## 假设

- 纯前端 SPA，无后端
- IndexedDB 为唯一持久层
- 目标浏览器：Chrome 90+、Safari 16+、Firefox 100+、Edge 90+

## 依赖

- docs/data-model.md 数据模型
- docs/ui-spec.md UI 规格
- docs/flows.md 业务流程

---

## 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | React 18+ | 组件化、生态成熟、Boss 确认 |
| 语言 | TypeScript 5+ | 类型安全、重构友好 |
| 构建 | Vite | 快速开发、HMR |
| 路由 | React Router v6 | 轻量、声明式 |
| 状态管理 | Zustand | 轻量、无 boilerplate、适合中小应用 |
| 数据层 | idb (IndexedDB 封装) | Promise-based、轻量 |
| 图表 | 自研 SVG (React 组件) | 完全可控、不依赖 D3 |
| 导出 | modern-screenshot ^4（html-to-image 替代，SVG/ShadowDOM 兼容性更好，无 foreignObject 空白 bug。锁定主版本避免 breaking change） | DOM → Canvas → PNG |
| 样式 | Tailwind CSS | 原子化、快速开发 |
| 图标 | Lucide React | 轻量、一致性 |
| 拖拽 | @dnd-kit/core | 需求排序 |
| UUID | crypto.randomUUID()（Chrome 92+；低版本 fallback 用 uuid 库） | 浏览器原生优先 |
| 日期 | date-fns | 轻量、tree-shakable |

---

## 仓库结构

```
scope-shield/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                    # 入口
│   ├── App.tsx                     # 根组件 + 路由
│   │
│   ├── components/                 # UI 组件
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # 侧边栏（项目列表）
│   │   │   └── MainLayout.tsx      # 整体布局
│   │   │
│   │   ├── project/
│   │   │   ├── ProjectHeader.tsx   # 项目头部 + 统计卡片
│   │   │   ├── ProjectSettings.tsx # 项目设置（归档/恢复）
│   │   │   └── StatsCard.tsx       # 统计卡片组件
│   │   │
│   │   ├── requirement/
│   │   │   ├── RequirementList.tsx # 需求列表
│   │   │   ├── RequirementRow.tsx  # 单行需求
│   │   │   ├── RequirementForm.tsx # 添加/编辑需求表单
│   │   │   └── DependencyPicker.tsx# 依赖选择器
│   │   │
│   │   ├── change/
│   │   │   ├── ChangeList.tsx      # 变更记录列表
│   │   │   ├── ChangeRow.tsx       # 单条变更
│   │   │   ├── ChangeModal.tsx     # 记录变更弹窗
│   │   │   └── PersonNameInput.tsx # 人名自动补全
│   │   │
│   │   ├── chart/
│   │   │   ├── ChartArea.tsx       # 图表区域 + Tab 切换
│   │   │   ├── SimpleChart.tsx     # 简洁版（膨胀对比条）
│   │   │   ├── DetailChart.tsx     # 详细版（时间线+甘特）
│   │   │   └── ExportModal.tsx     # 导出弹窗
│   │   │
│   │   ├── export/
│   │   │   ├── ExportRenderer.tsx  # 导出专用渲染器（Apple 风格）
│   │   │   ├── ExportSimple.tsx    # 导出用简洁版
│   │   │   └── ExportDetail.tsx    # 导出用详细版
│   │   │
│   │   └── shared/
│   │       ├── ConfirmDialog.tsx   # 确认弹窗
│   │       ├── EmptyState.tsx      # 空状态组件
│   │       └── Toast.tsx           # 提示消息
│   │
│   ├── pages/
│   │   ├── ProjectPage.tsx         # 项目详情页
│   │   ├── SettingsPage.tsx        # 设置页
│   │   └── NotFoundRedirect.tsx    # 无效路由重定向
│   │
│   ├── stores/                     # 状态管理
│   │   ├── projectStore.ts         # 项目状态
│   │   ├── requirementStore.ts     # 需求状态
│   │   ├── changeStore.ts          # 变更状态
│   │   └── uiStore.ts             # UI 状态（当前项目、Tab、lastVisitedProjectId 等）
│   │
│   ├── db/                         # 数据层
│   │   ├── schema.ts              # IndexedDB schema 定义
│   │   ├── connection.ts          # 数据库连接管理
│   │   ├── projectRepo.ts         # Project CRUD
│   │   ├── requirementRepo.ts     # Requirement CRUD
│   │   ├── changeRepo.ts          # Change CRUD
│   │   ├── snapshotRepo.ts        # Snapshot CRUD
│   │   ├── personNameRepo.ts      # PersonNameCache CRUD
│   │   └── exportImport.ts        # JSON 导入/导出
│   │
│   ├── engine/                     # 计算引擎
│   │   ├── scheduler.ts           # 最长路径 + 依赖调度
│   │   ├── changeProcessor.ts     # 变更处理（应用变更到需求）
│   │   ├── replayEngine.ts        # Snapshot Replay（变更删除/编辑后重算）
│   │   └── snapshotManager.ts     # 快照管理
│   │
│   ├── hooks/                      # 自定义 Hooks
│   │   ├── useProject.ts          # 项目数据 + 操作
│   │   ├── useRequirements.ts     # 需求列表 + 操作
│   │   ├── useChanges.ts          # 变更列表 + 操作
│   │   ├── useSchedule.ts         # 调度计算结果
│   │   └── useExport.ts           # 导出逻辑
│   │
│   ├── utils/
│   │   ├── date.ts               # 日期工具
│   │   ├── id.ts                 # UUID 生成
│   │   └── validation.ts         # 表单验证
│   │
│   ├── types/
│   │   └── index.ts              # TypeScript 类型定义
│   │
│   ├── constants/
│   │   ├── roles.ts              # 角色枚举
│   │   ├── changeTypes.ts        # 变更类型枚举
│   │   └── demo.ts               # Demo 数据
│   │
│   └── styles/
│       ├── index.css             # 全局样式 + Tailwind 指令
│       └── export-theme.css      # 导出 Apple 风格变量
│
├── tests/
│   ├── engine/
│   │   ├── scheduler.test.ts     # 最长路径算法测试
│   │   ├── replayEngine.test.ts  # Snapshot Replay 正确性测试
│   │   └── changeProcessor.test.ts
│   ├── db/
│   │   └── repos.test.ts         # 数据层测试
│   └── components/
│       └── ChangeModal.test.ts   # 关键组件测试
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

---

## 模块边界

```
┌─────────────────────────────────────────────────────┐
│                    Components (UI)                    │
│  Layout │ Project │ Requirement │ Change │ Chart     │
└────────────────────┬────────────────────────────────┘
                     │ 调用 hooks
┌────────────────────┴────────────────────────────────┐
│                    Hooks (胶水层)                     │
│  useProject │ useRequirements │ useChanges │ ...     │
└────────┬─────────────────┬──────────────────────────┘
         │ 调用 store       │ 调用 engine
┌────────┴──────┐  ┌───────┴──────────────────────────┐
│  Stores       │  │  Engine (纯逻辑)                  │
│  (Zustand)    │  │  scheduler │ changeProcessor      │
└───────┬───────┘  └──────────────────────────────────┘
        │ 调用 db
┌───────┴───────────────────────────────────────────────┐
│                    DB (数据层)                         │
│  schema │ connection │ repos │ exportImport            │
└───────────────────────────────────────────────────────┘
        │
   [IndexedDB]
```

**规则**：
- Components 只通过 Hooks 访问数据和逻辑
- Hooks 组合 Store 和 Engine
- Engine 是纯函数，不依赖任何状态库或 DB
- Store 通过 Repo 读写 DB
- DB 层封装所有 IndexedDB 操作

---

## 状态管理设计

### Zustand Store 架构

```typescript
// projectStore.ts
interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  lastVisitedProjectId: string | null;  // 持久化到 localStorage，路由降级用
  loadProjects: () => Promise<void>;
  createProject: (name: string, startDate: string) => Promise<Project>;
  updateProject: (id: string, data: { name: string }) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  setCurrentProject: (id: string) => void;
}

// requirementStore.ts
interface RequirementStore {
  requirements: Requirement[];  // 当前项目的需求
  loadRequirements: (projectId: string) => Promise<void>;
  addRequirement: (data: CreateRequirementInput) => Promise<Requirement>;
  updateRequirement: (id: string, data: Partial<Requirement>) => Promise<void>;
  deleteRequirement: (id: string) => Promise<void>;
  reorderRequirements: (ids: string[]) => Promise<void>;
}

// changeStore.ts
interface ChangeStore {
  changes: Change[];  // 当前项目的变更
  loadChanges: (projectId: string) => Promise<void>;
  recordChange: (data: CreateChangeInput) => Promise<Change>;
  updateChange: (id: string, data: Partial<Change>) => Promise<void>;
  deleteChange: (id: string) => Promise<void>;
}
```

### 数据流

```
用户操作 → Component → Hook → Store action → DB write → Store update → re-render
                                    ↓
                              Engine 重算 → 更新计算字段
                                    ↓
                              Snapshot 保存（变更时）
```

---

## 计算引擎

### scheduler.ts — 最长路径算法

```
输入：requirements: Requirement[], daysKey: "currentDays" | "originalDays"
  - currentTotalDays 计算时：传入 active 状态需求，daysKey="currentDays"
  - originalTotalDays 计算时：传入所有 isAddedByChange=false 的需求（含 paused/cancelled），daysKey="originalDays"。注意：基线模式下不应用 status-based 依赖松弛规则（暂停/取消的依赖不解除），所有需求均以 originalDays 参与调度
输出：ScheduleResult { requirementSchedules, totalDays, criticalPath }

算法：
1. 构建邻接表（dependsOn → 被依赖者）
2. 拓扑排序（Kahn's algorithm）
3. 正向遍历，计算每个需求的最早开始/结束时间（半开区间 [startDay, endDay)）
   - 无依赖：startDay = 0
   - 有依赖：startDay = 前驱需求的 endDay（MVP 为单一依赖，直接取 dependsOn 的 endDay）
   - endDay = startDay + requirement[daysKey]（使用传入的 daysKey 参数：currentDays 或 originalDays）
   - 日历映射：startDate = project.startDate + startDay，endDate = project.startDate + endDay - 1（含尾日）
4. totalDays = max(所有 endDay)
5. 逆向追踪关键路径
```

**循环依赖检测**：拓扑排序时检测，有环则抛出 CyclicDependencyError。

**依赖边界处理**（与 data-model.md 一致，**仅适用于 daysKey="currentDays" 模式**）：
- A paused → B 依赖 A：B 的依赖暂时解除（startDay=0，视为无依赖）
- A cancelled → B 依赖 A：B.dependsOn 自动清除为 null
- A 被删除 → B 依赖 A：B.dependsOn 自动清除为 null，提示用户"依赖已解除"

**基线模式（daysKey="originalDays"）**：上述 status-based 依赖松弛规则**不生效**。所有需求无论 status 均以 originalDays + 原始依赖关系参与调度。

### changeProcessor.ts — 变更处理器

```
输入：change: CreateChangeInput, requirements: Requirement[]
输出：ProcessResult { updatedRequirements, newRequirement? }

处理逻辑（按 type 分发）：
- add_days → 目标需求 currentDays += daysDelta
- new_requirement → 创建新需求 (isAddedByChange=true) + 记录变更
- cancel_requirement → 目标需求 status = "cancelled"（currentDays 保留取消前的值，不置零），daysDelta = -currentDays，metadata 自动回写 { cancelledRequirementName: 目标需求名, cancelledDays: currentDays }
- reprioritize → 调整 sortOrder（不影响工期），daysDelta = 0
- pause → 目标需求 status = "paused", 用户输入 pausedRemainingDays
- resume → 目标需求 status = "active", currentDays = pausedRemainingDays, daysDelta = 0
```

### replayChanges — Snapshot Replay 重算

```
输入：changes: Change[]（按 date+createdAt 排序），baseRequirements: Requirement[]（isAddedByChange=false 的）
输出：ReplayResult { requirements, changes（daysDelta 可能更新）, totalDays }

算法（与 data-model.md §变更重算策略 完全一致）：
1. 确定基线需求集：所有 isAddedByChange=false 的需求，恢复字段：currentDays=originalDays, status="active", pausedRemainingDays=null（保留 dependsOn 和 sortOrder）
2. 删除所有 isAddedByChange=true 的需求（replay 中由 new_requirement 重新创建）
3. 按 change.date + change.createdAt 排序剩余变更（同日按 createdAt 升序）
4. 依次调用 changeProcessor 应用每条变更（**状态守卫：每步先检查目标需求当前 status，不符则跳过**）：
   - add_days → 若 status ≠ "active" 则跳过；否则 currentDays += daysDelta
   - new_requirement → 创建新需求（isAddedByChange=true，**复用原需求 ID**），daysDelta = 新需求天数
   - cancel_requirement → 若 status ≠ "active" 则跳过（仅 active 需求可取消——已取消不重复取消，已暂停需先恢复再取消）；否则 status=cancelled（currentDays 保留取消前的值，不置零），daysDelta 重算为 -currentDays（取消时的当前值），metadata 回写 cancelledRequirementName + cancelledDays
   - reprioritize → 更新 sortOrder，daysDelta=0
   - pause → 若 status ≠ "active" 则跳过；否则 status=paused，pausedRemainingDays=max(1, min(metadata.remainingDays ?? currentDays, currentDays))
   - resume → 若 status ≠ "paused" 则跳过；否则 status=active，currentDays=pausedRemainingDays，pausedRemainingDays=null，daysDelta=0
5. 更新所有 Change 记录的 daysDelta（cancel 类型会因前序变更不同而变化）
6. 调用 scheduler 计算总工期
7. 保存新的 snapshot：删除该项目所有旧 snapshot，然后为每条变更依次生成新 snapshot（snapshot.changeId = 对应变更 ID）
```

触发条件：
- `deleteChange` → 完整 replay
- `updateChange`（修改 type/target/daysDelta/date/metadata 中影响计算的字段时）→ 完整 replay。影响计算的 metadata 字段：pause 的 `remainingDays`、reprioritize 的 `fromPosition`/`toPosition`
- `editRequirement`（修改 originalDays 且有变更记录时）→ 完整 replay

**注意**：`deleteRequirement`（需求删除）**不经过 replayEngine**，仅触发 scheduler 重算。详见 data-model.md §删除策略。**删除时立即回写**：DB 层在删除需求的同一事务中，将所有 targetRequirementId 指向该需求的变更记录的 `metadata.deletedRequirementName` 回写为被删需求的名称（此操作在 scheduler 重算之前完成，确保 UI 可立即显示"需求名（已删除）"）。

**悬空 target 处理**：replay 中遇到 targetRequirementId 指向已删除需求的变更 → 跳过该条（不报错，不影响计算）。cancelled 需求的后续 add_days → 跳过。

---

## 数据层

### IndexedDB Schema

```typescript
// schema.ts
const DB_NAME = 'scope-shield';
const DB_VERSION = 1;

const stores = {
  projects: {
    keyPath: 'id',
    indexes: ['status', 'createdAt']
  },
  requirements: {
    keyPath: 'id',
    indexes: ['projectId', 'status', 'sortOrder']
  },
  changes: {
    keyPath: 'id',
    indexes: ['projectId', 'date', 'type']
  },
  snapshots: {
    keyPath: 'id',
    indexes: ['projectId', 'createdAt']
  },
  personNameCache: {
    keyPath: 'id',
    indexes: [
      { name: 'name', unique: true },
      'usageCount'
    ]
  }
};
```

### 事务策略

| 操作 | 事务模式 | 涉及 Store |
|------|----------|-----------|
| 读取项目详情 | readonly | projects, requirements, changes |
| 记录变更 | readwrite | changes, requirements, snapshots, personNameCache |
| 删除变更 | readwrite | changes, requirements, snapshots |
| JSON 导入 | readwrite | 全部（清空 + 写入，单事务） |

---

## 图表引擎

### 渲染架构

```
数据 → ScheduleResult → ChartData 转换 → React SVG 组件 → DOM
                                                        → 导出渲染
```

### 简洁版 SVG 结构

```xml
<svg width="{widthPx}" height="{heightPx}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <!-- 原始计划条 -->
  <rect class="plan-bar" ... fill="#2563EB" />
  <text>原始计划 {X}天</text>

  <!-- 实际工期条（分段） -->
  <rect class="actual-base" ... fill="#2563EB" />
  <rect class="change-segment" ... fill="{roleColor}" />
  <!-- 标注 -->
  <text class="change-label">{日期} {角色} {人名（如有）} {描述}</text>

  <!-- 底部总结（3 行固定格式） -->
  <text class="summary-line1">延期 {totalDelay} 天</text>
  <text class="summary-line2">{changeCount} 次变更 · {角色中文名×条数}</text>
  <text class="summary-line3">100% 来自需求变更 · 0 天来自开发</text>
</svg>
```

### 详细版 SVG 结构

```xml
<svg width="{widthPx}" height="{heightPx}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <!-- 时间线区域 -->
  <g class="timeline">
    <line class="timeline-axis" ... />
    <g class="timeline-entry">
      <circle /><text>{日期} {角色} {人名（如有）} {描述} {±X天}</text>
    </g>
  </g>

  <!-- 甘特区域 -->
  <g class="gantt">
    <g class="gantt-row">
      <text>{需求名}</text>
      <rect class="original" fill="#2563EB" />
      <rect class="change-delta" fill="{color}" />
    </g>
  </g>

  <!-- 底部汇总 -->
  <text>原计划 {originalTotalDays}天 → 实际 {currentTotalDays}天 · {changeCount}次变更 · {roleSummary} · 0天来自开发</text>
</svg>
```

### 角色 → 颜色映射

| 角色 | App 颜色 | 导出颜色 (Apple) |
|------|---------|-----------------|
| pm (产品经理) | #DC2626 | #FF3B30 |
| leader (领导) | #D97706 | #FF9500 |
| qa (测试) | #7C3AED | #AF52DE |
| other (其他) | #6B7280 | #8E8E93 |
| 节省(砍需求) | #059669 | #34C759 |
| 原始计划 | #2563EB | #007AFF |
| 新增需求(new_requirement) | #5B21B6 | #5856D6 |

**颜色规则**：变更段默认按角色着色。**例外**：`new_requirement` 类型段始终使用靛色（不按角色），确保与 QA 紫色视觉区分。**甘特混合着色**：`isAddedByChange=true` 的需求在详细版甘特中，原始天数部分整条靛色；若该需求后续有 `add_days` 变更，变更段仍按角色着色（不用靛色），仅原始天数部分为靛色。

**导入时数据规模校验**：JSON 导入流程（`dataService.ts`）在写入 IndexedDB 前校验单项目需求数 ≤ 50、变更数 ≤ 200，超出则拒绝导入并回滚。

---

## 导出方案

### 技术选型

**首选**：`modern-screenshot`（`domToPng` API，兼容性优于 html-to-image）
**备选**：`html-to-image`（如 modern-screenshot 有问题时切换）

> **为什么不用 html-to-image？** 该库有大量已知空白输出 bug：Safari foreignObject 安全限制、外部字体加载失败、离屏 fixed 定位元素渲染空白、Canvas 子元素丢失。modern-screenshot 使用不同的序列化方式，对 SVG 和 ShadowDOM 兼容性更好。

### 流程

```
1. 创建离屏 DOM 容器（absolute, left: -9999px, width = 指定宽度）
   ⚠️ 不要用 fixed 定位（html-to-image/modern-screenshot 对 fixed 节点有已知空白 bug）
2. 渲染 ExportRenderer 组件（Apple 风格 + 指定宽度）
   - 不使用 backdrop-filter（导出版用纯色模拟毛玻璃）
   - 必须设置 background-color: #ffffff（不能用 transparent）
3. 等待渲染完成（requestAnimationFrame + 100ms 延迟，确保 SVG 测量完成）
4. modern-screenshot domToPng / domToBlob，配置：
   - scale: 2（Retina 2x DPI）
   - backgroundColor: '#ffffff'
   - style: { fontFamily: 系统字体栈（不依赖外部字体） }
5. Canvas.toBlob('image/png') → Blob
6. 创建下载链接 → 文件名 `scope-shield-{项目名}-{YYYY-MM-DD}.png`（特殊字符替换为下划线）
7. 触发下载
8. 验证输出（Blob.size > 1024，否则重试一次 with fallback 方案）
9. 清理离屏 DOM
```

### 防空白图片策略（关键）

| 问题 | 解决方案 |
|------|---------|
| 外部字体加载失败 | **导出组件不使用 @import 外部字体**，仅用系统字体栈：`-apple-system, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif` |
| transparent 背景 | 导出容器和 card 都设 `background-color: #ffffff` |
| fixed 定位空白 | 离屏容器用 `position: absolute; left: -9999px`，不用 fixed |
| SVG 未渲染 | SVG 必须有显式 `width/height` 属性（不仅靠 viewBox），且 `xmlns="http://www.w3.org/2000/svg"` |
| 输出为空 | 检查 Blob.size > 1024 bytes，小于则重试一次。第二次仍失败则 Toast 提示"导出失败" |
| Safari foreignObject | SVG 内不使用 foreignObject（全部用原生 SVG 元素：rect/text/line/g） |

### 导出渲染器规范

```typescript
// ExportRenderer 组件约束
// 1. 不引入任何外部 CSS（@import url 禁止）
// 2. 所有样式 inline 或 CSS-in-JS
// 3. 背景色不透明（#ffffff）
// 4. SVG 显式设置 width/height 属性
// 5. 字体仅用系统字体栈
// 6. 不使用 backdrop-filter、canvas、video
// 7. 所有颜色用 hex 值（不用 rgba 中 alpha=0 的写法）
```

**跨浏览器注意**：导出渲染器（ExportRenderer）避免使用 `backdrop-filter`（Safari/Firefox 截图不一致），改用纯色半透明背景模拟毛玻璃效果。App 内显示仍可使用真实 `backdrop-filter`。

### 导出尺寸

| 预设 | 宽度 | 用途 |
|------|------|------|
| 手机 | 390px | 发群（默认） |
| 桌面 | 800px | 展示 |
| 自定义 | 用户输入 | 特殊需求 |

高度均为自适应内容。DPI: 2x（Retina 适配）。

**Retina 说明**：CSS 宽度 = 用户选择的宽度（如 390px），Canvas 实际像素宽度 = 2x（780px）。最终 PNG 为 780px × 自适应高度。

---

## 错误处理策略

| 层 | 策略 |
|----|------|
| DB 层 | try/catch + 抛出 DBError（区别于"空数据"状态，避免误触 Demo 创建） |
| Engine | 纯函数，输入不合法抛具体 Error（CyclicDependencyError 等） |
| Store | catch DB 错误，设置 error state |
| Hook | 暴露 error state，组件展示 |
| Component | 错误边界（ErrorBoundary）兜底 |
| 导出 | try/catch，失败显示 Toast "导出失败，请重试" |
| JSON 导入 | 验证失败不写入，显示具体错误 |

### 全局错误边界

```typescript
// App 级 ErrorBoundary
// 捕获未处理的渲染错误
// 显示"出了点问题，请刷新页面"
// 提供"导出数据"按钮（防止数据丢失）
```

---

## Demo 数据

**首次加载检测**：通过查询 projects store 是否有记录判断。DB 连接失败抛 DBError（不走 Demo 创建路径），仅 projects store 返回空数组时才触发 Demo 写入。

Demo 数据：

```typescript
const DEMO_PROJECT = {
  id: 'demo-001',
  name: 'CRM 系统重构',
  startDate: '2026-04-01',
  status: 'active',
  isDemo: true,
  requirements: [
    { id: 'req-001', name: '用户管理模块', originalDays: 8, currentDays: 12, isAddedByChange: false, dependsOn: null, status: 'active', sortOrder: 0 },
    { id: 'req-002', name: '订单系统', originalDays: 10, currentDays: 10, isAddedByChange: false, dependsOn: 'req-001', status: 'active', sortOrder: 1 },
    { id: 'req-003', name: '报表导出', originalDays: 5, currentDays: 5, isAddedByChange: false, dependsOn: null, status: 'cancelled', sortOrder: 2 },  // cancelled 保留 currentDays 原值，靠 status 排除出调度
    { id: 'req-004', name: '数据大屏', originalDays: 3, currentDays: 3, isAddedByChange: true, dependsOn: null, status: 'active', sortOrder: 3 },
  ],
  changes: [
    { type: 'add_days', targetRequirementId: 'req-001', description: '加RBAC权限模块',
      role: 'pm', personName: '张三', daysDelta: 4, date: '2026-04-05' },
    { type: 'new_requirement', targetRequirementId: 'req-004', description: '客户下周参观，要数据大屏',
      role: 'leader', personName: '王总', daysDelta: 3, date: '2026-04-08' },
    { type: 'cancel_requirement', targetRequirementId: 'req-003', description: 'MVP砍掉导出',
      role: 'pm', personName: '张三', daysDelta: -5, date: '2026-04-10',
      metadata: { cancelledRequirementName: '报表导出', cancelledDays: 5 } },
  ]
  // Demo 展示要点：
  // - 含依赖关系（req-002 依赖 req-001）→ 总工期 = 12+10 = 22天
  // - 含3种变更类型（加天数、新需求、砍需求）→ 图表丰富
  // - 含绿色"节省"段 → 展示砍需求效果
  // - originalTotalDays = max(8+10, 5) = 18天（req-001→002 串行 + req-003 并行）
  // - currentTotalDays = max(12+10, 3) = 22天（req-003 已砍不计）
  // - 膨胀率 = (22-18)/18 = +22%
};
```

**Demo 恢复规则**：归档后恢复 Demo 项目时，重写为上述初始 Demo 数据（用户修改被重置）。

---

## 测试策略

| 层 | 工具 | 覆盖目标 |
|----|------|---------|
| Engine | Vitest | 最长路径算法、变更处理器、边界用例 |
| DB | Vitest + fake-indexeddb | CRUD 操作、事务完整性 |
| Components | Vitest + Testing Library | 关键交互：变更弹窗、需求列表 |
| E2E | Playwright (V1.1) | 完整流程：创建→变更→导出 |

### 优先测试

1. `scheduler.ts` — 最长路径算法正确性（核心）
2. `changeProcessor.ts` — 6 种变更类型全覆盖
3. `replayEngine.ts` — 删除/编辑变更后 replay 正确性
4. `exportImport.ts` — JSON 导入验证 + 事务回滚
5. `ChangeModal` — 30 秒流程可用性

---

## 性能考量

| 场景 | 目标 | 策略 |
|------|------|------|
| 图表渲染 | < 500ms | SVG 直接渲染，无动画 |
| 变更保存 | < 200ms | 单事务写入 |
| 项目切换 | < 300ms | 按需加载当前项目数据 |
| PNG 导出 | < 3s | 离屏渲染 + 2x DPI |
| 首次加载 | < 2s | Vite 代码分割 + 按需导入 |
| Replay（200条变更） | < 1s | 纯内存计算，无 DB I/O |

**数据规模上限**：单项目最大 50 需求 + 200 变更记录，超出时 UI 阻止添加。此上限保证 replay 和图表渲染在性能目标内。

**限制执行点**：
| 操作 | 检查位置 | 行为 |
|------|---------|------|
| 添加需求（"+ 添加需求"按钮） | `requirementStore.addRequirement` | 当前项目需求数 ≥ 50 → 阻止添加，Toast "已达需求上限(50)" |
| 记录变更 — 新增需求 | `changeProcessor`（new_requirement 类型处理） | 当前项目需求数 ≥ 50 → 阻止保存，Toast "已达需求上限(50)，无法新增" |
| 记录变更（所有类型） | `changeStore.recordChange` | 当前项目变更数 ≥ 200 → 阻止保存，Toast "已达变更记录上限(200)" |

**多 Tab 行为**：MVP 不保证多 Tab 数据一致性。IndexedDB 支持多 Tab 读写，但 Zustand Store 不跨 Tab 同步。行为定义：多 Tab 同时操作可能导致旧数据覆盖新数据，切换 Tab 后需手动刷新页面。V2 可考虑 BroadcastChannel API 实现跨 Tab 同步

---

## V2 预留接口

```typescript
// types/index.ts 中预留
interface Project {
  // ... MVP 字段
  _userId?: string | null;
  _teamId?: string | null;
  _feishuProjectId?: string | null;
}

interface Requirement {
  // ... MVP 字段
  _feishuTaskId?: string | null;
}

// db/schema.ts 中预留
// V2 新增索引：_userId, _teamId
// V2 新增 store：syncQueue（离线队列）
```

预留不影响 MVP 功能，仅在类型和 schema 中留位。

---

## 附录：定时清理

### PersonNameCache 90 天清理

触发时机：App 启动时（`useEffect` in App.tsx）。
逻辑：查询 `lastUsedAt < now - 90d` 的记录，批量删除。
频率：每次启动执行一次，轻量操作（通常 < 10 条）。
