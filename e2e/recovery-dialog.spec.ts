import { test, expect } from '@playwright/test';
import { hardResetDB } from './helpers';

/**
 * RecoveryDialog only appears when:
 *   1. IndexedDB has zero projects after first load
 *   2. localStorage has a non-empty backup at scope-shield-backup-latest
 *
 * To force this state we visit the page once (so the origin exists), wipe
 * everything, inject a backup, then reload — App.tsx's bootstrap will see an
 * empty DB and pick up the localStorage backup, rendering the dialog.
 */

const PROJECT_ID = 'recovery-test';
const PROJECT_NAME = 'Recovery Test Project';

const STUB_BACKUP = {
  version: '1.0',
  createdAt: '2026-04-30T00:00:00.000Z',
  projectCount: 1,
  requirementCount: 1,
  data: {
    version: '1.0',
    exportedAt: '2026-04-30T00:00:00.000Z',
    projects: [
      {
        id: PROJECT_ID,
        name: PROJECT_NAME,
        startDate: '2026-04-01',
        status: 'active',
        isDemo: false,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        requirements: [
          {
            id: 'req-1',
            projectId: PROJECT_ID,
            name: '从备份恢复的需求',
            originalDays: 3,
            currentDays: 3,
            isAddedByChange: false,
            status: 'active',
            sortOrder: 0,
            dependsOn: null,
            pausedRemainingDays: null,
            createdAt: '2026-04-30T00:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
          },
        ],
        changes: [],
        snapshots: [],
      },
    ],
    personNameCache: [],
  },
};

async function seedBackupAndReload(page: import('@playwright/test').Page) {
  await hardResetDB(page);
  await page.evaluate((backup) => {
    localStorage.setItem('scope-shield-backup-latest', JSON.stringify(backup));
  }, STUB_BACKUP);
  // Use about:blank → / round-trip again instead of reload(): a plain reload
  // re-fires beforeunload, which would let any race between our wipe and the
  // running App overwrite our injected backup.
  await page.goto('about:blank');
  await page.goto('/');
  await expect(page.getByRole('alertdialog', { name: '数据恢复' })).toBeVisible({
    timeout: 8000,
  });
}

test.describe('RecoveryDialog: empty DB with localStorage backup', () => {
  test('appears on startup when DB is empty and a backup exists', async ({ page }) => {
    await seedBackupAndReload(page);
    // The dialog announces itself and shows backup metadata
    await expect(page.getByText(/检测到本地备份|发现备份|恢复/).first()).toBeVisible({ timeout: 5000 });
    // It should mention the project count or the backup time so the user knows what is being restored
    const dialog = page.locator('body');
    await expect(dialog).toContainText(/2026-04-30|1 个项目|1 个|项目/);
  });

  test('clicking 恢复备份 imports the backup and dismisses the dialog', async ({ page }) => {
    await seedBackupAndReload(page);
    await page.getByRole('button', { name: '恢复备份' }).click();
    // Dialog dismisses
    await expect(page.getByRole('alertdialog', { name: '数据恢复' })).not.toBeVisible({ timeout: 5000 });
    // App navigates to the recovered project's page
    await expect(page).toHaveURL(new RegExp(`/project/${PROJECT_ID}`), { timeout: 5000 });
    // Sidebar shows the recovered project name (use a forgiving locator: the
    // project sits inside a <button> with extra icons, not a plain <p>)
    await expect(page.locator('aside').getByText(PROJECT_NAME, { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test('clicking 从零开始 falls back to demo data', async ({ page }) => {
    await seedBackupAndReload(page);
    await page.getByRole('button', { name: '从零开始' }).click();
    await expect(page.getByText(PROJECT_NAME)).not.toBeVisible({ timeout: 3000 });
    await expect(page).toHaveURL(/\/project\//, { timeout: 5000 });
  });

  test('clicking 下载备份文件 triggers a file download', async ({ page }) => {
    await seedBackupAndReload(page);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载备份文件' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/scope-shield-recovery-.*\.json/);
  });

  test('does NOT appear when localStorage has no backup', async ({ page }) => {
    await hardResetDB(page);
    await page.goto('about:blank');
    await page.goto('/');
    await expect(page.getByRole('alertdialog', { name: '数据恢复' })).not.toBeVisible({ timeout: 3000 });
  });

  test('does NOT appear when backup contains zero projects', async ({ page }) => {
    await hardResetDB(page);
    await page.evaluate(() => {
      localStorage.setItem('scope-shield-backup-latest', JSON.stringify({
        version: '1.0',
        createdAt: '2026-04-30T00:00:00.000Z',
        projectCount: 0,
        requirementCount: 0,
        data: { version: '1.0', exportedAt: '', projects: [], personNameCache: [] },
      }));
    });
    await page.goto('about:blank');
    await page.goto('/');
    await expect(page.getByRole('alertdialog', { name: '数据恢复' })).not.toBeVisible({ timeout: 3000 });
  });
});
