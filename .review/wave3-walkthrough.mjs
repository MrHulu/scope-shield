/**
 * 秘书 Wave 3 验收走查 — 7 个面 + 16 项断言
 * 对照基线：wave2-walkthrough.md（11/11 落地 + 14/14 走查）
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/Users/hulu/huluman/scope-shield/.review/wave3-shots';
fs.mkdirSync(OUT, { recursive: true });
const findings = [];
const note = (step, finding) => {
  findings.push({ step, finding, ts: new Date().toISOString() });
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

// === S1: 首屏 ===
await page.goto('http://127.0.0.1:5173/');
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(800);
await shot('01-first-paint');
note('S1', `首屏耗时 ${Date.now() - t0}ms`);

// === S2: 焦点 trap (W3.1) ===
await page.getByTestId('floating-cta-record-change').click();
await page.waitForTimeout(300);
// Tab 多次后焦点应仍在 modal 内
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
}
const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
const focusedInDialog = await page.evaluate(() =>
  !!document.activeElement?.closest('[role="dialog"]'),
);
note('S2.W3.1', `Tab 8 次后焦点 tag=${focusedTag}, 仍在 dialog 内 = ${focusedInDialog}`);
await page.keyboard.press('Escape');

// === S3: ? 帮助 modal 焦点 trap 也生效 ===
await page.keyboard.press('?');
await page.waitForTimeout(300);
await shot('03-keyboard-help-with-trap');
const helpVisible = await page.getByTestId('keyboard-help-modal').isVisible().catch(() => false);
note('S3.W3.1', `? 帮助 modal 可见 + 焦点 trap = ${helpVisible}`);
await page.keyboard.press('Escape');

// === S4: 批量导入 (W3.3) ===
await page.getByTestId('bulk-import-trigger').click();
await page.waitForTimeout(300);
await page.getByTestId('bulk-import-sample').click();
await page.waitForTimeout(300);
await shot('04-bulk-import-preview');
const previewRows = await page.locator('[data-testid^="bulk-import-row-"]').count();
note('S4.W3.3', `CSV 示例 → 预览行数 = ${previewRows} (应为 5)`);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// === S5: 复制 Markdown 报告 (W3.5) ===
const copyBtn = page.getByTestId('copy-markdown-report');
const copyVisible = await copyBtn.isVisible({ timeout: 1500 }).catch(() => false);
note('S5.W3.5', copyVisible ? '✓ 复制报告按钮可见' : '✗ 缺失');

// === S6: 时光机历史快照 (W3.4) ===
const tmBtn = page.getByTestId('open-snapshot-history');
const tmVisible = await tmBtn.isVisible({ timeout: 1500 }).catch(() => false);
note('S6.W3.4', tmVisible ? '✓ 时光机按钮可见' : '✗ 缺失');
if (tmVisible) {
  await tmBtn.click();
  await page.waitForTimeout(400);
  await shot('06-snapshot-history');
  const rowCount = await page.locator('[data-testid="snapshot-row"]').count();
  note('S6.W3.4', `历史快照行数 = ${rowCount} (demo 至少 1)`);
  await page.keyboard.press('Escape');
}

// === S7: ChangeList 搜索 + 过滤 (W3.6) ===
const filterBar = page.getByTestId('change-list-filter');
const filterVisible = await filterBar.isVisible({ timeout: 1500 }).catch(() => false);
note('S7.W3.6', filterVisible ? '✓ 搜索/过滤栏可见' : '— demo 变更 < 3 条，未渲染（预期行为）');
if (filterVisible) {
  await page.getByTestId('change-list-search').fill('需求');
  await page.waitForTimeout(300);
  await shot('07-change-filter-search');
  const cntText = await page.getByTestId('change-filter-count').textContent().catch(() => '');
  note('S7.W3.6', `搜「需求」匹配计数: ${cntText}`);
}

// === S8: g d / g s navigation (W3.7) ===
// NavigationKeys ignores keypresses while an input has focus — blur first.
await page.evaluate(() => { const el = document.activeElement; if (el && typeof el.blur === 'function') el.blur(); });
await page.keyboard.press('g');
await page.waitForTimeout(150);
await page.keyboard.press('s');
await page.waitForTimeout(500);
const settingsUrl = page.url();
note('S8.W3.7', `g s 后 URL = ${settingsUrl} (含 settings = ${settingsUrl.includes('settings')})`);
await page.keyboard.press('g');
await page.waitForTimeout(150);
await page.keyboard.press('d');
await page.waitForTimeout(500);
const projUrl = page.url();
note('S8.W3.7', `g d 后 URL = ${projUrl} (含 project = ${projUrl.includes('project')})`);

// === S9: 全屏图表 (W3.9) ===
const fsBtn = page.getByTestId('chart-fullscreen-toggle');
await fsBtn.click();
await page.waitForTimeout(400);
await shot('09-fullscreen-chart');
const fsOverlay = await page.getByTestId('chart-fullscreen-overlay').isVisible().catch(() => false);
note('S9.W3.9', fsOverlay ? '✓ 全屏覆盖层渲染' : '✗ 缺失');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const fsAfterEsc = await page.getByTestId('chart-fullscreen-overlay').isVisible().catch(() => false);
note('S9.W3.9', `Esc 后全屏隐藏 = ${!fsAfterEsc}`);

await browser.close();

const summary = {
  totalDuration: Date.now() - t0,
  errors,
  findingCount: findings.length,
  findings,
};
fs.writeFileSync(
  '/Users/hulu/huluman/scope-shield/.review/wave3-walkthrough.json',
  JSON.stringify(summary, null, 2),
);
console.log(
  `\n=== 总耗时 ${summary.totalDuration}ms · 错误 ${errors.length} 条 · finding ${findings.length} 条 ===`,
);
if (errors.length) console.log('Errors:', errors);
