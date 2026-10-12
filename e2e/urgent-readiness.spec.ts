import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { prepareSyntheticDoctor } from './doctor-profile-e2e-fixture';

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function prepareUrgentReadiness(page: Page): Promise<void> {
  await prepareSyntheticDoctor(page);
  await page.route('**/api/v1/me/care-capabilities', (route) =>
    json(route, {
      revision: 4,
      capabilities: ['CABINET', 'URGENT_HOME', 'URGENT_CABINET'],
    }),
  );
  await page.route('**/api/v1/me/practice-locations', (route) =>
    json(route, [
      { id: 'cab-e2e-lac', name: 'Cabinet Démo Lac', active: true },
      { id: 'cab-e2e-centre', name: 'Cabinet Démo Centre', active: true },
    ]),
  );
  await page.goto('/doctor/urgent-readiness');
  await expect(
    page.getByRole('heading', { name: 'Préparation aux urgences', level: 1 }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await prepareUrgentReadiness(page);
});

test('keeps permanent, runtime, eligibility and operation layers explicit and read-only', async ({
  page,
}) => {
  await expect(page.getByText('Aperçu statique · lecture seule')).toBeVisible();
  await expect(page.getByText(/Les capacités permanentes et les noms de cabinets/)).toBeVisible();
  await expect(page.getByText('Cabinet Démo Lac')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Disponibilité à domicile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Disponibilité au cabinet' })).toBeVisible();
  await expect(
    page.getByText(/se déclare et se gère dans l’application mobile Doctor/),
  ).toBeVisible();
  await expect(page.getByText('Disponibilité déclarée').first()).toBeVisible();
  await expect(page.getByText('Éligibilité effective').first()).toBeVisible();
  await expect(page.getByText('Non renseignée').first()).toBeVisible();
  await expect(page.getByText('À confirmer').first()).toBeVisible();
  await expect(page.getByText('Aucune prise en charge urgente active')).toBeVisible();
  await expect(page.locator('.readiness-card--home .oc-card--information')).toHaveCount(1);
  await expect(page.locator('.readiness-card--cabinet .oc-card--success')).toHaveCount(1);
  await expect(page.locator('.status-reason--information')).toHaveCount(3);
  for (const selector of [
    '.readiness-card--home .mode-icon oc-icon svg',
    '.readiness-card--cabinet .mode-icon oc-icon svg',
    '.status-reason__icon oc-icon svg',
  ]) {
    const icons = page.locator(selector);
    expect(await icons.count()).toBeGreaterThan(0);
    await expect(icons.first()).not.toHaveAttribute('data-icon-fallback', 'true');
    expect(await icons.first().locator('path, circle, rect').count()).toBeGreaterThan(0);
  }
  const statusLabelLocator = page.locator('oc-status-badge .oc-status__label');
  const statusLabels = await statusLabelLocator.allInnerTexts();
  expect(statusLabels.length).toBeGreaterThan(0);
  expect(statusLabels.every((label) => label.trim().length > 0)).toBe(true);
  for (let index = 0; index < statusLabels.length; index += 1) {
    await expect(statusLabelLocator.nth(index)).toBeVisible();
  }
  await expect(page.locator('.readiness-card--home .readiness-facts')).toContainText(
    'Aucune observation',
  );
  await expect(page.locator('.cabinet-runtime')).toHaveCount(2);
  await expect(page.locator('.cabinet-runtime').first()).toContainText('Disponibilité déclarée');
  await expect(page.locator('.cabinet-runtime').first()).toContainText('Éligibilité effective');
  await expect(page.locator('.cabinet-runtime').first()).toContainText('Aucune observation');
  await expect(page.getByRole('button', { name: 'Gérer les capacités' })).toHaveClass(
    /oc-button--primary/,
  );
  await expect(page.getByText('Connexion temps réel indisponible')).toHaveCount(1);
  await expect(page.getByText('Disponibilité urgente inactive')).toHaveCount(1);
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole('button', { name: 'Ouvrir la navigation Docteur' }).click();
  }
  await expect(page.getByRole('link', { name: 'Préparation urgences' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('link', { name: 'Communication' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Historique' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Facturation' })).toHaveCount(0);

  const pageText = (await page.locator('.urgent-readiness').innerText()).toLowerCase();
  for (const forbidden of [
    'accepter',
    'refuser',
    'démarrer le trajet',
    'confirmer l’arrivée',
    'scanner un qr',
    'coordonnées gps',
  ]) {
    expect(pageText).not.toContain(forbidden);
  }
  expect(pageText).not.toContain('mode home');
  expect(pageText).not.toContain('mode cabinet');
  expect(pageText).toContain('aucune observation');
});

test('contains the readiness experience at desktop, tablet and mobile widths', async ({ page }) => {
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const bounds = await page.locator('.urgent-readiness').evaluate((element) => ({
      left: Math.floor(element.getBoundingClientRect().left),
      right: Math.ceil(element.getBoundingClientRect().right),
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      workspaceWidth: element.parentElement?.getBoundingClientRect().width ?? 0,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    const headingBounds = await page
      .getByRole('heading', { name: 'Préparation aux urgences', level: 1 })
      .evaluate((element) => {
        const heading = element.getBoundingClientRect();
        const topbar = document.querySelector('.topbar')?.getBoundingClientRect();
        return {
          headingTop: Math.floor(heading.top),
          headingBottom: Math.ceil(heading.bottom),
          topbarBottom: Math.ceil(topbar?.bottom ?? 0),
          viewportHeight: window.innerHeight,
        };
      });
    expect(
      bounds.right,
      `Readiness exceeds viewport at ${width}px: ${JSON.stringify(bounds)}`,
    ).toBeLessThanOrEqual(width);
    expect(bounds.scrollWidth, `Readiness overflows internally at ${width}px`).toBeLessThanOrEqual(
      bounds.clientWidth,
    );
    expect(
      headingBounds.headingTop,
      `Heading is clipped by the topbar at ${width}px: ${JSON.stringify(headingBounds)}`,
    ).toBeGreaterThanOrEqual(headingBounds.topbarBottom);
    expect(headingBounds.headingBottom).toBeLessThanOrEqual(headingBounds.viewportHeight);
  }

  await page.getByRole('button', { name: 'Ouvrir la navigation Docteur' }).click();
  await expect(page.getByRole('heading', { name: 'Navigation Docteur' })).toBeVisible();
  await expect(page.getByText('Espace clinique').last()).toBeVisible();
});

test('has no serious or critical AXE violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('.urgent-readiness')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations
    .filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
    .flatMap((item) => item.nodes.map((node) => `${item.id}:${node.target.join(' ')}`));

  expect(violations).toEqual([]);
});
