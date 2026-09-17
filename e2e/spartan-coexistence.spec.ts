import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const unexpectedConsoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  unexpectedConsoleErrors.length = 0;
  page.on('console', (message) => {
    if (message.type() === 'error') unexpectedConsoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => unexpectedConsoleErrors.push(error.message));
  await page.goto('/design-system');
  await expect(page.getByRole('heading', { name: 'Spartan coexistence' })).toBeVisible();
});

test.afterEach(() => {
  expect(unexpectedConsoleErrors).toEqual([]);
});

test('has no serious or critical Axe violations in the P0 harness', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('.oc-spartan-compat')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);
});

test('has no unintended page-level horizontal overflow', async ({ page }) => {
  const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
});

test('dialog traps focus, dismisses on Escape, and restores the trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open focus-safe dialog' });
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Confirm compatibility behavior' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#spartan-compat-dialog-name')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('sheet has an accessible name, moves focus, and restores the trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open focus-safe sheet' });
  await trigger.focus();
  await trigger.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Compatibility sheet' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});
