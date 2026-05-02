# Wave 5 走查报告 · Scope Shield 从单项目工具进阶为跨项目平台

> 时间：2026-05-02 · 秘书亲测 · headless Chromium @ 1440×900 + 390×844 mobile
> 对照基线：[wave4-walkthrough.md](./wave4-walkthrough.md)（17/17 + 9/9 落地）

## 摘要

**19/19 断言通过 · 0 console + pageerror · 总耗时 8.5s**

Wave 5 落地 6 项 + 走查 6 站全绿。新功能（项目目标日 + 项目级逾期识别 / Demo
回放真实可用 / 跨项目 Analytics 页面 / 只读分享链接 / 移动端 baseline）端到端
happy-path 全部能跑。

## 走查站点对照

| Step | Wave | 项 | 断言 | 结果 |
|------|------|----|----|----|
| S1 | — | 首屏 | 1.9s 首绘 + 0 错误 | ✅ |
| S2.W5.1 | W5 | 项目目标日 | ProjectHeader 红"已逾期 12 天" chip · 编辑按钮显示"目标 2026-04-20" · Sidebar 红圆点 1 个 | ✅ ✅ ✅ |
| S2.W5.2 | W5 | Demo 逾期变更 | ChangeRow 逾期 chip 数 = 1（chg-005） | ✅ |
| S3.W5.2 | W5 | 回放真实数据 | 帧标签 = "帧 0 / 5 · 原计划 · 18 天"（非"暂无快照"） | ✅ |
| S4.W5.3 | W5 | Analytics 页面 | /analytics 路由渲染 · 平均膨胀率 KPI 显示 +42% · 逾期 Top 3 = 1 行 · 标签 Top 5 panel 可见 | ✅ ✅ ✅ ✅ |
| S5.W5.4 | W5 | 只读分享链接 | 按钮可见 · #share= 格式正确（4219 chars）· 在新页面打开 banner 可见 · 编辑按钮数 = 0 | ✅ ✅ ✅ ✅ |
| S6.W5.5 | W5 | 移动端 | 390×844 viewport Hamburger 可见 · drawer backdrop 可见 · chart overflow-x = auto | ✅ ✅ ✅ |

## 截图

- `01-first-paint.png` — Demo 项目桌面首屏（包含逾期 chip + 红圆点 + 目标日按钮）
- `03-replay-with-frames.png` — 回放 dialog 5 帧可 scrub
- `04-analytics.png` — /analytics 页面（KPI + Top 3 + Top 5 + 全部项目表）
- `05-share-mode.png` — 只读分享视图（蓝色 banner）
- `06-mobile-default.png` — 390×844 移动端默认（Hamburger 可见）
- `06-mobile-drawer-open.png` — 移动端 drawer 打开

## 发现细节（每个 finding 的原话）

```
[S1] 首屏耗时 1884ms
[S2.W5.1] ✓ ProjectHeader 红色"已逾期 N 天" chip 可见
[S2.W5.1] 逾期 chip 文案: 已逾期 12 天
[S2.W5.1] ✓ 目标日编辑按钮可见，文案 = 目标 2026-04-20
[S2.W5.1] Sidebar 红圆点数量 = 1 (demo 应 ≥ 1)
[S2.W5.2] ChangeRow 逾期 chip 数量 = 1 (W5.2 demo 升级后应 ≥ 1)
[S3.W5.2] 回放帧标签: 帧 0 / 5原计划 · 18 天 (W5.2 修复后应非"暂无快照")
[S4.W5.3] /analytics 路由渲染 = true
[S4.W5.3] 平均膨胀率 KPI: 平均膨胀率+42%基于进行中项目
[S4.W5.3] 逾期 Top 3 行数 = 1 (demo 应 ≥ 1)
[S4.W5.3] 标签 Top 5 panel 可见 = true
[S5.W5.4] ✓ 分享按钮可见
[S5.W5.4] 分享 URL 已复制 · #share= 格式正确 = true · 长度 4219
[S5.W5.4] 共享 URL 打开 → banner 可见 = true
[S5.W5.4] "复制为我的项目"按钮可见 = true
[S5.W5.4] 只读模式下"编辑"按钮数 = 0 (应为 0)
[S6.W5.5] ✓ 移动端 Hamburger 可见
[S6.W5.5] Drawer 打开后 backdrop 可见 = true
[S6.W5.5] chart-content overflow-x = auto (应为 auto)
```

## Bug 修复记录（走查发现 → 当场补）

**S5.W5.4 first run** — share-page 抛 `useLocation() may be used only in the
context of a <Router>`，banner / clone button 不可见。原因：SharedViewPage 复用
ChangeList，而后者用 `useSearchParams`，需要 router 上下文。修复：在 App.tsx 用
MemoryRouter 包住 SharedViewPage（不能用 BrowserRouter，会复用 location 把
share URL fragment 覆盖掉）。再跑 19/19 全绿。

## Wave 5 整体收口

| 项 | 落地 | 测试 | 走查 |
|---|---|---|---|
| W5.1 项目目标日 + 项目级逾期 | ✅ | tsc | ✅ |
| W5.2 Demo 真实变更（snapshot + 逾期 chip） | ✅ | tsc | ✅ |
| W5.3 跨项目 Analytics 页面 | ✅ | 5 unit | ✅ |
| W5.4 只读分享链接 | ✅ | 4 unit | ✅ |
| W5.5 移动端 responsive | ✅ | tsc | ✅ |
| W5.6 走查 + 收口 | ✅ | — | ✅ (本报告) |

**累计 Wave 1-5：45 项落地 · 266 unit + 4 轮亲测走查全过 · Wave 1-4 e2e 历史绿盘**

## 待优化项（不阻断 Wave 5）

1. **share URL 长度** — demo 项目 5 changes + 4 reqs 编码后 4219 字符。如果用户的项目挤到 100+ changes，URL 可能超过 8KB，部分平台粘贴会被截断。Wave 6 候选：加 lz-string 压缩（~3KB 包，能压到 ~30%）。
2. **Analytics 仅服务端聚合** — 数据完全在 IndexedDB 计算，跨设备不会同步。这是 scope shield "纯本地 zero-backend" 设计的延伸特性，非缺陷，但用户量上来后会有"在公司机器看不到家里数据"的呼声。
3. **移动端 chart 横向滚动可发现性** — 目前用 overflow-x: auto，PC 上有滚动条提示，但 iOS 上无肉眼提示。可以加 fade gradient 暗示可滚动。
