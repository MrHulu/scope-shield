import { test, expect } from '@playwright/test';
import {
  hardResetDB,
  addRequirement,
  openChangeModal,
  selectChangeType,
  selectInDialog,
  fillDescription,
  saveChange,
} from './helpers';

/**
 * Smoke tests for the four W1 surfaces that are easy to regress visually:
 *   - FAB + ⌘⇧C shortcut (W1.3)
 *   - reprioritize same-dep toast (W1.6)
 *   - critical path highlight (W1.11)
 *   - comparison export mode (W1.12)
 *   - command palette (W1.13)
 *
 * Tests assume the demo project is auto-seeded so we can act immediately.
 */

test.describe('W1 features', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
    // Wait until the seeded demo data has rendered — most tests below assume
    // at least one requirement exists (FAB only mounts then; reprioritize
    // dropdowns only populate then). FAB visibility is a stronger signal
    // than sidebar text because it requires requirements.length > 0.
    await expect(page.getByTestId('floating-cta-record-change')).toBeVisible({ timeout: 8000 });
  });

  test('FAB triggers change modal', async ({ page }) => {
    const fab = page.getByTestId('floating-cta-record-change');
    await expect(fab).toBeVisible({ timeout: 5000 });
    await fab.click();
    await expect(page.getByRole('dialog', { name: /记录变更/ })).toBeVisible();
  });

  test('⌘⇧C keyboard shortcut opens change modal', async ({ page }) => {
    // The FAB is mounted; just send the chord and the same handler fires.
    await expect(page.getByTestId('floating-cta-record-change')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Meta+Shift+C');
    await expect(page.getByRole('dialog', { name: /记录变更/ })).toBeVisible({ timeout: 2000 });
  });

  test('reprioritize same-dep → toast appears, modal stays open', async ({ page }) => {
    // beforeEach already confirmed FAB is mounted = requirements loaded.
    await openChangeModal(page);
    await selectChangeType(page, '调优先级');

    const dialog = page.getByRole('dialog');
    const targetSelect = dialog.locator('select').nth(0);
    const depSelect = dialog.locator('select').nth(1);

    // The demo project's first active requirement has dependsOn=null. Pick
    // it as target, then explicitly set newDep="__null__" — same as current
    // → must trigger the no-op toast instead of saving.
    await targetSelect.selectOption({ index: 1 });
    await depSelect.selectOption('__null__');
    await fillDescription(page, '尝试无变化');
    await dialog.getByRole('button', { name: /保存/ }).click();

    // Toast text "前置依赖未变化，未生效" must appear within 1s.
    await expect(page.getByText('前置依赖未变化，未生效')).toBeVisible({ timeout: 1500 });
    // Modal stays open because the engine never got the change.
    await expect(dialog).toBeVisible();
  });

  test('critical path bars carry data-critical attr', async ({ page }) => {
    await page.getByRole('tab', { name: '详细版' }).click();
    // Demo project has at least one critical-path requirement.
    const critical = page.locator('g[data-critical="true"]');
    await expect(critical.first()).toBeVisible({ timeout: 3000 });
  });

  test('export modal exposes comparison mode', async ({ page }) => {
    await page.getByRole('button', { name: /导出图片/ }).click();
    await expect(page.getByTestId('export-mode-comparison')).toBeVisible();
    await page.getByTestId('export-mode-comparison').click();
    // Hint text only renders in comparison mode
    await expect(page.getByText(/对比模式输出两栏并排/)).toBeVisible();
  });

  test('⌘K opens command palette and matches projects', async ({ page }) => {
    // Wait for demo project to load so projectStore is populated
    await expect(page.locator('aside').getByText('CRM')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Meta+k');
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible();
    // Demo project is named "CRM 系统重构" — search by "CRM"
    await page.getByTestId('command-palette-input').fill('CRM');
    const projectItems = page.getByTestId('command-palette-item-project');
    await expect(projectItems.first()).toBeVisible({ timeout: 2000 });
    // Esc closes
    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible({ timeout: 1500 });
  });

  test('LocalStorageBadge renders in sidebar footer', async ({ page }) => {
    await expect(page.getByTestId('local-storage-badge')).toBeVisible();
  });

  test('hero stat-inflation uses ≥32px font size', async ({ page }) => {
    const hero = page.getByTestId('hero-stat-inflation');
    await expect(hero).toBeVisible();
    // The value text is the second <p> inside; query computed font-size.
    const heroText = hero.locator('p').nth(1);
    const fontSize = await heroText.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(32);
  });

  test('add requirement triggers data-just-added pulse', async ({ page }) => {
    await addRequirement(page, '走查需求', '2');
    const justAdded = page.locator('[data-just-added="true"]');
    await expect(justAdded.first()).toBeVisible({ timeout: 1000 });
    // Pulse expires within ~1.6s
    await page.waitForTimeout(1700);
    await expect(page.locator('[data-just-added="true"]')).toHaveCount(0);
  });
});
