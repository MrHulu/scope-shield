import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement, openChangeModal, selectChangeType, selectTarget, fillDescription, saveChange } from './helpers';

test.describe('Change: pause & resume', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'Pause Project', '2026-04-01');
    await addRequirement(page, '搜索功能', '8');
  });

  test('pauses a requirement with remaining days', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '暂停');
    await selectTarget(page, '搜索功能');
    const dialog = page.getByRole('dialog');

    // Remaining days defaults to current days
    const remaining = dialog.locator('input[type="number"]');
    await expect(remaining).toHaveValue('8');
    // Adjust remaining days
    await remaining.clear();
    await remaining.fill('5');
    await fillDescription(page, '等后端接口');
    await saveChange(page);

    await expect(page.getByText('等后端接口', { exact: true })).toBeVisible();
  });

  test('resumes a paused requirement', async ({ page }) => {
    // First pause
    await openChangeModal(page);
    await selectChangeType(page, '暂停');
    await selectTarget(page, '搜索功能');
    await fillDescription(page, '暂停开发');
    await saveChange(page);

    // Now resume
    await openChangeModal(page);
    await selectChangeType(page, '恢复');
    const dialog2 = page.getByRole('dialog');
    // Only paused requirements appear — select by partial text
    const select = dialog2.locator('select').first();
    const options = await select.locator('option').allTextContents();
    const match = options.find((o) => o.includes('搜索功能'));
    if (match) await select.selectOption({ label: match });
    await fillDescription(page, '接口好了继续');
    await saveChange(page);

    await expect(page.getByText('接口好了继续', { exact: true })).toBeVisible();
  });

  test('resume only shows paused requirements', async ({ page }) => {
    // Don't pause anything
    await openChangeModal(page);
    await selectChangeType(page, '恢复');
    const dialog = page.getByRole('dialog');
    // The select should have no requirement options (only placeholder)
    const options = await dialog.locator('select').first().locator('option').allTextContents();
    // Filter out placeholder
    const reqOptions = options.filter((o) => !o.includes('选择'));
    expect(reqOptions.length).toBe(0);
    await page.keyboard.press('Escape');
  });

  test('validates target is required for pause', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '暂停');
    const dialog = page.getByRole('dialog');
    // Don't select target
    await fillDescription(page, 'No target');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(dialog).toBeVisible(); // validation fail
    await page.keyboard.press('Escape');
  });
});
