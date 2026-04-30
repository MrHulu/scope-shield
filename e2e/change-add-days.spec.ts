import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement, openChangeModal, selectChangeType, selectTarget, fillDescription, saveChange } from './helpers';

test.describe('Change: add_days', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'Days Project', '2026-04-01');
    await addRequirement(page, '登录模块', '5');
  });

  test('records an add_days change', async ({ page }) => {
    await openChangeModal(page);
    await selectTarget(page, '登录模块');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('2');
    await fillDescription(page, 'PM加了新功能');
    await saveChange(page);

    // Change should appear in list (use exact to avoid SVG chart match)
    await expect(page.getByText('PM加了新功能', { exact: true })).toBeVisible();
    await expect(page.getByText('+2天', { exact: true })).toBeVisible();
  });

  test('records add_days with 0.5 granularity', async ({ page }) => {
    await openChangeModal(page);
    await selectTarget(page, '登录模块');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('1.5');
    await fillDescription(page, '半天调整');
    await saveChange(page);

    await expect(page.getByText('+1.5天', { exact: true })).toBeVisible();
  });

  test('validates description is required', async ({ page }) => {
    await openChangeModal(page);
    await selectTarget(page, '登录模块');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('2');
    // Leave description empty and try to save
    const saveBtn = dialog.getByRole('button', { name: '保存' });
    await saveBtn.click();
    // Modal should still be open (validation failed)
    await expect(dialog).toBeVisible();
  });

  test('validates target requirement is required', async ({ page }) => {
    await openChangeModal(page);
    const dialog = page.getByRole('dialog');
    // Don't select target, just fill days + description
    await dialog.locator('input[type="number"]').fill('2');
    await fillDescription(page, 'No target');
    const saveBtn = dialog.getByRole('button', { name: '保存' });
    await saveBtn.click();
    await expect(dialog).toBeVisible();
  });

  test('escape key closes modal', async ({ page }) => {
    await openChangeModal(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('clicking overlay closes modal', async ({ page }) => {
    await openChangeModal(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Click the backdrop (outside the dialog box)
    await page.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 10 } });
    await expect(dialog).toBeHidden();
  });
});
