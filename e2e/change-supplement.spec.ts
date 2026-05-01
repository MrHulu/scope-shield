import { test, expect } from '@playwright/test';
import { hardResetDB, createProject, addRequirement, openChangeModal, selectChangeType, selectTarget, fillDescription, saveChange } from './helpers';

test.describe('Change: supplement', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
    await createProject(page, 'Supplement Project', '2026-04-01');
    await addRequirement(page, '订单系统', '10');
  });

  test('records a supplement with days', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '需求补充');
    await selectTarget(page, '订单系统');
    const dialog = page.getByRole('dialog');

    // Sub-type defaults to 功能补充
    await expect(dialog.getByText('功能补充')).toBeVisible();
    // Fill days
    await dialog.locator('input[type="number"]').fill('1.5');
    await fillDescription(page, '增加退款流程');
    await saveChange(page);

    await expect(page.getByText('增加退款流程', { exact: true })).toBeVisible();
    await expect(page.getByText('+1.5天', { exact: true })).toBeVisible();
  });

  test('records a zero-day supplement (record only)', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '需求补充');
    await selectTarget(page, '订单系统');
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').fill('0');
    await fillDescription(page, '需求描述补充');
    await saveChange(page);

    await expect(page.getByText('需求描述补充', { exact: true })).toBeVisible();
  });

  test('selects different supplement subtypes', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '需求补充');
    await selectTarget(page, '订单系统');
    const dialog = page.getByRole('dialog');

    // Select "条件变更"
    await dialog.getByRole('button', { name: '条件变更' }).click();
    await dialog.locator('input[type="number"]').fill('2');
    await fillDescription(page, '支付方式改变');
    await saveChange(page);

    // The subtype badge should be visible
    await expect(page.getByText('条件变更', { exact: true }).first()).toBeVisible();
  });

  test('validates target is required for supplement', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '需求补充');
    const dialog = page.getByRole('dialog');
    // Don't select target
    await dialog.locator('input[type="number"]').fill('1');
    await fillDescription(page, 'No target');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(dialog).toBeVisible(); // validation fail
    await page.keyboard.press('Escape');
  });
});
