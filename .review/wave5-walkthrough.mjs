/**
 * 秘书 Wave 5 验收走查 — 7 站 + ~18 项断言
 * 对照基线：wave4-walkthrough.md (17/17)
 *
 * Coverage:
 *   S1 首屏 / 错误捕获
 *   S2 W5.1 + W5.2 项目目标交付日 + demo 逾期 chip
 *   S3 W5.2 demo 回放 dialog 帧标签非空（snapshot 已落库）
 *   S4 W5.3 Analytics 页面 KPI + Top 3 + 标签 Top 5
 *   S5 W5.4 只读分享链接 — 生成 → 打开 → banner 可见
 *   S6 W5.5 移动端 — 375 viewport drawer 触发 + chart overflow
 *   S7 错误总览
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/Users/hulu/huluman/scope-shield/.review/wave5-shots';
fs.mkdirSync(OUT, { recursive: true });
const findings = [];
const errors = [];
const note = (step, finding) => {
  findings.push({ step, finding, ts: new Date().toISOString() });
  console.log(`[${step}] ${finding}`);
};

const browser = await chromium.launch({ headless: true });

async function makeContext(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return { ctx, page };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

const t0 = Date.now();

// === Desktop session ===
const { ctx, page } = await makeContext();

// S1: 首屏
await page.goto('http://127.0.0.1:5174/');
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(800);
await shot(page, '01-first-paint');
note('S1', `首屏耗时 ${Date.now() - t0}ms`);

// S2: 项目目标交付日 + 逾期 chip
const overdueChip = page.getByTestId('project-overdue-chip');
const overdueVisible = await overdueChip.isVisible({ timeout: 1500 }).catch(() => false);
note('S2.W5.1', overdueVisible ? '✓ ProjectHeader 红色"已逾期 N 天" chip 可见' : '✗ 缺失 — demo 项目应已逾期');
if (overdueVisible) {
  const txt = (await overdueChip.textContent())?.trim() ?? '';
  note('S2.W5.1', `逾期 chip 文案: ${txt}`);
}

const targetEditBtn = page.getByTestId('target-end-date-edit');
const targetVisible = await targetEditBtn.isVisible({ timeout: 1000 }).catch(() => false);
note('S2.W5.1', targetVisible ? `✓ 目标日编辑按钮可见，文案 = ${(await targetEditBtn.textContent())?.trim()}` : '✗ 缺失');

const overdueDots = await page.locator('[data-testid^="project-overdue-dot-"]').count();
note('S2.W5.1', `Sidebar 红圆点数量 = ${overdueDots} (demo 应 ≥ 1)`);

// S2 — 真实逾期变更 chip（W5.2 加的 chg-005）
const overdueChanges = await page.locator('[data-testid^="change-row-overdue-"]').count();
note('S2.W5.2', `ChangeRow 逾期 chip 数量 = ${overdueChanges} (W5.2 demo 升级后应 ≥ 1)`);

// S3: 回放 dialog 帧标签非空
await page.getByTestId('replay-trigger').click();
await page.waitForTimeout(800);
await shot(page, '03-replay-with-frames');
const frameLabel = page.getByTestId('replay-frame-label');
const hasFrame = await frameLabel.isVisible({ timeout: 1500 }).catch(() => false);
if (hasFrame) {
  const text = (await frameLabel.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
  note('S3.W5.2', `回放帧标签: ${text} (W5.2 修复后应非"暂无快照")`);
} else {
  note('S3.W5.2', '✗ 回放帧标签仍未渲染');
}
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// S4: Analytics 页面
await page.getByTestId('nav-analytics').click();
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(500);
await shot(page, '04-analytics');
const analyticsPage = await page.getByTestId('analytics-page').isVisible().catch(() => false);
note('S4.W5.3', `/analytics 路由渲染 = ${analyticsPage}`);
const kpiInflation = await page.getByTestId('kpi-avg-inflation').textContent().catch(() => '');
note('S4.W5.3', `平均膨胀率 KPI: ${kpiInflation?.replace(/\s+/g, ' ').trim()}`);
const overdueRows = await page.locator('[data-testid^="overdue-row-"]').count();
note('S4.W5.3', `逾期 Top 3 行数 = ${overdueRows} (demo 应 ≥ 1)`);
const tagPanel = await page.getByTestId('panel-top-tags').isVisible().catch(() => false);
note('S4.W5.3', `标签 Top 5 panel 可见 = ${tagPanel}`);

// 回到 demo 项目
await page.goBack();
await page.waitForTimeout(500);

// S5: 只读分享链接
const shareBtn = page.getByTestId('copy-share-link');
const shareVisible = await shareBtn.isVisible({ timeout: 1000 }).catch(() => false);
note('S5.W5.4', shareVisible ? '✓ 分享按钮可见' : '✗ 缺失');
let shareUrl = '';
if (shareVisible) {
  // grant clipboard permission so writeText resolves
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await shareBtn.click();
  await page.waitForTimeout(300);
  shareUrl = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  const okFormat = /#share=[A-Za-z0-9_-]+$/.test(shareUrl);
  note('S5.W5.4', `分享 URL 已复制 · #share= 格式正确 = ${okFormat} · 长度 ${shareUrl.length}`);
}

// 在 share URL 上验证 banner
if (shareUrl) {
  const sharePage = await ctx.newPage();
  sharePage.on('pageerror', (e) => errors.push(`share-pageerror: ${e.message}`));
  sharePage.on('console', (m) => {
    if (m.type() === 'error') errors.push(`share-console: ${m.text()}`);
  });
  // Re-target to local dev port (the share URL uses window.location.origin
  // from headless above, which already is 127.0.0.1:5174)
  await sharePage.goto(shareUrl);
  await sharePage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await sharePage.waitForTimeout(500);
  await sharePage.screenshot({ path: path.join(OUT, '05-share-mode.png') });
  const bannerVisible = await sharePage.getByTestId('share-mode-banner').isVisible().catch(() => false);
  note('S5.W5.4', `共享 URL 打开 → banner 可见 = ${bannerVisible}`);
  const cloneBtn = await sharePage.getByTestId('share-clone-button').isVisible().catch(() => false);
  note('S5.W5.4', `"复制为我的项目"按钮可见 = ${cloneBtn}`);
  // 只读模式下编辑按钮应缺失（因为 isArchived=true）
  const editButtons = await sharePage.locator('[aria-label="编辑"]').count();
  note('S5.W5.4', `只读模式下"编辑"按钮数 = ${editButtons} (应为 0)`);
  await sharePage.close();
}

await page.close();
await ctx.close();

// === Mobile session ===
const { ctx: mctx, page: mpage } = await makeContext({ width: 390, height: 844 });
await mpage.goto('http://127.0.0.1:5174/');
await mpage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
await mpage.waitForTimeout(500);
await mpage.screenshot({ path: path.join(OUT, '06-mobile-default.png') });
const hamburger = mpage.getByTestId('mobile-drawer-open');
const hamburgerVisible = await hamburger.isVisible({ timeout: 1500 }).catch(() => false);
note('S6.W5.5', hamburgerVisible ? '✓ 移动端 Hamburger 可见' : '✗ 缺失');
if (hamburgerVisible) {
  await hamburger.click();
  await mpage.waitForTimeout(300);
  const drawerBackdrop = await mpage.getByTestId('mobile-drawer-backdrop').isVisible().catch(() => false);
  note('S6.W5.5', `Drawer 打开后 backdrop 可见 = ${drawerBackdrop}`);
  await mpage.screenshot({ path: path.join(OUT, '06-mobile-drawer-open.png') });
  // 关闭 drawer
  await mpage.getByTestId('mobile-drawer-close').click().catch(() => {});
  await mpage.waitForTimeout(200);
}
// chart overflow 检查
const chartContent = mpage.getByTestId('chart-content');
if (await chartContent.isVisible().catch(() => false)) {
  const styles = await chartContent.evaluate((el) => getComputedStyle(el).overflowX);
  note('S6.W5.5', `chart-content overflow-x = ${styles} (应为 auto)`);
}
await mpage.close();
await mctx.close();

await browser.close();

const summary = {
  totalDuration: Date.now() - t0,
  errors,
  findingCount: findings.length,
  findings,
};
fs.writeFileSync(
  '/Users/hulu/huluman/scope-shield/.review/wave5-walkthrough.json',
  JSON.stringify(summary, null, 2),
);
console.log(
  `\n=== 总耗时 ${summary.totalDuration}ms · 错误 ${errors.length} 条 · finding ${findings.length} 条 ===`,
);
if (errors.length) console.log('Errors:', errors);
