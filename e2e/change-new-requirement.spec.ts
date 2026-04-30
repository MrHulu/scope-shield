import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement, openChangeModal, selectChangeType, fillDescription, saveChange } from './helpers';

test.describe('Change: new_requirement', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'NewReq Project', '2026-04-01');
    await addRequirement(page, '基础需求', '5');
  });

  test('adds a new requirement via change', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '新增需求');
    const dialog = page.getByRole('dialog');

    // Fill new requirement name
    await dialog.getByPlaceholder('新需求名称').fill('数据大屏');
    // Fill days
    await dialog.locator('input[type="number"]').fill('3');
    await fillDescription(page, '老板新需求');
    await saveChange(page);

    // The change should show in change list (use exact to avoid SVG match)
    await expect(page.getByText('老板新需求', { exact: true })).toBeVisible();
    await expect(page.getByText('+3天', { exact: true })).toBeVisible();
    // New requirement should appear in requirement list (use exact to avoid SVG chart match)
    await expect(page.getByText('数据大屏', { exact: true }).first()).toBeVisible();
    // It should have the "变更新增" badge
    await expect(page.getByText('变更新增').first()).toBeVisible();
  });

  test('adds new requirement with 0.5 days', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '新增需求');
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('新需求名称').fill('小修改');
    await dialog.locator('input[type="number"]').fill('0.5');
    await fillDescription(page, '微小调整');
    await saveChange(page);

    await expect(page.getByText('小修改', { exact: true }).first()).toBeVisible();
  });

  test('validates new requirement name is required', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '新增需求');
    const dialog = page.getByRole('dialog');
    // Only fill days, leave name empty
    await dialog.locator('input[type="number"]').fill('3');
    await fillDescription(page, 'Missing name');
    await dialog.getByRole('button', { name: '保存' }).click();
    // Modal should stay open
    await expect(dialog).toBeVisible();
  });
});
