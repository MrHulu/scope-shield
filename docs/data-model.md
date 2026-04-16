# Scope Shield — 数据模型

## 范围

MVP 的 IndexedDB 数据模型：实体、字段、关系、约束、索引、删除策略。

## 非范围

- 云端数据库 schema
- 用户/团队相关字段的实际使用

## 假设

- IndexedDB 作为唯一持久化层
- 单用户，无并发写入
- JSON 导入/导出使用相同模型

## 依赖

- 浏览器 IndexedDB API (idb 库封装)

---

## 实体关系

```
Project (1) ──→ (N) Requirement
Project (1) ──→ (N) Change
Project (1) ──→ (N) Snapshot
Requirement (1) ──→ (0..1) Requirement [dependency]
Change (N) ──→ (0..1) Requirement [targetRequirement]
```

**中心对象**：Project

---

## 实体字段字典

### Project

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | string (UUID) | 是 | auto | 主键 |
| name | string | 是 | — | 项目名称，≤ 100 字符 |
| startDate | string (ISO date) | 是 | 今天 | 项目开始日期 |
| status | enum | 是 | "active" | "active" \| "archived" |
| isDemo | boolean | 是 | false | 是否为 Demo 项目 |
| createdAt | string (ISO datetime) | 是 | auto | 创建时间 |
| updatedAt | string (ISO datetime) | 是 | auto | 最后更新时间 |
| _userId | string \| null | 否 | null | V2 预留：用户 ID |
| _teamId | string \| null | 否 | null | V2 预留：团队 ID |
| _feishuProjectId | string \| null | 否 | null | V2 预留：飞书项目 ID |

**索引**：status, createdAt

### Requirement

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | string (UUID) | 是 | auto | 主键 |
| projectId | string | 是 | — | 所属项目 ID（外键） |
| name | string | 是 | — | 需求名称，≤ 200 字符 |
| originalDays | number | 是 | — | 原始预估天数，≥ 0.5（支持 0.5 天粒度：0.5, 1, 1.5, 2...） |
| isAddedByChange | boolean | 是 | false | 是否由 new_requirement 变更创建（true 时不纳入 originalTotalDays） |
| currentDays | number | 是 | = originalDays | 当前天数（变更后），支持 0.5 天粒度 |
| status | enum | 是 | "active" | "active" \| "paused" \| "cancelled" |
| sortOrder | number | 是 | auto | 排序权重（优先级） |
| dependsOn | string \| null | 否 | null | 依赖的需求 ID |
| pausedRemainingDays | number \| null | 否 | null | 暂停时冻结的剩余天数，≥ 0.5 且 ≤ currentDays |
| createdAt | string (ISO datetime) | 是 | auto | 创建时间 |
| updatedAt | string (ISO datetime) | 是 | auto | 最后更新时间 |
| _feishuTaskId | string \| null | 否 | null | V2 预留：飞书任务 ID |

**索引**：projectId, status, sortOrder
**约束**：
- dependsOn 不能形成循环依赖（应用层校验）
- 依赖中的暂停/取消行为：A→B 依赖中，若 A 被暂停，B 的依赖**在调度时**暂时解除（视为无依赖，startDay=0），但 B.dependsOn 字段**不修改**（A 恢复后依赖自动恢复）；若 A 被取消或硬删除，B 的 dependsOn **永久清除为 null**

### Change

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | string (UUID) | 是 | auto | 主键 |
| projectId | string | 是 | — | 所属项目 ID（外键） |
| type | enum | 是 | — | "add_days" \| "new_requirement" \| "cancel_requirement" \| "supplement" \| "reprioritize" \| "pause" \| "resume" |
| targetRequirementId | string \| null | 否 | null | 关联需求 ID（新增需求时为新建的 ID） |
| role | enum | 是 | "pm" | "pm" \| "leader" \| "qa" \| "other" |
| personName | string \| null | 否 | null | 具体人名（可选） |
| description | string | 是 | — | 变更描述，≤ 500 字符 |
| daysDelta | number | 否 | 0 | 天数变化（正数增加，负数减少），支持 0.5 天粒度（0, 0.5, 1, 1.5...）。`add_days` 类型：≥ 0.5，且应用后 currentDays ≥ 0.5。`supplement` 类型：≥ 0（允许 daysDelta=0，表示范围变更但无天数影响；支持 0.5 天粒度）。**MVP 不支持减少已有需求天数**（无 reduce_days 类型）——如需缩减，使用 cancel_requirement + new_requirement 组合。其他类型由系统自动计算 |
| date | string (ISO date) | 是 | 今天 | 变更日期 |
| metadata | object \| null | 否 | null | 结构化扩展数据（见 metadata 结构定义） |
| createdAt | string (ISO datetime) | 是 | auto | 创建时间 |
| updatedAt | string (ISO datetime) | 是 | auto | 最后更新时间 |

**索引**：projectId, date, type
**role 映射**：pm=产品经理, leader=领导, qa=测试, other=其他

**metadata 结构定义**（按 type 不同）：

| type | metadata 字段 | 类型 | 说明 |
|------|--------------|------|------|
| reprioritize | `fromPosition` | number | 调整前的 sortOrder 位置（0-based，UI 展示时 +1 为 1-based） |
| reprioritize | `toPosition` | number | 调整后的 sortOrder 位置（0-based，UI 展示时 +1 为 1-based） |
| pause | `remainingDays` | number | 用户输入的剩余天数 |
| cancel_requirement | `cancelledRequirementName` | string | 被砍需求名称（冗余存储，防止需求删除后丢失） |
| cancel_requirement | `cancelledDays` | number | 被砍需求的 currentDays（冗余存储，用于图表绿色段宽度） |
| new_requirement | `newRequirementName` | string | 新增需求名称（冗余存储） |
| supplement | `subType` | enum | 补充子类型："feature_addition"（功能补充）\| "condition_change"（条件变更）\| "detail_refinement"（细节细化） |
| supplement | `cascadeTargets?` | string[] \| undefined | 级联影响的依赖需求 ID 列表（系统自动计算，记录时回写） |
| 所有 type | `deletedRequirementName?` | string \| undefined | 目标需求被硬删除后，系统回写原需求名称 |

### Snapshot

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | string (UUID) | 是 | auto | 主键 |
| projectId | string | 是 | — | 所属项目 ID |
| changeId | string | 是 | — | 触发此快照的变更 ID |
| data | object | 是 | — | 快照时刻的项目状态，结构见下方 |
| totalDays | number | 是 | — | 快照时的总工期 |
| createdAt | string (ISO datetime) | 是 | auto | 创建时间 |

**索引**：projectId, createdAt

**Snapshot.data 结构**：

```json
{
  "requirements": [
    { "id": "...", "name": "...", "originalDays": 8, "currentDays": 12,
      "status": "active", "isAddedByChange": false, "dependsOn": null,
      "sortOrder": 0, "pausedRemainingDays": null }
  ],
  "schedule": {
    "totalDays": 24,
    "originalTotalDays": 15,
    "requirementSchedules": [
      { "requirementId": "...", "startDay": 0, "endDay": 12 }
    ]
  }
}
```

### PersonNameCache

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | string (UUID) | 是 | auto | 主键 |
| name | string | 是 | — | 人名 |
| role | enum | 是 | — | 最近使用的角色 |
| usageCount | number | 是 | 1 | 使用次数（排序用） |
| lastUsedAt | string (ISO datetime) | 是 | auto | 最后使用时间 |

**索引**：name (unique), usageCount

---

## 删除策略

| 实体 | 策略 | 说明 |
|------|------|------|
| Project | 软删除（归档） | status → "archived"，数据保留 |
| Project (Demo) | 不可删除 | isDemo=true 时阻止删除 |
| Requirement | 硬删除 | 确认弹窗后删除，相关 Change 保留（Change.targetRequirementId 变为悬空引用，**同一 DB 事务中**立即回写 metadata.deletedRequirementName，UI 可立即显示"需求已删除"+ 原名称）。其他需求的 dependsOn 指向该需求的自动清除为 null。仅调度器重算（非完整 replay） |
| Change | 硬删除 | 确认弹窗后删除，触发 snapshot replay 重算（见变更重算策略） |
| Snapshot | 随 Change 删除 | Change 删除时对应 Snapshot 也删除 |
| PersonNameCache | 自动清理 | 超过 90 天未使用的记录自动清理 |

---

## 变更重算策略（Snapshot Replay）

编辑或删除变更记录后，需求状态无法通过简单的 +/- 回退。采用 **snapshot replay** 策略：

```
1. 确定基线需求集：所有 isAddedByChange=false 的需求，恢复字段：
   - currentDays = originalDays
   - status = "active"
   - pausedRemainingDays = null
   - dependsOn = 保留原值（依赖关系不受 replay 重置）
   - sortOrder = 保留原值（即用户最后一次拖拽排序的结果持久保留；replay 中 reprioritize 变更会覆盖对应需求的 sortOrder，未被 reprioritize 涉及的需求保持拖拽排序值）
2. 删除所有 isAddedByChange=true 的需求（replay 中由 new_requirement 重新创建）。**例外**：如果某条 `new_requirement` 变更的 `targetRequirementId` 指向的需求已被用户硬删除（即需求记录不存在，且变更的 `metadata.deletedRequirementName` 已回写），则 replay 时**不重建该需求**，跳过该变更（与悬空 target 处理规则一致）
3. 按 change.date + change.createdAt 排序剩余变更（同日按 createdAt 升序）
4. 依次重新应用每条变更：
   - add_days → 若目标需求 status ≠ "active" 则跳过（不对 paused/cancelled 需求加天数）；否则 currentDays += daysDelta
   - new_requirement → 创建新需求（isAddedByChange=true，**复用原需求 ID**——确保后续变更的 targetRequirementId 仍指向正确实体），daysDelta 同步为新需求天数
   - cancel_requirement → 若目标需求 status ≠ "active" 则跳过（仅 active 需求可取消——已取消不重复取消，已暂停需先恢复再取消）；否则 status=cancelled，currentDays 保留取消前的值（不置零），daysDelta 重算为 -currentDays（取消时的当前值）
   - supplement → currentDays += daysDelta（supplement **不受 status 限制**——active/paused/cancelled 需求均可应用，因为 supplement 记录的是"需求范围变更的事实"而非"工期调整"）。daysDelta=0 时仅记录变更事实，不改变 currentDays。若目标需求有依赖者且 metadata.cascadeTargets 存在，级联更新依赖需求的 currentDays
   - reprioritize → 更新 sortOrder，daysDelta=0
   - pause → 若目标需求 status ≠ "active" 则跳过（已暂停/已取消不重复暂停）；否则 status=paused，pausedRemainingDays=max(0.5, min(metadata.remainingDays ?? currentDays, currentDays))（clamp：≥0.5 且 ≤ currentDays，防止 0 天恢复；metadata.remainingDays 缺失时回退到 currentDays）
   - resume → 若目标需求 status ≠ "paused" 则跳过（未暂停不恢复，防止 pausedRemainingDays=null 崩溃）；否则 status=active，currentDays=pausedRemainingDays，pausedRemainingDays=null（清除暂停态残留），daysDelta=0
5. 更新所有 Change 记录的 daysDelta（cancel 类型会因前序变更不同而变化）
6. 重新计算总工期
7. 保存新的 snapshot（replay 后的 snapshot 处理策略：删除该项目所有旧 snapshot，然后为每条变更依次生成新 snapshot，每条 snapshot.changeId = 对应变更的 ID）
```

**触发条件**：
- 删除任意变更记录
- 编辑变更记录的 type、targetRequirementId、daysDelta、date 字段（date 影响 replay 顺序）
- 编辑变更记录的 metadata 中影响计算的字段：pause 类型的 `metadata.remainingDays`（影响 pausedRemainingDays）、reprioritize 类型的 `metadata.fromPosition`/`metadata.toPosition`（影响 sortOrder）

**编辑限制**：
- `new_requirement` 类型：可编辑描述、角色、人名、日期、天数。不可更改 type 和 targetRequirementId
- 其他类型：可编辑描述、角色、人名、日期、天数、targetRequirementId、type。**但 type 不可更改为 `new_requirement`**（因 new_requirement 需关联创建需求实体，无法通过编辑补建）。可选 type 范围：add_days、cancel_requirement、supplement、reprioritize、pause、resume
- 删除 `new_requirement` 变更时：级联删除关联需求（按§删除需求的统一合同回写 metadata.deletedRequirementName）。**级联影响**：删除关联需求时，其他以该需求为 target 的变更（如 add_days）同样执行§删除需求的统一合同——targetRequirementId 变为悬空引用，系统回写各自的 metadata.deletedRequirementName。然后 replay 剩余变更

**Replay 中悬空 target 处理**：
- 如果某条变更的 targetRequirementId 指向已被硬删除的需求：replay 时跳过该条变更（不报错），保留变更记录但不影响计算
- **`new_requirement` 变更的目标需求被硬删除**：replay 时跳过该条变更，不重建需求（与步骤 2 的例外规则一致）。判定依据：变更的 `metadata.deletedRequirementName` 已回写
- 已取消（cancelled）需求的后续 add_days 变更：replay 时跳过（对 cancelled 需求不再加天数）

**已知 MVP 限制**：
- **cancel/dependency replay-safety**：当 `cancel_requirement` 变更应用时，其他需求中 `dependsOn` 指向被取消需求的会被永久清除为 `null`（见§删除需求的统一合同）。如果该 cancel 变更后续被删除或编辑（触发 replay），已清除的 `dependsOn` 无法自动恢复——replay 步骤 1 中 `dependsOn = 保留原值`，但此时原值已是 `null`。**MVP 接受此限制**，用户需手动重新设置依赖关系

---

## 导入/导出格式

```json
{
  "version": "1.0",
  "exportedAt": "2026-04-11T12:00:00Z",
  "projects": [
    {
      "...project fields",
      "requirements": ["...requirement fields"],
      "changes": ["...change fields"],
      "snapshots": ["...snapshot fields"]
    }
  ],
  "personNameCache": ["...cache fields"]
}
```

**导入校验**（任一失败则整体回滚，不写入任何数据）：
1. **顶层结构**：version 字段必须存在且为 "1.0"（缺失或不匹配均拒绝）；projects 必须为数组
2. **必填字段**：
   - Project：id, name, startDate, status, createdAt, updatedAt
   - Requirement：id, projectId, name, originalDays, currentDays, status, isAddedByChange, sortOrder, createdAt, updatedAt
   - Change：id, projectId, type, role, description, date, createdAt, updatedAt
   - Snapshot：id, projectId, changeId, data, totalDays, createdAt
3. **格式校验**：
   - 日期字段（startDate, date）：ISO date 格式 `YYYY-MM-DD`
   - 时间字段（createdAt, updatedAt）：ISO datetime 格式
   - ID 唯一性：同类实体内 id 不可重复（如两个 requirement 不能有相同 id）
4. **外键引用完整性**：
   - requirement.projectId 必须存在于 projects 中
   - change.projectId 必须存在于 projects 中
   - change.targetRequirementId 若非 null：允许悬空引用（需求可能已被删除）。若有 metadata.deletedRequirementName 则 UI 显示原名称；若无则 UI 显示"需求已删除"（两种情况均允许导入）
   - requirement.dependsOn 若非 null 必须存在于同项目 requirements 中
   - snapshot.changeId 必须存在于对应 project 的 changes 中
5. **枚举值校验**：project.status（active/archived）、requirement.status（active/paused/cancelled）、change.type（add_days/new_requirement/cancel_requirement/supplement/reprioritize/pause/resume）、change.role（pm/leader/qa/other）必须为合法枚举值
6. **数据规模校验**：单项目需求数 ≤ 50、变更数 ≤ 200（超出则拒绝导入）
7. **数值范围校验**：originalDays ≥ 0.5、currentDays ≥ 0.5、sortOrder ≥ 0、add_days 类型的 daysDelta ≥ 0.5、supplement 类型的 daysDelta ≥ 0、pausedRemainingDays 若非 null 则 ≥ 0.5 且 ≤ currentDays
8. 失败时不写入任何数据（事务回滚），返回具体错误信息

---

## 基线管理规则

### 基线定义

**基线（baseline）**= 所有 `isAddedByChange=false` 需求的 `originalDays`，经最长路径算法计算出的 `originalTotalDays`。基线代表"如果没有任何外部变更，项目原本需要多少天"。

### 基线锁定时机

基线**不设显式锁定时间点**。用户始终可以通过以下两种方式影响基线：

| 操作 | 影响基线 | 处理方式 |
|------|----------|----------|
| **添加需求**（"+ 添加需求"按钮） | 是 | 新需求 `isAddedByChange=false`，`originalTotalDays` 按新需求集重算 |
| **编辑需求 originalDays** | 是 | 无变更记录时直接同步；有变更记录时触发 replay（currentDays 基于新 originalDays 重算） |
| **硬删除需求** | 是 | `originalTotalDays` 按剩余需求集重算 |
| **记录变更 → 新增需求** | 否 | 新需求 `isAddedByChange=true`，不纳入基线 |
| **记录变更 → 需求补充** | 否 | 只影响 `currentDays`（或 daysDelta=0 时无影响），不影响 `originalDays` |
| **记录变更 → 加天数/砍需求/暂停/恢复** | 否 | 只影响 `currentDays`/`status`，不影响 `originalDays` |

### 归因完整性保障

"0 天来自开发"的核心承诺通过以下机制保障：
1. **系统不提供"开发延期"变更类型**：4 种角色（pm/leader/qa/other）均为外部角色
2. **基线编辑透明**：用户直接编辑 originalDays 后，replay 会重算所有变更的 daysDelta，归因链完整保留
3. **添加需求 = 扩展基线**：开发者随时可以通过"+ 添加需求"扩展基线（不走变更流），这等价于"项目立项时就有这个需求"
4. **如需记录"这是外部要求加的需求"**：使用"记录变更 → 新增需求"，该需求 `isAddedByChange=true`，不纳入基线，膨胀率反映外部影响

### MVP 设计决策

MVP 不引入"基线锁定"状态机（如 draft → locked），因为：
- 目标用户（5-15 人团队开发者）场景简单，需求录入和变更记录通常交替进行
- 直接编辑需求会触发 replay，归因链不断裂
- 过度的流程控制违背"30 秒录入"的核心体验

---

## 责任归属算法

### 归因单位

责任归属以 **角色（role）** 为主要维度，**人名（personName）** 为辅助展示。

### 底部总结格式

图表底部总结区域展示以下信息（**简洁版**三行格式，**详细版**使用单行精简格式，见 ui-spec.md §详细版底部汇总）：

```
延期 {totalDelay} 天
{changeCount} 次变更 · {roleSummary}
{percentage}% 来自需求变更 · 0 天来自开发
```

#### totalDelay
`currentTotalDays - originalTotalDays`。若为负值显示"提前 {|totalDelay|} 天"（绿色）。若为 0 显示"延期 0 天"（灰色）。

#### roleSummary — 角色聚合规则

```
1. 收集所有 daysDelta ≠ 0 的变更（排除 reprioritize/pause/resume）
2. 按 role 分组，统计每组变更条数
3. 格式："{角色中文名}×{条数}" 按条数降序排列，用 " · " 分隔
4. 示例：产品经理×2 · 领导×1
```

**注意**：底部总结第二行中 `{changeCount}` 使用 `project.totalChanges`（所有变更记录总数，含 daysDelta=0 的 reprioritize/pause/resume），而 `{roleSummary}` 仅统计 daysDelta ≠ 0 的变更子集。两者口径不同是有意设计——总数反映变更活跃度，角色分组反映工期影响归因。

#### percentage
始终为 `100%`（MVP 不提供"开发延期"类型，所有记录的变更都来自需求变更）。当 totalDelay < 0 时，此行改为"需求变更被工期节省抵消"。totalDelay = 0 时仍显示"100% 来自需求变更 · 0 天来自开发"。

### 段宽总和 ≠ 总延期时的处理

底部 `totalDelay` 始终以关键路径差（`currentTotalDays - originalTotalDays`）为准，不引用段宽总和。两个数字独立展示，无需解释差异。MVP 不做非关键路径段的灰化处理（V1.1 可选优化）。

---

## 删除需求的统一合同

### 实体层面

| 对象 | 删除后行为 |
|------|-----------|
| 需求记录 | 硬删除，从 IndexedDB 移除 |
| 相关变更记录 | **保留**，`targetRequirementId` 变为悬空引用 |
| 变更 metadata | 系统回写 `metadata.deletedRequirementName`（原需求名称） |
| 其他需求 dependsOn | 指向该需求的 `dependsOn` 自动清除为 `null` |
| Snapshot | **不删除、不 replay**。旧 snapshot 保留历史状态。注意：后续若因其他变更的编辑/删除触发 replay，所有 snapshot 会按 replay 规则重建（§变更重算策略第7步），此时旧 snapshot 自然被替换 |

### 计算层面

| 计算 | 删除后行为 |
|------|-----------|
| originalTotalDays | 按剩余 `isAddedByChange=false` 需求重算 |
| currentTotalDays | 按剩余 active 需求重算（调度器重算，非 replay） |
| inflationRate | 基于新的 originalTotalDays 和 currentTotalDays 重算 |

### 图表层面

| 图表元素 | 删除后行为 |
|----------|-----------|
| 简洁版膨胀条 | 已删除需求相关的变更段**仍显示**（使用 `metadata.deletedRequirementName`），段标注追加"(已删除)" |
| 详细版时间线 | 变更事件仍显示，需求名后标注"(已删除)" |
| 详细版甘特 | 已删除需求**不显示行**（因需求记录已不存在） |
| 底部总结 | 基于关键路径重算后的 totalDelay |

### 设计理由

- **不触发 replay**：因为变更记录本身未改变，只是目标需求不存在了。replay 的触发条件是变更记录的增删改，不是需求的增删改
- **保留变更记录**：历史记录有审计价值，标注"已删除"足以让用户理解上下文
- **保留旧 snapshot**：snapshot 是变更时刻的历史快照，删需求不应改变历史记录

---

## 边界状态矩阵

| 状态 | 统计卡片 | 简洁版图表 | 详细版图表 | 导出图片 |
|------|----------|-----------|-----------|---------|
| **无需求** | 原始工期: 0天, 当前工期: 0天, 膨胀率: —, 变更: 0次 | "添加需求后即可看到图表" | "添加需求后即可看到图表" | 导出按钮置灰 |
| **有需求无变更** | 正常数值, 膨胀率 0% | 仅蓝色原始计划条 | 时间线: "暂无变更记录"；甘特: 纯蓝色条 | 可导出, 显示"暂无变更" |
| **全部需求取消** | 原始工期: X天（冻结基线）, 当前工期: 0天, 膨胀率: -100% | 蓝色原始条 + 绿色节省段, 底部"所有需求已取消" | 时间线正常; 甘特全灰删除线 | 可导出 |
| **全部需求暂停** | 原始工期: X天（冻结基线）, 当前工期: 0天, 膨胀率: -100% | 蓝色原始条, 底部"所有需求已暂停" | 时间线正常; 甘特全虚线边框+浅灰 | 可导出 |
| **无需求但有变更记录**（需求全部硬删除） | 原始工期: 0天, 当前工期: 0天, 膨胀率: —, 变更: N次 | 变更段仍显示（标注"已删除"），无原始计划条 | 时间线显示变更事件（标注"已删除"）；甘特无需求行 | 可导出（有变更记录即可） |
| **originalTotalDays=0** | 原始工期: 0天, 膨胀率: "—" | 无原始计划条, 仅变更段 | 时间线正常; 甘特正常 | 可导出, 膨胀率显示"—" |
| **DB 连接失败** | 不渲染 | 不渲染 | 不渲染 | 不可用。全屏错误: "请使用支持 IndexedDB 的浏览器" |
| **DB 写入失败** | 保持上次数据 | 保持上次渲染 | 保持上次渲染 | 保持原状态。Toast: "保存失败，请重试" |
| **导入回滚失败** | 保持原数据 | 保持原渲染 | 保持原渲染 | 保持原状态。Toast: "导入失败：{具体错误}" |
| **导出 PNG 空白** | — | — | — | 自动重试1次; 仍失败则 Toast "导出失败，请重试" |

---

## 计算字段（非持久化）

以下字段在运行时由引擎计算，不存入 IndexedDB：

| 字段 | 计算逻辑 |
|------|---------|
| project.originalTotalDays | 所有 **现存** isAddedByChange=false 的需求（**含 paused/cancelled 状态**），以其 **originalDays** 计算最长路径（含依赖）。**基线模式调度规则**：不应用 status-based 依赖松弛（暂停/取消的依赖不解除），所有需求均以 originalDays 参与调度——即调用 `scheduler(requirements, "originalDays")` 时忽略 status 字段。此值**不受变更操作影响**（暂停/取消/加天数均不改变它），但会因**基线需求集变化**而重算（添加新需求或硬删除需求）。**基线纳入规则**：用户通过"添加需求"按钮直接添加的需求 isAddedByChange=false，**无论何时添加**均纳入基线；通过"记录变更→新增需求"添加的 isAddedByChange=true，不纳入基线。**示例**：项目创建后添加 A(8天)，originalTotalDays=8；后添加 B(4天) 并行，originalTotalDays=max(8,4)=8；通过变更新增 C(5天)，originalTotalDays 仍=8（C 不纳入）；硬删除 A，originalTotalDays=4（只剩 B） |
| project.currentTotalDays | 所有 active 需求（含 new_requirement 新增的），按最长路径算法 |
| project.inflationRate | (currentTotalDays - originalTotalDays) / originalTotalDays × 100，四舍五入到整数。当 originalTotalDays = 0 时显示"—"（仅当项目无原始需求时发生） |
| project.totalChanges | count(changes) |
| project.supplementCount | count(changes where type="supplement")——包含 daysDelta=0 的补充记录，作为"温水煮青蛙"指标 |
| project.endDate | startDate + currentTotalDays - 1（包含起始日，与 requirement.endDate 口径一致） |
| requirement.startDay | 调度器计算的相对偏移天数（Day 0 起始）。无依赖=0；有依赖=前驱需求的 endDay |
| requirement.endDay | startDay + currentDays（半开区间：[startDay, endDay)。如 startDay=0, currentDays=8 → endDay=8） |
| requirement.startDate | project.startDate + startDay 天（日历日期）。如项目 4/1 + startDay 0 = 4/1 |
| requirement.endDate | project.startDate + endDay - 1 天（包含尾日。如 4/1 + 8 - 1 = 4/8） |
| change.savedDays | 仅 cancel_requirement 类型：被砍需求的 currentDays |

---

## 字段语义澄清

### sortOrder — 纯展示排序

`Requirement.sortOrder` 仅控制 UI 列表中的显示顺序，**不影响调度计算**。调度器仅依据 `dependsOn` 依赖关系计算最长路径。`reprioritize` 变更类型只改变 `sortOrder`，不影响工期。

### daysDelta — 简化归因模型

图表中的延期归因采用 **daysDelta 累加模型**（非关键路径归因）：
- 膨胀条中每段宽度 = 该变更的 `|daysDelta|`
- 底部总结中的"延期 X 天" = `currentTotalDays - originalTotalDays`
- `reprioritize` 类型的 `daysDelta = 0`，不在膨胀条中显示段
- `cancel_requirement` 的 `daysDelta` 存储为负数（= `-currentDays`），图表中显示为绿色"节省"段
- `new_requirement` 的 `daysDelta` = 新需求的天数（正数）
- `supplement` 的 `daysDelta` ≥ 0（允许 0），daysDelta > 0 时在膨胀条中显示玫瑰红段，daysDelta = 0 时不在膨胀条中渲染段（但计入 changeCount 和补充次数统计）
- `pause/resume` 的 `daysDelta = 0`，不在膨胀条中显示段

### daysDelta 累加 vs 关键路径 — 计算合同

图表采用 **daysDelta 累加模型**展示每次变更的"输入量"，而总工期通过**最长路径**计算实际项目天数。两者各司其职，数值可能不一致——这是有意设计，非 bug。

**合同规则**：
- **膨胀条每段宽度** = 该变更的 `|daysDelta|`（展示变更输入量）
- **总延期天数** = `currentTotalDays - originalTotalDays`（展示最长路径差异）
- **段宽度之和 ≠ 总延期天数**（当存在并行需求或非关键路径变更时）
- **膨胀率** = 总延期天数 / originalTotalDays × 100%

**示例 1：并行新增需求不影响关键路径**

```
初始：需求 A(8天)，无依赖
originalTotalDays = 8

变更：新增需求 B(5天)，与 A 并行，无依赖
→ daysDelta = +5
→ currentTotalDays = max(8, 5) = 8（关键路径仍为 A）
→ 总延期 = 8 - 8 = 0 天
→ 膨胀率 = 0%
→ 图表：膨胀条仍显示 +5 段（正常渲染，MVP 不做灰化），
  底部显示"延期 0 天"
```

**示例 2：串行变更叠加**

```
初始：A(8天) → B(4天) 依赖链
originalTotalDays = 12

变更 1：A 加天数 +3（PM 张三）→ A=11天
→ currentTotalDays = 11 + 4 = 15
变更 2：B 加天数 +2（测试 李四）→ B=6天
→ currentTotalDays = 11 + 6 = 17
→ 总延期 = 17 - 12 = 5 天
→ 段宽度之和 = 3 + 2 = 5 = 总延期 ✓（串行场景一致）
```

**示例 3：砍非关键路径需求**

```
初始：A(8天)、B(3天) 并行
originalTotalDays = 8（关键路径 = A）

变更：砍需求 B
→ daysDelta = -3
→ currentTotalDays = 8（关键路径仍为 A）
→ 总延期 = 0 天
→ 图表：显示绿色"节省 3 天"段（正常渲染，MVP 不做灰化），
  底部显示"延期 0 天"
```

**示例 4：混合场景**

```
初始：A(8天) → B(4天) 依赖，C(3天) 并行
originalTotalDays = 12

变更 1：A +4天（PM）→ daysDelta=+4，currentTotalDays=16
变更 2：新增 D(5天) 并行 → daysDelta=+5，currentTotalDays=max(16,5)=16
变更 3：砍 C → daysDelta=-3，currentTotalDays=16（C 非关键路径）
→ 总延期 = 16 - 12 = 4 天
→ 段宽度之和 = 4 + 5 + 3 = 12 ≠ 4
→ 图表：显示各段（+4红、+5靛色、-3绿色），所有段正常渲染（MVP 不做灰化），
  底部独立显示"延期 4 天"
```

**开发者实现要点**：
- 膨胀条的段宽度展示"变更输入量"，不需要与总延期数学匹配
- 当段总和 ≠ 总延期时，非关键路径的变更段可视觉降级（降低透明度或加标注）——V1.1 可选优化，MVP 直接显示所有段
- 底部"延期 X 天"始终以关键路径差为准，与段宽度独立

### pausedRemainingDays — 暂停时用户输入

暂停需求时，变更弹窗额外显示"剩余天数"输入框（默认 = `currentDays`，用户可手动修改）。此值存入 `Requirement.pausedRemainingDays`。恢复时 `currentDays` 替换为 `pausedRemainingDays`。

### isAddedByChange — 新增需求标记

由 `new_requirement` 变更创建的需求，`isAddedByChange = true`。计算 `originalTotalDays` 时排除这些需求，确保新增需求的天数体现在膨胀率中而非原始工期中。

### 枚举映射速查

| 数据层 (code) | 显示层 (UI) | 用于 |
|----------------|-------------|------|
| `"pm"` | 产品经理 | Change.role |
| `"leader"` | 领导 | Change.role |
| `"qa"` | 测试 | Change.role |
| `"other"` | 其他 | Change.role |
| `"add_days"` | 加天数 | Change.type |
| `"new_requirement"` | 新增需求 | Change.type |
| `"cancel_requirement"` | 砍需求 | Change.type |
| `"reprioritize"` | 调优先级 | Change.type |
| `"pause"` | 暂停 | Change.type |
| `"supplement"` | 需求补充 | Change.type |
| `"resume"` | 恢复 | Change.type |
