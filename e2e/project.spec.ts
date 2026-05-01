import { test, expect } from '@playwright/test';
import { hardResetDB, createProject } from './helpers';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
  });

  test('creates a new project from sidebar', async ({ page }) => {
    await createProject(page, 'E2E Test Project', '2026-04-01');
    // Project name should appear in sidebar
    await expect(page.getByRole('heading', { name: 'E2E Test Project' })).toBeVisible();
    // Stats should show zero state
    await expect(page.getByText('原始工期')).toBeVisible();
    await expect(page.getByText('0天').first()).toBeVisible();
  });

  test('sidebar shows newly created project as selected', async ({ page }) => {
    await createProject(page, 'Selected Project');
    const sidebarBtn = page.locator('aside').getByText('Selected Project');
    await expect(sidebarBtn).toBeVisible();
  });

  test('navigates between projects', async ({ page }) => {
    await createProject(page, 'Project A', '2026-01-01');
    // Go back to create another
    await page.getByTitle('新建项目').click();
    await page.getByPlaceholder('项目名称').fill('Project B');
    await page.getByRole('button', { name: '创建' }).click();
    await expect(page).toHaveURL(/\/project\//);

    // Navigate back to Project A
    await page.locator('aside').getByText('Project A').click();
    await expect(page.getByText('Project A')).toBeVisible();
  });

  test('archives and restores a project', async ({ page }) => {
    await createProject(page, 'Archive Me');
    // Archive
    await page.getByRole('button', { name: /归档/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '确认' }).click();
    // Should see 已归档 status in the main area
    await expect(page.getByRole('main').getByText('已归档')).toBeVisible();
    // Sidebar should show it under 已归档 section
    await expect(page.locator('aside').getByText('已归档')).toBeVisible();

    // Restore
    await page.getByRole('button', { name: /恢复/ }).click();
    // 已归档 should disappear from the project header
    await expect(page.getByRole('main').getByText('已归档')).toBeHidden({ timeout: 3000 });
  });

  test('archived project hides add/edit buttons', async ({ page }) => {
    await createProject(page, 'Readonly Project');
    // Add a requirement first
    await page.getByRole('button', { name: '添加需求' }).click();
    await page.getByPlaceholder('需求名称').fill('Test Req');
    await page.getByPlaceholder('天数').fill('5');
    await page.getByRole('button', { name: '添加', exact: true }).click();
    await expect(page.getByText('Test Req')).toBeVisible();

    // Archive
    await page.getByRole('button', { name: /归档/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '确认' }).click();
    await expect(page.getByRole('main').getByText('已归档')).toBeVisible();

    // The "添加需求" button should be gone
    await expect(page.getByRole('button', { name: '添加需求' })).toBeHidden();
    // The "记录变更" button should be gone
    await expect(page.getByRole('button', { name: '记录变更' })).toBeHidden();
  });

  test('cancel project creation', async ({ page }) => {
    await page.getByTitle('新建项目').click();
    await page.getByPlaceholder('项目名称').fill('Will Cancel');
    await page.getByRole('button', { name: '取消' }).click();
    // Form should close
    await expect(page.getByPlaceholder('项目名称')).toBeHidden();
  });
});
