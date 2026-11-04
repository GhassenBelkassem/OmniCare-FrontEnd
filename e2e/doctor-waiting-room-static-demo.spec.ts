import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function openWaitingRoom(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page
    .locator('button.demo-workspace')
    .filter({ hasText: /^Independent practiceDoctor/ })
    .click();
  await expect(page).toHaveURL(/\/doctor\/command$/);
  await page.evaluate(() => localStorage.removeItem('omnicare.static-demo.waiting-room.v2'));
  await page.goto('/doctor/waiting-room');
  await expect(page.getByRole('heading', { name: "Salle d'attente" })).toBeVisible();
}

test.describe('static-demo Doctor waiting room', () => {
  test('matches the approved dense table and safe patient drawer', async ({ page }, testInfo) => {
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

    if (testInfo.project.name === 'desktop') {
      await page.setViewportSize({ width: 1536, height: 1024 });
    }
    await openWaitingRoom(page);

    await expect(page.getByText('Démo locale')).toBeVisible();
    await expect(page.getByText(/Horloge simulée · 11:20/)).toBeVisible();
    await expect(page.getByText('À appeler ensuite')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Appeler le suivant' })).toBeEnabled();
    await expect(page.locator('.waiting-table tbody tr')).toHaveCount(7);
    await expect(page.getByRole('dialog', { name: 'Marie Dupont' })).toBeVisible();
    await expect(page.getByText('25 min', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Appeler ce patient' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reprogrammer' })).toHaveCount(0);

    const waitingRoomText = await page.locator('.waiting-room-demo').innerText();
    expect(waitingRoomText).not.toMatch(
      /diagnostic|allergie|prescription|traitement|résultat médical/i,
    );

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const accessibility = await new AxeBuilder({ page })
      .include('.waiting-room-demo')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(backendRequests).toEqual([]);
    expect(applicationWebSockets).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`doctor-waiting-room-${testInfo.project.name}.png`),
      fullPage: false,
    });
  });

  test('supports search, filters, sorting, pagination and empty state', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Table interactions are certified once.');
    await openWaitingRoom(page);
    await page.getByRole('button', { name: 'Fermer le détail du patient' }).last().click();

    const search = page.locator('input[name="waiting-room-search"]');
    await search.fill('Jean Martin');
    await expect(page).toHaveURL(/q=Jean(\+|%20)Martin/);
    await expect(page.locator('.waiting-table tbody tr')).toHaveCount(1);
    await expect(page.getByText('Jean Martin', { exact: true })).toBeVisible();

    await search.clear();
    await page.getByLabel('Filtrer par cabinet').selectOption('Cabinet annexe');
    await expect(page.locator('.waiting-table tbody tr')).toHaveCount(4);
    await page.getByLabel('Filtrer par type').selectOption('Suivi');
    await expect(page.locator('.waiting-table tbody tr')).toHaveCount(3);
    await page.getByLabel('Filtrer par statut').selectOption('NO_SHOW');
    await expect(page.locator('.waiting-table tbody tr')).toHaveCount(1);
    await expect(page.getByText('Emma Richard', { exact: true })).toBeVisible();

    await page.getByLabel('Filtrer par cabinet').selectOption('all');
    await page.getByLabel('Filtrer par type').selectOption('all');
    await page.getByLabel('Filtrer par statut').selectOption('all');
    await page.getByRole('button', { name: 'Patient', exact: true }).click();
    await expect(page.locator('.waiting-table tbody tr').first()).toContainText('Claire Bernard');

    await page.getByRole('button', { name: 'Rendez-vous', exact: true }).click();
    await page.getByRole('button', { name: 'Page 2' }).click();
    await expect(page.locator('.waiting-table tbody tr')).toHaveCount(3);
    await expect(page.getByText('Nadia Ferchichi', { exact: true })).toBeVisible();

    await search.fill('patient-introuvable-999');
    await expect(page.getByRole('heading', { name: 'Aucun patient trouvé' })).toBeVisible();
    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
    await expect(page.locator('.waiting-table tbody tr')).toHaveCount(7);
  });

  test('supports keyboard drawer behavior and explicit safe demo transitions', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Drawer transitions are certified once.');
    const backendRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/')) backendRequests.push(request.url());
    });
    await openWaitingRoom(page);
    await page.getByRole('button', { name: 'Fermer le détail du patient' }).last().click();

    const pierreRow = page.locator('.waiting-table tbody tr').filter({ hasText: 'Pierre Moreau' });
    await pierreRow.click();
    await page.getByRole('button', { name: 'Continuer la consultation' }).click();
    await expect(page).toHaveURL(/\/doctor\/consultation\/waiting-room-demo-waiting-pierre/);
    await expect(page.getByRole('heading', { name: 'Consultation', exact: true })).toBeVisible();

    await page.goto('/doctor/waiting-room');
    await page.getByRole('button', { name: 'Fermer le détail du patient' }).last().click();
    const lucasRow = page.locator('.waiting-table tbody tr').filter({ hasText: 'Lucas Petit' });
    await lucasRow.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Lucas Petit' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Lucas Petit' })).toHaveCount(0);
    await expect(lucasRow).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Marquer arrivé' }).click();
    await expect(page.getByRole('dialog', { name: 'Lucas Petit' })).toContainText('En attente');
    await page.getByRole('button', { name: 'Appeler ce patient' }).click();
    await expect(page.getByRole('dialog', { name: 'Lucas Petit' })).toContainText('Appelé');
    await expect(page.getByRole('button', { name: 'Démarrer la consultation' })).toBeDisabled();
    await expect(page.getByText(/Consultation déjà active avec Pierre Moreau/)).toBeVisible();

    await page.getByRole('button', { name: 'Fermer le détail du patient' }).last().click();
    await pierreRow.click();
    await page.getByRole('button', { name: 'Terminer' }).click();
    await expect(page.getByRole('dialog', { name: 'Terminer la consultation' })).toBeVisible();
    await page.getByRole('button', { name: 'Terminer', exact: true }).last().click();
    await expect(page.getByRole('dialog', { name: 'Pierre Moreau' })).toContainText('Terminé');

    await page.getByRole('button', { name: 'Fermer le détail du patient' }).last().click();
    await lucasRow.click();
    await page.getByRole('button', { name: 'Démarrer la consultation' }).click();
    await expect(page).toHaveURL(/\/doctor\/consultation\/waiting-room-demo-waiting-lucas/);
    await expect(page.getByRole('heading', { name: 'Consultation', exact: true })).toBeVisible();

    await page.goto('/doctor/waiting-room');
    await page.getByRole('button', { name: 'Fermer le détail du patient' }).last().click();
    const nadiaRow = page.locator('.waiting-table tbody tr').filter({ hasText: 'Nadia Ferchichi' });
    await page.getByRole('button', { name: 'Page 2' }).click();
    await nadiaRow.click();
    await page.getByRole('button', { name: 'Signaler non présenté' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirmer la non-présentation' })).toBeVisible();
    await page.getByRole('button', { name: 'Signaler non présenté' }).last().click();
    await expect(page.getByRole('dialog', { name: 'Nadia Ferchichi' })).toContainText(
      'Non présenté',
    );
    await expect(page.locator('.waiting-patient-panel__footer')).toContainText(
      'aucune action automatique',
    );
    expect(backendRequests).toEqual([]);
  });

  test('adds a walk-in, persists it across refresh, and resets the demo', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Persistence flow is certified once.');
    await openWaitingRoom(page);
    await page.getByRole('button', { name: 'Patient sans rendez-vous' }).click();
    await expect(page.getByRole('dialog', { name: 'Ajouter un patient sans rendez-vous' })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter à la file' }).click();
    await expect(page.locator('.waiting-room-feedback')).toContainText(/Amira Ben Salah a été ajouté/);
    await page.reload();
    await page.locator('input[name="waiting-room-search"]').fill('Amira Ben Salah');
    await expect(page.locator('.waiting-table tbody tr')).toContainText('Sans RDV');

    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(page.getByRole('dialog', { name: 'Réinitialiser la démonstration' })).toBeVisible();
    await page.getByRole('button', { name: 'Réinitialiser', exact: true }).last().click();
    await expect(page.locator('.waiting-room-feedback')).toContainText(/réinitialisée/);
    await expect(page.getByText('Amira Ben Salah', { exact: true })).toHaveCount(0);
  });
});
