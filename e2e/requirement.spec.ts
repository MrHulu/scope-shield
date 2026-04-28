import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement } from './helpers';

test.describe('Requirement Management', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'Req Test Project', '2026-04-01');
  });

  test('adds a requirement with name and days', async ({ page }) => {
    await addRequirement(page, '用户登录', '5');
    await expect(page.getByText('用户登录')).toBeVisible();
    // Verify days in the requirement row (span contains "5天")
    await expect(page.locator('span', { hasText: /^5天$/ }).first()).toBeVisible();
  });

  test('adds requirement with 0.5-day granularity', async ({ page }) => {
    await addRequirement(page, '小任务', '1.5');
    await expect(page.locator('span', { hasText: /^1\.5天$/ }).first()).toBeVisible();
  });

  test('adds requirement with dependency', async ({ page }) => {
    await addRequirement(page, '前端页面', '5');
    await addRequirement(page, '后端接口', '3', '前端页面');
    // Dependency shown
    await expect(page.getByText('前置：前端页面')).toBeVisible();
  });

  test('edits requirement name and days', async ({ page }) => {
    await addRequirement(page, '原始需求', '5');
    // Click edit on the requirement row
    await page.getByLabel('编辑').first().click();
    // The edit form renders inline with input fields
    // Wait for the input to appear
    const editRow = page.locator('.bg-gray-50').filter({ has: page.locator('input') });
    const nameInput = editRow.locator('input').first();
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill('修改后需求');
    const daysInput = editRow.locator('input[type="number"]');
    await daysInput.clear();
    await daysInput.fill('8');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('修改后需求')).toBeVisible();
    await expect(page.locator('span', { hasText: /^8天$/ }).first()).toBeVisible();
  });

  test('deletes a requirement with confirmation', async ({ page }) => {
    await addRequirement(page, '将删除', '3');
    await expect(page.getByText('将删除')).toBeVisible();
    // Click delete
    await page.getByLabel('删除').first().click();
    // Confirm dialog
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText('确定要删除')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click();
    // Requirement should be gone
    await expect(page.getByText('将删除')).toBeHidden();
  });

  test('cancels requirement deletion', async ({ page }) => {
    await addRequirement(page, '不删除', '3');
    await page.getByLabel('删除').first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click();
    // Should still be there
    await expect(page.getByText('不删除')).toBeVisible();
  });

  test('shows empty state when no requirements', async ({ page }) => {
    await expect(page.getByText('暂无需求')).toBeVisible();
  });

  test('cancel adding requirement hides form', async ({ page }) => {
    await page.getByRole('button', { name: '添加需求' }).click();
    await expect(page.getByPlaceholder('需求名称')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByPlaceholder('需求名称')).toBeHidden();
  });

  test('validates requirement name is required', async ({ page }) => {
    await page.getByRole('button', { name: '添加需求' }).click();
    await page.getByPlaceholder('天数').fill('5');
    await page.getByRole('button', { name: '添加', exact: true }).click();
    // Form should still be visible (validation failed, nothing saved)
    await expect(page.getByPlaceholder('需求名称')).toBeVisible();
  });

  test('stats update after adding requirements', async ({ page }) => {
    // Add two independent requirements — scheduler runs them in parallel
    await addRequirement(page, 'Req A', '5');
    await addRequirement(page, 'Req B', '3');
    // Verify both exist
    await expect(page.getByText('Req A')).toBeVisible();
    await expect(page.getByText('Req B')).toBeVisible();
    // With parallel scheduling (no dependencies), total = max(5, 3) = 5 days
    // Stats card shows "原始工期" with value "5天"
    const card = page.locator('.bg-gray-50').filter({ has: page.getByText('原始工期') });
    await expect(card).toContainText('5天');
  });
});
