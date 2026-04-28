import { test, expect } from '@playwright/test';
import { resetDB, createProject } from './helpers';

test.describe('Requirement: Feishu URL source', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'Feishu URL Project', '2026-04-01');
  });

  test('saves a Feishu URL source without Plugin Token', async ({ page }) => {
    await page.getByRole('button', { name: '添加需求' }).click();
    await page.getByPlaceholder('飞书需求 URL（可选）').fill(
      'https://project.feishu.cn/proj/story/detail?project_key=PAY&work_item_type_key=story&work_item_id=42',
    );
    await page.getByRole('button', { name: '解析' }).click();

    await expect(page.getByText(/已解析 URL|已保留 URL 来源/)).toBeVisible();

    await page.getByPlaceholder('需求名称').fill('支付重构');
    await page.getByPlaceholder('天数').fill('3');
    await page.getByRole('button', { name: '添加', exact: true }).click();

    await expect(page.locator('span', { hasText: '支付重构' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /飞书需求/ })).toBeVisible();
  });
});
