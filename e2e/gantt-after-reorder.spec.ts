import { test, expect } from '@playwright/test';
import { hardResetDB, createProject, addRequirement } from './helpers';

test.describe('Gantt chart after reorder', () => {
  test.beforeEach(async ({ page }) => {
    await hardResetDB(page);
    await createProject(page, 'Gantt Test', '2026-04-01');
  });

  test('gantt displays correctly after drag reorder', async ({ page }) => {
    // Add three independent requirements (parallel scheduling)
    await addRequirement(page, '需求A', '5');
    await addRequirement(page, '需求B', '3');
    await addRequirement(page, '需求C', '4');

    // Check initial state - scroll to chart area
    await page.getByRole('button', { name: '详细版' }).click();
    await expect(page.getByText('原计划 5天 → 实际 5天')).toBeVisible();

    // Drag to reorder first requirement to last position
    const first = page.getByText('需求A').first();
    const third = page.getByText('需求C').first();
    const firstBox = await first.boundingBox();
    const thirdBox = await third.boundingBox();

    if (firstBox && thirdBox) {
      await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2 + 10, { steps: 5 });
      await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    // Chart should still display correctly after reorder
    await expect(page.getByText('原计划 5天 → 实际 5天')).toBeVisible();
  });
});
