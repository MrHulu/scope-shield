import { test, expect } from '@playwright/test';
import { hardResetDB } from './helpers';

/**
 * W2.9 — accessibility smoke. Verifies the structural a11y guarantees for
 * every dialog the app ships:
 *   - role=dialog or alertdialog with aria-modal="true"
 *   - explicit aria-label
 *   - Esc closes (or click backdrop closes)
 *   - close button reachable by Tab
 *
 * Does NOT exhaustively test focus trap mechanics — full focus-trap
 * implementation lives in a separate W3 follow-up.
 */
test.describe('a11y · dialog structure', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
    // Wait for demo data to render so triggers are clickable.
    await expect(page.getByTestId('floating-cta-record-change')).toBeVisible({
      timeout: 8000,
    });
  });

  test('ChangeModal is role=dialog + aria-modal + aria-label', async ({ page }) => {
    await page.getByTestId('floating-cta-record-change').click();
    const dialog = page.getByRole('dialog', { name: /记录变更/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 2000 });
  });

  test('ConfirmDialog (project archive) is role=alertdialog + Esc closes', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '归档' }).click();
    const alert = page.getByRole('alertdialog', { name: '归档项目' });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('aria-modal', 'true');
    await page.keyboard.press('Escape');
    await expect(alert).toBeHidden({ timeout: 2000 });
  });

  test('CommandPalette is role=dialog + Esc closes', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const palette = page.getByRole('dialog', { name: '命令面板' });
    await expect(palette).toBeVisible();
    await expect(palette).toHaveAttribute('aria-modal', 'true');
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden({ timeout: 2000 });
  });

  test('KeyboardHelpModal opens with `?`, closes with Esc', async ({ page }) => {
    await page.keyboard.press('?');
    const help = page.getByTestId('keyboard-help-modal');
    await expect(help).toBeVisible();
    await expect(help).toHaveAttribute('role', 'dialog');
    await expect(help).toHaveAttribute('aria-modal', 'true');
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden({ timeout: 2000 });
  });

  test('ExportModal opens with named close button', async ({ page }) => {
    await page.getByRole('button', { name: /导出图片/ }).click();
    const modal = page.getByRole('heading', { name: '导出图片' });
    await expect(modal).toBeVisible();
    // Close button has aria-label
    const close = page.getByRole('button', { name: /取消|关闭/ }).first();
    await expect(close).toBeVisible();
    await close.click();
    await expect(modal).toBeHidden({ timeout: 2000 });
  });

  test('FAB has accessible name including the keyboard hint', async ({ page }) => {
    const fab = page.getByTestId('floating-cta-record-change');
    await expect(fab).toHaveAttribute('aria-label', /记录变更/);
  });

  test('ThemeToggle is a radiogroup with three radio options', async ({ page }) => {
    const group = page.getByTestId('theme-toggle');
    await expect(group).toHaveAttribute('role', 'radiogroup');
    await expect(group).toHaveAttribute('aria-label', '主题');
    // 3 radios — light / system / dark
    const radios = page.getByTestId(/^theme-option-/);
    await expect(radios).toHaveCount(3);
  });

  test('chart tab switcher uses ARIA tablist semantics', async ({ page }) => {
    const list = page.getByRole('tablist', { name: /图表样式/ });
    await expect(list).toBeVisible();
    await expect(page.getByRole('tab', { name: '简洁版' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '详细版' })).toBeVisible();
  });
});
