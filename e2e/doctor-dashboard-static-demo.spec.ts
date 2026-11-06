import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function openDoctorDashboard(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page
    .locator('button.demo-workspace')
    .filter({ hasText: /^Independent practiceDoctor/ })
    .click();
  await expect(page).toHaveURL(/\/doctor\/command$/);
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();
}

test.describe('static-demo Doctor Accueil', () => {
  test('renders the approved dashboard responsively without accessibility regressions', async ({
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
      if (!url.startsWith('http://127.0.0.1:4200/')) {
        externalRequests.push(url);
      }
      if (new URL(url).pathname.startsWith('/api/v1/')) backendRequests.push(url);
    });
    page.on('websocket', (socket) => {
      const url = new URL(socket.url());
      const isAngularReloadSocket =
        url.hostname === '127.0.0.1' &&
        url.port === '4200' &&
        url.pathname === '/' &&
        url.searchParams.has('token');
      if (!isAngularReloadSocket) applicationWebSockets.push(socket.url());
    });

    await openDoctorDashboard(page);

    await expect(page.locator('.appointment-row')).toHaveCount(6);
    await expect(page.getByRole('heading', { name: 'À faire' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Consultation en cours' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Planning à jour' })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const accessibility = await new AxeBuilder({ page })
      .include('.demo-dashboard')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(backendRequests).toEqual([]);
    expect(applicationWebSockets).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`doctor-dashboard-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('keeps dashboard actions on the existing Doctor workflows', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Interaction paths are certified once on desktop.',
    );
    await openDoctorDashboard(page);

    await page.getByRole('link', { name: /10:45, Julie Moreau/ }).click();
    await expect(page).toHaveURL(/\/doctor\/calendar\?appointmentId=demo-appointment-julie$/);
    await page.goBack();

    await page.getByRole('link', { name: /Claire Bernard/ }).click();
    await expect(page).toHaveURL(/\/doctor\/requests\?requestId=demo-request-claire$/);
    await page.goBack();

    await page.getByRole('link', { name: 'Continuer la consultation' }).click();
    await expect(page).toHaveURL(/\/doctor\/consultation\/11111111-1111-4111-8111-111111111111$/);
    await page.goBack();

    await page.getByRole('link', { name: 'Voir les détails' }).click();
    await expect(page).toHaveURL(/\/doctor\/calendar\?appointmentId=demo-appointment-marc$/);
    await page.goBack();

    await page.getByRole('link', { name: 'Gérer mes disponibilités' }).click();
    await expect(page).toHaveURL(/\/doctor\/settings\?tab=schedule$/);
  });

  test('captures the approved collapsed and mobile navigation states', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'tablet',
      'The expanded tablet state is covered by the responsive screenshot.',
    );
    await openDoctorDashboard(page);

    if (testInfo.project.name === 'mobile') {
      const menu = page.getByRole('button', { name: 'Ouvrir la navigation' });
      await menu.click();
      await expect(page.getByRole('heading', { name: 'Navigation' })).toBeVisible();
      await expect(page.locator('.oc-sheet').getByText('Dr Ben Salah', { exact: true })).toBeVisible();
      const accessibility = await new AxeBuilder({ page })
        .include('.oc-sheet')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath('doctor-sidebar-static-mobile-open.png'),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Navigation' })).toBeHidden();
      await expect(menu).toBeFocused();
      return;
    }

    const sidebar = page.locator('app-doctor-sidebar.doctor-shell__desktop-sidebar');
    await sidebar.getByRole('button', { name: 'Réduire la navigation' }).click();
    await expect(sidebar.locator('.doctor-sidebar')).toHaveCSS('width', '80px');
    await page.screenshot({
      path: testInfo.outputPath('doctor-sidebar-static-desktop-collapsed.png'),
      fullPage: true,
    });
  });
});
