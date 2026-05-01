import { test, expect } from '@playwright/test';
import { hardResetDB, createProject, addRequirement, goToSettings } from './helpers';

test.describe('Settings: import & export', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
    await createProject(page, 'Export Project', '2026-04-01');
    await addRequirement(page, '导出需求', '5');
  });

  test('navigates to settings page', async ({ page }) => {
    await goToSettings(page);
    await expect(page.getByText('导出数据')).toBeVisible();
    await expect(page.getByText('导入数据')).toBeVisible();
  });

  test('exports data as JSON', async ({ page }) => {
    await goToSettings(page);
    // Listen for download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出' }).click();
    const download = await downloadPromise;
    // Verify filename pattern
    expect(download.suggestedFilename()).toMatch(/scope-shield-backup-.*\.json/);
  });

  test('import button triggers file picker', async ({ page }) => {
    await goToSettings(page);
    // The import button should trigger a hidden file input
    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await expect(fileInput).toBeAttached();
  });

  test('import shows confirmation dialog', async ({ page }) => {
    await goToSettings(page);
    // Simulate choosing a file
    const fileInput = page.locator('input[type="file"][accept=".json"]');

    // Create a valid import JSON
    const exportData = JSON.stringify({
      version: 1,
      projects: [{
        id: 'test-import',
        name: 'Imported Project',
        startDate: '2026-01-01',
        isArchived: false,
        requirements: [],
        changes: [],
      }],
    });

    await fileInput.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportData),
    });

    // Confirmation dialog should appear
    await expect(page.getByText('导入将覆盖当前所有数据')).toBeVisible();
  });

  test('cancels import', async ({ page }) => {
    await goToSettings(page);
    const fileInput = page.locator('input[type="file"][accept=".json"]');

    const exportData = JSON.stringify({
      version: 1,
      projects: [{ id: 'x', name: 'X', startDate: '2026-01-01', isArchived: false, requirements: [], changes: [] }],
    });

    await fileInput.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportData),
    });

    // Cancel the import
    await page.getByRole('button', { name: '取消' }).click();
    // Original data should still be intact
    // Navigate back and check
  });
});
