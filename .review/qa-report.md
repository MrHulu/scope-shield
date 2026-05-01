# QA 审计报告 · Scope Shield → 95% Coverage

> 审计时间：2026-05-01
> 审计目标：商业级 95%+ 覆盖率
> 审计基线：163 unit tests passing / 8 unit test files / 19 e2e specs

## 总体覆盖率

`@vitest/coverage-v8` 未安装（`npx vitest run --coverage` 报 `MISSING DEPENDENCY`），无法跑 instrumented 数字。基于人工对比（test 文件 vs 源代码函数清单）的估算：

| 维度 | 估算值 | 商业级目标 | 差距 |
|------|-------|-----------|-----|
| Unit statement coverage | ~55% | 95% | 40 个百分点 |
| Unit branch coverage | ~35% | 90% | 55 个百分点 |
| Engine 模块覆盖 | ~75% | 100% | 关键新代码裸奔 |
| Service / db 模块覆盖 | ~50% | 95% | feishuSettings/repos/connection 全裸 |
| Stores 模块覆盖 | 0% | 80% | 整个 zustand 层无 unit test |
| Hooks 模块覆盖 | 0% | 70% | 6 个 hook 全裸 |
| Components 模块覆盖 | 0%（间接 e2e） | 60%+ unit 或 component test | 全裸 |

**第一优先级行动**：装 `@vitest/coverage-v8`、配 `coverage.thresholds.{lines,branches,functions,statements: 90}` + 在 CI 强制——见 [测试基础设施缺口] 节。

---

## P0 必补（不补就别说商业级）

### P0-1: reprioritize 新语义（reprioritizeTargetId / reprioritizeNewDependsOn）unit 完全裸奔

- **被测代码**: `src/engine/changeProcessor.ts` `applyReprioritizeByDep` (Line 347-379) + `processChange` reprioritize case Line 133-149 + `applyChangeForReplay` reprioritize Line 296-310
- **现状**: `changeProcessor.test.ts` 唯一一个 reprioritize 测试（Line 339-357）走的是 **legacy** `fromPosition/toPosition`；新语义的 helper 函数 `applyReprioritizeByDep` **0 unit test**。e2e 有 happy path（`change-reprioritize.spec.ts`），但 unit 层 helper 的分支没锁。
- **建议测试**: 新增 `describe('reprioritize 新语义 (by dep)')` 块，至少 8 个 unit case
- **关键断言**:
  - `processChange({type:'reprioritize', metadata:{reprioritizeTargetId:'r2', reprioritizeNewDependsOn:'r3'}}, ...)` → `r2.dependsOn === 'r3'`
  - target.dependsOn = null 时（"无前置"）→ target sortOrder = 0，原 head 后移
  - newDep 在 cancelled 列表中 → `nonCancelled.findIndex` 返回 -1 → fallback 到 `without.length`（追加末尾），cancelled 列表不被打乱
  - 设置后 cancelled requirements 的 sortOrder = `without.length + i`（保持在尾部）
  - target 是 cancelled → 整个函数 early return（don't mutate）
  - target.id === newDep（自指）→ scheduler 后续会抛 cycle，processChange 不该静默生成自指 dependsOn
  - 别的需求 dependsOn **完全不动**（保留并行结构）—— 这是新语义和旧语义的核心区别
  - applyChangeForReplay 走同一份 helper → 同样断言需在 replay 路径复制
- **被覆盖的 Boss 反馈**: "reprioritize fromPos array index 与 sortOrder 错位" + "项目里有 cancelled 需求" + commit log "reprioritize 已从位置移动语义改为目标 + 新前置依赖语义"

### P0-2: extractScheduleFromNodes / msToIsoDate / extractCurrentNodeOwnersByRole 飞书节点解析无 unit

- **被测代码**: `src/services/feishuRequirement.ts` Line 330-405
- **现状**: 0 测试。`feishuRequirement.test.ts` 现有 demand_fetch mock 只在 `field_value_map` 里塞 estimate / owner，**完全没覆盖 biz_data[key=node].value.data.work_hour.attributes.points.value 这条新路径**；`current_status_operator` / `role_owners` / `node[doing].owner.value JSON parse → role_key` 三层兜底链 0 测试；`msToIsoDate` 的 `Number.isFinite` 守卫和 `new Date(ms).toISOString().slice(0,10)` 异常路径未验。
- **建议测试**: 新增 `describe('extractScheduleFromNodes')` + `describe('extractCurrentNodeOwnersByRole')` + `describe('msToIsoDate')`，至少 12 个 case
- **关键断言**:
  - work_hour.attributes.points.value = 5 → `points: 5`
  - work_hour 不存在但 scheduleV3.attributes 存在 → 走 fallback 取 scheduleV3
  - points < 0.5 → 跳过（`continue`），扫下一个 node
  - points 是字符串 "3.5" → Number(value) 转换 → 3.5
  - schedule_start.timestamp_in_ms = 1714521600000 → `msToIsoDate` 返回 `'2026-05-01'`
  - schedule_end.timestamp_in_ms = NaN / undefined / 字符串 → `endMs: null`，draft.source.endDate = null
  - bizWorkItem.current_status_operator 为非空数组 → `currentNodeOwners` 优先
  - current_status_operator 空 + node[doing].owner.value JSON `{"roles":["dev"]}` + role_owners[role=dev].owners=[{name:"张三"}] → owners=["张三"]
  - owner.value 是损坏 JSON → 静默吞，名单回 `[]`
  - role_owners 中 role 不在 roleKeys → 不收
  - currentNodeOwners 和 roleBasedOwners 都空 → 才 fallback 到 legacy owner / assignee（保证三层链不跳级）
  - msToIsoDate(null) → null；msToIsoDate(Infinity) → null
- **被覆盖的 Boss 反馈**: commit "工期在 biz_data[key=node].value.data.work_hour.attributes.points.value、当前节点负责人在 bizWorkItem.current_status_operator 或从 node.value.owner.value JSON 解析 role_key 反查 role_owners" + DEV-only console.info 排查日志的存在说明这是高变化区域

### P0-3: cancel 触发的 dependents 清理 + replay 一致性裸奔

- **被测代码**: `src/engine/changeProcessor.ts` Line 91-97（cancel 后 `r.dependsOn = null`）+ `applyChangeForReplay` cancel 同样行为 Line 268-274 + `replayEngine.ts` Line 28-123 整体
- **现状**: `changeProcessor.test.ts` Line 178-189 有 "clears dependsOn of dependent requirements" 但**只测一层**；多层链（A→B→C，cancel B 后 C.dependsOn 是否变 null？是否反链到 A？）+ replay 一致性（删掉 cancel change → C 的 dependsOn 应**恢复**为 B）都没测。Boss 反馈过这块炸过。
- **建议测试**: 4 个 unit case（一个 replay roundtrip 是核心）
- **关键断言**:
  - `replayChanges` 删掉 cancel change 后，依赖链恢复（C.dependsOn 重新指向 B）—— 这是"删一个 change 触发 replay 后状态等同于一开始就没有这个 change"的核心保证
  - cancel 后再 supplement cancelled 需求 → currentDays 增加，但 dependents 不被牵连（supplement 的 cascadeTargets 排除 cancelled）
  - Cancel + reprioritize 顺序错位 → 重 replay 后等价（Boss 反馈过）
  - replay 后 `newRequirement` 的 ID 保持原始（applyChangeForReplay Line 242 用 `change.targetRequirementId!` 复用 ID）
- **被覆盖的 Boss 反馈**: "项目里有 cancelled 需求 → reprioritize fromPos array index 与 sortOrder 错位"

### P0-4: supplement.metadata.cascadeTargets 自动级联裸奔

- **被测代码**: `src/engine/changeProcessor.ts` Line 117-126
- **现状**: `changeProcessor.test.ts` 的 supplement 测试（Line 202-264）**完全没测 cascadeTargets**。这是新代码且会改 metadata，是商业级数据完整性 hook 点。
- **建议测试**: 4 个 unit
- **关键断言**:
  - 有 active dependents → `metadata.cascadeTargets` 包含每个 dependent.id
  - 只有 cancelled / paused dependents → `cascadeTargets` 不包含他们（仅 active）
  - daysDelta = 0 → 不写 cascadeTargets（Line 117 `if (daysDelta > 0)`）
  - 0 dependents → 不挂 `cascadeTargets` key（保持 metadata 干净）
- **被覆盖的 Boss 反馈**: 数据完整性

### P0-5: changeStore deleteChange 级联 + replay 持久化路径 0 unit

- **被测代码**: `src/stores/changeStore.ts` Line 123-172
- **现状**: `__tests__/stores/` 不存在。`deleteChange` 的：`new_requirement` 时级联删 requirement、replay 后清旧 snapshots、写新 snapshots/changes/requirements 三件套、最后一条删完后 reset 路径——全都没测。e2e 测的是 UI，不能锁 store contract。
- **建议测试**: 新建 `src/stores/__tests__/changeStore.test.ts`，mock 所有 repo + replay engine，6 个 unit
- **关键断言**:
  - `deleteChange(newRequirementChangeId)` → `requirementRepo.deleteRequirement(targetRequirementId)` 被调用一次
  - 最后一条 change 删完 → `replayChanges` **不被调用**（走 reset 分支 Line 141-158）+ 所有 requirements `currentDays = originalDays`
  - replay 路径 → `snapshotRepo.deleteSnapshotsByProject` 在 `putSnapshot` **之前**调用一次（顺序锁）
  - 删之前 lookup 不存在 → `return null`，无副作用
  - target.type='new_requirement' 但 targetRequirementId=null → 不级联调用 deleteRequirement（防 NPE）
- **被覆盖的 Boss 反馈**: 持久化保障

### P0-6: autoBackup beforeunload flush 时 timer 残留 + 无 listener 双重注册

- **被测代码**: `src/db/autoBackup.ts` Line 85-113
- **现状**: 现有 `autoBackup.test.ts` Line 308-321 测了 beforeunload 触发 doBackup，但**没测**：(a) cleanup() 后再触发 onDataChange 不应调用 doBackup（防 listener 残留）(b) 调用两次 startAutoBackup() 是否产生两个 listener（潜在 leak）(c) doBackup 已经在跑时 beforeunload 触发会不会双跑。
- **建议测试**: 3 个 unit 加固
- **关键断言**:
  - `cleanup()` 后 `dataChangeListeners.length === 0` 且 `window.removeEventListener('beforeunload')` 被调一次
  - 两次 `startAutoBackup()` 应让 `dataChangeListeners.length === 2`（有意？）+ 配套两个 cleanup 函数互不干扰
  - mid-debounce 触发 beforeunload → timer 被 clearTimeout 一次（不重复 fire）
- **被覆盖的 Boss 反馈**: 持久化保障

### P0-7: importData 写库阶段事务回滚 + 字段穿透污染 0 测试

- **被测代码**: `src/db/exportImport.ts` Line 39-90
- **现状**: `exportImport.test.ts` 都是 validation 错误路径（拒绝阶段），**`tx.done` 失败 → 全 abort 不写半截**这条事务原子性 contract 0 测试。`sanitizeRequirementSource` 在 import 时被调（Line 67-69）但**没测**导入污染 source（带 pluginToken）→ 写入 DB 后字段被剥离这条数据流。
- **建议测试**: 新增 fake-indexeddb 集成测试 4 个
- **关键断言**:
  - mock IDBObjectStore.put 在写第二个 project 时 throw → DB 应保持原状（事务回滚），无 partial write
  - import 含 `requirements[].source.pluginToken: 'leak'` 的合法包 → DB 中 requirement.source 不含 pluginToken 字段
  - import 后再 export → exported source 也不含 pluginToken（双重防御）
  - 同一 ID 的 requirement 在两个不同 project 下（projectId mismatch 已 reject）走 reject 路径
- **被覆盖的 Boss 反馈**: 错误路径

### P0-8: e2e 端到端 "happy path 全流程" 缺失

- **被测代码**: 全栈
- **现状**: 19 个 e2e spec **每个只测一种 change type**，没有任何一个 spec 覆盖完整 user journey。Boss 明确要求："新建项目 → 加 5 条需求 → 7 类变更各一 → 看图表 → 导出 → 关闭重启 → 数据完整"。
- **建议测试**: `e2e/journey-full.spec.ts`，1 个 long test（≤90s timeout）
- **关键断言**:
  - 7 种 change（add_days / new_requirement / cancel / supplement / reprioritize / pause / resume）按真实顺序产生 → ChangeList 显示 7 行 + sortOrder/dates 单调
  - 切换 simple ↔ detail tab → 工期 / 原计划数字一致
  - 导出 PNG → blob.size > 1024（不是 retry-fallback 兜底产物）
  - `page.context().close()` + reopen → 项目仍在 sidebar，所有 7 条 change 仍在
  - 通过 `localStorage.getItem('scope-shield-backup-latest')` 断言 backup 存在 + projectCount=1 + requirementCount=5
- **被覆盖的 Boss 反馈**: e2e 用户旅程

### P0-9: e2e cross-spec pollution → resetDB 不彻底

- **被测代码**: `e2e/helpers.ts` Line 7-22
- **现状**: 当前 `resetDB` 只清 IDB + localStorage。**遗漏**：sessionStorage、cookies、Service Worker、navigator.storage.persist 颁发的 quota 不重置。`recovery-dialog.spec.ts` 用 hardWipe + about:blank round-trip 才能彻底擦——但这是 spec-local 的 workaround，没下沉到 helper。`playwright.config` 是 `fullyParallel: false / workers: 1`，flake 现状靠串行掩盖了。
- **建议测试**: 改造 helpers.resetDB 成 `hardResetDB`，所有 spec 用同一 helper（不要再让每个 spec 各写各的）
- **关键断言**:
  - 全 spec 切到 `hardResetDB` 后，`fullyParallel: true` + workers ≥ 2 跑 100 次 → 失败率 ≤ 1/100
  - `auto-backup.spec.ts` 切前现状：偶有 `localStorage` 残留导致 RecoveryDialog 抢先弹（已知 flake 嫌疑）
- **被覆盖的 Boss 反馈**: "已知 flake：偶尔跨 spec state pollution（IndexedDB / localStorage 残留）"

### P0-10: useSyncFeishu / Promise.allSettled 失败聚合 0 测试

- **被测代码**: `src/hooks/useSyncFeishu.ts` Line 22-66
- **现状**: 0 unit。`syncAll` 里的 `Promise.allSettled` 错误聚合 + `draft.status !== 'fetched'` 计 failed + name/originalDays 部分填充 patch 都是关键 contract，跑批量同步爆错只能靠 e2e 兜——但 e2e 跑不到真飞书。
- **建议测试**: 新建 `src/hooks/__tests__/useSyncFeishu.test.tsx` 用 `@testing-library/react-hooks` 或纯函数化（建议把 `syncAll` body 抽成纯函数 `syncFeishuRequirements(reqs, fetcher) -> {success, failed, patches}`），4 个 unit
- **关键断言**:
  - 3 reqs，2 个 fetcher 成功 1 个 reject → success=2, failed=1
  - draft.status='url_only' → 计 failed
  - draft.originalDays=null → patch 不含 originalDays（不要清空既有值）
  - draft.name='' → patch 不含 name（同上）
- **被覆盖的 Boss 反馈**: 错误路径 "飞书 cookie 失效"

### P0-11: requirementStore.deleteRequirement metadata 写穿到 changes 没 unit

- **被测代码**: `src/stores/requirementStore.ts` Line 121-154
- **现状**: 0 unit。`deletedRequirementName` 写穿到所有 targetRequirementId 匹配的 change 是关键 audit trail（删完需求后 ChangeList 上还能看到"已删除：XX"）—— 没人测，将来 refactor 一不小心删掉 audit trail 也没人发现。
- **建议测试**: 2 个 unit（mock repos）
- **关键断言**:
  - 删除 r1 后所有 `c.targetRequirementId === 'r1'` 的 change.metadata.deletedRequirementName === r1.name
  - 删除 r1 后所有 `r.dependsOn === 'r1'` 的 requirement.dependsOn 变 null
  - 没有依赖也没有变更指向时不抛错

### P0-12: a11y / keyboard accessibility 0 e2e 断言

- **被测代码**: `src/components/change/ChangeModal.tsx` / `RecoveryDialog.tsx` / `ConfirmDialog.tsx` 等所有 modal
- **现状**: e2e 偶尔用 `page.keyboard.press('Escape')` 关 modal 但**没断言**：focus trap、Tab 顺序、aria-labelledby、`role="dialog"` vs `role="alertdialog"` 区分。商业级要过 WCAG 2.1 AA。
- **建议测试**: 新增 `e2e/a11y.spec.ts`，3 个 spec（每个 modal 一个）
- **关键断言**:
  - 打开 ChangeModal → `await expect(page.locator(':focus')).toBeAttached()` + focus 在 modal 内
  - Tab 6 次后 focus 应在 modal 末按钮，再 Tab 一次回到首字段（focus trap）
  - Escape 关 → focus 还原到触发按钮（`document.activeElement` ≡ "记录变更" 按钮）
  - ConfirmDialog `role="alertdialog"` + 取消/确认按钮顺序与视觉一致
- **被覆盖的 Boss 反馈**: 可访问性

---

## P1 加固（覆盖率拉到 90%+）

### P1-1: scheduler 双 paused 链 + 跨状态依赖切换无测试
- **被测代码**: `src/engine/scheduler.ts` getEffectiveDep Line 29-37
- **现状**: 单条 paused 测了（Line 97-105），但 `A active → B paused → C depends B` 这种 "C 是否真启动于 day 0" 没测；resume 后 schedule 自动重连接也没测。
- **建议测试**: unit，3 个 case，断言 C.startDay = 0 + resume 后 C.startDay = endDay(B)

### P1-2: scheduler critical path 多分支并列等长 case 失明
- **被测代码**: `src/engine/scheduler.ts` traceCriticalPath Line 155-183
- **现状**: 现有 1 个 critical path test。两条路径同时 endDay === totalDays 的 case 没测（典型并行 5+5 vs 链 3+7=10）—— 要保证两条都被识别为 critical。
- **建议测试**: unit，2 个 case
- **关键断言**: criticalPath 同时含两条等长链上所有节点

### P1-3: addRequirement wouldCycle 调用方式 bug
- **被测代码**: `src/stores/requirementStore.ts` Line 47
- **现状**: `wouldCycle(currentReqs, '', input.dependsOn)` 把空字符串当 reqId 传——这是新建需求场景，input.id 还不存在。**这意味着**只能拦自指（reqId === targetId），其他间接 cycle 拦不住（因为新需求不在 reqs 里）。但因为新需求 dependsOn 只能选已存在 req 而它们的链不会反向指向"将来出现的 ID"，事实上**目前可能没 bug**——但语义不清晰，need a contract test 锁定。
- **建议测试**: unit，2 个 case
- **关键断言**: addRequirement 传 dependsOn = 现有 req → 不算 cycle；dependsOn 链最终回到一个临时 reqId='' 不可能发生

### P1-4: feishuSettings 整模块 0 测试
- **被测代码**: `src/services/feishuSettings.ts` (33 行)
- **现状**: 0 unit。`getFeishuSettings` 损坏 JSON 容错路径、`saveFeishuSettings` 序列化 + baseUrl=undefined 路径、`checkProxyStatus` 网络错误 → false 路径都没测。
- **建议测试**: 新建 `src/services/__tests__/feishuSettings.test.ts`，5 个 unit

### P1-5: utils/image.ts compressImage 0 测试
- **被测代码**: `src/utils/image.ts` (59 行)
- **现状**: 0 unit。`MAX_BASE64_LENGTH` 超限 → 0.5 quality 重压一次 → 仍然超限 → reject 路径无测试；FileReader.onerror 路径无测试；canvas 缩放数学（`Math.round((height * MAX_WIDTH) / width)`）无测试。
- **建议测试**: 4 个 unit，jsdom 环境（vitest 设 `environment: 'jsdom'` for this file）
- **关键断言**: 800×1600 图返回原尺寸；4000×800 → 800×160；blob 超大 → reject 'too big'；reader.onerror → reject '文件读取失败'

### P1-6: utils/date addCalendarDays / formatDate 0 测试
- **被测代码**: `src/utils/date.ts`
- **现状**: 0 unit。`addCalendarDays('2026-12-31', 1)` 跨年、月末跨月、闰年都没测。`formatDate` `'2026-01-05'` → `'1/5'` 没测。
- **建议测试**: unit，6 个 case

### P1-7: useSchedule hook inflationRate 边界 0 测试
- **被测代码**: `src/hooks/useSchedule.ts` Line 13-25
- **现状**: 0 unit。`originalTotalDays === 0` → `inflationRate: null`（除零保护）这条分支没测；`endDate` 在 totalDays=0 时返回 startDate（不偏移）也没测；`Math.max(0, Math.ceil(totalDays) - 1)` 边界 totalDays=0.5 → `ceil(0.5)-1 = 0` 验证。
- **建议测试**: 4 个 unit（用 renderHook）

### P1-8: db/connection upgrade 路径
- **被测代码**: `src/db/connection.ts` Line 9-37
- **现状**: 0 unit。多 store / index 创建路径 + future migration `if (oldVersion < 2)` 缺位说明无 v1→v2 测试。
- **建议测试**: 用 fake-indexeddb，3 个 case
- **关键断言**: 全新打开 → 5 个 store 都建好 + indexes 存在；二次 getDB() 复用 dbInstance（singleton）；模拟 oldVersion=0 → 完整 upgrade 跑

### P1-9: e2e import 错误回退路径无 spec
- **被测代码**: `src/components/SettingsPage.tsx` import 路径 + `importData` 错误抛出
- **现状**: `settings-import-export.spec.ts` 测了 import 触发对话框，**没测**：用一个 invalid JSON（缺 version / projects 不是 array / requirement 字段缺失）触发 → toast 显示具体错误信息 → DB 保持原状。
- **建议测试**: 3 个 e2e spec
- **关键断言**: invalid JSON → 不进入 confirm dialog 或 confirm 后看到 error toast + 项目数 = 1（未变）

### P1-10: 截图 lightbox 行为 + 上限 3 张 e2e 不够强
- **被测代码**: `screenshot.spec.ts` 现有 3 个 spec
- **现状**: "上传第 4 张" 触发的拒绝 / 提示路径没测；剪贴板 paste 路径没测；图片 lightbox 键盘 Esc 关也没测。
- **建议测试**: 2 个 e2e spec

---

## P2 体验保护（覆盖商业级常见 corner）

### P2-1: 飞书代理超时（30s+）e2e 不存在
- **现状**: `analyzeFeishuRequirementUrl` 没有 abort signal，死等。商业级 web 必须 5-10s timeout 兜底。
- **建议**: unit + 改造源码加 AbortController（注意：reviewer 不动源码 → 这条要先建 issue）

### P2-2: changeStore.recordChange 上限 200 拒绝路径无 e2e
- **被测代码**: `changeStore.ts` Line 59-62
- **现状**: 0 测试。导入路径（`importData`）有 200 上限验证；运行时 `recordChange` 上限拒绝 0 测试。
- **建议测试**: unit + 1 e2e（mock 模拟 200 条已存在）

### P2-3: 新增同名需求 / change 描述去重无单测
- **被测代码**: `requirementRepo.createRequirement`
- **现状**: 同名允许（业务允许重名）—— 但**应该有断言锁定这个行为**否则下次"修复"成不允许就破坏 user。
- **建议测试**: 1 e2e + 1 unit 锁定"重名允许"

### P2-4: chart 导出 png 大图 hidden DOM 渲染没断言
- **被测代码**: `useExport.ts` exportPng + `ExportRenderer.tsx`
- **现状**: `chart-export.spec.ts` 只点击导出按钮但不验证生成的 PNG。retry 路径（blob.size <= 1024 → 重试）无 spec。
- **建议测试**: 1 e2e，断言下载文件 size > 100KB

### P2-5: settings page 保存 baseUrl 错误形式拒绝
- **被测代码**: `feishuSettings.ts saveFeishuSettings` + UI 输入校验
- **现状**: `parseFeishuApiBaseUrl` 单测有但 UI 拒绝路径 0 e2e。
- **建议测试**: 1 e2e

### P2-6: project rename / startDate 修改没 e2e
- **现状**: `project.spec.ts` 只测了 create / archive / restore。重命名 + 改 startDate（影响整个甘特图横坐标）0 测试。
- **建议测试**: 2 e2e

### P2-7: cleanup 日期 90 天 personNameRepo.cleanupOldNames 0 unit
- **被测代码**: `src/db/personNameRepo.ts` Line 37-52
- **现状**: 0 unit。`cutoff.setDate(cutoff.getDate() - 90)` 边界没测，会被无声踩坑（数据被错删）。
- **建议测试**: 2 unit，fake timers + fake-indexeddb

### P2-8: visual regression（Gantt chart / StatsCard）0 测试
- **现状**: e2e 只看文本，不看渲染像素。商业级 SaaS 一般用 `@playwright/test` toHaveScreenshot 锁定关键画面（StatsCard / Gantt 至少 2 张）。
- **建议测试**: 加 `playwright.config.ts` 的 expect.toHaveScreenshot baseline + 2 个 spec

---

## 测试基础设施缺口

### 1. 没装 coverage tool（最严重）
```bash
npm i -D @vitest/coverage-v8
```
然后 `vite.config.ts` test 块加：
```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  exclude: ['e2e/**', 'src/main.tsx', 'src/types/**', '**/*.test.ts'],
  thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 },
}
```
CI 跑 `vitest run --coverage` 失败即挂。**没数字就没"95%"**。

### 2. helpers.resetDB 不彻底（已知 flake 来源）
现状只清 IDB + localStorage。改造为：
```ts
export async function hardResetDB(page: Page) {
  await page.goto('about:blank');
  await page.goto('/');
  await page.waitForTimeout(150);
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    await Promise.all(dbs.map(db => new Promise<void>(r => {
      if (!db.name) return r();
      const req = indexedDB.deleteDatabase(db.name);
      req.onsuccess = () => r();
      req.onerror = () => r();
      req.onblocked = () => setTimeout(r, 200);
    })));
    localStorage.clear();
    sessionStorage.clear();
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  });
  await page.context().clearCookies();
  await page.goto('about:blank');
  await page.goto('/');
}
```
**所有 spec 切换到 `hardResetDB`**，包括 recovery-dialog.spec.ts 的 hardWipe（删 spec-local helper，统一）。

### 3. playwright fullyParallel: false 是技术债
`workers: 1` + `fullyParallel: false` 把测试套从 30s 拖到几分钟。修好 helpers.resetDB 后改成：
```ts
fullyParallel: true,
workers: process.env.CI ? 2 : 4,
```
回归 100 次稳定就常态化。

### 4. e2e 没有 visual regression
`@playwright/test` 自带 `toHaveScreenshot()`。Gantt + StatsCard 至少各一 baseline。

### 5. 没有 stores/hooks/components 测试目录
当前 `__tests__` 只在 db/engine/services/utils 下。stores 0 测试、hooks 0 测试、components 0 测试。建议：
- stores → unit (mock repos)
- hooks → renderHook (`@testing-library/react`)
- 关键 components（ChangeModal / RequirementForm / RecoveryDialog 错误态）→ component test

### 6. 没有 fake-indexeddb 集成测试
`db/__tests__/exportImport.test.ts` 只测了 reject 路径（不打 DB），对**写库阶段事务原子性**没覆盖。装 `fake-indexeddb`：
```bash
npm i -D fake-indexeddb
```
再加一个 `db/__tests__/integration.test.ts`，setup 里 `import 'fake-indexeddb/auto'`。

### 7. 没有 react-testing-library
组件层完全靠 e2e 兜，但 e2e 慢且不能精测分支。装：
```bash
npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```
然后给 vitest 加 multi-environment 配置（node default，组件测试 envOption: 'jsdom'）。

### 8. CI gate 缺失
当前 `package.json` `"test": "vitest run"` 但没看到 husky / pre-commit / GH Actions 强制跑。建议：
- pre-commit: `npm test`（unit only，秒级）
- pre-push 或 PR: `npm test && npm run test:e2e`
- main branch protection: 上述 pass + coverage thresholds 不破才允许 merge

---

## 已知 flake 清单

### F-1: recovery-dialog.spec.ts hardWipe race
- **路径**: `e2e/recovery-dialog.spec.ts:63-80`
- **复现条件**: 上一个 spec 在 beforeunload 阶段 doBackup 还没 return，下一个 spec hardWipe 后又被覆盖；CI 在 worker 切换时偶发
- **修法**: 已经用 about:blank 双跳兜底（Line 88-91），但**根因**是 autoBackup 没有"取消正在跑的 doBackup" hook。建议下沉到 helpers.hardResetDB（见上）+ 源码层加 abort signal（reviewer 不动源码 → 建 issue）

### F-2: dnd-reorder.spec.ts mouse drag 不稳
- **路径**: `e2e/dnd-reorder.spec.ts:38-49` + `e2e/gantt-after-reorder.spec.ts:26-33`
- **复现条件**: dnd-kit 的 PointerSensor activation distance=5px，硬编码的 `+10` 偏移在某些 viewport 下被首次拖动忽略；spec 里 `await page.waitForTimeout(500)` 是 magic number
- **修法**:
  1. 改用 `await firstHandle.dragTo(targetHandle)`（playwright 内建）
  2. 替换 `waitForTimeout` 为 `await expect(page.locator('[data-sortable-active]')).toBeHidden()` 或基于 sortOrder DOM 顺序的精确断言
  3. 加 `data-testid="req-row-${id}"` 让 spec 能直接读 sortOrder 重排

### F-3: change-edit-delete.spec.ts hover-to-show buttons
- **路径**: `e2e/change-edit-delete.spec.ts:21,38,52,65`
- **复现条件**: 行内按钮 `opacity-0 → group-hover:opacity-100`；`hover()` 后立即 `click('编辑')` 偶尔 race（CSS transition 中）
- **修法**: 用 `await changeRow.hover()` + `await page.locator('[aria-label="编辑"]').waitFor({ state: 'visible' })` 或干脆改成"始终可见 + a11y 友好"（reviewer 不动源码 → 建 issue）

### F-4: auto-backup.spec.ts 5s waits
- **路径**: `e2e/auto-backup.spec.ts:24,41,49,63`
- **复现条件**: `DEBOUNCE_MS + 1500` = 6.5s × 3 测试 = 单 spec 跑 ~25s，CI 有概率被 30s timeout 切
- **修法**: 把 DEBOUNCE_MS 暴露成 window 全局或 test 注入（dev-only），spec 里改成 `await page.evaluate(() => __forceBackupNow())`。或给 spec.timeout(45_000)

### F-5: settings-import-export.spec.ts:62 cancel test 没断言
- **路径**: `e2e/settings-import-export.spec.ts:62-82`
- **复现条件**: 注释写 "Original data should still be intact... Navigate back and check" 但**完全没断言**。哪天 cancel 路径错把 DB 清了也没人发现。
- **修法**: 在 cancel 后切到 sidebar，断言 'Export Project' 仍在

### F-6: requirement-feishu-url.spec.ts 飞书 URL 解析依赖网络
- **路径**: `e2e/requirement-feishu-url.spec.ts:18`
- **复现条件**: `/api/feishu` proxy 在 CI 无飞书 cookie → 返回 url-only。spec 用 `飞书未登录|已解析 URL|已保留 URL 来源` 三选一兜，但**未来后端 wording 一改就挂**。
- **修法**: mock `/api/feishu/v5/workitem/v1/demand_fetch` 路由（playwright route），返回固定 401，断言走 url-only 分支 + 占位名 `飞书需求 #42`

### F-7: change-pause-resume.spec.ts:43-45 conditional select
- **路径**: `e2e/change-pause-resume.spec.ts:43-45`
- **复现条件**: `if (match) await select.selectOption(...)` —— `match` 为 undefined 时静默跳过整段，测试**永远 pass**（false negative）
- **修法**: 改成 `if (!match) throw new Error('Expected req in dropdown')`

---

## 收口建议（行动顺序）

1. **本周**：装 coverage 工具 + 跑出基线数字 → 修 P0-1/2/3/4（核心 engine 新代码）→ 立 CI gate
2. **下周**：修 helpers.resetDB + parallel + P0-5/6/7（数据层）+ 已知 flake F-1~F-7
3. **第三周**：完成 P0-8/9/10/11/12（journey + a11y + sync + audit trail）+ P1
4. **第四周**：P2 + visual regression + 引入 component test 框架

完成 P0 + 基础设施 = ~85%，再加 P1 可冲到 92%+，P2 拉到 95%+。
