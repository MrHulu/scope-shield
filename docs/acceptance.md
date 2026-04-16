# Scope Shield — 验收场景

## 范围

覆盖 MVP 所有功能需求的验收场景：项目管理、需求管理、变更记录、图表渲染、导出、数据管理。

## 非范围

- 团队协作场景
- 云同步场景
- 第三方集成场景

## 假设

- 测试环境为 Chrome 90+、Safari 16+、Firefox 100+、Edge 90+ 桌面浏览器
- IndexedDB 可用且未被禁用

## 依赖

- docs/mvp-prd.md 中的功能需求和业务规则

---

## 项目管理

### AC-1: 创建项目

```
Given 用户在首页
When 点击"新建项目"，输入"CRM重构"，开始日期保持默认（今天）
Then 项目创建成功，自动跳转到项目详情页
And 左侧边栏"进行中"分组出现"CRM重构"
And 项目详情页显示空需求列表和"+ 添加需求"按钮
```

### AC-2: 首次打开 — Demo 项目

```
Given 用户首次打开 Scope Shield（IndexedDB 无数据）
When 页面加载完成
Then 左侧边栏显示一个预填的 Demo 项目
And Demo 项目包含 ≥ 3 个需求和 ≥ 2 条变更记录
And 图表正确渲染，用户可直接体验导出功能
```

### AC-3: 归档与恢复

```
Given 项目"CRM重构"在"进行中"
When 用户点击项目设置 → 归档
Then 项目移到"已归档"分组
And 项目详情页变为只读状态

When 用户在"已归档"中点击"恢复"
Then 项目回到"进行中"分组
And 项目详情页恢复可编辑
```

### AC-4: 多项目切换

```
Given 存在项目 A（进行中）和项目 B（进行中）
When 用户点击左侧边栏的项目 B
Then 主内容区切换为项目 B 的详情
And 项目 B 在侧边栏高亮
```

---

## 需求管理

### AC-10: 添加需求

```
Given 项目"CRM重构"已创建
When 点击"+ 添加需求"，输入名称"用户管理"，天数"8"
Then 需求出现在列表中，显示"用户管理 — 8天"
And 项目总工期更新为 8 天
```

### AC-11: 添加多个需求 — 总工期计算

```
Given 项目已有需求 A(8天) 和需求 B(4天)，无依赖关系
When 用户添加需求 C(3天)，无依赖
Then 总工期 = max(8, 4, 3) = 8 天（并行，最长路径）
```

### AC-12: 设置依赖 — 顺延

```
Given 需求 A(8天) 和需求 B(4天)
When 设置 B 依赖于 A
Then 总工期 = 8 + 4 = 12 天
And 界面显示 B 的开始日期紧接 A 结束（调度模型中 B.startDay = A.endDay，半开区间）
```

### AC-13: 依赖自动顺延

```
Given A(8天) → B(4天) 有依赖，总工期 12 天
When 记录变更"A 范围扩大 +3天"
Then A 变为 11 天
And B 自动顺延，开始日期后移 3 天
And 系统显示提示"因 A 延期，B 被顺延 3 天"
And 总工期更新为 15 天
```

### AC-14: 删除需求

```
Given 需求 A 存在且有 2 条变更记录
When 用户删除需求 A，确认弹窗点击"确定"
Then 需求 A 从列表移除
And 相关变更记录保留但标记"需求已删除"
And 总工期重新计算
```

---

## 变更记录

### AC-20: 记录变更 — 加天数（30秒验证）

```
Given 项目有需求"用户管理(8天)"
When 点击"记录变更"
And 选择类型"加天数"
And 选择需求"用户管理"
And 角色保持默认"产品经理"，填人名"张三"
And 描述填"加RBAC权限"
And 天数填"4"
And 点击保存
Then 从点击"记录变更"到保存完成 ≤ 30 秒
And 需求"用户管理"工期变为 12 天
And 变更记录列表新增一条
And 图表实时更新
```

### AC-21: 记录变更 — 新增需求

```
Given 项目已有需求 A/B/C
When 记录变更类型"新增需求"
And 填写名称"数据大屏"，天数"3"，角色"领导"，人名"王总"
And 描述"客户参观用"
Then 需求列表新增"数据大屏(3天)"
And 变更记录显示"新增需求：数据大屏 +3天 — 领导 王总"
And 总工期重新计算
```

### AC-22: 记录变更 — 砍需求

```
Given 需求 C"导出功能(3天)"存在
When 记录变更类型"砍需求"，选择需求 C
And 角色"产品经理"，描述"MVP不需要导出"
Then 需求 C 显示灰色删除线
And 图表中出现绿色"节省 3 天"标注
And 总工期按最长路径重算（若 C 在关键路径上则减少，否则不变）
```

### AC-23: 记录变更 — 优先级调整

```
Given 需求顺序为 A → B → C
When 记录变更类型"优先级调整"，将 C 提到最前
Then 需求列表顺序变为 C → A → B
And 变更记录显示"C 优先级调整到第 1 位"
And 总工期不变（sortOrder 仅影响显示顺序，不影响调度）
```

### AC-24: 记录变更 — 暂停与恢复

```
Given 需求 B(4天)
When 记录变更类型"暂停"，选择需求 B
Then 弹窗显示"剩余天数"输入框，默认值 4
When 用户修改为 3（已开发 1 天），填描述"等设计稿"，保存
Then 需求 B 状态变为"已暂停"，pausedRemainingDays = 3
And B 不计入总工期

When 后续记录变更类型"恢复"，选择需求 B
Then 需求 B 状态恢复为 active，currentDays = 3
And 总工期重新计算
```

### AC-25: 编辑变更

```
Given 存在变更记录"A范围扩大 +4天"
When 点击该记录的编辑按钮
And 修改天数为 5
Then 记录更新为 +5 天
And 图表实时重新渲染
```

### AC-26: 删除变更

```
Given 存在变更记录"A范围扩大 +4天"
When 点击删除，弹窗显示"确定删除此变更记录？"
And 点击"确定"
Then 记录删除
And 需求 A 工期回退（扣除 4 天）
And 总工期重算，图表更新
```

---

## 图表渲染

### AC-30: 简洁版膨胀条

```
Given 项目有 15 天原始工期，3 次变更共 +9 天
When 切换到"简洁版"Tab
Then 上方显示蓝色原始计划条（15天）
And 下方显示分段实际工期条（15天蓝 + 各变更红/橙/紫）
And 每段标注变更日期、角色、描述
And 底部显示"延期 9 天 = 100% 来自需求变更"
And 膨胀率显示 +60%
```

### AC-31: 详细版时间线+甘特

```
Given 同上数据
When 切换到"详细版"Tab
Then 上部显示时间线（每条变更按日期排列，含描述和影响天数）
And 下部显示甘特条（每个需求一行，原始工期蓝色+变更部分红色）
And 新增需求整行用靛色（#5B21B6，非角色色）
And 砍掉的需求用灰色删除线
And 底部汇总"原计划 X天 → 实际 Y天 · N次变更 · 角色×条数 · 0天来自开发"
```

### AC-32: 图表实时更新

```
Given 图表正在显示
When 保存一条新变更
Then 图表在 500ms 内重新渲染，无需手动刷新
```

---

## 导出

### AC-33: 导出 PNG — 手机尺寸

```
Given 图表已渲染
When 点击"导出图片"，尺寸选择"手机(390px)"
Then 下载一张 PNG 图片
And 图片 CSS 宽度 390px，实际像素宽度 780px（2x Retina）
And 图片使用 Apple/iOS 亮色风格（非 App 界面风格）
And 图片包含项目名、统计数字、对比条/时间线、结论
And 人名直接显示
```

### AC-34: 导出 PNG — 桌面尺寸

```
Given 同上
When 尺寸选择"桌面(800px)"
Then PNG CSS 宽度 800px，实际像素宽度 1600px（2x Retina）
And 布局自适应放大
```

---

## 数据管理

### AC-40: JSON 导出

```
Given 存在 2 个项目，共 5 个需求和 8 条变更记录
When 点击设置 → 导出数据
Then 下载一个 JSON 文件
And 文件包含所有项目、需求、变更记录的完整数据
```

### AC-41: JSON 导入

```
Given 用户有之前导出的 JSON 文件
When 点击设置 → 导入数据，选择文件
Then 弹窗提示"导入将覆盖当前所有数据，是否继续？"
When 点击"确定"
Then 数据完全恢复
And 所有项目、需求、变更记录与导出时一致
```

### AC-42: JSON 导入 — 无效文件

```
Given 用户选择了一个非 JSON 或格式错误的文件
When 导入
Then 显示错误提示"文件格式不正确"
And 现有数据不受影响
```

---

## 空状态与边界

### AC-50: 项目无需求

```
Given 新创建的空项目
When 查看项目详情
Then 需求列表显示"还没有需求，点击下方添加"
And 图表区域显示"添加需求后即可看到图表"
And "导出图片"按钮置灰不可点击
```

### AC-51: 项目无变更

```
Given 项目有 3 个需求但无变更记录
When 查看图表
Then 简洁版只显示原始计划条（蓝色），无实际工期对比条
And 详细版：上部时间线区域显示"暂无变更记录"，下部甘特条正常渲染所有需求（纯蓝色，无变更段）
And 导出图片可用，显示"原始计划 X 天 · 暂无变更"
```

### AC-52: 清除浏览器数据

```
Given 用户清除了浏览器数据（IndexedDB 被删除）
When 重新打开 Scope Shield
Then 回到首次打开状态，显示 Demo 项目
And 之前的数据丢失（无 JSON 备份则不可恢复）
```

### AC-53: Demo 项目不可删除

```
Given Demo 项目存在
When 用户尝试删除 Demo 项目
Then 没有"删除"选项（仅有"归档"）
And Demo 项目只能归档，不能永久删除
```

### AC-54: Demo 项目归档恢复

```
Given Demo 项目已被归档
When 用户恢复 Demo 项目
Then Demo 项目恢复到初始状态（原始 Demo 数据）
And 用户对 Demo 的修改被重置
```

### AC-55: 循环依赖检测

```
Given 需求 A 依赖 B，需求 B 已存在
When 用户尝试设置 B 依赖于 A
Then 系统阻止操作，显示"不能设置循环依赖"
And 依赖设置不保存
```

### AC-56: 暂停需求填写剩余天数

```
Given 需求 C(10天)
When 记录变更类型"暂停"，选择需求 C
Then 弹窗显示"剩余天数"输入框，默认值 10
When 用户修改为 7，填写描述，保存
Then 需求 C 状态变为 paused，pausedRemainingDays = 7
And C 不计入总工期
```

### AC-57: 恢复需求使用冻结天数

```
Given 需求 C 已暂停，pausedRemainingDays = 7
When 记录变更类型"恢复"，选择需求 C
Then 需求 C 状态变为 active，currentDays = 7
And 总工期重新计算
```

### AC-58: 砍需求 — 仅限 active 状态

```
Given 需求 D 状态为 paused
When 打开变更弹窗选择"砍需求"
Then 需求 D 不出现在可选需求列表中（只显示 active 需求）
```

### AC-59: 优先级调整不影响工期

```
Given 需求 A(8天) 和需求 B(4天)，无依赖，总工期 = 8 天
When 记录变更类型"优先级调整"，将 B 移到 A 前面
Then 需求列表顺序变为 B → A
And 总工期仍为 8 天（不变）
```

### AC-60: 删除变更触发 replay 重算

```
Given 需求 X(5天)，有变更"X +3天"和变更"X +2天"，currentDays = 10
When 删除变更"X +3天"
Then X 的 currentDays 变为 7（初始5 + 剩余变更2）
And 总工期重新计算
```

### AC-61: 新增需求不影响原始工期

```
Given 原始需求 A(8天)，原始总工期 = 8 天
When 记录变更"新增需求 B(5天)"
Then 当前总工期 = max(8, 5) = 8 天
And 原始总工期仍为 8 天（B 不纳入原始工期）
And 膨胀率 = 0%（因为当前工期未超过原始工期）
```

### AC-62: 设置页入口

```
Given 用户在任意页面
When 点击侧边栏底部的"设置"图标/链接
Then 导航到设置页面 (/settings)
And 显示"导出数据"和"导入数据"按钮
```

### AC-63: 变更描述不能为空

```
Given 用户正在记录变更
When 描述字段留空，点击保存
Then 描述字段高亮红色，提示"请填写变更描述"
And 保存被阻止
```

### AC-64: 编辑需求 — 无变更记录时

```
Given 需求"用户管理(8天)"存在，尚未有变更记录修改其天数
When 用户点击需求行的编辑按钮
And 修改名称为"用户管理模块"，天数改为 10
Then 需求名称和天数更新
And originalDays = 10, currentDays = 10（直接同步）
And 总工期重新计算
```

### AC-65: 人名历史建议

```
Given 用户之前录入变更时填写过人名"张三"和"王总"
When 打开变更弹窗，点击人名输入框
Then 下拉显示"张三"和"王总"作为建议
And 按使用频次排序
When 输入"张"
Then 下拉过滤显示"张三"
```

### AC-66: 拖拽排序需求（无变更记录）

```
Given 需求列表顺序为 A → B → C
When 用户拖拽 C 到第一位
Then 列表顺序变为 C → A → B
And sortOrder 更新
And 不创建变更记录
And 总工期不变
```

### AC-67: 编辑变更 — 修改天数触发 replay

```
Given 需求 X(5天)，有变更"X +3天"(currentDays=8) 和变更"X +2天"(currentDays=10)
When 编辑第一条变更，将 +3 改为 +1
Then 触发 snapshot replay
And X 的 currentDays 变为 8（初始5 + 变更1 + 变更2）
And 总工期重新计算
```

### AC-68: 删除 new_requirement 变更 — 级联删除

```
Given 通过变更新增了需求"数据大屏(3天)"
When 删除该 new_requirement 类型的变更记录
Then 确认弹窗提示"删除此变更将同时删除关联的需求「数据大屏」"
When 点击"确定"
Then 变更记录删除
And 需求"数据大屏"同时删除
And 触发 replay 重算
```

### AC-69: 导出 PNG — 自定义宽度

```
Given 图表已渲染
When 点击"导出图片"，选择"自定义"，输入 600
Then 下载 PNG 图片，CSS 宽度 600px，实际像素宽度 1200px（2x Retina）
And 图表布局自适应 600px 宽度
```

### AC-70: 导出 PNG 文件名格式

```
Given 项目名为"CRM重构"
When 导出图片
Then 下载文件名格式为 scope-shield-CRM重构-{YYYY-MM-DD}.png
```

### AC-71: 无效路由处理

```
Given 用户访问 /project/nonexistent-id
When 页面加载
Then 重定向到最近的有效项目，或首页
And 不显示空白页或报错
```

### AC-72: 所有需求被取消 — 膨胀率边界

```
Given 项目有需求 A(8天)，原始总工期 = 8 天（冻结基线）
When 记录变更"砍需求 A"
Then 当前总工期 = 0 天
And 原始总工期仍为 8 天（冻结基线不受取消影响）
And 膨胀率显示 "-100%"（(0-8)/8 × 100）
And 图表显示"所有需求已取消"
```

### AC-73: 核心论点 — 0天来自开发

```
Given 项目有多条变更记录，总延期 9 天
When 查看图表底部总结
Then 显示"延期 9 天 = 100% 来自需求变更"
And 显示"0 天来自开发"
And 不存在"开发延期"类型的变更（系统不提供此类型）
```

### AC-74: 编辑需求 — 有变更记录时触发 replay

```
Given 需求 X(5天)，有变更"X +3天"，currentDays = 8
When 编辑 X 的 originalDays 从 5 改为 7
Then 触发 replay 重算
And X 的 currentDays = 7 + 3 = 10（基线变化，变更累加）
And 总工期重新计算
```

### AC-75: 依赖链 — 删除被依赖需求

```
Given 需求 A(8天) → B(4天) → C(3天) 链式依赖
When 删除需求 B
Then B 从列表移除
And C 的 dependsOn 自动清除为 null（C 变为无依赖）
And 总工期重新计算（C 从串行变并行）
And 系统提示"需求 C 的依赖已自动解除"
```

### AC-76: JSON 导入 — 悬空引用 + 有原名缓存

```
Given 导入的 JSON 中 change.targetRequirementId 指向不存在的需求
And 该 change 的 metadata.deletedRequirementName = "旧需求"
When 导入
Then 导入成功（允许悬空引用，因有原名缓存）
And UI 显示该变更关联"旧需求（已删除）"
```

### AC-76b: JSON 导入 — 悬空引用 + 无原名缓存

```
Given 导入的 JSON 中 change.targetRequirementId 指向不存在的需求
And 该 change 的 metadata 中没有 deletedRequirementName
When 导入
Then 导入成功（允许悬空引用）
And UI 显示该变更关联"需求已删除"
```

### AC-77: JSON 导入 — 枚举值非法

```
Given 导入的 JSON 中某条 change.type = "invalid_type"
When 导入
Then 显示错误提示"文件包含非法数据"
And 现有数据不受影响（事务回滚）
```

### AC-78: 暂停需求在依赖链中的行为

```
Given A(8天) → B(4天) 有依赖
When 暂停 A（剩余 5 天）
Then A 不计入工期
And B 的依赖暂时解除（视为无依赖，startDay=0）
And 总工期 = B 的 4 天

When 恢复 A（currentDays = 5）
Then A 计入工期
And B 的依赖恢复，startDay = A 结束后
And 总工期 = 5 + 4 = 9 天
```

### AC-79: 自定义导出宽度 — 非法值

```
Given 用户选择"自定义"导出宽度
When 输入 50（小于最小值 200px）
Then 输入框高亮红色，提示"宽度范围 200–2000px"
And "导出"按钮置灰

When 输入 3000（大于最大值 2000px）
Then 同上提示
```

### AC-80: 快照自动保存

```
Given 项目有需求 A(8天)
When 记录变更"A +3天"
Then 变更保存成功
And 系统自动创建一条 Snapshot 记录（changeId = 该变更 ID）
And Snapshot.data 包含变更后的需求状态和调度结果
```

### AC-81: 原始总工期为 0 的显示

```
Given 新建空项目，无需求
When 通过"记录变更→新增需求"添加需求 A(5天)
Then originalTotalDays = 0（A 是 isAddedByChange=true）
And currentTotalDays = 5
And 膨胀率显示"—"（非数字）
And 统计卡片"原始工期"显示"0 天"
```

### AC-82: 已归档项目仍可导出

```
Given 项目"CRM重构"已归档，有需求和变更数据
When 查看已归档项目详情
Then 所有编辑/添加/变更按钮不可见
And "导出图片"按钮仍可用
And 点击导出可正常生成 PNG
```

### AC-83: 编辑需求名称（不改天数）不触发 replay

```
Given 需求 X(5天)，有变更记录
When 编辑 X 的名称从"用户管理"改为"用户管理模块"，天数不变
Then 名称更新成功
And 不触发 replay（仅 originalDays 变更才触发）
And currentDays 和总工期不变
```

### AC-84: 数据规模上限

```
Given 项目已有 50 个需求
When 用户点击"+ 添加需求"
Then 显示提示"已达需求上限(50)"
And "添加"按钮置灰不可点击

Given 项目已有 200 条变更记录
When 用户点击"记录变更"
Then 显示提示"已达变更记录上限(200)"
And "保存"按钮置灰不可点击

Given 项目已有 49 个需求
When 用户通过变更弹窗选择"新增需求"类型并保存
Then 新增需求成功（第 50 个）

Given 项目已有 50 个需求
When 用户通过变更弹窗选择"新增需求"类型
Then 显示提示"已达需求上限(50)，无法新增"
And "保存"按钮置灰
```

### AC-85: 拖拽排序 vs 变更弹窗调优先级的区别

```
Given 需求列表顺序为 A → B → C
When 用户通过拖拽将 C 拖到第一位
Then 列表变为 C → A → B
And 不创建变更记录

When 用户通过变更弹窗"调优先级"将 B 调到第 1 位
Then 列表变为 B → C → A
And 创建一条 reprioritize 变更记录
And 变更记录显示"B 优先级调整到第 1 位"
```

### AC-86: JSON 导入 — version 字段缺失

```
Given 导入的 JSON 文件中没有 version 字段
When 导入
Then 显示错误提示"文件格式不正确：缺少版本信息"
And 现有数据不受影响
```

### AC-87: 图表段宽与总延期不一致时的显示

```
Given 需求 A(8天) 无依赖
When 记录变更"新增需求 B(5天)"（B 与 A 并行）
Then 简洁版图表：
  原始计划条 = 8天宽
  实际工期条 = 8天蓝色基底 + 5天靛色段（段超出 currentTotalDays 标记线，靛色=#5B21B6 表示新增需求）
  currentTotalDays 标记线 = 8天位置（竖线）
  底部显示"延期 0 天 · 膨胀率 0%"
And 段宽总和(8+5=13) > currentTotalDays(8)，段正常渲染超出标记线
And 基准天数 = max(8, 8, 13) = 13，所有条使用此比例尺
```

### AC-88: 编辑项目名称

```
Given 项目"CRM重构"存在
When 用户点击项目名称进入编辑态
And 修改为"CRM 系统重构"
And 失焦或按回车
Then 项目名称更新为"CRM 系统重构"
And 侧边栏同步显示新名称
```

### AC-89: 编辑变更 — 更改类型（非 new_requirement）

```
Given 存在变更记录"A范围扩大 +4天"（type=add_days, target=A）
When 编辑该记录，将 type 从 add_days 改为 cancel_requirement
And target 改为需求 B（active 状态）
Then type 和 target 更新成功
And 触发 snapshot replay 重算
And A 恢复原始天数，B 变为 cancelled
```

### AC-90: 编辑变更 — 禁止改为 new_requirement

```
Given 存在变更记录"A范围扩大 +4天"（type=add_days）
When 编辑该记录
Then type 下拉选项中不包含"新增需求"（new_requirement）
And 可选类型为：加天数、砍需求、调优先级、暂停、恢复
```

### AC-91: 编辑变更 — 更改日期触发 replay

```
Given 存在两条变更：04/01 A+3天，04/05 A+2天（A 原始5天→10天）
When 编辑第二条变更日期从 04/05 改为 03/30
Then replay 顺序变为：03/30 A+2天，04/01 A+3天
And A 的 currentDays 仍为 10（加法交换律，结果不变）
And snapshot 按新顺序重建
```

### AC-92: 编辑需求依赖 — 触发调度器重算

```
Given 需求 A(8天) 和 B(4天)，B 无依赖，总工期=8天
When 编辑 B，设置依赖于 A
Then 总工期变为 12 天（A 8天 + B 4天）
And 不触发 replay（依赖修改只触发调度器重算）
And 变更记录不受影响
```

### AC-93: 暂停/恢复在简洁版图表中不渲染段

```
Given 需求 A(8天) 有变更"A +3天"和"暂停 A"
When 查看简洁版图表
Then 膨胀条只显示 +3天的段（按角色着色）
And 暂停事件不渲染段（daysDelta=0）
And 底部总结根据当前工期计算
```

### AC-94: 详细版甘特 — 同需求多次变更段

```
Given 需求 A(8天)，变更1: PM +3天(04/01)，变更2: QA +2天(04/05)
When 查看详细版甘特
Then A 行显示：蓝色8天 + 红色3天(PM) + 紫色2天(QA)
And 段按日期正序从左到右排列
And 每段颜色按角色映射
```

### AC-95: 表单字段长度限制

```
Given 用户正在创建项目
When 项目名称输入超过 100 字符
Then 输入被截断或红色提示"项目名称不能超过 100 字"

Given 用户正在记录变更
When 描述输入超过 500 字符
Then 输入被截断或红色提示"描述不能超过 500 字"
```

### AC-96: 导出 PNG 非空白验证

```
Given 项目有至少 1 个需求和 1 条变更
When 用户点击"导出图片" → 选择 390px → 导出
Then 下载的 PNG 文件大小 > 1KB
And 图片内容包含项目名称、工期数字、膨胀条/甘特条
And 背景为白色（非透明）
And 文字清晰可读（使用系统字体，无乱码/缺字）

Given 导出第一次失败（Blob.size ≤ 1024）
Then 系统自动重试一次
And 第二次仍失败则 Toast 提示"导出失败，请重试"
```

### AC-97: 导出 PNG 跨浏览器兼容

```
Given 用户在 Safari 16+ 中使用
When 导出图片
Then 图片内容非空白（导出组件不使用 foreignObject、backdrop-filter、外部字体）
And 图片效果与 Chrome 基本一致
```

### AC-98: 责任归属 — 底部总结格式

```
Given 项目有 3 条变更：PM张三 +4天, PM李四 +2天, 领导王总 +3天
When 查看简洁版图表底部
Then 第一行显示"延期 9 天"（红色大字）
And 第二行显示"3 次变更 · 产品经理×2 · 领导×1"
And 第三行显示"100% 来自需求变更 · 0 天来自开发"
```

### AC-99: 责任归属 — 节省超过膨胀

```
Given 项目原始工期 15 天
And 变更 1: 砍需求 A(8天), 变更 2: 加天数 B +3天
And currentTotalDays < originalTotalDays
When 查看图表底部
Then 显示"提前 X 天"（绿色）
And 第三行改为"需求变更被工期节省抵消"
```

### AC-100: 新增需求颜色与 QA 区分

```
Given 项目有变更"QA加天数 +2天"和变更"新增需求 D(3天)"
When 查看简洁版图表
Then QA段为紫色(#7C3AED)
And 新增需求段为靛色(#5B21B6)
And 两者颜色可明显区分
```

### AC-101: 删除需求后的图表显示

```
Given 需求 A 有 2 条变更记录（+3天, +2天）
When 删除需求 A
Then 简洁版图表中 A 相关变更段仍显示，段标注追加"(已删除)"
And 详细版甘特中 A 不显示行（需求记录已不存在）
And 详细版时间线中 A 相关变更仍显示，需求名后标注"(已删除)"
And 总工期按剩余需求重算
```

### AC-102: 删除需求不触发 replay

```
Given 需求 A(5天) 有变更"A +3天"，需求 B(4天) 有变更"B +2天"
When 删除需求 A
Then 变更"A +3天"保留，标记"需求已删除"
And 需求 B 的 currentDays 不变（仍为 6）
And Snapshot 保留不重建
And 仅调度器重算总工期
```

### AC-103: DB 写入失败时的用户提示

```
Given 用户正在记录变更
When IndexedDB 写入操作抛出异常
Then Toast 提示"保存失败，请重试"
And 已渲染的数据和图表保持上次成功状态
And 用户可重新点击保存
```

### AC-104: 基线编辑 — 有变更记录时编辑 originalDays

```
Given 需求 A(5天)，有变更"A +3天"和"A +2天"，currentDays=10
When 用户编辑 A 的天数从 5 改为 8
Then originalDays 更新为 8
And 触发 replay：currentDays = 8 + 3 + 2 = 13
And originalTotalDays 按新 originalDays 重算
And 归因链完整保留（两条变更的 daysDelta 不变）
```

### AC-105: 直接添加需求扩展基线

```
Given 项目有需求 A(8天)，originalTotalDays = 8
And 已有 1 条变更记录
When 用户通过"+ 添加需求"添加 B(6天)
Then B.isAddedByChange = false
And originalTotalDays = max(8, 6) = 8（或串行时累加）
And 变更记录不受影响
And 基线正常扩展
```

### AC-106: 删除 new_requirement 创建的需求后 replay 不复活

```
Given 需求 A(8天) 有变更"A +3天"
And 有变更"新增需求 B(5天)"（B.isAddedByChange=true）
When 用户硬删除需求 B
Then B 从 IndexedDB 移除，变更"新增需求 B"保留且 metadata.deletedRequirementName 已回写
When 用户随后删除变更"A +3天"（触发 replay）
Then replay 跳过"新增需求 B"变更（因目标需求已被硬删除）
And 需求 B 不会被重建
And A 的 currentDays = 8（回退到 originalDays）
And 仅剩需求 A 参与总工期计算
```

### AC-107: Replay 状态守卫 — resume 在未暂停需求上跳过

```
Given 需求 A(8天) 有变更序列：
  1. "暂停 A"（pause, remainingDays=5）
  2. "恢复 A"（resume）
  3. "A +2天"（add_days）
When 用户将变更 1 的 type 从 pause 改为 add_days（+1天）（触发 replay）
Then replay 依次应用：
  变更 1: add_days → currentDays = 8+1 = 9
  变更 2: resume → 目标 status="active"（非 paused），跳过不应用
  变更 3: add_days → currentDays = 9+2 = 11
And A 最终 currentDays = 11，status = active
```

### AC-108: Replay 状态守卫 — cancel 在已取消需求上跳过

```
Given 需求 A(8天) 有变更序列：
  1. "砍掉 A"（cancel_requirement）
  2. "砍掉 A"（cancel_requirement，因编辑 type 产生的重复）
When replay 执行
Then 变更 1: cancel → status=cancelled, daysDelta=-8
And 变更 2: cancel → 目标 status="cancelled"，跳过不重复取消
And A 最终 currentDays = 8（保留），status = cancelled
```

### AC-109: 编辑 new_requirement 变更的天数

```
Given 需求 A(8天) 有变更"新增需求 B(5天)"
And B.isAddedByChange=true, B.currentDays=5
When 用户编辑该变更的天数从 5 改为 8（触发 replay）
Then replay 重建 B（复用原 ID），B.currentDays = 8, B.originalDays = 8
And B 的 daysDelta 更新为 8
And 后续引用 B 的变更正常应用
```

### AC-110: 无需求但有变更记录 — 仍可导出

```
Given 项目曾有需求 A(8天) 和变更"A +3天"
And 用户已硬删除需求 A（变更记录保留，标注"已删除"）
When 查看图表区域
Then 简洁版显示变更段（标注"已删除"），无原始计划条
And "导出图片"按钮可用
When 点击导出
Then 正常生成 PNG，包含变更记录（标注"已删除"）
```

### AC-111: Reprioritize 变更在 replay 中正确保留

```
Given 需求 A(5天)、B(4天)，sortOrder 为 A=0, B=1
And 有变更序列：1."A +3天"，2."B 调优先级到第 1 位"
When 删除变更 1（触发 replay）
Then replay 应用变更 2：B.sortOrder 更新到第 1 位
And A 的 currentDays = 5（回退到 originalDays）
And 需求列表顺序变为 B → A
```

### AC-112: 基线工期调度 — 忽略状态依赖松弛

```
Given 需求 A(8天) → B(4天) 有依赖，A 已暂停
When 计算 originalTotalDays
Then 调度器使用 originalDays 且不应用 status-based 依赖松弛
And A 虽然 paused，仍以 originalDays=8 参与基线调度
And originalTotalDays = 8 + 4 = 12（不因 A 暂停而变化）
```

### AC-113: 删除 new_requirement 变更 — 级联回写 metadata

```
Given 通过变更新增了需求 B(5天)（isAddedByChange=true）
And 另有变更"B +3天"（type=add_days, target=B）
When 删除 new_requirement 变更
Then 确认弹窗提示级联删除需求 B
When 点击"确定"
Then 需求 B 被硬删除
And new_requirement 变更被删除
And 变更"B +3天"保留，targetRequirementId 变为悬空引用
And 变更"B +3天"的 metadata.deletedRequirementName 被系统回写为"B"的原名称
And 触发 replay 重算（replay 时跳过悬空 target 的变更）
```

### AC-114: 编辑变更为砍需求 — 暂停目标被阻止

```
Given 需求 D 状态为 paused
And 存在变更记录"X +3天"（type=add_days, target=X）
When 编辑该记录，将 type 改为 cancel_requirement，target 改为需求 D
Then 需求 D 不出现在可选需求列表中（砍需求仅显示 active 需求）
And 无法选择 paused 状态的需求作为砍需求目标
```

### AC-115: 编辑变更 — 修改 pause.remainingDays 触发 replay

```
Given 需求 A(8天)，有变更"暂停 A"（pause, remainingDays=5）
When 编辑该变更的 metadata.remainingDays 从 5 改为 3
Then 触发 snapshot replay 重算
And A 的 pausedRemainingDays 更新为 3
And 后续若恢复 A，currentDays = 3
```

### AC-116: JSON 导入 — 数据规模超限

```
Given 导入的 JSON 中某项目有 51 个需求
When 导入
Then 显示错误提示"文件包含非法数据：单项目需求数超过上限(50)"
And 现有数据不受影响（事务回滚）

Given 导入的 JSON 中某项目有 201 条变更记录
When 导入
Then 显示错误提示"文件包含非法数据：单项目变更数超过上限(200)"
And 现有数据不受影响（事务回滚）
```

### AC-117: 人名缓存自动清理

```
Given PersonNameCache 中有人名"张三"，lastUsedAt = 91 天前
When 系统执行定期清理（应用启动时，见 architecture.md §PersonNameCache 90天清理）
Then "张三"从缓存中删除
And 不影响已保存的变更记录中的 personName 字段
```

### AC-118: totalDelay=0 时的显示

```
Given 项目原始工期 8 天，当前工期 8 天（totalDelay = 0）
When 查看简洁版图表底部
Then 第一行显示"延期 0 天"（灰色，非红色）
And 不显示"提前 0 天"
And 第三行显示"100% 来自需求变更 · 0 天来自开发"
```

### AC-119: 详细版负延期底部汇总

```
Given 项目原始工期 15 天，当前工期 10 天（totalDelay = -5）
When 查看详细版图表底部汇总
Then 显示单行格式："原计划 15天 → 实际 10天 · 提前 5天 · N次变更 · {roleSummary} · 需求变更被工期节省抵消"
And "提前 5天"使用绿色
```

### AC-120: 新增需求甘特混合着色

```
Given 通过变更新增需求 B(5天)（isAddedByChange=true）
And 后续有变更"B +3天"（PM 张三）
When 查看详细版甘特
Then B 行显示：靛色5天（原始天数部分）+ 红色3天（PM 变更部分，按角色着色）
And 靛色仅用于 B 的原始天数部分，变更段按角色着色
```

### AC-121: 编辑 reprioritize metadata 触发 replay

```
Given 存在变更记录"B 调优先级到第 1 位"（type=reprioritize, metadata.fromPosition=1, toPosition=0）
When 编辑该记录的 metadata.toPosition 从 0 改为 2
Then 触发 snapshot replay 重算
And 需求列表 sortOrder 按新位置更新
```

### AC-122: 所有需求暂停 — 边界状态

```
Given 项目有需求 A(8天) 和 B(4天)，originalTotalDays = 8
When 暂停 A 和 B
Then currentTotalDays = 0（无 active 需求）
And originalTotalDays 仍为 8（冻结基线，基线调度忽略 status）
And 膨胀率显示"-100%"
And 简洁版图表：蓝色原始条，底部"所有需求已暂停"
And 详细版甘特：所有需求行虚线边框 + 浅灰填充
```

### AC-123: 砍需求后依赖链 — replay 无法恢复 dependsOn（已知限制）

```
Given 需求 A(8天) → B(4天) 有依赖
When 记录变更"砍需求 A"
Then A.status = cancelled，B.dependsOn 自动清除为 null
And 总工期 = B 的 4 天（B 变为无依赖）

When 删除该 cancel 变更（触发 replay）
Then replay 将 A 恢复为 active，currentDays = 8
But B.dependsOn 仍为 null（replay 不恢复依赖关系——已知 MVP 限制）
And 总工期 = max(8, 4) = 8 天（非串行 12 天）
And 系统不显示错误（静默降级）
```

### AC-124: 编辑变更仅修改描述/角色/人名 — 不触发 replay

```
Given 需求 X(5天)，有变更"X +3天"（currentDays=8）
When 编辑该变更，仅修改描述从"范围扩大"改为"加了RBAC"
Then 描述更新成功
And 不触发 snapshot replay
And X 的 currentDays 仍为 8（不变）
And 总工期不变

When 编辑该变更，仅修改角色从"产品经理"改为"领导"
Then 角色更新成功
And 不触发 snapshot replay
And 图表颜色按新角色重新着色（领导=橙色）
And X 的 currentDays 仍为 8（不变）
```

---

## 需求补充（Supplement）

### AC-130: 记录变更 — 需求补充（基本流程）

```
Given 项目有需求"用户管理(8天)"（active 状态）
When 点击"记录变更"
And 选择类型"需求补充"
And 选择需求"用户管理"
And 选择补充子类型"功能补充"
And 天数填"2"
And 角色保持默认"产品经理"，填人名"张三"
And 描述填"要支持LDAP登录"
And 点击保存
Then 需求"用户管理"currentDays 变为 10 天
And 变更记录列表新增一条，类型显示"需求补充"
And 变更记录显示补充子类型"功能补充"
And 图表实时更新
And 从点击"记录变更"到保存完成 ≤ 30 秒（3步快速模式）
```

### AC-131: 需求补充 — 3 种子类型

```
Given 用户正在记录需求补充变更
When 选择补充子类型
Then 下拉显示 3 个选项：
  功能补充（feature_addition）
  条件变更（condition_change）
  细节细化（detail_refinement）
And 子类型为必选项（不选择则阻止保存）

Given 记录了 3 条补充变更，分别使用 3 种子类型
When 查看详细版时间线
Then 每条补充事件标注子类型名称（如"补充·条件变更"）
```

### AC-132: 需求补充 — daysDelta=0 允许

```
Given 项目有需求"用户管理(8天)"
When 记录需求补充变更，天数填"0"，描述"登录页要加验证码（不影响工时）"
Then 保存成功
And 需求"用户管理"currentDays 仍为 8 天（不变）
And 变更记录创建成功，daysDelta = 0
And 统计卡片"变更次数"增加 1
And 统计卡片"补充次数"增加 1
And 简洁版图表膨胀条中不渲染该变更段（daysDelta=0）
And 详细版时间线中显示该变更事件
```

### AC-133: 需求补充 — 不受需求状态限制

```
Given 项目有需求 A(active)、B(paused)、C(cancelled)
When 记录需求补充变更
Then 需求下拉列表显示 A、B、C 三个需求（所有状态均可选）

When 选择 paused 状态的需求 B，天数填"1"，描述"增加了审批流程"
Then 保存成功，B 的 currentDays 增加 1
And B 状态仍为 paused（不因 supplement 改变状态）

When 选择 cancelled 状态的需求 C，天数填"0.5"，描述"方案变更"
Then 保存成功，C 的 currentDays 增加 0.5
And C 状态仍为 cancelled（不因 supplement 改变状态）
```

### AC-134: 需求补充 — 级联自动继承

```
Given 需求 A(8天) → B(4天) 有依赖
When 记录需求补充变更，选择需求 A，天数填"2"
Then A 的 currentDays 变为 10
And B 因依赖自动顺延（调度器重算）
And 变更记录 metadata.cascadeTargets 包含 B 的 ID
And 总工期 = 10 + 4 = 14 天
```

### AC-135: 需求补充 — 简洁版图表渲染

```
Given 项目有需求 A(8天)，变更1: PM +3天(红)，变更2: 补充 +2天(玫瑰红)
When 查看简洁版图表
Then 膨胀条中：蓝色8天 + 红色3天(PM) + 玫瑰红2天(补充)
And 补充段使用固定玫瑰红色 #E11D48（不按角色着色）
And 段标注显示"补充 +2天"
```

### AC-136: 需求补充 — 详细版甘特虚线段

```
Given 项目有需求 A(8天)，有补充变更 +2天
When 查看详细版甘特
Then A 行显示：蓝色8天（实线） + 虚线边框 + 玫瑰红浅色填充2天（#E11D48 opacity 20%）
And 补充段与 add_days 的实线段视觉明显区分
And daysDelta=0 的补充变更不在甘特条中渲染段
```

### AC-137: 需求补充 — 详细版时间线

```
Given 项目有补充变更：PM 张三对"用户管理"补充 +1.5天，子类型"条件变更"
When 查看详细版时间线
Then 显示事件："04/10 PM 张三：用户管理要支持LDAP +1.5天（补充·条件变更）"
And 事件中包含补充子类型名称
```

### AC-138: 统计卡片 — 补充次数

```
Given 项目有 5 条变更记录，其中 3 条为 supplement 类型（含 1 条 daysDelta=0 的）
When 查看项目头部统计卡片
Then 显示 5 个统计卡片：原始工期、当前工期、膨胀率、变更次数、补充次数
And "补充次数"卡片显示"3 次"（包含 daysDelta=0 的记录）
```

### AC-139: 需求补充 — 颜色与其他类型区分

```
Given 项目有变更"PM +3天"(红)、"QA +2天"(紫)、"补充 +1天"(玫瑰红)、"新增需求 D(3天)"(靛色)
When 查看简洁版图表
Then PM段为红色(#DC2626)
And QA段为紫色(#7C3AED)
And 补充段为玫瑰红(#E11D48)
And 新增需求段为靛色(#5B21B6)
And 四种颜色可明显区分

When 查看导出版图表
Then 补充段使用导出版玫瑰红 #E11D48（App 和导出共用同一色值）
```

### AC-140: 需求补充 — replay 中不受状态限制

```
Given 需求 A(8天)，有变更序列：
  1. "砍掉 A"（cancel_requirement）
  2. "补充 A +1天"（supplement, daysDelta=1）
When replay 执行
Then 变更 1: cancel → status=cancelled, currentDays=8
And 变更 2: supplement → currentDays=9（supplement 不受 status 限制，正常应用）
And A 最终 currentDays = 9, status = cancelled
```

### AC-141: 需求补充 — 编辑变更弹窗

```
Given 存在补充变更记录"用户管理要支持LDAP +1.5天"
When 点击编辑按钮
Then 弹窗标题为"编辑变更"
And type 按钮显示"需求补充"已选中
And 补充子类型下拉显示当前值"条件变更"
And 天数输入框显示 1.5
And 描述字段显示"用户管理要支持LDAP"
And 所有字段均可编辑

When 修改天数从 1.5 改为 2.5
And 修改子类型从"条件变更"改为"功能补充"
Then 触发 snapshot replay 重算
And 需求 currentDays 按新天数重算
```

### AC-142: 编辑变更 — 类型改为 supplement

```
Given 存在变更记录"A +3天"（type=add_days, target=A）
When 编辑该记录，将 type 改为 supplement
Then 动态字段联动：
  显示补充子类型下拉（3选1，必选）
  显示 daysDelta 输入框（允许0，支持0.5粒度）
  描述字段变为必填
And target 下拉刷新为所有状态需求（active + paused + cancelled）
When 选择子类型、填写天数和描述后保存
Then 触发 replay 重算
```

### AC-143: 需求补充 — 归因区分（add_days vs supplement）

```
Given 项目有变更"A +3天"（add_days, PM）和"A +2天"（supplement, PM）
When 查看简洁版图表
Then add_days 段按角色着色（PM=红色）
And supplement 段使用固定玫瑰红（#E11D48），不按角色着色
And 两种变更在图表中视觉明显区分

When 查看底部总结
Then 第二行角色统计中：add_days 按 PM 计入；supplement daysDelta>0 也按 PM 计入
And "5 次变更 · 产品经理×2 · ..."
```

### AC-144: 需求补充 — 底部总结中 daysDelta=0 不计入角色统计

```
Given 项目有 3 条变更：
  1. PM +3天（add_days）
  2. PM 补充 +0天（supplement, daysDelta=0）
  3. 领导 补充 +2天（supplement, daysDelta=2）
When 查看简洁版图表底部总结
Then 第二行："3 次变更 · 产品经理×1 · 领导×1"
And totalChanges=3（含 daysDelta=0 的），角色统计排除 daysDelta=0 的变更
And 补充次数卡片显示"2 次"（2 条 supplement）
```

---

## 0.5 天粒度

### AC-150: 需求天数 — 0.5 步进验证

```
Given 用户正在添加需求
When 天数输入 0.5
Then 保存成功（最小值 0.5）
When 天数输入 1.5
Then 保存成功（0.5 步进）
When 天数输入 0.3
Then 输入框红色高亮，提示"请输入有效天数（最小 0.5，支持 0.5 步进）"
When 天数输入 0
Then 输入框红色高亮，提示"请输入有效天数（最小 0.5）"
```

### AC-151: 变更天数 — add_days ≥ 0.5

```
Given 用户正在记录 add_days 变更
When 天数输入 0.5
Then 保存成功
When 天数输入 0
Then 输入框红色高亮，提示"增加天数最小 0.5"
And 保存被阻止
```

### AC-152: 补充天数 — ≥ 0 且支持 0.5 步进

```
Given 用户正在记录 supplement 变更
When 天数输入 0
Then 保存成功（supplement 允许 0）
When 天数输入 0.5
Then 保存成功
When 天数输入 1.5
Then 保存成功
When 天数输入 0.3
Then 输入框红色高亮，提示"请输入有效天数（允许 0，支持 0.5 步进）"
And 保存被阻止
When 天数输入 -1
Then 输入框红色高亮，提示"天数不能为负数"
And 保存被阻止
```

### AC-153: 暂停剩余天数 — ≥ 0.5

```
Given 需求 A(8天)
When 记录暂停变更，剩余天数输入 0.5
Then 保存成功，pausedRemainingDays = 0.5
When 剩余天数输入 0
Then 输入框红色高亮，提示"剩余天数须在 0.5~8 之间"
And 保存被阻止
```

### AC-154: JSON 导入 — supplement 枚举值验证

```
Given 导入的 JSON 中某条 change.type = "supplement"
And change.metadata.subType = "feature_addition"
And change.daysDelta = 0
When 导入
Then 导入成功

Given 导入的 JSON 中某条 change.type = "supplement"
And change.metadata.subType = "invalid_subtype"
When 导入
Then 显示错误提示"文件包含非法数据"
And 现有数据不受影响（事务回滚）
```

### AC-155: 编辑变更 — 可选类型包含 supplement

```
Given 存在变更记录"A +3天"（type=add_days）
When 编辑该记录
Then type 下拉选项包含：加天数、砍需求、需求补充、调优先级、暂停、恢复
And 不包含"新增需求"（new_requirement）
And 选择"需求补充"后显示对应动态字段
```

### AC-156: replay 中 supplement daysDelta=0 不改变 currentDays

```
Given 需求 A(5天)，有变更序列：
  1. "A +3天"（add_days）
  2. "A 补充 +0天"（supplement, daysDelta=0）
  3. "A +2天"（add_days）
When replay 执行
Then 变更 1: currentDays = 5+3 = 8
And 变更 2: daysDelta=0, currentDays 仍为 8（不变）
And 变更 3: currentDays = 8+2 = 10
And A 最终 currentDays = 10
```

### AC-157: 需求补充 — 3步快速模式验证

```
Given 用户点击"记录变更" → 选择"需求补充"
Then 核心交互为 3 步：
  Step 1: 选择需求（下拉，所有状态可选）
  Step 2: 填写描述（必填）
  Step 3: 填天数（≥0，默认可为0或空）+ 选子类型（3选1，必选）
And 角色默认"产品经理"，日期默认今天（多数情况不需改）
And 整体操作 ≤ 30 秒
```
