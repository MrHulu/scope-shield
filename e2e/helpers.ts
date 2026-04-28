import { type Page, expect } from '@playwright/test';

/**
 * Clear IndexedDB to start fresh — call at the beginning of each test file.
 */
export async function resetDB(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });
  await page.reload();
  await page.waitForTimeout(500); // let stores rehydrate
}

/**
 * Create a project via the sidebar form. Returns to the new project page.
 */
export async function createProject(page: Page, name: string, startDate?: string) {
  await page.getByTitle('新建项目').click();
  await page.getByPlaceholder('项目名称').fill(name);
  if (startDate) {
    await page.locator('input[type="date"]').first().fill(startDate);
  }
  await page.getByRole('button', { name: '创建' }).click();
  // Wait for navigation to project page
  await expect(page).toHaveURL(/\/project\//);
  await page.waitForTimeout(300);
}

/**
 * Add a requirement via the inline form.
 */
export async function addRequirement(page: Page, name: string, days: string, dependsOn?: string) {
  await page.getByRole('button', { name: '添加需求' }).click();
  await page.getByPlaceholder('需求名称').fill(name);
  await page.getByPlaceholder('天数').fill(days);
  const select = page.locator('select').filter({ hasText: '无前置' });
  if (dependsOn) {
    const options = await select.locator('option').allTextContents();
    const match = options.find((o) => o.includes(dependsOn));
    if (!match) throw new Error(`No dependency option containing "${dependsOn}" in [${options.join(', ')}]`);
    await select.selectOption({ label: match });
  } else {
    await select.selectOption({ label: '无前置（与其他需求并行）' });
  }
  await page.getByRole('button', { name: '添加', exact: true }).click();
  // Wait for the requirement to appear in the list (span with text), not in the dropdown
  await expect(page.locator('span', { hasText: name }).first()).toBeVisible();
}

/**
 * Open the ChangeModal and fill common fields. Does NOT click save.
 */
export async function openChangeModal(page: Page) {
  await page.getByRole('button', { name: '记录变更' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Select a change type in the ChangeModal.
 */
export async function selectChangeType(page: Page, label: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: label }).click();
}

/**
 * Fill the description field in the ChangeModal.
 */
export async function fillDescription(page: Page, text: string) {
  await page.getByPlaceholder('一句话描述变更原因').fill(text);
}

/**
 * Click save/update in the ChangeModal.
 */
export async function saveChange(page: Page) {
  const dialog = page.getByRole('dialog');
  const saveBtn = dialog.getByRole('button', { name: /保存|更新/ });
  await saveBtn.click();
  // Wait for modal to close
  await expect(dialog).toBeHidden({ timeout: 5000 });
}

/**
 * Select a target requirement in the ChangeModal dropdown by partial name match.
 */
export async function selectTarget(page: Page, reqName: string) {
  const dialog = page.getByRole('dialog');
  const select = dialog.locator('select').first();
  // Get all option labels, find the one containing reqName, then select by exact label
  const options = await select.locator('option').allTextContents();
  const match = options.find((o) => o.includes(reqName));
  if (!match) throw new Error(`No option found containing "${reqName}" in [${options.join(', ')}]`);
  await select.selectOption({ label: match });
}

/**
 * Select an option in a specific select (by index) in the ChangeModal dropdown by partial name match.
 */
export async function selectInDialog(page: Page, selectIndex: number, reqName: string) {
  const dialog = page.getByRole('dialog');
  const select = dialog.locator('select').nth(selectIndex);
  const options = await select.locator('option').allTextContents();
  const match = options.find((o) => o.includes(reqName));
  if (!match) throw new Error(`No option found containing "${reqName}" in select[${selectIndex}]: [${options.join(', ')}]`);
  await select.selectOption({ label: match });
}

/**
 * Click confirm in a ConfirmDialog.
 */
export async function confirmDialog(page: Page) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  // Find the non-cancel button (the colored one) — it's the last button
  const buttons = dialog.getByRole('button');
  await buttons.last().click();
  await expect(dialog).toBeHidden({ timeout: 3000 });
}

/**
 * Navigate to settings page.
 */
export async function goToSettings(page: Page) {
  await page.getByRole('button', { name: '设置' }).click();
  await expect(page).toHaveURL(/\/settings/);
}

/**
 * Get visible requirement names from the requirement list.
 */
export async function getRequirementNames(page: Page): Promise<string[]> {
  // Each requirement row has the name in a span
  const rows = page.locator('[class*="rounded-lg"]').filter({ hasText: /天$/ });
  const names: string[] = [];
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).textContent();
    if (text) names.push(text);
  }
  return names;
}
