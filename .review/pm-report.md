# PM 评审报告 · Scope Shield → Commercial Grade

> 评审基线：HEAD `28320b1`（2026-04-30），实地对比 `docs/screenshots/01-06.png` × `docs/prototypes/_renders/proto-apple-style.png`。
> 评审标准：Linear / Notion / Apple HIG / Stripe Dashboard。
> 视觉锚点：Boss 已三次确认 Apple 亮色磨砂玻璃为唯一品牌方向（`proto-apple-style.png` + `proto-export-v2-c.png`）。

## 总体印象

**定位**：Scope Shield 是少有的"用对比条 + 甘特把 scope creep 量化到天"的隐私优先工具，叙事好（"延期 5.5 天 = 100% 来自需求变更"），数据完整度对得起复盘场景。
**核心强项**：变更归因 + 双图表 + 100% 本地 IDB + 自动备份恢复 — 这套组合开源圈难找第二份。引擎层（changeProcessor / replayEngine / scheduler）是真技术资产。
**致命弱项**：**App 界面与设计稿严重脱节**——当前是"通用 Tailwind 后台"美学（白底 + gray-200 边框 + 12-13 px 字号），磨砂玻璃 / 渐变 bar / 大数字震撼 / 浮动 CTA 一个都没落地。导出图片做到了 Apple 风格，App 自己反而最不像 Scope Shield。**这是要从开源升商业级的最大鸿沟**。

---

## P0 致命问题（修不了不能发布 · 7 项）

### P0-1: App 视觉与品牌设计稿严重脱节，磨砂玻璃 0% 落地

- **位置**: `src/components/layout/Sidebar.tsx:30` (`bg-gray-50`) / `src/components/project/StatsCard.tsx:10` (`bg-gray-50`) / `src/pages/ProjectPage.tsx:115` 起的三个 `bg-white rounded-xl border border-gray-200 shadow-sm` 卡片 / `src/index.css` 全局只定义 3 个 CSS 变量
- **现象**: 当前 App 是「白底 + 浅灰边框 + shadow-sm」的通用后台美学，无渐变、无毛玻璃、无 backdrop-filter、无 saturate、无渐变 bar。`docs/ui-spec.md:301` 直接把 App 风格定义成 "Linear/Notion 中性风"，与 Boss 反复确认的 Apple 亮色磨砂玻璃 (`proto-apple-style.png`) **从规格层面就矛盾**。导出图片做到了 Apple，App 反而最不像 Scope Shield。
- **应该**: 全局 design token 系统（CSS variables for `--glass-bg` / `--glass-blur` / `--glass-saturate` / `--gradient-plan` / `--gradient-actual` / `--shadow-card`），核心容器（侧栏 / 卡片 / 模态）启用 `backdrop-filter: blur(20px) saturate(180%)` + `background: rgba(255,255,255,0.72)`。参考 Stripe Dashboard（亮色卡片悬浮）+ Linear Today 视图（柔和阴影 + 渐变 accent）。
- **原因**: Boss 已 3 次否决暖羊皮纸方向，但 App 至今没把磨砂玻璃落地任何一个组件。商业级产品的首屏 3 秒决定订阅/Star/留存，"看着像哪个开源项目"和"看着像 Linear 第二个产品"差一个估值数量级。
- **改动**: (1) 新建 `src/styles/tokens.css` 把所有视觉变量集中；(2) `index.css` 引入；(3) 改造 `Sidebar` / `StatsCard` / `ProjectHeader` / 三个主卡片 + `ConfirmDialog` / `RecoveryDialog` / `ChangeModal` 容器；(4) 同步重写 `docs/ui-spec.md` §"App 界面风格"段落，删除"中性风格"措辞，改为"Apple 亮色磨砂玻璃"。**M（中等工作量，约 1 个工作日）**
- **验收**: 全部主容器在 Chrome / Safari 上能看见 backdrop-filter 模糊（用红色画板拖到背后能看到模糊渗透）；与 `proto-apple-style.png` 并排截图，色温 / 圆角 / 阴影差异肉眼难辨；Lighthouse a11y > 95（不能因为半透明把对比度搞炸）。

### P0-2: 关键指标"膨胀率"信息层级缺失，等同于普通统计卡

- **位置**: `src/components/project/ProjectHeader.tsx:61-69` + `src/components/project/StatsCard.tsx:8-18`
- **现象**: 5 个 StatsCard 平铺 + 同字号 + 同背景，"膨胀率 +31%" 与"变更次数 4 次"视觉权重一致。设计稿里 `+60%` 是大号红色数字 + 副本说明，是整张卡的视觉锚点。当前实现里它和"原始工期 18 天"比没有任何特别地位。
- **应该**: 膨胀率独立放大为主指标卡（字号 ≥36 px，宽度占 1.5–2 倍，色彩跟着正/负变红/绿，下方加一行解释 "比原计划多 5.5 天，3 次需求变更带来"），"原始工期"/"当前工期"做小卡，"变更次数"/"需求补充"做更小的 chip。参考 Stripe Dashboard 的 hero metric 处理。
- **原因**: 这是产品价值主张的视觉支点（README 第一句 "膨胀 31%"），首屏没让它震撼 = 产品故事没讲出来。
- **改动**: `ProjectHeader.tsx` 重排 5 → 1 主 + 4 副；`StatsCard` 增加 `variant: 'hero' | 'default' | 'chip'` prop。**S（半天）**
- **验收**: 用户截屏分享时一眼能看到红色大数字；e2e 断言 `[data-testid=hero-stat-inflation] text=+31%` 字号至少 32px。

### P0-3: 主操作按钮 "记录变更" 被埋在第三个 section 头部，违反 Fitts's Law

- **位置**: `src/components/change/ChangeList.tsx:50-57` + 当前 1280×720 viewport 下需求列表 + 变更记录两个区都比图表区高（截图 `01-overview.png` 印证）
- **现象**: 用户日常最高频操作是"记录变更"（产品名都叫 Scope Shield），但按钮位于变更记录 section 标题右侧 — 需要先滚到中段。设计稿里这个按钮是**右下角浮动的红色 pill 按钮**（`proto-apple-style.png` 右下 "+ 记录变更"），永远 1 步触达。
- **应该**: 浮动 FAB 模式（fixed bottom-right，z-index 高于卡片），按 ⌘+⇧+C 也能触发（`docs/ui-spec.md:474` 已规划但未实现）。空状态时按钮内文案改 "记录第一次变更" 引导。
- **原因**: 主 CTA 不在视区 = 用户每次复盘都要找按钮 = 退订率上升。Linear 的 New Issue 永远 ⌘K 一键，Notion 的 + 永远悬浮。
- **改动**: 新建 `src/components/project/FloatingCTA.tsx`，挂在 `ProjectPage.tsx` 根；移除 `ChangeList` 内嵌按钮（保留头部 section 入口但改成轻量 ghost 按钮）；新增全局 keydown listener 绑定 ⌘+⇧+C。**S（半天）**
- **验收**: e2e 断言：在任意滚动位置点击右下角 FAB 都能打开 ChangeModal；按 ⌘+⇧+C 同样触发。

### P0-4: 变更弹窗一屏密度过大，"30 秒记录"目标实际要 60 秒+

- **位置**: `src/components/change/ChangeModal.tsx:244-575`（一个 580 行的巨型 modal）
- **现象**: 截图 `03-change-modal.png` 一打开 7 个类型 chip + 目标需求 + 调整天数 + 责任角色 + 责任人 + 日期 + 描述 + 截图证据，**8 个 field 同屏纵向滚动**。`docs/ui-spec.md:214` 自己声明 30 秒目标，但实际录入新增需求 / supplement 时字段联动多，新手第一次完成需要 60+ 秒。
- **应该**: 两段式（Step 1 选类型 → Step 2 填上下文），或者按"必填 vs 可选"折叠（截图证据 / 责任人 / 日期 这种默认折叠）。参考 Linear 的 Issue 创建（核心 3 个字段，其它 inline 折叠）+ 飞书 multidim 的快捷录入。
- **原因**: 用户高频任务被卡 = 每天少录几条 = 数据残缺 = 复盘数据不可信 = 产品失去价值锚点。
- **改动**: 把 ChangeModal 拆 `<TypeStep />` + `<DetailStep />`；非首屏字段做 disclosure。可与 P0-3 一起做。**M（1 天）**
- **验收**: 录入 add_days 类型从 modal 打开到关闭 ≤ 6 次点击 / 输入；e2e timer 测试 < 15 秒（机器输入）。

### P0-5: 主页缺少"工期对比"区域标题 + 双图表 tab 视觉太弱，用户找不到核心可视化

- **位置**: `src/components/chart/ChartArea.tsx:21-72` + `src/pages/ProjectPage.tsx:142-150`
- **现象**: 当前 ChartArea 只有一个 inline tab pill（`简洁版 | 详细版`）和导出按钮，**没有 section 标题**（其他两个区都有"需求列表" / "变更记录"）。在 `proto-apple-style.png` 里这块叫"工期对比"，是图表区的明确锚点；当前实现里它默认在第三屏，新用户看不到 = 产品最重要的"画面"没展示出来。
- **应该**: ChartArea 加 section 标题 "工期对比"，tab 改更显著的 segmented control（系统蓝高亮），右侧加副标题/解读 "原计划 18 天 → 实际 23.5 天，膨胀 31%"。考虑提到 ProjectPage 顶部第二位（仅次于 ProjectHeader），让首屏就看到。
- **原因**: 产品名叫 Shield，核心价值是"看见"，用户进来如果第一屏看不到对比图 = 卖点失败。
- **改动**: `ChartArea.tsx` 加头部行 + section title；`ProjectPage.tsx` 把 ChartArea 移到 RequirementList 之上或之下取决于 first-impression 分析（推荐紧跟 ProjectHeader 之后，让数字 → 图表自然衔接）。**S（半天）**
- **验收**: 进入项目页首屏（不滚动）就能看到"工期对比"标题 + 完整简洁版图表。

### P0-6: 数据持久化保障对用户 0 可见，"100% 本地"承诺没体现在 UI 上

- **位置**: `src/pages/SettingsPage.tsx:109-120`（自动备份只在设置页一行小字）+ `src/components/layout/Sidebar.tsx`（无任何备份/隐私指示）
- **现象**: 自动备份是 P1 大杀器（README 重点宣传），但用户根本看不见——除非主动进设置页。隐私优先 = 卖点之一，但 UI 里没有任何 "Local · Encrypted in browser" 类的徽章 / footer / status indicator。
- **应该**: (1) Sidebar 底部加 status 行 "本地存储 · 上次备份 14:35"（绿点 = 正常 / 黄点 = 备份失败 / 红点 = quota 即将满）；(2) 项目头部右侧加小 chip "🔒 本地 only"；(3) 备份失败时 Toast 主动提示 "存储空间不足，建议导出"。
- **原因**: 隐私和数据安全是付费转化的最强卖点，看不见 = 等于没有。Notion 让你觉得云端"很重"是因为它有同步指示器，本产品反过来要让"本地很重"被用户感知。
- **改动**: `Sidebar.tsx` footer 区域扩展，新增 `<LocalStorageBadge />` 组件 hook `getBackupTime()` + `navigator.storage.estimate()`；`autoBackup.ts` 失败时调 Toast。**M（1 天）**
- **验收**: 任何页面都能看到本地备份状态；mock storage quota 满时 Toast 出现且 chip 变红。

### P0-7: 大数据集（100+ 需求）无虚拟化，首屏渲染卡顿

- **位置**: `src/components/requirement/RequirementList.tsx:107-122`（DnD + 全量 map）+ `src/components/chart/DetailChart.tsx:295-441`（甘特行 SVG 全量渲染）+ `src/components/change/ChangeList.tsx:62-75`
- **现象**: 当前 list 是 `requirements.map`/`changes.map` 全量渲染，DetailChart 也是按 `ganttRows.length` 创建 SVG `<g>`。在 demo 项目（4-6 条）下没问题，但商业级用户的实际项目（半年期 100+ 需求 + 200+ 变更）会卡。我没看到任何 `react-window` / `react-virtualized` / `IntersectionObserver` 痕迹。
- **应该**: 列表 / 变更记录用 `react-window`（dnd-kit 兼容方案：`@dnd-kit/sortable` + `useVirtualizer` 配 `getItemKey`）；DetailChart SVG 加视口剪裁（rows in viewport 才渲染，配滚动条同步）。或者更现实的：**先加性能基准 + 上限提醒**（"你的项目超过 80 条需求，建议拆分"），等真有用户超 100 再做虚拟化。
- **原因**: 商业级 = 不能在第一个真实大客户那里炸。提前打基准比事后救火便宜。
- **改动**: (a) 加 `e2e/performance.spec.ts` 用 100/500/1000 条数据跑 Lighthouse；(b) 设阈值 80 条软警告 + 200 条硬警告；(c) 真要虚拟化时引 `@tanstack/react-virtual`（dnd-kit 官方推荐）。**M（基准 + 警告 0.5 天，全量虚拟化 2 天）**
- **验收**: 100 条需求场景下 First Input Delay < 100ms；500 条场景下页面切换 < 500ms。

---

## P1 体验拉胯问题（影响日常使用 · 8 项）

### P1-1: 缺少深色模式，"全平台覆盖"印象残缺

- **位置**: `src/index.css`（无 `@media (prefers-color-scheme)`）+ 所有组件硬编码 `bg-white` / `text-gray-900`
- **现象**: 商业级 SaaS 100% 都做暗色（Linear / Notion / Stripe / Figma），开源圈也是。Boss 反复要 Apple 亮色，但**亮 + 暗 是两件事**。`docs/ui-spec.md:13` 把暗色列为非范围，过时了。
- **应该**: 设计 token 系统天然支持 `[data-theme="dark"]` 覆写；右上角加 sun/moon toggle；首次进入跟随系统。
- **改动**: 与 P0-1 token 系统一起做，多写一组暗色变量；新建 `useTheme()` hook + localStorage 保存偏好。**M（1 天，与 P0-1 协同）**
- **验收**: ⌘+⇧+L 快速切换；图表 SVG 文字色彩在暗色下对比度 ≥ AA。

### P1-2: 没有撤销 / 重做（Undo/Redo），删需求 / 删变更不可逆

- **位置**: `src/components/requirement/RequirementRow.tsx:143-151` 删需求 ConfirmDialog 仅"确定/取消" / `src/components/change/ChangeList.tsx:87-95` 删变更同理 / 无全局 history store
- **现象**: 误删需求 / 变更记录后只能去备份恢复（且会丢失中间所有数据）。Notion / Linear / Figma 都有 ⌘Z。
- **应该**: zustand 加一个 `historyStore`（最近 50 步的 inverse action），全局 ⌘Z / ⌘⇧Z；Toast 删除时显示"已删除 · 撤销" 5 秒按钮。后者更轻，先做。
- **改动**: `Toast.tsx` 加 `actionLabel?` + `onAction?`；删需求 / 删变更后调用。**S（半天）**
- **验收**: 删一条变更后右上角 Toast 显示"已删除 · 撤销"按钮，点击后变更恢复且 replayEngine 重算。

### P1-3: 没有键盘快捷键体系（除 Esc 关弹窗）

- **位置**: `docs/ui-spec.md:467-474` 列了 ⌘N / ⌘⇧C / ⌘E 但代码 0 实现 / 全局只有 ConfirmDialog/Modal 的 Escape
- **现象**: 商业级工具的"重度用户保留率"靠快捷键。Linear 的 G→I（go to inbox）/ C（new issue）是核心粘性。
- **应该**: 实现 ⌘N（新项目）/ ⌘⇧C（记录变更）/ ⌘E（导出）/ ⌘K（命令面板，最少做项目跳转）/ G→P（go to project）/ ?（快捷键面板）。
- **改动**: 新建 `src/hooks/useKeyboardShortcuts.ts` + `src/components/shared/CommandPalette.tsx`（cmd+k 项目跳转 + 操作搜索）。**M（1 天）**
- **验收**: 按 ? 弹快捷键面板；⌘K 输入项目名能跳转。

### P1-4: 飞书代理状态藏在设置页，URL 同步流没有视觉一致性反馈

- **位置**: `src/pages/SettingsPage.tsx:123-152`（绿/红/灰小圆点） + `src/components/requirement/RequirementForm.tsx:188-209`（解析后的 toast/inline message 风格不统一）
- **现象**: 用户粘贴 URL → 看到"已从飞书读取" → 但首页没办法快速看到代理是否还活着；解析失败时的"一键登录"按钮风格（橙色边）和正常态（蓝边）跳跃。
- **应该**: Sidebar 项目列表上方加全局 status row "🟢 飞书已连接 / 🟡 离线模式（仅手填）"；解析过程的所有反馈用同一套 inline status component。
- **改动**: 新建 `src/components/layout/SystemStatusBar.tsx`，hook `useSyncFeishu` 提供全局 health state；统一 form feedback color tokens。**S（半天）**
- **验收**: 任何页面都能看到飞书连接态；URL 解析的 5 种状态（待输入 / 解析中 / 成功 / 失败 / 需登录）走同一组件。

### P1-5: 截图证据交互生硬，没有粘贴提示 / 拖拽支持 / 缩放预览

- **位置**: `src/components/change/ChangeModal.tsx:517-562`（仅"添加"按钮 + paste listener，但 UI 上没明示）
- **现象**: 当前 UI 只显示"截图证据 (0/3，可粘贴)"，paste 工作但用户不知道；没有 drag-and-drop；预览的 lightbox 在 `ChangeRow.tsx:99-106`，不能放大缩小，背景不模糊。
- **应该**: dropzone 高亮（拖拽进入时虚线框变蓝 + "释放以上传"）；lightbox 加 ⌘+/⌘- 缩放、左右键切换、Esc 关闭、点背景关闭、模糊背景；空状态文案"拖入图片 / 粘贴 / 点击添加"三选一明示。
- **改动**: `ChangeModal.tsx` 加 `onDragOver` / `onDrop` handler + 文案；`ChangeRow.tsx` 抽出 `<ImageLightbox />`，用 framer-motion 加缩放 transform。**S–M（半天 - 1 天）**
- **验收**: 拖拽 PNG 进 modal 能识别上传；lightbox 支持滚轮缩放 + 左右键。

### P1-6: 表单错误恢复路径单薄，红边没有提示原因

- **位置**: `src/components/requirement/RequirementForm.tsx:150-153`（`border-red-300 bg-red-50` 但**没渲染错误文案**）+ `src/components/change/ChangeModal.tsx:407-410`（同样只有红边）
- **现象**: 字段验证失败只看到红色边框，没有具体错误原因。`docs/ui-spec.md:278-285` 列了详细错误文案"请输入有效天数（最小 0.5）"等，但实现里只有红边 + 部分 modal 字段（如 reprioritize）有 `<p className="text-red-500">`。
- **应该**: 所有错误字段统一加 `<FieldError />` 行内组件，显示具体原因；首次提交时聚焦到第一个错误字段；带 aria-describedby 让屏幕阅读器读到错因。
- **改动**: 新建 `src/components/shared/FieldError.tsx` + 全表单一致使用；form submit 时 scrollIntoView 第一个错误。**S（半天）**
- **验收**: e2e 断言：天数填 0 → 看到 "天数必须 ≥ 0.5"；有错时按 Enter 不提交；触达 a11y 错误 announce。

### P1-7: 没有 onboarding，Demo 项目唯一引导但讲不清产品价值

- **位置**: `src/db/seedDemo.ts`（自动创建 demo-001 但无 tour）+ 首次启动只跳到 Demo 项目
- **现象**: 新用户进来只看到一个看起来普通的项目页，不知道"+31% 膨胀率"代表什么、"7 类变更"为什么重要、"自动备份"在哪里。Notion / Linear 都有第一次的 ghost tour 或 checklist。
- **应该**: 首次启动后弹一个 4 步 tooltip-tour（指向膨胀率 → 变更类型 → 双图表 → 导出按钮），用 driver.js 或自写。或者更轻：Demo 项目侧栏置顶钉一条 "👉 这是演示数据，看左下角导出图片体验产品" 的 banner。
- **改动**: 新建 `src/components/onboarding/FirstRunTour.tsx`，localStorage 存 `onboarded` flag。**S–M（半天 - 1 天）**
- **验收**: 首次启动看到 tour 4 步；按 Skip 后再不出现。

### P1-8: 项目侧栏缺少状态/进度可视化，多项目并行时一眼看不清谁在膨胀

- **位置**: `src/components/layout/Sidebar.tsx:86-100`（`<FolderOpen />` + 项目名 + Demo 标签，仅此而已）
- **现象**: README 卖点之一就是"多个项目并行也能一眼看清谁在膨胀"，但侧栏只显示项目名 — 完全没体现各项目当前膨胀率 / 变更次数。设计稿（`docs/screenshots/00-design-concept.png`）侧栏每个项目左侧有彩色 status dot（绿/黄/红代表健康度）。
- **应该**: Sidebar 每个项目右侧显示 `+31%` mini-chip（红/绿色），左侧 status dot（绿 < 10% / 黄 10-30% / 红 > 30%）。
- **改动**: `Sidebar.tsx` 增加 `useProjectStats(projectId)` 派生 hook，渲染 chip + dot。**S（半天）**
- **验收**: 侧栏点击切换项目前就能看到每个项目当前膨胀率。

---

## P2 锦上添花（可放 backlog · 6 项）

### P2-1: 导出格式只有 PNG，缺 PDF / Markdown / 飞书富文本

- **位置**: `src/hooks/useExport.ts` 仅 `modern-screenshot` PNG 路径
- **现象**: 复盘场景常需粘到周报（Markdown）/ 走查文档（PDF）/ 飞书文档（富文本表）。当前只 PNG 一种。
- **应该**: 加 Markdown 表格导出（项目+需求+变更）、PDF（用 `@react-pdf/renderer`）、飞书图文复制（`navigator.clipboard.write` 写 HTML+text）。
- **改动**: `ExportModal.tsx` 增加 format radio。**M（1 天）**
- **验收**: 导出 Markdown 后粘到 飞书 / Notion 不乱码。

### P2-2: 缺批量操作（多选需求批量删除 / 批量调优先级 / 批量导入）

- **位置**: `src/components/requirement/RequirementList.tsx`（无 selection state）
- **现象**: 项目末期常有"砍掉所有 P3 需求"的批量操作，当前只能一条一条删。
- **应该**: 列表加多选 checkbox + 批量操作 toolbar（删除 / 复制到其他项目 / 调依赖）。
- **改动**: `RequirementList.tsx` 加 `selectedIds: Set<string>` state + toolbar。**M（1 天）**
- **验收**: 多选后显示 "已选 3 条，[删除] [移动到...]"。

### P2-3: 无搜索 / 过滤，长项目找不到东西

- **位置**: 整个 ProjectPage 无搜索框
- **现象**: 100+ 需求时找不到 "需求 A23"，需要肉眼扫。
- **应该**: ⌘F / 顶部搜索框 fuzzy 匹配需求名 / 变更描述 / 责任人。
- **改动**: 新建 `src/components/project/SearchBox.tsx`，配 fuse.js 或自写。**M（1 天）**

### P2-4: 没有内置评论 / 备注系统，变更记录的 description 是单行

- **位置**: `src/types/index.ts:91` `description: string`（受限单行）
- **现象**: 复杂变更需要长文说明，当前只有一行 input 框（`ChangeModal.tsx:507-514`）。
- **应该**: description 改 textarea + Markdown 渲染 + @ 提及人名（自动联动 PersonNameInput）。
- **改动**: schema 加 `descriptionMd` 可选字段（不破坏老数据）；UI 升级。**S（半天）**

### P2-5: 没有数据导出/导入的版本兼容提示

- **位置**: `src/db/exportImport.ts` + `src/types/index.ts:192` `version: '1.0'`
- **现象**: 当前 `version: '1.0'` 写死，将来 schema 升级时旧版 JSON 导入会怎样？没有 migration / 兼容性判断。
- **应该**: `importData` 检测 version，不匹配时弹"数据格式 v0.9 → v1.0 自动升级"对话框。
- **改动**: `exportImport.ts` 加 `migrateImport(data, fromVersion)` 函数。**S（半天）**

### P2-6: 缺少多语言（i18n），固化中文不利出海

- **位置**: 全部 hardcoded 中文（"添加需求" / "记录变更" / 等）
- **现象**: 隐私优先工具天然适合海外市场（GDPR），当前架构 0 i18n 准备。
- **应该**: 引入 `i18next` + `react-i18next`，至少抽中 / 英两份。
- **改动**: 全代码 string 抽 keys，约 200-300 处。**L（2-3 天）**

---

## 商业级缺口（vs Linear / Notion / Stripe）

**视觉资产差距（最大短板）**：当前 App 长得像 React Admin Demo，导出图片才像 Apple 产品。商业级要做的不是"加几个 backdrop-filter"——而是建立完整的 design system：token / motion / sound（subtle 的 confirmation chime）/ haptic（mobile 时代）。Linear 的 "feel" 是 200ms 缓入 + 渐变 backdrop + 所有 list 项 hover 都有色彩流动；Notion 的 "feel" 是浮动卡片阴影随鼠标位置动；Stripe 的 "feel" 是 Tabular numbers + 大量 8 px 网格对齐。Scope Shield 现在 0 motion、0 hover effect 差异、字号体系混乱（11/12/13/14/16/18/20 px 散乱共 7 档）。

**协作维度缺失**：100% 本地 IDB 是隐私卖点也是协作天花板。商业级要在不破坏隐私承诺前提下加：(1) 链接共享（导出加密 JSON 片段，对方导入查看，不上云）；(2) 评论系统（本地 + 可选 P2P 同步像 yjs）；(3) 多端同步可选项（iCloud / 自建 WebDAV）。这是从工具到平台的关键。

**Onboarding 与教育**：核心概念"7 类变更" / "膨胀率 100% 来自需求变更"是产品的认知锚点，但现在没有任何引导内容（没有 changelog / blog / playbook / 视频教程入口）。Linear 的 method.com、Notion 的 templates 库、Stripe 的 docs 是订阅留存的关键资产。

**变现路径模糊**：README / CLAUDE 都强调"零账号 / 零云"，但商业级版本一定要有付费方案（Pro = 多端同步 / 团队共享 / 高级图表 / 优先支持）。当前 0 付费按钮、0 Pricing 页、0 latitude 设计 paywall。建议先加 "Pro · Coming Soon" 占位 + 邮箱 waitlist 收集，验证付费意愿再开发。

**生态空缺**：飞书是已实现的 1 个集成，但 Jira / Linear / GitHub Issues / Notion DB / Asana / Monday 都该有 URL 同步。或者反向：暴露公共 URL schema 让其他工具来 push 数据进来（webhook + IDB write）。

**战略级建议**：先做 P0-1（视觉品牌落地）+ P0-3（FAB CTA）+ P0-7 性能基准 + P1-3 快捷键体系 — 这四件做完产品立刻有 "Linear 第二个产品" 的气场，再谈 Pro 收费就有底气。导出多格式 / 批量操作 / 多 tracker 集成全部是 P2 之后，现在做没价值。

---

## 视觉品牌一致性审计

> 评分：🟢 与 Apple 亮色磨砂玻璃一致 / 🟡 部分一致需调整 / 🔴 完全偏离品牌

| 组件 | 文件 | 视觉评分 | 主要偏离点 |
|------|------|---------|-----------|
| Sidebar | `Sidebar.tsx` | 🔴 | 纯 bg-gray-50，无 backdrop-filter，无项目状态 dot，logo 用 lucide-Shield 而非品牌定制 |
| ProjectHeader | `ProjectHeader.tsx` | 🟡 | 标题字号偏小（text-xl ≈ 20px，应 28-32），Archive 按钮位置弱，无渐变 accent |
| StatsCard | `StatsCard.tsx` | 🔴 | bg-gray-50 + 平铺无层级，缺渐变 / hero variant；与 `proto-export-v2-c.png` 的红色 +60% 视觉差距巨大 |
| RequirementList | `RequirementList.tsx` | 🟡 | rounded-xl 容器尚可，但内部行无 hover 渐变、无 grouping 分隔，DnD 抓手太隐藏（gray-300） |
| RequirementRow | `RequirementRow.tsx` | 🟡 | text-sm + tabular-nums 工程感重，缺 status badge 视觉权重；编辑态切换无动画 |
| RequirementForm | `RequirementForm.tsx` | 🟡 | bg-blue-50/50 太弱，飞书 URL 区缺图标层级；天数 / 前置 / 文案 三段挤在一起 |
| ChangeList / ChangeRow | `ChangeRow.tsx` | 🟡 | 左侧 1px 色条想法对，但 hover 无变化、截图缩略图 8×8 太小看不清 |
| ChangeModal | `ChangeModal.tsx` | 🔴 | 580 行平铺 modal，无渐进披露；7 个 chip 平铺挤压 horizontal space；rounded-xl + shadow-xl 但无毛玻璃 |
| ChartArea | `ChartArea.tsx` | 🟡 | tab pill 是细节做对的少数地方，但缺 section 标题、缺 hero 副标题解读 |
| SimpleChart | `SimpleChart.tsx` | 🟡 | SVG 内 fill=#2563EB + opacity 0.85 接近设计稿但**无渐变 fill**（设计稿是 linearGradient 蓝→深蓝），段标注线 stroke 太细 |
| DetailChart | `DetailChart.tsx` | 🟡 | 同上，BAR rx=4 偏方，应 6-8；时间线项目无 connector / dot pulse |
| ExportRenderer | `ExportRenderer.tsx` | 🟢 | 这个反而做对了——SF Pro 字体栈 + 系统色 + 圆角 12-16，是当前最像 Apple 的部分 |
| RecoveryDialog | `RecoveryDialog.tsx` | 🟡 | rounded-xl + shadow-xl 框架对，但按钮配色（蓝主 + 灰副 + 透明三）层级感弱；缺图标 |
| ConfirmDialog | `ConfirmDialog.tsx` | 🟡 | 同上，无 icon、无 destructive 视觉警示（应红色 alert icon） |
| Toast | `Toast.tsx` | 🟡 | bg-red-600 / bg-green-600 / bg-gray-800 三色硬切，缺渐变 + backdrop blur，应该浮在右上角加毛玻璃 |
| ExportModal | `ExportModal.tsx` | 🟡 | radio button 老式样，应改 segmented control；预览图缺失（用户不知道选 390 长什么样） |
| EmptyState | `EmptyState.tsx` | 🔴 | 13 行的最小实现，没有插画 / 渐变 icon / CTA 按钮——商业级的 EmptyState 应是首次惊艳点 |
| PersonNameInput | `PersonNameInput.tsx` | 🟡 | 下拉建议样式同 native select，无键盘高亮、无 fuzzy match icon |

**评分小结**：18 个组件中 🔴 4 个 / 🟡 13 个 / 🟢 1 个。**一致性约 5%**。导出图片做对了 Apple 风（🟢），App 自己反而最远离品牌。这是从开源到商业级最大的视觉债务。

---

> 评审完毕。建议优先做 P0-1（design tokens + 磨砂玻璃落地）+ P0-2（hero metric）+ P0-3（FAB） — 这三件做完整体气场就达到 Linear/Notion 60% 水平，再谈 Pro 付费才有谈判筹码。
