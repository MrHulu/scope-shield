import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement, openChangeModal, selectTarget, fillDescription, saveChange } from './helpers';

test.describe('Change: edit & delete', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'Edit Project', '2026-04-01');
    await addRequirement(page, '核心模块', '10');
    // Create a change to work with
    await openChangeModal(page);
    await selectTarget(page, '核心模块');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('3');
    await fillDescription(page, '原始变更');
    await saveChange(page);
  });

  test('edits change description', async ({ page }) => {
    // Change row buttons are opacity-0 until hover — hover the change row first
    const changeRow = page.locator('.group').filter({ hasText: '原始变更' }).first();
    await changeRow.hover();
    await changeRow.getByLabel('编辑').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Update description
    const descInput = dialog.getByPlaceholder('一句话描述变更原因');
    await descInput.clear();
    await descInput.fill('修改后的变更');
    await dialog.getByRole('button', { name: '更新' }).click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
    // Verify updated
    await expect(page.getByText('修改后的变更', { exact: true })).toBeVisible();
    await expect(page.getByText('原始变更', { exact: true })).toBeHidden();
  });

  test('edits change days', async ({ page }) => {
    const changeRow = page.locator('.group').filter({ hasText: '原始变更' }).first();
    await changeRow.hover();
    await changeRow.getByLabel('编辑').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const daysInput = dialog.locator('input[type="number"]');
    await daysInput.clear();
    await daysInput.fill('5');
    await dialog.getByRole('button', { name: '更新' }).click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('+5天', { exact: true })).toBeVisible();
  });

  test('deletes a change with confirmation', async ({ page }) => {
    const changeRow = page.locator('.group').filter({ hasText: '原始变更' }).first();
    await changeRow.hover();
    await changeRow.getByLabel('删除').click();
    // Confirm dialog
    await expect(page.getByText('删除变更记录')).toBeVisible();
    await expect(page.getByText('确定要删除')).toBeVisible();
    // Click delete in confirm dialog
    await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click();
    // Change should be gone
    await expect(page.getByText('原始变更', { exact: true })).toBeHidden();
  });

  test('cancels change deletion', async ({ page }) => {
    const changeRow = page.locator('.group').filter({ hasText: '原始变更' }).first();
    await changeRow.hover();
    await changeRow.getByLabel('删除').click();
    await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click();
    // Change should still be there
    await expect(page.getByText('原始变更', { exact: true })).toBeVisible();
  });
});
