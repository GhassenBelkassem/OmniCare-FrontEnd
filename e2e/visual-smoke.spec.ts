import { expect, test } from '@playwright/test';

test('captures the reviewed development-only compatibility surface', async ({ page }, testInfo) => {
  await page.goto('/design-system');
  const closeFilters = page.getByRole('button', { name: 'Close advanced filters' });
  if (await closeFilters.isVisible()) await closeFilters.click();
  const harness = page.locator('.oc-spartan-compat');
  await expect(harness).toBeVisible();
  await harness.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.screenshot({ path: testInfo.outputPath(`spartan-harness-${testInfo.project.name}.png`) });
});
