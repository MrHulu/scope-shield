import { test, expect } from '@playwright/test';
import { hardResetDB, createProject, addRequirement } from './helpers';

const KEY_LATEST = 'scope-shield-backup-latest';
const KEY_PREV = 'scope-shield-backup-previous';
const DEBOUNCE_MS = 5000;

async function readBackup(page: import('@playwright/test').Page, key: string) {
  return await page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

test.describe('autoBackup: localStorage round-trip', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
  });

  test('produces a backup in KEY_LATEST after the debounce window', async ({ page }) => {
    await createProject(page, '自动备份项目', '2026-04-15');
    await addRequirement(page, '需求 A', '5');
    // wait past debounce
    await page.waitForTimeout(DEBOUNCE_MS + 1500);

    const backup = await readBackup(page, KEY_LATEST);
    expect(backup).not.toBeNull();
    expect(backup.version).toBe('1.0');
    expect(backup.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(backup.data.projects.length).toBeGreaterThan(0);

    const target = backup.data.projects.find((p: { name: string }) => p.name === '自动备份项目');
    expect(target).toBeDefined();
    expect(target.requirements.length).toBeGreaterThan(0);
    expect(target.requirements[0].name).toBe('需求 A');
  });

  test('rotates KEY_LATEST → KEY_PREV on the second backup', async ({ page }) => {
    await createProject(page, '滚动测试', '2026-04-15');
    await addRequirement(page, 'first req', '2');
    await page.waitForTimeout(DEBOUNCE_MS + 1500);

    const firstBackup = await readBackup(page, KEY_LATEST);
    expect(firstBackup).not.toBeNull();
    const firstReqCount = firstBackup.data.projects[0].requirements.length;

    // Trigger another data change → debounced second backup
    await addRequirement(page, 'second req', '3');
    await page.waitForTimeout(DEBOUNCE_MS + 1500);

    const prev = await readBackup(page, KEY_PREV);
    const latest = await readBackup(page, KEY_LATEST);

    expect(prev).not.toBeNull();
    expect(prev.data.projects[0].requirements.length).toBe(firstReqCount);

    expect(latest.data.projects[0].requirements.length).toBeGreaterThan(firstReqCount);
  });

  test('Settings page surfaces "上次备份" timestamp once a backup exists', async ({ page }) => {
    await createProject(page, '展示备份时间', '2026-04-15');
    await addRequirement(page, '需求 X', '1');
    await page.waitForTimeout(DEBOUNCE_MS + 1500);

    await page.getByRole('button', { name: '设置' }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(/上次备份[:：]/)).toBeVisible({ timeout: 3000 });
  });
});
