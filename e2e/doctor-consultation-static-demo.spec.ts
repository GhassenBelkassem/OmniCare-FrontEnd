import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function openConsultation(page: import('@playwright/test').Page, query = ''): Promise<void> {
  await page.goto('/login');
  await page.locator('button.demo-workspace').filter({ hasText: /^Independent practiceDoctor/ }).click();
  await expect(page).toHaveURL(/\/doctor\/command$/);
  await page.goto(`/doctor/consultation/demo-youssef-mansour${query}`);
  await expect(page.getByRole('heading', { name: 'Consultation', exact: true })).toBeVisible();
}

test.describe('static-demo Doctor tabbed consultation workspace', () => {
  test('renders one domain at a time without backend traffic', async ({ page }, testInfo) => {
    const browserErrors: string[] = [];
    const backendRequests: string[] = [];
    const externalRequests: string[] = [];
    const applicationWebSockets: string[] = [];

    page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://127.0.0.1:4200/')) externalRequests.push(url);
      if (new URL(url).pathname.startsWith('/api/v1/')) backendRequests.push(url);
    });
    page.on('websocket', (socket) => {
      const url = new URL(socket.url());
      const angularReloadSocket = url.hostname === '127.0.0.1' && url.port === '4200' && url.pathname === '/' && url.searchParams.has('token');
      if (!angularReloadSocket) applicationWebSockets.push(socket.url());
    });

    if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 1536, height: 1024 });
    await openConsultation(page);

    await expect(page.getByRole('heading', { name: 'Youssef Mansour' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Note clinique' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Constantes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dossier médical' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aperçu PDF' })).toBeDisabled();

    await page.screenshot({ path: testInfo.outputPath(`doctor-consultation-tabs-${testInfo.project.name}.png`), fullPage: false });

    await page.getByRole('tab', { name: 'Constantes' }).click();
    await expect(page.getByRole('heading', { name: 'Constantes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Note clinique' })).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    const accessibility = await new AxeBuilder({ page }).include('.consultation-demo').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(backendRequests).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(applicationWebSockets).toEqual([]);

  });

  test('preserves unsaved drafts and supports keyboard tabs and explicit saves', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Keyboard workflow is certified once.');
    await openConsultation(page);

    const complaint = page.locator('input[name="chiefComplaint"]');
    await complaint.fill('Brouillon conservé entre les onglets');
    await expect(page.getByRole('tab', { name: /Note clinique Modifié/ })).toBeVisible();
    await page.getByRole('tab', { name: 'Constantes' }).click();
    await page.locator('input[name="heartRate"]').fill('76');
    await expect(page.getByRole('tab', { name: /Constantes Modifié/ })).toBeVisible();
    await page.getByRole('tab', { name: /Note clinique Modifié/ }).click();
    await expect(complaint).toHaveValue('Brouillon conservé entre les onglets');

    await page.keyboard.press('Control+s');
    await expect(page.getByText('Brouillon enregistré localement pour cet onglet. Aucun envoi réseau.')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Note clinique', exact: true })).toBeVisible();

    const noteTab = page.getByRole('tab', { name: 'Note clinique', exact: true });
    await noteTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: 'Constantes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Constantes Modifié/ })).toBeFocused();
  });

  test('keeps domain dependencies and finalisation independent', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Domain workflow is certified once.');
    await openConsultation(page);

    await page.getByRole('tab', { name: 'Prescription' }).click();
    await page.getByRole('button', { name: 'Ajouter un médicament' }).click();
    await expect(page.getByRole('tab', { name: /Prescription Modifié/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Signer' })).toBeDisabled();
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await page.getByRole('tab', { name: 'Ordres cliniques' }).click();
    await page.locator('input[name="orderRequest"]').fill('NFS');
    await page.getByRole('button', { name: 'Ajouter au brouillon' }).click();
    await expect(page.getByText('NFS', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await page.getByRole('tab', { name: 'Documents' }).click();
    await page.getByRole('button', { name: 'Certificat médical' }).click();

    await page.getByRole('tab', { name: 'Finalisation' }).click();
    await expect(page.getByText('Constantes')).toBeVisible();
    await expect(page.getByText('Non enregistré')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terminer la consultation' }).last()).toBeDisabled();
  });

  for (const state of ['ACTIVE', 'NONE', 'EXPIRED', 'REVOKED', 'UNAVAILABLE'] as const) {
    test(`respects MRS ${state} in the medical-record drawer`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'MRS state matrix is certified once.');
      await openConsultation(page, `?mrs=${state}`);
      await page.getByRole('button', { name: 'Dossier médical' }).click();
      await expect(page.getByRole('dialog', { name: 'Dossier médical' })).toBeVisible();
      if (state === 'ACTIVE') {
        await expect(page.getByText('Accès MRS actif')).toBeVisible();
        await expect(page.getByText('Consultations récentes')).toBeVisible();
      } else {
        await expect(page.getByText('Consultations récentes')).toHaveCount(0);
        await expect(page.getByText('Aucune information clinique historique n’est rendue.')).toBeVisible();
      }
    });
  }
});
