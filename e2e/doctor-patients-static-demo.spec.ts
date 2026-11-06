import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function openDoctorPatients(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page
    .locator('button.demo-workspace')
    .filter({ hasText: /^Independent practiceDoctor/ })
    .click();
  await expect(page).toHaveURL(/\/doctor\/command$/);
  await page.goto('/doctor/patients');
  await expect(page.getByRole('heading', { name: 'Mes patients' })).toBeVisible();
}

test.describe('static-demo Doctor patients', () => {
  test('renders a responsive administrative directory with no clinical leakage', async ({
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

    await openDoctorPatients(page);

    await expect(page.getByText('8 462 patients', { exact: true })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await expect(page.getByRole('columnheader', { name: /Patient/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Liaison OmniCare/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Source/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Tags|Alertes/ })).toHaveCount(0);

    const directoryText = await page.locator('.patient-directory').innerText();
    expect(directoryText).not.toMatch(/allergie|diab[eè]te|cardiopathie|asthme|hta|bpco/i);

    const overflowSources = await page.evaluate(() => {
      return [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => {
          const style = getComputedStyle(element);
          return element.scrollWidth > element.clientWidth + 1 && style.overflowX === 'visible';
        })
        .slice(0, 8)
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    });
    expect(overflowSources).toEqual([]);

    const accessibility = await new AxeBuilder({ page })
      .include('.patient-directory')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(backendRequests).toEqual([]);
    expect(applicationWebSockets).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`doctor-patients-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('supports search, filters, sorting, pagination, selection and row navigation', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Directory interactions are certified once on desktop.',
    );
    await openDoctorPatients(page);

    const search = page.getByRole('searchbox', { name: 'Rechercher un patient' });
    await search.fill('+216 20 000 303');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByRole('link', { name: /Ben Salah Amira/ })).toBeVisible();

    await page.getByRole('checkbox', { name: 'Sélectionner Amira Ben Salah' }).check();
    await expect(page.getByText('1 sélectionné')).toBeVisible();

    await search.clear();
    await page.getByLabel('Source').selectOption('WALK_IN');
    await expect(page.getByText('446 résultats')).toBeVisible();
    await expect(page.locator('tbody .source-pill')).toHaveText([
      'Passage',
      'Passage',
      'Passage',
      'Passage',
      'Passage',
      'Passage',
      'Passage',
      'Passage',
      'Passage',
      'Passage',
    ]);

    await page.getByRole('button', { name: 'Patient', exact: true }).click();
    await page.getByRole('button', { name: /Page suivante/ }).click();
    await expect(page.getByText(/Afficher 11–20/)).toBeVisible();

    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await search.fill('+216 20 000 303');
    await page.getByRole('link', { name: /Ben Salah Amira/ }).click();
    await expect(page).toHaveURL(/\/doctor\/patient\/demo-practice-patient-amira$/);
    await expect(page.getByRole('heading', { name: 'Amira Ben Salah' })).toBeVisible();
  });

  test('exposes intentional loading, empty and recoverable error states', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Data states are certified once on desktop.');
    await openDoctorPatients(page);

    await page
      .getByRole('searchbox', { name: 'Rechercher un patient' })
      .fill('patient-introuvable-999');
    await expect(page.getByRole('heading', { name: 'Aucun patient trouvé' })).toBeVisible();

    await page.goto('/doctor/patients?state=loading');
    await expect(page.getByRole('heading', { name: 'Chargement des patients…' })).toBeVisible();

    await page.goto('/doctor/patients?state=error');
    await expect(
      page.getByRole('heading', { name: 'Impossible de charger les patients' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(10);
  });

  test('preserves the existing add-patient flow inside the offline demo', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Patient creation is certified once on desktop.',
    );
    const backendRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/'))
        backendRequests.push(request.url());
    });
    await openDoctorPatients(page);

    await page.getByRole('button', { name: 'Ajouter un patient' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const inputs = dialog.locator('input');
    await inputs.nth(0).fill('Essai');
    await inputs.nth(1).fill('Nour');
    await inputs.nth(2).fill('1994-05-18');
    await inputs.nth(3).fill('F');
    await inputs.nth(4).fill('+216 21 555 404');
    await inputs.nth(5).fill('nour.essai@example.test');
    await dialog.locator('textarea').fill('10 rue de la Démo, Tunis');
    await page.getByRole('button', { name: 'Créer le patient' }).click();

    await expect(page.locator('.created-message')).toContainText(
      'Nour Essai a été ajouté à la démo.',
    );
    await expect(page.getByText('8 463 patients', { exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Rechercher un patient' }).fill('+216 21 555 404');
    await page.getByRole('link', { name: /Essai Nour/ }).click();
    await expect(page.getByRole('heading', { name: 'Nour Essai' })).toBeVisible();
    expect(backendRequests).toEqual([]);
  });

  test('keeps the selected patient record locked and all tabs non-clinical', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile',
      'Patient detail is certified at desktop and tablet widths.',
    );
    await openDoctorPatients(page);
    await page.goto('/doctor/patient/demo-practice-patient-ahmed');

    await expect(page.getByRole('heading', { name: 'Ahmed Trabelsi' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dossier médical protégé' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Demander l’accès/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Scanner un QR/i })).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath(`doctor-patient-locked-${testInfo.project.name}.png`),
      fullPage: true,
    });

    await page.getByRole('tab', { name: 'Consultations' }).click();
    await expect(page.getByRole('heading', { name: 'Historique des rendez-vous' })).toBeVisible();
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByRole('heading', { name: 'Documents cliniques protégés' })).toBeVisible();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByRole('heading', { name: 'Timeline administrative' })).toBeVisible();

    const detailText = await page.locator('.patient-detail').innerText();
    expect(detailText).not.toMatch(
      /allergie|diab[eè]te|diagnostic|prescription|traitement|groupe sanguin/i,
    );

    const accessibility = await new AxeBuilder({ page })
      .include('.patient-detail')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });
});
