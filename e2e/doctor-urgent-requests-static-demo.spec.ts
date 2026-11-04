import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function openUrgentRequests(page: Page, query = ''): Promise<void> {
  await page.goto('/login');
  await page
    .locator('button.demo-workspace')
    .filter({ hasText: /^Independent practiceDoctor/ })
    .click();
  await expect(page).toHaveURL(/\/doctor\/command$/);
  await page.goto(`/doctor/urgent-requests${query}`);
  await expect(page.getByRole('heading', { name: 'Demandes urgentes', exact: true })).toBeVisible();
}

function screenshotName(testInfo: TestInfo, state: string): string {
  return `doctor-urgent-requests-${state}-${testInfo.project.name}.png`;
}

test.describe('static-demo Doctor urgent requests', () => {
  test('renders the operational queue responsively, offline and accessibly', async ({
    page,
  }, testInfo) => {
    const browserErrors: string[] = [];
    const backendRequests: string[] = [];
    const applicationWebSockets: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/')) {
        backendRequests.push(request.url());
      }
    });
    page.on('websocket', (socket) => {
      const url = new URL(socket.url());
      const angularReloadSocket =
        url.hostname === '127.0.0.1' &&
        url.port === '4200' &&
        url.pathname === '/' &&
        url.searchParams.has('token');
      if (!angularReloadSocket) applicationWebSockets.push(socket.url());
    });

    await openUrgentRequests(page);

    await expect(page.locator('.summary-strip strong').first()).toHaveText('3');
    await expect(page.getByText('Douleur thoracique', { exact: true })).toBeVisible();
    await expect(page.getByText('Fièvre élevée', { exact: true })).toBeVisible();
    await expect(page.getByText('Douleur abdominale', { exact: true })).toBeVisible();
    if (testInfo.project.name !== 'mobile') {
      await expect(page.getByText('Connexion temps réel active')).toBeVisible();
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(horizontalOverflow).toBe(false);

    const accessibility = await new AxeBuilder({ page })
      .include('.urgent-page')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(backendRequests).toEqual([]);
    expect(applicationWebSockets).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'populated')),
      fullPage: true,
    });
  });

  test('opens details and moves an accepted request to En cours', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The full interaction is certified on desktop.');
    await openUrgentRequests(page, '?drawer=open');

    const drawer = page.getByRole('dialog', { name: 'Détails de la demande' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Signes d'alerte")).toBeVisible();
    await expect(drawer.getByText('Antécédents connus')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'detail')),
      fullPage: true,
    });

    await drawer.getByRole('button', { name: 'Accepter la demande' }).click();
    await expect(page.getByText('Demande acceptée', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'En cours' }).click();
    await expect(page.getByText('Douleur thoracique', { exact: true })).toBeVisible();
    await expect(page.getByText('En attente du choix du patient')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'active')),
      fullPage: true,
    });
  });

  test('supports history and compact refusal confirmation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The full interaction is certified on desktop.');
    await openUrgentRequests(page);

    await page.getByRole('tab', { name: 'Historique' }).click();
    await expect(page.getByText('Plaie superficielle')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'history')),
      fullPage: true,
    });

    await page.getByRole('tab', { name: 'À traiter' }).click();
    await page.getByRole('button', { name: 'Voir la demande' }).first().click();
    await page.getByRole('button', { name: 'Refuser', exact: true }).click();
    const refusal = page.getByRole('dialog', { name: 'Refuser la demande' });
    await expect(refusal).toBeVisible();
    await refusal.getByLabel('Trop loin').check();
    await refusal.getByRole('button', { name: 'Confirmer le refus' }).click();
    await expect(page.getByText('Demande refusée', { exact: true })).toBeVisible();
  });

  test('renders empty, error, loading and unavailable states', async ({ page }, testInfo) => {
    await openUrgentRequests(page, '?state=empty');
    await expect(
      page.getByRole('heading', { name: 'Aucune demande urgente disponible' }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'empty')),
      fullPage: true,
    });

    await page.goto('/doctor/urgent-requests?state=error');
    await expect(
      page.getByRole('heading', { name: 'Impossible de charger les demandes' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.getByText('Douleur thoracique', { exact: true })).toBeVisible();

    await page.goto('/doctor/urgent-requests?state=loading');
    await expect(page.getByLabel('Chargement des demandes urgentes')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'loading')),
      fullPage: true,
    });

    if (testInfo.project.name === 'desktop') {
      await page.goto('/doctor/urgent-requests?state=unavailable&drawer=open');
      const drawer = page.getByRole('dialog', { name: 'Détails de la demande' });
      await drawer.getByRole('button', { name: 'Accepter la demande' }).click();
      await expect(page.getByText("Cette demande n'est plus disponible.")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(screenshotName(testInfo, 'unavailable')),
        fullPage: true,
      });
    }
  });
});
