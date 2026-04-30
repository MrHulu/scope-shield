import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement, openChangeModal, selectChangeType, selectTarget, fillDescription, saveChange } from './helpers';

test.describe('Change: cancel_requirement', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'Cancel Project', '2026-04-01');
    await addRequirement(page, '报表导出', '5');
    await addRequirement(page, '用户管理', '3');
  });

  test('cancels a requirement', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '砍需求');
    await selectTarget(page, '报表导出');
    await fillDescription(page, '客户不要了');
    await saveChange(page);

    // Change appears (exact to avoid SVG chart match)
    await expect(page.getByText('客户不要了', { exact: true })).toBeVisible();
    await expect(page.getByText('-5天', { exact: true })).toBeVisible();
  });

  test('cancelled requirement becomes unavailable for add_days', async ({ page }) => {
    // First cancel
    await openChangeModal(page);
    await selectChangeType(page, '砍需求');
    await selectTarget(page, '报表导出');
    await fillDescription(page, '砍掉');
    await saveChange(page);

    // Now try add_days — "报表导出" should NOT appear in the active dropdown
    await openChangeModal(page);
    const dialog2 = page.getByRole('dialog');
    const options = await dialog2.locator('select').first().locator('option').allTextContents();
    const hasTarget = options.some((o) => o.includes('报表导出'));
    expect(hasTarget).toBe(false);
    await page.keyboard.press('Escape');
  });
});
