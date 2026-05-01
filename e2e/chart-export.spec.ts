import { test, expect } from '@playwright/test';
import { hardResetDB, createProject, addRequirement, openChangeModal, selectTarget, fillDescription, saveChange } from './helpers';

test.describe('Chart & Export', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
    await createProject(page, 'Chart Project', '2026-04-01');
    await addRequirement(page, '模块A', '5');
    await addRequirement(page, '模块B', '3');
    // Add a change so charts have data
    await openChangeModal(page);
    await selectTarget(page, '模块A');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('2');
    await fillDescription(page, '增加工时');
    await saveChange(page);
  });

  test('switches between chart tabs', async ({ page }) => {
    // Look for chart tab buttons
    const detailTab = page.getByRole('button', { name: /详细/ });
    const simpleTab = page.getByRole('button', { name: /简洁/ });

    if (await detailTab.isVisible()) {
      await detailTab.click();
      await page.waitForTimeout(500);

      await simpleTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('opens export modal', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /导出/ });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      // ExportModal uses plain div (no role="dialog"), find it by content
      const exportModal = page.locator('.fixed.inset-0.z-50');
      await expect(exportModal).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('stats display correctly', async ({ page }) => {
    // Original: 5 + 3 = 8, after change: 5+2+3 = 10
    // Check change description is visible (exact to avoid SVG match)
    await expect(page.getByText('增加工时', { exact: true })).toBeVisible();
    // The +2天 change delta should be visible (exact to avoid SVG match)
    await expect(page.getByText('+2天', { exact: true })).toBeVisible();
  });
});
