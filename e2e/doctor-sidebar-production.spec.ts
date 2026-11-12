import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

type ShellRole = 'DOCTOR' | 'SECRETARY';
const consultationId = '11111111-1111-4111-8111-111111111111';

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function prepareShell(page: Page, role: ShellRole): Promise<Set<string>> {
  const calls = new Set<string>();
  await page.addInitScript((sessionRole: ShellRole) => {
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    sessionStorage.setItem(
      'omnicare.dashboard.session',
      JSON.stringify({
        accessToken: crypto.randomUUID(),
        tokenType: 'Bearer',
        expiresAt: expiry,
        refreshToken: crypto.randomUUID(),
        refreshExpiresAt: expiry,
        user: {
          id: `e2e-${sessionRole.toLocaleLowerCase()}`,
          role: sessionRole,
          mustChangePassword: false,
        },
      }),
    );
  }, role);

  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    calls.add(`${route.request().method()} ${pathname}`);
    if (pathname.endsWith('/auth/refresh')) {
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      return json(route, 200, {
        accessToken: 'e2e-access-token',
        tokenType: 'Bearer',
        expiresAt: expiry,
        refreshToken: 'e2e-refresh-token',
        refreshExpiresAt: expiry,
        user: { id: `e2e-${role.toLocaleLowerCase()}`, role, mustChangePassword: false },
      });
    }
    if (pathname.endsWith('/auth/logout')) return json(route, 204, null);
    if (pathname.endsWith('/me/professional-profile')) {
      return json(route, 200, {
        userId: 'e2e-doctor',
        firstName: 'Amina',
        lastName: 'Gharbi',
        displayName: 'Dr Amina Gharbi',
        photoUrl: null,
        professionalLicenseNumber: 'E2E-1',
        specialty: 'Cardiologie',
        governorate: 'Tunis',
        affiliatedClinicId: null,
        affiliatedClinicName: null,
        alsoIndependent: true,
        verifiedAt: '2026-01-01T00:00:00.000Z',
        mfaMethod: null,
        revision: 1,
      });
    }
    if (pathname.endsWith('/notifications/unread-count'))
      return json(route, 200, { unreadCount: 2 });
    if (pathname.endsWith('/notifications')) {
      return json(route, 200, {
        items: [],
        page: 0,
        pageSize: 20,
        totalElements: 0,
        unreadCount: 2,
      });
    }
    if (pathname.endsWith('/doctor/consultations/active')) {
      return json(route, 200, {
        consultationId,
        sourceType: 'SCHEDULED_APPOINTMENT',
        sourceId: 'appointment-1',
        status: 'IN_PROGRESS',
        medicalAccessStatus: 'NONE',
        version: 2,
        startedAt: '2026-11-06T09:30:00.000Z',
      });
    }
    if (pathname.endsWith('/me/urgent-cabinet/commitments')) return json(route, 200, []);
    if (pathname.endsWith('/appointments/stats/today')) {
      return json(route, 200, { consultations: 0, upcoming: 0, finished: 0, urgentRequests: 0 });
    }
    if (pathname.endsWith('/appointments/availability/rules')) return json(route, 200, []);
    if (pathname.endsWith('/appointments')) return json(route, 200, []);
    if (pathname.endsWith('/doctor/scheduled-care/home-summary')) {
      return json(route, 200, {
        generatedAt: '2026-11-06T09:00:00.000Z',
        pendingRequestCount: 0,
        nextPendingRequest: null,
        nextConfirmedAppointment: null,
      });
    }
    if (pathname.endsWith('/me/document-templates/field-catalog')) return json(route, 200, []);
    if (pathname.endsWith('/me/document-templates')) return json(route, 200, []);
    if (pathname.endsWith('/secretary/appointments')) {
      return json(route, 200, {
        items: [],
        page: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      });
    }
    return json(route, 200, {});
  });
  return calls;
}

test.describe('production Doctor sidebar and shell', () => {
  test('renders the approved Doctor presentation responsively with authoritative identity', async ({
    page,
  }, testInfo) => {
    const calls = await prepareShell(page, 'DOCTOR');
    await page.goto('/doctor/command');
    await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();

    if (testInfo.project.name === 'mobile') {
      await expect(page.locator('.doctor-shell__desktop-sidebar')).toBeHidden();
      const menu = page.getByRole('button', { name: 'Ouvrir la navigation' });
      await menu.click();
      const sheet = page.locator('.oc-sheet');
      await expect(page.getByRole('heading', { name: 'Navigation' })).toBeVisible();
      await expect(sheet.getByText('Dr Amina Gharbi', { exact: true })).toBeVisible();
      await expect(sheet.getByText('Cardiologie', { exact: true })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('doctor-sidebar-production-mobile-open.png'),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Navigation' })).toBeHidden();
      await expect(menu).toBeFocused();
    } else {
      const sidebar = page.locator('app-doctor-sidebar.doctor-shell__desktop-sidebar');
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByText('Dr Amina Gharbi', { exact: true })).toBeVisible();
      await expect(sidebar.getByText('Cardiologie', { exact: true })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: 'Accueil' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(sidebar.locator('.doctor-sidebar__badge')).toHaveCount(0);
      await expect(sidebar.getByRole('link', { name: 'Consultation', exact: true })).toHaveAttribute(
        'href',
        `/doctor/consultation/${consultationId}`,
      );
      await expect(sidebar.getByText('Suivi clinique')).toHaveCount(0);
      await expect(sidebar.getByRole('link', { name: 'Documents', exact: true })).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath(`doctor-sidebar-production-${testInfo.project.name}.png`),
        fullPage: true,
      });
    }

    expect(calls).toContain('GET /api/v1/me/professional-profile');
    expect(calls).toContain('GET /api/v1/notifications/unread-count');
    await expect(page.getByRole('button', { name: 'Rechercher un patient' })).toBeVisible();
    await expect(page.locator('.topbar__realtime')).toContainText('Connexion temps réel');
    const accessibility = await new AxeBuilder({ page })
      .include(testInfo.project.name === 'mobile' ? '.doctor-layout' : 'app-doctor-sidebar')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });

  test('keeps document templates reachable from settings and the direct route without a sidebar entry', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Documents reachability runs once.');
    await prepareShell(page, 'DOCTOR');
    await page.goto('/doctor/settings?tab=documents');

    const sidebar = page.locator('app-doctor-sidebar.doctor-shell__desktop-sidebar');
    await expect(sidebar.getByText('Suivi clinique')).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Documents', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Documents', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Documents & modèles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comment ça marche ?' })).toBeVisible();
    await expect(
      page.getByText(/testez le rendu avec des données de démonstration/i),
    ).toBeVisible();

    await page.goto('/doctor/documents');
    await expect(page.getByRole('heading', { name: 'Documents & modèles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aucun modèle configuré' })).toBeVisible();
    await expect(
      page.getByText(/prévisualisez le rendu avec des données de démonstration/i),
    ).toBeVisible();
    await expect(sidebar.getByText('Suivi clinique')).toHaveCount(0);
  });

  test('preserves collapse, focus, notifications, lookup and logout behavior', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop interaction certification runs once.');
    await prepareShell(page, 'DOCTOR');
    await page.goto('/doctor/command');
    const sidebar = page.locator('app-doctor-sidebar.doctor-shell__desktop-sidebar');

    const activeLink = sidebar.getByRole('link', { name: 'Accueil' });
    await activeLink.focus();
    expect(await activeLink.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
      'none',
    );
    const patientsLink = sidebar.getByRole('link', { name: 'Mes patients' });
    await patientsLink.hover();
    expect(
      await patientsLink.evaluate((element) => getComputedStyle(element).backgroundImage),
    ).not.toBe('none');

    const collapse = sidebar.getByRole('button', { name: 'Réduire la navigation' });
    await collapse.click();
    await expect(sidebar.locator('.doctor-sidebar')).toHaveClass(/doctor-sidebar--collapsed/);
    await expect(sidebar.locator('.doctor-sidebar')).toHaveCSS('width', '80px');
    await expect(sidebar.getByRole('button', { name: 'Se déconnecter' })).toHaveText('AG');
    await expect(sidebar.getByRole('button', { name: 'Développer la navigation' })).toBeVisible();
    expect(
      await sidebar
        .locator('.doctor-sidebar')
        .evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toContain('1e-05s');
    await page.screenshot({
      path: testInfo.outputPath('doctor-sidebar-production-desktop-collapsed.png'),
      fullPage: true,
    });
    await sidebar.getByRole('button', { name: 'Développer la navigation' }).click();

    const notifications = page.getByRole('button', { name: /Notifications, 2 non lues/ });
    await notifications.click();
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeHidden();

    const lookup = page.getByRole('button', { name: 'Rechercher un patient' });
    await lookup.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(lookup).toBeFocused();

    await sidebar.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('preserves the restricted Secretary shell and generic authorized identity', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Secretary role certification runs once.');
    const calls = await prepareShell(page, 'SECRETARY');
    await page.goto('/doctor/secretary-agenda');

    const sidebar = page.locator('app-doctor-sidebar.doctor-shell__desktop-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(sidebar.getByText('Secrétaire', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('Agenda du cabinet', { exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Rechercher un patient' })).toHaveCount(0);
    await expect(page.locator('.topbar__realtime')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Notifications/ })).toHaveCount(0);
    expect(calls).not.toContain('GET /api/v1/me/professional-profile');

    await page.screenshot({
      path: testInfo.outputPath('doctor-sidebar-secretary-desktop.png'),
      fullPage: true,
    });
    await sidebar.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
