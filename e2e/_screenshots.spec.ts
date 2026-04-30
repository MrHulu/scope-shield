/**
 * Capture spec — produces docs/screenshots/*.png for the README.
 * Excluded from the regular `npx playwright test` run via testIgnore in
 * playwright.config.ts. Run explicitly:
 *
 *     npx playwright test e2e/_screenshots.spec.ts
 *
 * Each test resets state then captures one canonical scene at @1.5x DPI.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';

// playwright runs tests with cwd = project root
const OUT = path.resolve('docs/screenshots');

// Larger viewport for high-res README hero
test.use({
  viewport: { width: 1440, height: 1300 },
  deviceScaleFactor: 2,
});

async function hardReset(page: import('@playwright/test').Page) {
  await page.goto('about:blank');
  await page.goto('/');
  await page.waitForTimeout(200);
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    await Promise.all(dbs.map((db) => {
      if (!db.name) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(db.name!);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => setTimeout(resolve, 200);
      });
    }));
    localStorage.clear();
  });
  // Round-trip again so the App boots fresh against the wiped state.
  await page.goto('about:blank');
}

test.describe('README screenshots', () => {
  test('01 — project overview with demo data (hero)', async ({ page }) => {
    await hardReset(page);
    await page.goto('about:blank');
    await page.goto('/');
    await expect(page).toHaveURL(/\/project\//, { timeout: 10_000 });
    await expect(page.getByText('CRM 系统重构').first()).toBeVisible();
    await page.waitForTimeout(1200); // chart animation settles
    await page.screenshot({
      path: path.join(OUT, '01-overview.png'),
      fullPage: false,
    });
  });

  test('06 — chart detail (gantt timeline)', async ({ page }) => {
    await hardReset(page);
    await page.goto('about:blank');
    await page.goto('/');
    await expect(page).toHaveURL(/\/project\//, { timeout: 10_000 });
    await expect(page.getByText('CRM 系统重构').first()).toBeVisible();
    await page.waitForTimeout(800);
    // Switch to detail (gantt) view
    const detailTab = page.getByRole('button', { name: '详细版' });
    if (await detailTab.isVisible().catch(() => false)) {
      await detailTab.click();
    }
    await page.waitForTimeout(800);
    // Scroll the chart card into view
    const chartHeader = page.getByText(/工期对比|对比图|甘特/).first();
    if (await chartHeader.isVisible().catch(() => false)) {
      await chartHeader.scrollIntoViewIfNeeded();
    } else {
      // fallback: scroll all the way down
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, '06-chart-detail.png'),
      fullPage: false,
    });
  });

  test('02 — settings page (auto-backup status + feishu proxy probe)', async ({ page }) => {
    await hardReset(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/project\//, { timeout: 10_000 });
    // Trigger one data change so 上次备份 has a value
    await page.getByRole('button', { name: '设置' }).click();
    await expect(page).toHaveURL(/\/settings/);
    // Wait for the proxy probe to settle (whichever side it lands on)
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUT, '02-settings.png'),
      fullPage: false,
    });
  });

  test('03 — change modal (record a change)', async ({ page }) => {
    await hardReset(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/project\//, { timeout: 10_000 });
    await page.getByRole('button', { name: '记录变更' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, '03-change-modal.png'),
      fullPage: false,
    });
  });

  test('04 — requirement form with feishu URL input', async ({ page }) => {
    await hardReset(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/project\//, { timeout: 10_000 });
    await page.getByRole('button', { name: '添加需求' }).click();
    // Pre-fill so the field looks lived-in
    await page.getByPlaceholder('需求名称').fill('支付重构');
    await page.getByPlaceholder('飞书需求 URL（可选）').fill(
      'https://project.feishu.cn/proj/story/detail?project_key=PAY&work_item_type_key=story&work_item_id=42',
    );
    await page.getByPlaceholder('天数').fill('5');
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, '04-requirement-form.png'),
      fullPage: false,
    });
  });

  test('05 — recovery dialog', async ({ page }) => {
    await hardReset(page);
    // hardReset leaves us on about:blank. Inject the backup via initScript so
    // it lands in localStorage *before* App.tsx's bootstrap reads it.
    const backup = {
      version: '1.0' as const,
      createdAt: new Date('2026-04-30T09:00:00Z').toISOString(),
      projectCount: 3,
      requirementCount: 17,
      data: {
        version: '1.0' as const,
        exportedAt: new Date('2026-04-30T09:00:00Z').toISOString(),
        projects: [{
          id: 'recov', name: 'Recovered Project', startDate: '2026-04-01',
          status: 'active' as const, isDemo: false,
          createdAt: '', updatedAt: '',
          requirements: [{
            id: 'r', projectId: 'recov', name: 'r', originalDays: 1, currentDays: 1,
            isAddedByChange: false, status: 'active' as const, sortOrder: 0,
            dependsOn: null, pausedRemainingDays: null,
            createdAt: '', updatedAt: '',
          }],
          changes: [], snapshots: [],
        }],
        personNameCache: [],
      },
    };
    await page.addInitScript((b) => {
      localStorage.setItem('scope-shield-backup-latest', JSON.stringify(b));
    }, backup);
    await page.goto('/');
    await expect(page.getByRole('alertdialog', { name: '数据恢复' })).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, '05-recovery-dialog.png'),
      fullPage: false,
    });
  });
});
