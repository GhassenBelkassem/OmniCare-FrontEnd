import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { prepareSyntheticDoctor } from './doctor-profile-e2e-fixture';

test.beforeEach(async ({ page }) => {
  await prepareSyntheticDoctor(page);
  await page.goto('/doctor/settings');
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', level: 2 })).toBeVisible();
});

test('shows the authoritative healthy readiness state by default', async ({ page }) => {
  await expect(page.getByText('Votre profil est visible')).toBeVisible();
  await expect(page.getByText('Disponible pour les consultations au cabinet')).toBeVisible();
  await expect(page.getByText('Profil vérifié', { exact: true })).toBeVisible();
  await expect(page.getByText('1 cabinet actif', { exact: true })).toBeVisible();
});

test('contains the page at all required responsive widths', async ({ page }) => {
  for (const width of [1440, 1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByText('Votre profil est visible')).toBeVisible();
    const settingsBounds = await page.locator('.settings-page').evaluate((element) => ({
      right: Math.ceil(element.getBoundingClientRect().right),
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(settingsBounds.right, `Settings exceeds the viewport at ${width}px`).toBeLessThanOrEqual(
      width,
    );
    expect(
      settingsBounds.scrollWidth,
      `Settings has internal horizontal overflow at ${width}px`,
    ).toBeLessThanOrEqual(settingsBounds.clientWidth);
  }
});

test('has no serious or critical AXE violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('.readiness')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations
    .filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
    .flatMap((item) => item.nodes.map((node) => `${item.id}:${node.target.join(' ')}`));
  expect(violations).toEqual([]);
});
