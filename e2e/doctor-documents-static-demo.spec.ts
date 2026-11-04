import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function openDoctorDocuments(page: Page, query = ''): Promise<void> {
  await page.goto('/login');
  await page
    .locator('button.demo-workspace')
    .filter({ hasText: /^Independent practiceDoctor/ })
    .click();
  await expect(page).toHaveURL(/\/doctor\/command$/);
  await page.goto(`/doctor/documents${query}`);
  if (query.includes('flow=create')) {
    await expect(page).toHaveURL(/\/doctor\/documents\?flow=create/);
  } else {
    await expect(page.getByRole('heading', { name: 'Documents & modèles' })).toBeVisible();
  }
}

function screenshotName(testInfo: TestInfo, state: string): string {
  return `doctor-documents-${state}-${testInfo.project.name}.png`;
}

test.describe('static-demo Doctor documents and templates', () => {
  test('renders the populated workspace responsively, offline and without accessibility regressions', async ({
    page,
  }, testInfo) => {
    const browserErrors: string[] = [];
    const externalRequests: string[] = [];
    const backendRequests: string[] = [];
    const applicationWebSockets: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://127.0.0.1:4200/')) externalRequests.push(url);
      if (new URL(url).pathname.startsWith('/api/v1/')) backendRequests.push(url);
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

    await openDoctorDocuments(page);

    await expect(page.getByRole('heading', { name: 'Mes modèles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mes documents PDF' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prévisualisation' })).toBeVisible();
    const templateRegion =
      testInfo.project.name === 'mobile'
        ? page.locator('.template-mobile-list')
        : page.locator('.template-table');
    await expect(
      templateRegion.getByText('Ordonnance — Cabinet Lac 2', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(/Après impression, vous le signez/)).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(horizontalOverflow).toBe(false);

    const accessibility = await new AxeBuilder({ page })
      .include('.documents-page')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(backendRequests).toEqual([]);
    expect(applicationWebSockets).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'populated')),
      fullPage: true,
    });
  });

  test('supports template selection, field preview and safe management actions', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Interactions are certified once on desktop.');
    await openDoctorDocuments(page);

    await page
      .getByRole('button', { name: /Certificat médical général/ })
      .first()
      .click();
    await expect(page.getByLabel('Modèle à prévisualiser')).toHaveValue('template-certificate');

    await page.getByRole('tab', { name: 'Champs' }).click();
    await expect(page.locator('.mapping-box')).toHaveCount(5);

    const defaultRow = page.locator('tr').filter({ hasText: 'Ordonnance — Clinique Hannibal' });
    await defaultRow.getByRole('button', { name: /Actions pour/ }).click();
    await page.getByRole('menuitem', { name: 'Définir par défaut' }).click();
    await expect(page.getByText(/est maintenant le modèle par défaut/)).toBeVisible();

    const draftRow = page.locator('tr').filter({ hasText: /^Arrêt maladie/ });
    await draftRow.getByRole('button', { name: /Actions pour/ }).click();
    await page.getByRole('menuitem', { name: 'Dupliquer' }).click();
    await expect(page.getByText('Une copie en brouillon a été créée.')).toBeVisible();
  });

  test('captures the add-template, mapping and sample-test states', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Workflow states are captured on desktop.');

    await openDoctorDocuments(page, '?flow=create&step=1');
    await expect(
      page.getByRole('heading', { name: 'Quel document souhaitez-vous configurer ?' }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'create-step')),
      fullPage: true,
    });

    await page.goto('/doctor/documents?flow=create&step=4');
    await expect(
      page.getByRole('heading', { name: 'Positionner les champs', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.editor-field')).toHaveCount(5);
    await page.getByRole('button', { name: /Nom du patient/ }).click();
    await expect(page.locator('.editor-field')).toHaveCount(6);
    await page.getByRole('button', { name: 'Déplacer vers la droite' }).click();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'mapping')),
      fullPage: true,
    });

    await page.goto('/doctor/documents?flow=create&step=5');
    await expect(page.getByText('Données de démonstration', { exact: true })).toBeVisible();
    await expect(page.getByText('Amoxicilline 1 g', { exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'test-preview')),
      fullPage: true,
    });
  });

  test('shows empty, recoverable load failure, PDF failure and mobile mapping guidance', async ({
    page,
  }, testInfo) => {
    await openDoctorDocuments(page, '?state=empty');
    await expect(page.getByRole('heading', { name: 'Aucun modèle configuré' })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(screenshotName(testInfo, 'empty')),
      fullPage: true,
    });

    await page.goto('/doctor/documents?state=error');
    await expect(
      page.getByRole('heading', { name: 'Impossible de charger vos documents' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.getByRole('heading', { name: 'Mes modèles' })).toBeVisible();

    await page.goto('/doctor/documents?state=pdf-error');
    await expect(page.getByRole('heading', { name: 'Impossible d’afficher ce PDF' })).toBeVisible();

    if (testInfo.project.name === 'mobile') {
      await page.goto('/doctor/documents?flow=create&step=4');
      await expect(
        page.getByText('La configuration des champs est optimisée pour tablette et ordinateur.'),
      ).toBeVisible();
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(horizontalOverflow).toBe(false);
    }
  });
});
