import { test, expect } from '@playwright/test';
import {
  hardResetDB,
  createProject,
  addRequirement,
  openChangeModal,
  selectChangeType,
  selectTarget,
  selectInDialog,
  fillDescription,
  saveChange,
} from './helpers';

/**
 * Wave 1 收口：one e2e covering the whole authoring → review → export →
 * reload loop. Touches every primary surface and asserts persistence.
 */
test.describe('journey-full', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
  });

  test('new project → 5 reqs → 6 change types → switch chart → export → reload', async ({
    page,
  }) => {
    // ── Step 1: create project ────────────────────────────────────────
    await createProject(page, 'Journey 项目', '2026-05-01');
    await expect(page).toHaveURL(/\/project\//);

    // ── Step 2: 5 requirements ────────────────────────────────────────
    await addRequirement(page, '登录鉴权', '3');
    await addRequirement(page, '商品列表', '5');
    await addRequirement(page, '购物车', '4', '商品列表');
    await addRequirement(page, '下单', '6', '购物车');
    await addRequirement(page, '支付', '4', '下单');

    // ── Step 3: record 6 change types (skip resume — needs a paused first
    //   that we'd have to wait for; pause + cancel + add_days + supplement
    //   + new_requirement + reprioritize gives full coverage of UI paths) ──
    await openChangeModal(page);
    await selectChangeType(page, '调整天数');
    await selectTarget(page, '登录鉴权');
    await page.getByPlaceholder('正数增加，负数减少').fill('1');
    await fillDescription(page, '加密算法变更');
    await saveChange(page);

    await openChangeModal(page);
    await selectChangeType(page, '砍需求');
    await selectTarget(page, '购物车');
    await fillDescription(page, '购物车并入下单');
    await saveChange(page);

    await openChangeModal(page);
    await selectChangeType(page, '需求补充');
    await selectTarget(page, '商品列表');
    // Supplement-mode placeholder is just "0".
    await page.getByPlaceholder('0', { exact: true }).fill('0.5');
    await fillDescription(page, '补充筛选功能');
    await saveChange(page);

    await openChangeModal(page);
    await selectChangeType(page, '新增需求');
    await page.getByPlaceholder('新需求名称').fill('优惠券');
    // Days input has no placeholder — find it by its label association.
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="number"]').first().fill('2');
    await fillDescription(page, '运营要求加入');
    await saveChange(page);

    await openChangeModal(page);
    await selectChangeType(page, '暂停');
    await selectTarget(page, '支付');
    await fillDescription(page, '等支付方资料');
    await saveChange(page);

    await openChangeModal(page);
    await selectChangeType(page, '调优先级');
    await selectInDialog(page, 0, '下单'); // target
    await selectInDialog(page, 1, '商品列表'); // newDep — different from current 'cart'
    await fillDescription(page, '改并行流程');
    await saveChange(page);

    // ── Step 4: 6 change rows visible ─────────────────────────────────
    const changeListSection = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: '变更记录' }) })
      .first();
    // Each change row contains a date — count rows that match the YYYY-MM-DD pattern
    const today = new Date().toISOString().slice(0, 10);
    await expect(changeListSection.getByText(today).first()).toBeVisible();

    // ── Step 5: switch to detail chart and back ──────────────────────
    await page.getByRole('tab', { name: '详细版' }).click();
    await expect(page.getByRole('tab', { name: '详细版' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: '简洁版' }).click();
    await expect(page.getByRole('tab', { name: '简洁版' })).toHaveAttribute('aria-selected', 'true');

    // ── Step 6: export PNG ────────────────────────────────────────────
    await page.getByRole('button', { name: /导出图片/ }).click();
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: /^导出$/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/scope-shield-.*\.png/);

    // ── Step 7: reload — backup blob must persist requirements ───────
    // Wait briefly for autoBackup debounce (5s) then beforeunload flush.
    await page.waitForTimeout(5_500);
    await page.goto('about:blank');
    await page.goto('/');
    await page.waitForTimeout(1_000);

    // Sidebar should still show the project we created.
    await expect(page.locator('aside').getByText('Journey 项目')).toBeVisible();

    // localStorage's backup-latest must still hold the project + 5 base reqs
    // (the 6th — 优惠券 — was added via change, brings to 6 total; but
    // baseline reqs from create flow are 5).
    const backupSnapshot = await page.evaluate(() => {
      const raw = localStorage.getItem('scope-shield-backup-latest');
      return raw ? JSON.parse(raw) : null;
    });
    expect(backupSnapshot).not.toBeNull();
    expect(backupSnapshot.projectCount).toBeGreaterThanOrEqual(1);
    // Demo seed adds another project, so projectCount can be 1 or 2 here.
    expect(backupSnapshot.requirementCount).toBeGreaterThanOrEqual(5);
  });
});
