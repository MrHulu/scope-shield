/**
 * 秘书亲自走 Scope Shield 全流程 — 截图 + 记录卡顿点 / 反直觉点
 *
 * 视角：一个想用它管理项目的产品负责人，刚拿到这个工具，开机即用。
 * 不是 PM 视角（视觉/交互），不是 QA 视角（覆盖率），是「**这个产品好不好用**」。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/Users/hulu/huluman/scope-shield/.review/walkthrough-shots';
const findings = [];
const note = (step, finding) => {
  findings.push({ step, finding, ts: new Date().toISOString() });
  console.log(`[${step}] ${finding}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

const t0 = Date.now();

// === 步骤 1: 首屏 ===
await page.goto('http://localhost:5173/');
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(800);
await shot('01-first-paint');
note('S1-首屏', `加载耗时 ${Date.now() - t0}ms`);

// === 步骤 2: 默认 demo 项目体验 ===
const url = page.url();
note('S2-默认进入', `URL = ${url} ${url.includes('/project/') ? '✓ 自动跳到项目页' : '✗ 没自动进项目'}`);

const stats = await page.evaluate(() => {
  const labels = ['原始工期', '当前工期', '膨胀率', '变更次数'];
  const out = {};
  for (const label of labels) {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === label) {
        out[label] = el.parentElement?.textContent?.replace(label, '').trim();
        break;
      }
    }
  }
  return out;
});
note('S2-stats', `首屏 stats: ${JSON.stringify(stats)}`);

// === 步骤 3: 添加需求（不带飞书 URL，纯本地）===
const t3 = Date.now();
await page.getByRole('button', { name: '添加需求' }).click();
await page.waitForTimeout(200);
await shot('02-add-requirement-form');
const formInputs = await page.locator('input, select, textarea').count();
note('S3-表单字段数', `${formInputs} 个 input — 评估表单复杂度`);

await page.getByPlaceholder('需求名称').fill('登录鉴权');
await page.getByPlaceholder('天数').fill('5');
await page.getByRole('button', { name: '添加', exact: true }).click();
await page.waitForTimeout(500);
await shot('03-after-add-req');
note('S3-加需求耗时', `${Date.now() - t3}ms`);

const reqVisible = await page.locator('span', { hasText: '登录鉴权' }).first().isVisible().catch(() => false);
note('S3-加需求-列表显示', reqVisible ? '✓ 立刻出现' : '✗ 没出现');

const stats2 = await page.evaluate(() => {
  const labels = ['原始工期', '当前工期', '膨胀率'];
  const out = {};
  for (const label of labels) {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === label) {
        out[label] = el.parentElement?.textContent?.replace(label, '').trim();
        break;
      }
    }
  }
  return out;
});
note('S3-加需求-stats', `加完: ${JSON.stringify(stats2)}`);

// === 步骤 4: 飞书 URL 解析 — url-only 降级 ===
const t4 = Date.now();
await page.getByRole('button', { name: '添加需求' }).click();
await page.waitForTimeout(200);
const feishuInput = page.getByPlaceholder('飞书需求 URL（可选）');
const hasFeishuField = await feishuInput.isVisible().catch(() => false);
note('S4-飞书入口', hasFeishuField ? '✓ form 内嵌入口' : '✗ 找不到');
if (hasFeishuField) {
  await feishuInput.fill('https://project.feishu.cn/proj/story/detail?project_key=PAY&work_item_type_key=story&work_item_id=42');
  const t4Click = Date.now();
  await page.getByRole('button', { name: '解析' }).click();
  // 等到提示文案不再是"解析中" — 测真实解析耗时
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /飞书未登录|已从飞书读取|登录后会自动/.test(text) && !/解析中/.test(text);
  }, { timeout: 15_000 }).catch(() => {});
  note('S4-解析等待时间', `${Date.now() - t4Click}ms（直到提示落定）`);
  await shot('04-feishu-parse-result');
  const hint = await page.locator('text=/飞书未登录|已从飞书读取|解析/').first().textContent().catch(() => null);
  note('S4-解析提示文案', hint ?? '(无)');
  const fillBtn = page.getByRole('button', { name: /一键登录/ });
  const hasLoginCTA = await fillBtn.isVisible().catch(() => false);
  note('S4-未登录-CTA', hasLoginCTA ? '✓ 一键登录按钮显示' : '✗ 缺登录引导');
  const filledName = await page.getByPlaceholder('需求名称').inputValue();
  note('S4-占位名', filledName ? `✓ 自动填: "${filledName}"` : '✗ 名称为空');
}
note('S4-飞书流程耗时', `${Date.now() - t4}ms`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// === 步骤 5: 记录变更 — 调优先级（新 UI 语义：选需求 + 选新前置）===
const t5 = Date.now();
await page.getByRole('button', { name: '记录变更' }).click();
await page.waitForTimeout(200);
await shot('05-change-modal-opened');
const changeTypeBtns = await page.locator('[role="dialog"] button').filter({ hasText: /加天数|新增|砍|补充|调优先级|暂停|恢复/ }).count();
note('S5-变更类型按钮数', `${changeTypeBtns} 个`);

await page.getByRole('button', { name: '调优先级' }).click();
await page.waitForTimeout(200);
await shot('06-reprioritize-form');
const labels = await page.locator('[role="dialog"] label').allTextContents();
note('S5-调优先级 labels', JSON.stringify(labels));

const dialog = page.getByRole('dialog');
const selects = dialog.locator('select');
const selectCount = await selects.count();
note('S5-下拉数', `${selectCount} 个 select`);
// 选第一个 active 需求作为目标
await selects.nth(0).selectOption({ index: 1 });
await page.waitForTimeout(100);
// 选"无前置"作为新依赖（特殊值 __null__）
await selects.nth(1).selectOption('__null__');
await page.getByPlaceholder('一句话描述变更原因').fill('改并行');
await dialog.getByRole('button', { name: /保存/ }).click();
await page.waitForTimeout(700);
await shot('07-after-reprioritize');
note('S5-调优先级耗时', `${Date.now() - t5}ms`);

const stats3 = await page.evaluate(() => {
  const labels = ['原始工期', '当前工期', '膨胀率'];
  const out = {};
  for (const label of labels) {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent?.trim() === label) {
        out[label] = el.parentElement?.textContent?.replace(label, '').trim();
        break;
      }
    }
  }
  return out;
});
note('S5-调优先级后-stats', JSON.stringify(stats3));

// === 步骤 6: 切到详细图表 ===
const detailTab = page.getByRole('button', { name: '详细版' });
if (await detailTab.isVisible().catch(() => false)) {
  await detailTab.click();
  await page.waitForTimeout(800);
  await shot('08-detail-chart');
  note('S6-详细图表', '已切换 ✓');
}

// === 步骤 7: 设置页 ===
await page.getByRole('button', { name: '设置' }).click();
await page.waitForTimeout(500);
await shot('09-settings');
note('S7-设置页', '已进入');

// === 步骤 8: 备份恢复对话框 — 模拟空库 + 有 backup ===
const backup = {
  version: '1.0',
  createdAt: new Date('2026-04-30T09:00:00Z').toISOString(),
  projectCount: 1,
  requirementCount: 1,
  data: {
    version: '1.0',
    exportedAt: new Date('2026-04-30T09:00:00Z').toISOString(),
    projects: [{
      id: 'walkthrough-test',
      name: 'Walkthrough 测试项目',
      startDate: '2026-04-01',
      status: 'active',
      isDemo: false,
      createdAt: '',
      updatedAt: '',
      requirements: [{
        id: 'r1', projectId: 'walkthrough-test', name: '走查需求', originalDays: 1, currentDays: 1,
        isAddedByChange: false, status: 'active', sortOrder: 0, dependsOn: null, pausedRemainingDays: null,
        createdAt: '', updatedAt: '',
      }],
      changes: [], snapshots: [],
    }],
    personNameCache: [],
  },
};
await page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  await Promise.all(dbs.map((db) => new Promise((resolve) => {
    if (!db.name) { resolve(); return; }
    const req = indexedDB.deleteDatabase(db.name);
    req.onsuccess = req.onerror = () => resolve();
    req.onblocked = () => setTimeout(resolve, 200);
  })));
  localStorage.clear();
});
await page.addInitScript((b) => {
  localStorage.setItem('scope-shield-backup-latest', JSON.stringify(b));
}, backup);
await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
await shot('10-recovery-dialog');
const recoveryVisible = await page.getByRole('alertdialog', { name: '数据恢复' }).isVisible().catch(() => false);
note('S8-恢复对话框', recoveryVisible ? '✓ 显示' : '✗ 没弹');

await browser.close();

// === 写 findings ===
const summary = {
  totalDuration: Date.now() - t0,
  errors,
  findings,
};
fs.writeFileSync(
  '/Users/hulu/huluman/scope-shield/.review/walkthrough.json',
  JSON.stringify(summary, null, 2),
);
console.log(`\n=== 总耗时 ${summary.totalDuration}ms · 错误 ${errors.length} 条 · finding ${findings.length} 条 ===`);
if (errors.length) console.log('Errors:', errors);
