import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement, openChangeModal, selectChangeType, selectInDialog, fillDescription, saveChange } from './helpers';

test.describe('Change: reprioritize', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'Reprioritize Project', '2026-04-01');
    await addRequirement(page, '需求A', '3');
    await addRequirement(page, '需求B', '5');
    await addRequirement(page, '需求C', '2');
  });

  test('records a reprioritize change', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    // Select from and to positions
    await selectInDialog(page, 0, '需求A');
    await selectInDialog(page, 1, '需求C');
    await fillDescription(page, '调整优先级');
    await saveChange(page);

    await expect(page.getByText('调整优先级', { exact: true })).toBeVisible();
  });

  test('validates from position is required', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    const dialog = page.getByRole('dialog');
    // Don't select from, only select to
    await selectInDialog(page, 1, '需求B');
    await fillDescription(page, 'Missing from');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('validates to position is required', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    const dialog = page.getByRole('dialog');
    await selectInDialog(page, 0, '需求A');
    // Don't select to
    await fillDescription(page, 'Missing to');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('validates from and to cannot be the same', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    const dialog = page.getByRole('dialog');
    await selectInDialog(page, 0, '需求B');
    await selectInDialog(page, 1, '需求B');
    await fillDescription(page, 'Same position');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
