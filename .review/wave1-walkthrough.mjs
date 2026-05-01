/**
 * 秘书 Wave 1 验收走查 — 用 Playwright 亲自体验 Wave 1 落地的 13 项改动。
 *
 * 视角：和 baseline walkthrough 一致 — 不是 PM/QA，是「这个产品好不好用」。
 * 这次的对照基线是 .review/walkthrough.md (pre-Wave1) 的 5 个痛点 +
 * .review/wave1-triage.md 的 13 项承诺。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/Users/hulu/huluman/scope-shield/.review/wave1-shots';
fs.mkdirSync(OUT, { recursive: true });
const findings = [];
const note = (step, finding) => {
  findings.push({ step, finding, ts: new Date().toISOString() });
  // eslint-disable-next-line no-console
  console.log(`[${step}] ${finding}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

const t0 = Date.now();

// === S1: 首屏 — 看视觉品牌、磨砂玻璃、hero stat ===
await page.goto('http://127.0.0.1:5174/');
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(800);
await shot('01-first-paint');
note('S1', `首屏耗时 ${Date.now() - t0}ms`);

const heroVisible = await page.getByTestId('hero-stat-inflation').isVisible().catch(() => false);
note('S1.W1.2', heroVisible ? '✓ hero 膨胀率卡片可见' : '✗ hero 缺失');
if (heroVisible) {
  const fontSize = await page
    .getByTestId('hero-stat-inflation')
    .locator('p')
    .nth(1)
    .evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
  note('S1.W1.2', `hero 字号 = ${fontSize}px (≥32 要求 ${fontSize >= 32 ? '✓' : '✗'})`);
}

const fab = await page.getByTestId('floating-cta-record-change').isVisible().catch(() => false);
note('S1.W1.3', fab ? '✓ FAB 浮动按钮可见' : '✗ FAB 缺失');

const badge = await page.getByTestId('local-storage-badge').isVisible().catch(() => false);
note('S1.W1.5', badge ? '✓ 数据保障 badge 在侧栏底部可见' : '✗ badge 缺失');

// 章节标题 W1.4
const chartTitle = await page.getByText('工期对比').first().isVisible().catch(() => false);
note('S1.W1.4', chartTitle ? '✓ 「工期对比」标题在首屏' : '✗ 标题缺失');

// === S2: 切到详细版图表 — 看关键路径高亮 W1.11 ===
await page.getByRole('tab', { name: '详细版' }).click();
await page.waitForTimeout(600);
await shot('02-detail-chart-critical-path');
const criticalCount = await page.locator('g[data-critical="true"]').count();
note('S2.W1.11', `关键路径高亮节点数 = ${criticalCount}`);
const critHint = await page.getByText(/🔥 关键路径/).first().isVisible().catch(() => false);
note('S2.W1.11', critHint ? '✓ 底部说明文字渲染' : '✗ 说明缺失');

await page.getByRole('tab', { name: '简洁版' }).click();
await page.waitForTimeout(400);

// === S3: ⌘⇧C 调出 ChangeModal — 验 W1.3 ===
await page.keyboard.press('Meta+Shift+C');
await page.waitForTimeout(400);
await shot('03-fab-shortcut-opens-modal');
const modalAfterChord = await page.getByRole('dialog', { name: /记录变更/ }).isVisible().catch(() => false);
note('S3.W1.3', modalAfterChord ? '✓ ⌘⇧C 立刻打开 modal' : '✗ 快捷键未响应');
await page.keyboard.press('Escape');

// === S4: ⌘K 调出 命令面板 — 验 W1.13 ===
await page.keyboard.press('Meta+k');
await page.waitForTimeout(400);
await shot('04-command-palette-opened');
const palette = await page.getByTestId('command-palette').isVisible().catch(() => false);
note('S4.W1.13', palette ? '✓ ⌘K 命令面板弹出' : '✗ 面板未弹出');
await page.getByTestId('command-palette-input').fill('CRM').catch(() => {});
await page.waitForTimeout(300);
const projItems = await page.getByTestId('command-palette-item-project').count();
note('S4.W1.13', `搜索 "CRM" → ${projItems} 个项目命中`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// === S5: 加需求 — 验 W1.6 高亮反馈 ===
const t5 = Date.now();
await page.getByRole('button', { name: '添加需求' }).click();
await page.waitForTimeout(200);
await page.getByPlaceholder('需求名称').fill('Wave1 走查需求');
await page.getByPlaceholder('天数').fill('3');
await page.getByRole('button', { name: '添加', exact: true }).click();
await page.waitForTimeout(200);
await shot('05-just-added-pulse');
const justAddedCount = await page.locator('[data-just-added="true"]').count();
note('S5.W1.6', `加需求后 data-just-added 节点数 = ${justAddedCount}`);
note('S5', `加需求耗时 ${Date.now() - t5}ms`);
await page.waitForTimeout(1700);
const stillJustAdded = await page.locator('[data-just-added="true"]').count();
note('S5.W1.6', `1.7s 后 data-just-added 节点数 = ${stillJustAdded} (应为 0)`);

// === S6: 调优先级 同值 → 验 W1.6 toast ===
await page.getByRole('button', { name: '记录变更', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: '调优先级' }).click();
await page.waitForTimeout(200);
const dialog = page.getByRole('dialog');
const targetSelect = dialog.locator('select').nth(0);
const depSelect = dialog.locator('select').nth(1);
await targetSelect.selectOption({ index: 1 });
await depSelect.selectOption('__null__');
await page.getByPlaceholder('一句话描述变更原因').fill('走查同值');
await dialog.getByRole('button', { name: /保存/ }).click();
await page.waitForTimeout(800);
await shot('06-reprioritize-same-dep-toast');
const toastVisible = await page.getByText('前置依赖未变化，未生效').isVisible().catch(() => false);
note('S6.W1.6', toastVisible ? '✓ 同值 toast 弹出' : '✗ toast 未弹出');
await page.keyboard.press('Escape');

// === S7: 导出对比模式 — 验 W1.12 ===
await page.getByRole('button', { name: /导出图片/ }).click();
await page.waitForTimeout(300);
await shot('07-export-modal-default');
const compToggle = await page.getByTestId('export-mode-comparison').isVisible().catch(() => false);
note('S7.W1.12', compToggle ? '✓ 对比模式选项存在' : '✗ 对比模式缺失');
if (compToggle) {
  await page.getByTestId('export-mode-comparison').click();
  await page.waitForTimeout(300);
  await shot('07b-export-comparison-selected');
  const hint = await page.getByText(/对比模式输出两栏并排/).isVisible().catch(() => false);
  note('S7.W1.12', hint ? '✓ 对比模式提示文字' : '✗ 提示缺失');
}
// Close export modal explicitly — Escape inside the modal sometimes loses
// focus to the underlying canvas, so click the X button instead.
await page.locator('[role="dialog"], [aria-label="数据恢复"]').first().getByLabel('关闭').click().catch(() => {});
await page.waitForTimeout(300);

// === S8: 设置页 视觉一致性 ===
await page.getByRole('button', { name: '设置' }).click({ force: true }).catch(() => {});
await page.waitForTimeout(400);
await shot('08-settings').catch(() => {});

await browser.close();

const summary = {
  totalDuration: Date.now() - t0,
  errors,
  findingCount: findings.length,
  findings,
};
fs.writeFileSync(
  '/Users/hulu/huluman/scope-shield/.review/wave1-walkthrough.json',
  JSON.stringify(summary, null, 2),
);
// eslint-disable-next-line no-console
console.log(
  `\n=== 总耗时 ${summary.totalDuration}ms · 错误 ${errors.length} 条 · finding ${findings.length} 条 ===`,
);
if (errors.length) console.log('Errors:', errors);
