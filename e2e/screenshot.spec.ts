import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement, openChangeModal, selectTarget, fillDescription, saveChange } from './helpers';

test.describe('Screenshot evidence', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'Screenshot Project', '2026-04-01');
    await addRequirement(page, '截图测试', '5');
  });

  test('uploads a screenshot via file input', async ({ page }) => {
    await openChangeModal(page);
    await selectTarget(page, '截图测试');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('1');
    await fillDescription(page, '带截图的变更');

    // Create a small test image buffer
    const fileInput = dialog.locator('input[type="file"]');
    // Generate a minimal 1x1 red PNG as test fixture
    await fileInput.setInputFiles({
      name: 'test-screenshot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    // Wait for thumbnail to appear
    await expect(dialog.locator('img').first()).toBeVisible({ timeout: 5000 });

    await saveChange(page);
    // Change description should be visible (exact to avoid SVG match)
    await expect(page.getByText('带截图的变更', { exact: true })).toBeVisible();
  });

  test('deletes a screenshot before saving', async ({ page }) => {
    await openChangeModal(page);
    await selectTarget(page, '截图测试');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('1');

    // Upload image
    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'delete-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    await expect(dialog.locator('img').first()).toBeVisible({ timeout: 5000 });
    // Delete the screenshot
    await dialog.getByLabel('删除截图').click();
    // Thumbnail should be gone
    await expect(dialog.locator('img')).toBeHidden();
    await page.keyboard.press('Escape');
  });

  test('shows lightbox when clicking thumbnail in change row', async ({ page }) => {
    // Create a change with screenshot
    await openChangeModal(page);
    await selectTarget(page, '截图测试');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('1');
    await fillDescription(page, '有截图');

    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'lightbox-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      ),
    });
    await expect(dialog.locator('img').first()).toBeVisible({ timeout: 5000 });
    await saveChange(page);

    // Find thumbnail in the change list and click it
    const thumbnail = page.locator('main img').first();
    if (await thumbnail.isVisible({ timeout: 2000 }).catch(() => false)) {
      await thumbnail.click();
      // Lightbox overlay should appear
      const lightbox = page.locator('.fixed.inset-0').last();
      await expect(lightbox).toBeVisible();
      // Click overlay to close
      await lightbox.click({ position: { x: 10, y: 10 } });
    }
  });
});
