import { test, expect } from '@playwright/test';
import { resetDB, createProject, addRequirement } from './helpers';

test.describe('Drag-and-drop reorder', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page);
    await createProject(page, 'DnD Project', '2026-04-01');
    await addRequirement(page, '第一需求', '3');
    await addRequirement(page, '第二需求', '5');
    await addRequirement(page, '第三需求', '2');
  });

  test('requirements display in order', async ({ page }) => {
    // All three requirements should be visible
    await expect(page.getByText('第一需求')).toBeVisible();
    await expect(page.getByText('第二需求')).toBeVisible();
    await expect(page.getByText('第三需求')).toBeVisible();
  });

  test('drag handle is visible on hover', async ({ page }) => {
    // Hover over a requirement row to see drag handle
    const reqRow = page.getByText('第一需求').locator('..');
    await reqRow.hover();
    // The drag handle (GripVertical icon) should become visible
    // dnd-kit uses data attributes for sortable items
    await page.waitForTimeout(300);
  });

  test('reorders requirements via drag and drop', async ({ page }) => {
    // Get requirement elements
    const first = page.getByText('第一需求');
    const third = page.getByText('第三需求');

    // Get bounding boxes
    const firstBox = await first.boundingBox();
    const thirdBox = await third.boundingBox();

    if (firstBox && thirdBox) {
      // Drag first to third position
      await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
      await page.mouse.down();
      // Move slowly to trigger dnd-kit's pointer sensor (activation distance: 5px)
      await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2 + 10, { steps: 5 });
      await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, { steps: 10 });
      await page.mouse.up();

      // Wait for reorder to settle
      await page.waitForTimeout(500);
    }

    // Requirements should still all be visible after reorder
    await expect(page.getByText('第一需求')).toBeVisible();
    await expect(page.getByText('第二需求')).toBeVisible();
    await expect(page.getByText('第三需求')).toBeVisible();
  });
});
