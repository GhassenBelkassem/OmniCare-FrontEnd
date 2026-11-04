import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function openDoctorCalendar(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page
    .locator('button.demo-workspace')
    .filter({ hasText: /^Independent practiceDoctor/ })
    .click();
  await expect(page).toHaveURL(/\/doctor\/command$/);
  await page.goto('/doctor/calendar');
  await expect(page.getByRole('heading', { name: 'Octobre 2026' })).toBeVisible();
}

async function expectCalendarToolbarRegionsNotToOverlap(
  page: import('@playwright/test').Page,
): Promise<void> {
  const regions = [
    ['period', page.locator('.doctor-calendar-demo__period')],
    ['navigation', page.locator('.doctor-calendar-demo__navigation')],
    ['view switcher', page.locator('.doctor-calendar-demo__toolbar oc-segmented-control')],
    ['actions', page.locator('.doctor-calendar-demo__actions')],
  ] as const;
  const boxes = await Promise.all(
    regions.map(async ([name, locator]) => ({ name, box: await locator.boundingBox() })),
  );

  for (let index = 0; index < boxes.length; index += 1) {
    const current = boxes[index];
    expect(current.box, `${current.name} should be visible`).not.toBeNull();
    if (!current.box) continue;

    for (let comparison = index + 1; comparison < boxes.length; comparison += 1) {
      const other = boxes[comparison];
      expect(other.box, `${other.name} should be visible`).not.toBeNull();
      if (!other.box) continue;

      const overlapsHorizontally =
        current.box.x < other.box.x + other.box.width &&
        current.box.x + current.box.width > other.box.x;
      const overlapsVertically =
        current.box.y < other.box.y + other.box.height &&
        current.box.y + current.box.height > other.box.y;
      expect(
        overlapsHorizontally && overlapsVertically,
        `${current.name} should not overlap ${other.name}`,
      ).toBe(false);
    }
  }
}

test.describe('static-demo Doctor calendar', () => {
  test('renders month, week and day states with a safe appointment panel', async ({
    page,
  }, testInfo) => {
    const browserErrors: string[] = [];
    const backendRequests: string[] = [];
    const applicationWebSockets: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('ResizeObserver loop completed')) {
        browserErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      if (!error.message.includes('ResizeObserver loop completed'))
        browserErrors.push(error.message);
    });
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/'))
        backendRequests.push(request.url());
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
      await page.setViewportSize({ width: 1672, height: 941 });
    }
    await openDoctorCalendar(page);

    await expect(page.locator('.demo-calendar-view--dayGridMonth')).toBeVisible();
    await expect(page.getByText('Repos hebdomadaire').first()).toBeVisible();
    await expect(page.locator('.demo-calendar-day-cell--weekly-rest').first()).toHaveCSS(
      'background-color',
      /rgb/,
    );

    if (testInfo.project.name === 'desktop') {
      await page.screenshot({
        path: testInfo.outputPath('doctor-calendar-month-1672.png'),
        fullPage: true,
      });
    }

    await page.getByRole('button', { name: 'Semaine', exact: true }).click();
    await expect(page.getByRole('heading', { name: /26 oct.*1 nov.*2026/i })).toBeVisible();
    await expect(page.getByText('08:00 – 08:30', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('16:30 – 17:00', { exact: true }).first()).toBeVisible();
    await expectCalendarToolbarRegionsNotToOverlap(page);

    if (testInfo.project.name === 'desktop') {
      const hoverAppointment = page
        .locator('.demo-calendar-appointment')
        .filter({ hasText: 'Thomas Bernard' })
        .first();
      await hoverAppointment.hover();
      await expect(hoverAppointment).toHaveCSS('transform', /matrix/);
      await expect(hoverAppointment).not.toHaveCSS('box-shadow', 'none');
      await page.screenshot({
        path: testInfo.outputPath('doctor-calendar-week-hover-1672.png'),
        fullPage: true,
      });
    }

    const amiraWeek = page.locator('.demo-calendar-appointment').filter({ hasText: 'Amira Saidi' });
    await amiraWeek.click();
    await expect(page.getByRole('complementary', { name: 'Consultation' })).toBeVisible();
    await expect(page.getByText('Données fictives · aucune action serveur')).toBeVisible();
    await expect(amiraWeek.locator('.demo-event')).toHaveClass(/demo-event--selected/);

    if (testInfo.project.name === 'desktop') {
      await page.screenshot({
        path: testInfo.outputPath('doctor-calendar-week-drawer-1672.png'),
        fullPage: true,
      });
    }

    await page.getByRole('button', { name: 'Fermer le détail', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Consultation' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Jour', exact: true }).click();
    await expect(page.getByRole('heading', { name: '30 Octobre 2026' })).toBeVisible();
    await expect(page.getByText('8 rendez-vous')).toBeVisible();
    const amiraDay = page.locator('.demo-calendar-appointment').filter({ hasText: 'Amira Saidi' });
    await amiraDay.click();
    await expect(page.getByText('Consultation – Infection ORL')).toBeVisible();
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByText('Le dossier médical reste protégé.')).toBeVisible();
    await page.getByRole('tab', { name: 'Détails' }).click();

    if (testInfo.project.name === 'desktop') {
      await page.screenshot({
        path: testInfo.outputPath('doctor-calendar-day-drawer-1672.png'),
        fullPage: true,
      });
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const accessibility = await new AxeBuilder({ page })
      .include('.doctor-calendar-demo')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(backendRequests).toEqual([]);
    expect(applicationWebSockets).toEqual([]);
  });

  test('keeps schedule and exception changes local to the offline demo', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Demo dialog behavior is certified once.');
    await openDoctorCalendar(page);

    await page.getByRole('button', { name: 'Modifier les horaires' }).click();
    await expect(page.locator('nz-modal-container')).toBeVisible();
    await expect(page.getByText('Horaires de démonstration', { exact: true })).toBeVisible();
    await expect(page.getByText('Lundi – vendredi')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();

    await page.getByRole('button', { name: 'Exception', exact: true }).click();
    await expect(page.locator('nz-modal-container')).toBeVisible();
    await expect(page.getByText('Nouvelle exception', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter à la démo' }).click();
    await expect(page.locator('nz-modal-container')).toHaveCount(0);
  });

  test('keeps the week toolbar collision-free at a laptop viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The laptop breakpoint is certified once.');
    await page.setViewportSize({ width: 1280, height: 800 });
    await openDoctorCalendar(page);
    await page.getByRole('button', { name: 'Semaine', exact: true }).click();
    await expect(page.getByRole('heading', { name: /26 oct.*1 nov.*2026/i })).toBeVisible();
    await expectCalendarToolbarRegionsNotToOverlap(page);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath('doctor-calendar-week-toolbar-1280.png'),
      fullPage: true,
    });
  });
});
