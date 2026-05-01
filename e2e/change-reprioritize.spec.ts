import { test, expect } from '@playwright/test';
import { hardResetDB, createProject, addRequirement, openChangeModal, selectChangeType, selectInDialog, fillDescription, saveChange } from './helpers';

test.describe('Change: reprioritize', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
    await createProject(page, 'Reprioritize Project', '2026-04-01');
    await addRequirement(page, '需求A', '3');
    // B depends on A so that switching B → "no dependency" is a REAL change
    // (post-W1.6 the modal silently swallows no-op same-dep saves).
    await addRequirement(page, '需求B', '5', '需求A');
    await addRequirement(page, '需求C', '2');
  });

  test('records a reprioritize change', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    // 选目标需求 C，新前置 = 需求A
    await selectInDialog(page, 0, '需求C');
    await selectInDialog(page, 1, '需求A');
    await fillDescription(page, '调整优先级');
    await saveChange(page);

    await expect(page.getByText('调整优先级', { exact: true })).toBeVisible();
  });

  test('validates target requirement is required', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    const dialog = page.getByRole('dialog');
    // 只选了新前置，没选目标
    await selectInDialog(page, 1, '需求B');
    await fillDescription(page, 'Missing target');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('validates new dependency is required', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    const dialog = page.getByRole('dialog');
    await selectInDialog(page, 0, '需求A');
    // 没选新前置
    await fillDescription(page, 'Missing dep');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('records "no dependency" via the parallel option', async ({ page }) => {
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    await selectInDialog(page, 0, '需求B');
    await selectInDialog(page, 1, '无前置');
    await fillDescription(page, 'B 改并行');
    await saveChange(page);

    await expect(page.getByText('B 改并行', { exact: true })).toBeVisible();
  });
});

// Schedule-impact assertion: 用串行链才能看出"调优先级 → 工期变化"。默认
// helpers.addRequirement 的「无前置（并行）」会掩盖变化。
test.describe('Change: reprioritize - schedule impact', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
    await createProject(page, 'Serial Reprio Project', '2026-04-01');
    await addRequirement(page, '需求A', '3');
    await addRequirement(page, '需求B', '5', '需求A');
    await addRequirement(page, '需求C', '2', '需求B');
  });

  // 调优先级 = 改前置依赖：把需求 C 改成"无前置"。
  // C.dependsOn = null，但 A/B 的依赖保持不动 → 工期从串行 10 天变为 max(A→B=8, C=2) = 8 天。
  test('changing C dependency to "no dependency" updates schedule', async ({ page }) => {
    await expect(page.getByText('当前工期').locator('..')).toContainText('10天');

    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    await selectInDialog(page, 0, '需求C');
    await selectInDialog(page, 1, '无前置');
    await fillDescription(page, '把 C 改并行');
    await saveChange(page);

    await expect(page.getByText('当前工期').locator('..')).toContainText('8天');
    // C 的「前置」UI 应消失（dependsOn=null 时 RequirementRow 不渲染前置 span）
    await expect(page.locator('span', { hasText: '前置：需求B' })).not.toBeVisible();
  });

  // 回归保护：项目里有 cancelled 需求时，仍能正确改 dependsOn（不再受 array index / sortOrder 错位影响）。
  test('reprioritize works when there are cancelled requirements', async ({ page }) => {
    // 先 cancel 需求 B
    await openChangeModal(page);
    await selectChangeType(page, '砍需求');
    await selectInDialog(page, 0, '需求B');
    await fillDescription(page, '砍掉B');
    await saveChange(page);

    // 现在 active：A、C。把 A 改成依赖 C
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    await selectInDialog(page, 0, '需求A');
    await selectInDialog(page, 1, '需求C');
    await fillDescription(page, 'A 排在 C 之后');
    await saveChange(page);

    // 验证 A 的「前置」UI 显示为「需求C」
    await expect(page.locator('span', { hasText: '前置：需求C' })).toBeVisible();
  });
});
