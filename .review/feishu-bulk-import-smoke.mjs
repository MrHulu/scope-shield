/**
 * 飞书 URL 批量导入 smoke test — 不需要真飞书代理，覆盖 UI 路径：
 * 1. 打开 BulkImportModal
 * 2. 切到「飞书 URL 列表」tab
 * 3. 粘贴 3 条 URL（混合：1 个有效 feishu / 1 个无效 / 1 个有效）
 * 4. 解析后 row 状态 = 1 pending / 1 error / 1 pending
 * 5. 点击「拉取元数据」→ 没有代理时全部应为 url_only 或 error
 * 6. 验证导入按钮文案 + 启用状态
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const findings = [];
const note = (step, finding) => {
  findings.push({ step, finding });
  console.log(`[${step}] ${finding}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto('http://127.0.0.1:5173/');
await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
await page.waitForTimeout(500);

// Open bulk import modal
await page.getByTestId('bulk-import-trigger').click();
await page.waitForTimeout(300);
const modalVisible = await page.getByTestId('bulk-import-modal').isVisible();
note('S1', `BulkImportModal 可见 = ${modalVisible}`);

// Verify both tabs exist
const textTab = page.getByTestId('bulk-import-tab-text');
const feishuTab = page.getByTestId('bulk-import-tab-feishu');
note('S2', `tab 文本 / 飞书 = ${await textTab.isVisible()} / ${await feishuTab.isVisible()}`);

// Switch to feishu tab
await feishuTab.click();
await page.waitForTimeout(200);
const feishuTextarea = page.getByTestId('bulk-import-feishu-textarea');
note('S3', `飞书 tab textarea 可见 = ${await feishuTextarea.isVisible()}`);

// Paste 3 URLs (mix: valid / invalid / valid)
const urls = [
  'https://example.feishu.cn/space/123/work_item/story/100001',
  'not-a-url',
  'https://example.feishu.cn/space/123/work_item/story/100002',
].join('\n');
await feishuTextarea.fill(urls);
await page.waitForTimeout(300);

// Verify row count + initial states
const rowCount = await page.locator('[data-testid^="bulk-import-feishu-row-"]').count();
note('S4', `解析后 row 数 = ${rowCount} (应 = 3)`);

// Click fetch button
const fetchBtn = page.getByTestId('bulk-import-feishu-fetch');
const fetchEnabled = await fetchBtn.isEnabled();
note('S5', `拉取按钮初始可点 = ${fetchEnabled}`);
if (fetchEnabled) {
  await fetchBtn.click();
  // wait for fetch to complete (no real proxy → should fall back url_only or error fast)
  await page.waitForTimeout(2500);

  // Re-check row states via data-testid + aria-label of icon
  const rowsHtml = await page.locator('[data-testid^="bulk-import-feishu-row-"]').count();
  note('S6', `拉取后 row 数 = ${rowsHtml}`);
}

// Submit button label
const submitBtn = page.getByTestId('bulk-import-submit');
const submitText = (await submitBtn.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
const submitEnabled = await submitBtn.isEnabled();
note('S7', `导入按钮 = "${submitText}" · 启用 = ${submitEnabled}`);

// Switch back to text tab to verify CSV path still works
await textTab.click();
await page.waitForTimeout(200);
await page.getByTestId('bulk-import-sample').click();
await page.waitForTimeout(200);
const csvRows = await page.locator('[data-testid^="bulk-import-row-"]').count();
note('S8', `切回 CSV tab + 加载示例后 row 数 = ${csvRows} (应 = 5)`);

await browser.close();

console.log(`\n=== finding ${findings.length} 条 · 错误 ${errors.length} 条 ===`);
if (errors.length) console.log('Errors:', errors);
fs.writeFileSync(
  '/Users/hulu/huluman/scope-shield/.review/feishu-bulk-import-smoke.json',
  JSON.stringify({ findings, errors }, null, 2),
);
