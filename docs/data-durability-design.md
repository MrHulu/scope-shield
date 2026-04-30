# 数据持久化保障方案

> scope-shield 数据防丢设计，解决 IndexedDB 数据在迭代升级和浏览器清理中丢失的问题。

## 1. 问题诊断

### 1.1 现状

| 组件 | 文件 | 现状 | 风险 |
|------|------|------|------|
| 存储 | `src/db/connection.ts` | IndexedDB，`idb` 库封装 | 浏览器可随时回收 |
| Schema | `src/db/schema.ts` | `DB_VERSION = 1`，无迁移 | 升版本 = 数据清空 |
| 初始化 | `src/App.tsx:26` | 空库 → `seedDemoData()` | 数据丢失后被 demo 覆盖，无法察觉 |
| 备份 | `src/pages/SettingsPage.tsx` | 手动导出/导入 JSON | 用户不会每次手动备份 |
| 持久化申请 | 无 | 未调用 `navigator.storage.persist()` | 浏览器空间紧张时自动回收 |

### 1.2 数据丢失场景还原

```
用户录入数据 → 正常使用 → [触发事件] → IndexedDB 被清空 → 下次打开
→ loadProjects() 返回 [] → seedDemoData() 写入 demo → 用户数据永久消失
```

**触发事件**包括：

| 场景 | 概率 | 用户感知 |
|------|------|----------|
| 清除浏览器数据（勾选了"网站数据"） | 高 | 用户可能不知道会清 IndexedDB |
| 磁盘空间不足，Chrome eviction | 中 | 无任何提示，静默回收 |
| 开发迭代中换端口/域名 | 中 | IndexedDB 按 origin 隔离 |
| 隐私模式/访客模式 | 低 | 关窗口即清 |
| 未来 DB_VERSION 升级，upgrade 回调重建 store | 必然 | schema 迁移 = 数据全清 |

## 2. 设计目标

| 目标 | 度量 |
|------|------|
| **零静默丢失** | 任何导致数据消失的事件，用户必须看到明确提示 |
| **自动备份** | 无需用户手动操作，数据变更后自动产生可恢复的备份 |
| **Schema 可演进** | DB_VERSION 升级时增量迁移，不丢已有数据 |
| **恢复便捷** | 一键从最近备份恢复，无需找文件、选文件 |
| **不增加用户负担** | 所有保障机制对用户透明，只在异常时提示 |

## 3. 方案设计

### 3.1 持久化存储申请

**改动文件**：`src/App.tsx`

启动时调用 `navigator.storage.persist()`，申请持久化存储。成功后浏览器不会自动回收 IndexedDB。

```ts
// App.tsx useEffect 内，loadProjects 之前
if (navigator.storage?.persist) {
  const persisted = await navigator.storage.persisted();
  if (!persisted) {
    await navigator.storage.persist();
  }
}
```

**兼容性**：Chrome/Edge 自动授权（same-origin + 已有交互）。Firefox 会弹权限提示。Safari 支持但策略不同。不影响功能，只是防御层。

### 3.2 自动备份到 localStorage

**新建文件**：`src/db/autoBackup.ts`

核心思路：每次写操作后，将全量快照压缩存入 localStorage。localStorage 与 IndexedDB 是独立存储，IndexedDB 被清时 localStorage 大概率保留。

#### 3.2.1 备份策略

```
写操作（put/delete） → 触发 debounce 5s → exportAllData() → 压缩 → localStorage
```

| 参数 | 值 | 理由 |
|------|-----|------|
| Debounce | 5 秒 | 批量写入（如同步飞书）时避免频繁快照 |
| 保留份数 | 2 份（latest + previous） | localStorage 空间有限（5-10MB），2 份足够 |
| 压缩 | JSON string（暂不压缩） | 典型项目数据 < 100KB，无需 gzip |
| Key | `scope-shield-backup-latest` / `-previous` | 固定 key，滚动覆盖 |

#### 3.2.2 备份数据结构

```ts
interface AutoBackup {
  version: '1.0';
  createdAt: string;       // ISO datetime
  trigger: 'auto' | 'manual';
  projectCount: number;
  requirementCount: number;
  data: ExportData;        // 复用现有导出格式
}
```

#### 3.2.3 备份时机

| 时机 | 实现方式 |
|------|----------|
| 数据写入后 | 各 repo 函数调用后触发 debounced backup |
| 页面关闭前 | `beforeunload` 事件触发立即备份（跳过 debounce） |
| 手动触发 | 设置页「导出」按钮同时更新 localStorage 备份 |

#### 3.2.4 空间管理

```ts
function checkBackupSize(): { ok: boolean; sizeKB: number } {
  const latest = localStorage.getItem('scope-shield-backup-latest');
  const sizeKB = latest ? Math.round(latest.length / 1024) : 0;
  return { ok: sizeKB < 4000, sizeKB }; // 4MB 警戒线
}
```

超过 4MB 时：
- 仅保留 latest（删 previous）
- 从 ExportData 中剔除 screenshots（base64 大户）
- 仍然超过 → 降级为仅备份 projects + requirements（不含 changes/snapshots）

### 3.3 启动时数据完整性检测 + 自动恢复

**改动文件**：`src/App.tsx`

当前逻辑：

```ts
const loaded = await loadProjects();
if (loaded.length === 0) {
  await seedDemoData();  // ← 危险：无法区分"全新用户"和"数据丢失"
}
```

改为：

```ts
const loaded = await loadProjects();
if (loaded.length === 0) {
  const backup = getLatestBackup();
  if (backup && backup.projectCount > 0) {
    // 数据丢失！有备份 → 提示恢复
    showRecoveryDialog(backup);
  } else {
    // 全新用户，无历史数据 → 正常 seed demo
    await seedDemoData();
  }
}
```

#### 3.3.1 恢复对话框

```
┌─────────────────────────────────────────────┐
│  ⚠️ 检测到数据异常                            │
│                                              │
│  浏览器中的项目数据已丢失，但找到了自动备份：    │
│                                              │
│  📦 备份时间：2026-04-28 15:30               │
│     项目数：3  需求数：12                     │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 恢复备份  │  │ 下载备份  │  │ 从零开始  │   │
│  └──────────┘  └──────────┘  └──────────┘   │
│                                              │
│  「恢复备份」会还原上次的所有项目数据           │
│  「下载备份」先下载 JSON 再手动导入            │
│  「从零开始」使用空白演示项目                  │
└─────────────────────────────────────────────┘
```

**三个选项的行为**：

| 选项 | 行为 |
|------|------|
| 恢复备份 | `importData(backup.data)` → 刷新 stores → toast "已从备份恢复" |
| 下载备份 | 触发 JSON 下载（同手动导出），用户自行保管后 seed demo |
| 从零开始 | `seedDemoData()` → 正常启动（备份保留在 localStorage 不删） |

### 3.4 Schema 迁移框架

**改动文件**：`src/db/connection.ts`

当前 upgrade 回调只做 `createObjectStore`，无法处理已有数据库的 schema 升级。

改为版本化迁移：

```ts
export async function getDB(): Promise<IDBPDatabase<ScopeShieldDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ScopeShieldDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, tx) {
      // V0 → V1: 初始建表
      if (oldVersion < 1) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('status', 'status');
        projectStore.createIndex('createdAt', 'createdAt');

        const reqStore = db.createObjectStore('requirements', { keyPath: 'id' });
        reqStore.createIndex('projectId', 'projectId');
        reqStore.createIndex('status', 'status');
        reqStore.createIndex('sortOrder', 'sortOrder');

        const changeStore = db.createObjectStore('changes', { keyPath: 'id' });
        changeStore.createIndex('projectId', 'projectId');
        changeStore.createIndex('date', 'date');
        changeStore.createIndex('type', 'type');

        const snapStore = db.createObjectStore('snapshots', { keyPath: 'id' });
        snapStore.createIndex('projectId', 'projectId');
        snapStore.createIndex('createdAt', 'createdAt');

        const nameStore = db.createObjectStore('personNameCache', { keyPath: 'id' });
        nameStore.createIndex('name', 'name', { unique: true });
        nameStore.createIndex('usageCount', 'usageCount');
      }

      // V1 → V2: 示例 — 给 requirements 加 index
      // if (oldVersion < 2) {
      //   const reqStore = tx.objectStore('requirements');
      //   reqStore.createIndex('newField', 'newField');
      // }
    },
  });

  return dbInstance;
}
```

**关键变化**：`oldVersion < N` 条件分支，而非无条件 `createObjectStore`。已有数据库打开时 `oldVersion = 1`，跳过 V1 建表，只执行增量迁移。

### 3.5 数据变更通知总线（支撑自动备份）

**新建文件**：`src/db/changeNotifier.ts`

各 repo 写操作后发出通知，autoBackup 模块监听：

```ts
type Listener = () => void;
const listeners: Listener[] = [];

export function onDataChange(fn: Listener) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function notifyDataChange() {
  for (const fn of listeners) fn();
}
```

各 repo 的写操作函数末尾加一行：

```ts
// projectRepo.ts — createProject, updateProject, putProject
await db.put('projects', project);
notifyDataChange();
```

autoBackup 在 App 初始化时注册：

```ts
onDataChange(debouncedBackup); // 5s debounce
```

## 4. 文件清单

| 文件 | 操作 | 内容 |
|------|------|------|
| `src/db/autoBackup.ts` | **新建** | 自动备份逻辑（写入/读取/清理 localStorage） |
| `src/db/changeNotifier.ts` | **新建** | 数据变更事件总线 |
| `src/db/connection.ts` | **修改** | upgrade 回调改为版本化迁移 |
| `src/App.tsx` | **修改** | 持久化申请 + 启动恢复检测 |
| `src/components/shared/RecoveryDialog.tsx` | **新建** | 数据恢复对话框 |
| `src/db/projectRepo.ts` | **修改** | 写操作后 `notifyDataChange()` |
| `src/db/requirementRepo.ts` | **修改** | 同上 |
| `src/db/changeRepo.ts` | **修改** | 同上 |
| `src/db/snapshotRepo.ts` | **修改** | 同上 |
| `src/db/seedDemo.ts` | **修改** | 移除直接调用，由 App.tsx 控制时机 |

## 5. 数据流

```
                    ┌─────────────────────────────────────┐
                    │           App 启动                    │
                    └─────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼───────────────────────┐
                    │  navigator.storage.persist()         │
                    └─────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼───────────────────────┐
                    │  openDB(version) → 迁移框架          │
                    │  oldVersion < N → 增量迁移           │
                    └─────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼───────────────────────┐
                    │  loadProjects()                      │
                    └───────┬─────────────────┬───────────┘
                            │                 │
                   projects > 0          projects = 0
                            │                 │
                    ┌───────▼──────┐  ┌───────▼───────────┐
                    │  正常启动     │  │  检查 localStorage │
                    │  注册备份监听 │  │  有备份？           │
                    └──────────────┘  └───┬──────────┬────┘
                                          │          │
                                        有备份      无备份
                                          │          │
                                  ┌───────▼─────┐  ┌▼────────────┐
                                  │ RecoveryDlg │  │ seedDemo()  │
                                  │ 恢复/下载/  │  │ 全新用户     │
                                  │ 从零开始    │  └─────────────┘
                                  └─────────────┘

             正常使用中：
             ┌──────────────────────────────────────────┐
             │  repo.put/delete → notifyDataChange()     │
             │        ↓                                  │
             │  debounce 5s → exportAllData()            │
             │        ↓                                  │
             │  localStorage['scope-shield-backup-*']    │
             │  (latest + previous 滚动保留)              │
             └──────────────────────────────────────────┘

             页面关闭：
             ┌──────────────────────────────────────────┐
             │  beforeunload → 立即同步备份（无 debounce）│
             └──────────────────────────────────────────┘
```

## 6. 边界情况

| 场景 | 处理 |
|------|------|
| localStorage 也被清除 | 两道防线同时失效，只能靠手动导出的 JSON 文件。设置页增加提示："建议定期导出备份" |
| localStorage 容量不足 | 降级策略：去 screenshots → 去 changes/snapshots → 仅保留 projects + requirements |
| 备份数据格式与当前版本不兼容 | ExportData 已有 `version: '1.0'` 字段，未来升级时可做格式转换 |
| 多 tab 同时写入 | IndexedDB 本身支持多 tab，但 localStorage 写入可能竞争。用 `storage` 事件监听其他 tab 的备份更新 |
| 恢复对话框期间用户刷新 | localStorage 备份不删，下次打开仍会弹出恢复对话框 |
| `persist()` 被拒绝 | 不影响功能，日志记录。localStorage 备份仍然兜底 |

## 7. 不做的事

| 决策 | 理由 |
|------|------|
| 不做 ServiceWorker 缓存 | 复杂度高，对数据持久化无直接帮助 |
| 不做服务端备份 | 当前是纯前端应用，无后端 |
| 不做 OPFS（Origin Private File System）| 兼容性不足，且 localStorage 已够用 |
| 不做增量备份 | 全量快照 < 100KB，增量省不了多少空间，增加复杂度 |
| 不做自动定时备份 | 数据变更驱动优于时间驱动，避免空转 |

## 8. 实现优先级

| P | 内容 | 理由 |
|---|------|------|
| **P0** | Schema 迁移框架 (`connection.ts`) | 不做 = 下次改 schema 必丢数据 |
| **P0** | 启动检测 + 恢复对话框 | 区分"新用户"和"数据丢失"，防止 seed 覆盖 |
| **P1** | 自动备份到 localStorage | 最核心的防丢手段 |
| **P1** | `navigator.storage.persist()` | 一行代码，防浏览器回收 |
| **P2** | 数据变更通知总线 | 为自动备份提供触发机制 |
| **P2** | 空间管理 + 降级策略 | 大数据量时的兜底 |

## 9. 验收标准

- [ ] DB_VERSION 从 1 升到 2（加一个无害 index），已有数据不丢失
- [ ] 手动清除 IndexedDB 后重新打开，弹出恢复对话框而非直接 seed demo
- [ ] 点击「恢复备份」后数据完整还原
- [ ] 正常操作（增删改需求）后 5 秒内 localStorage 出现备份 key
- [ ] `beforeunload` 时备份被写入
- [ ] 设置页面显示"上次自动备份时间"
- [ ] 141 vitest + 59 E2E 不回归
