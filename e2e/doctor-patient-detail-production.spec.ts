import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const amira = {
  id: 'patient-amira',
  doctorId: 'e2e-doctor',
  firstName: 'Amira',
  lastName: 'Ben Salah',
  dateOfBirth: '1985-03-12',
  sex: 'F',
  phone: '+216 20 000 303',
  email: 'amira.bensalah@example.test',
  address: '42 rue Habib-Bourguiba, Tunis 1000',
  source: 'OMNICARE',
  linkedOmniCareUserId: 'user-amira',
  mrsPatientId: 'mrs-must-never-render',
  mrsProvisioned: true,
  possibleOmniCareMatch: false,
  createdAt: '2024-02-12T09:00:00.000Z',
  updatedAt: '2026-10-20T09:00:00.000Z',
};

const leila = {
  ...amira,
  id: 'patient-leila',
  firstName: 'Leila',
  lastName: 'Mansouri',
  phone: '+216 55 802 114',
  linkedOmniCareUserId: null,
  mrsPatientId: null,
  mrsProvisioned: false,
  possibleOmniCareMatch: true,
  source: 'IMPORTED',
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function preparePatientDetail(page: Page): Promise<{ readonly calls: string[] }> {
  const calls: string[] = [];
  let retryAttempts = 0;

  await page.addInitScript(() => {
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    sessionStorage.setItem(
      'omnicare.dashboard.session',
      JSON.stringify({
        accessToken: crypto.randomUUID(),
        tokenType: 'Bearer',
        expiresAt: expiry,
        refreshToken: crypto.randomUUID(),
        refreshExpiresAt: expiry,
        user: { id: 'e2e-doctor', role: 'DOCTOR', mustChangePassword: false },
      }),
    );
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    calls.push(`${request.method()} ${pathname}`);

    if (pathname.endsWith('/auth/refresh')) {
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      return json(route, 200, {
        accessToken: 'e2e-access-token',
        tokenType: 'Bearer',
        expiresAt: expiry,
        refreshToken: 'e2e-refresh-token',
        refreshExpiresAt: expiry,
        user: { id: 'e2e-doctor', role: 'DOCTOR', mustChangePassword: false },
      });
    }
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
      return json(route, 200, { unreadCount: 0 });
    if (pathname.endsWith('/doctor/consultations/active')) return json(route, 200, null);

    if (pathname.endsWith('/patients/patient-amira')) return json(route, 200, amira);
    if (pathname.endsWith('/patients/patient-leila')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return json(route, 200, leila);
    }
    if (pathname.endsWith('/patients/missing-fields')) {
      return json(route, 200, {
        ...amira,
        id: 'missing-fields',
        firstName: '',
        lastName: '',
        dateOfBirth: null,
        sex: null,
        phone: '',
        email: null,
        address: null,
        source: 'MANUAL',
        linkedOmniCareUserId: null,
        possibleOmniCareMatch: false,
      });
    }
    if (pathname.endsWith('/patients/not-found')) return json(route, 404, {});
    if (pathname.endsWith('/patients/forbidden')) return json(route, 403, {});
    if (pathname.endsWith('/patients/retry')) {
      retryAttempts += 1;
      return retryAttempts === 1 ? json(route, 503, {}) : json(route, 200, amira);
    }
    return json(route, 200, {});
  });

  return { calls };
}

test.describe('production Doctor Patient Detail', () => {
  test('renders the approved locked UI from the authoritative administrative DTO', async ({
    page,
  }, testInfo) => {
    const { calls } = await preparePatientDetail(page);
    const browserErrors: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });

    await page.goto('/doctor/patient/patient-amira');
    await expect(page.getByRole('heading', { name: 'Amira Ben Salah' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dossier médical protégé' })).toBeVisible();
    await expect(page.getByText('+216 20 000 303', { exact: true })).toBeVisible();
    await expect(page.getByText('Lié à OmniCare', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Non disponible', { exact: true })).toBeVisible();
    await expect(page.getByText('mrs-must-never-render')).toHaveCount(0);
    await expect(
      page
        .locator('.patient-detail')
        .getByText(/allergie|diagnostic|médicament|prescription|groupe sanguin/i),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /demander.*accès|scanner.*qr/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /télécharger|partager/i })).toHaveCount(0);
    expect(calls.filter((call) => call.includes('/patients/patient-amira'))).toEqual([
      'GET /api/v1/patients/patient-amira',
    ]);
    expect(calls.some((call) => /mrs|medical-record|clinical/i.test(call))).toBe(false);

    await page.getByRole('tab', { name: 'Consultations' }).click();
    await expect(page.getByRole('heading', { name: 'Historique des rendez-vous' })).toBeVisible();
    await expect(
      page
        .getByRole('tabpanel', { name: 'consultations' })
        .getByText('Aucun rendez-vous enregistré.'),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByRole('heading', { name: 'Documents cliniques protégés' })).toBeVisible();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByRole('heading', { name: 'Timeline administrative' })).toBeVisible();

    const accessibility = await new AxeBuilder({ page })
      .include('.patient-detail')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    const horizontalDocumentScroll = await page.evaluate(() => {
      window.scrollTo({ left: 100, behavior: 'instant' });
      const scrollPosition = window.scrollX;
      window.scrollTo({ left: 0, behavior: 'instant' });
      return scrollPosition;
    });
    expect(horizontalDocumentScroll).toBe(0);
    expect(
      browserErrors.filter(
        (message) => !message.includes("WebSocket connection to 'ws://localhost:8080"),
      ),
    ).toEqual([]);

    await page.getByRole('tab', { name: 'Vue d’ensemble' }).click();
    await page.screenshot({
      path: testInfo.outputPath(`doctor-patient-detail-production-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('clears the previous patient while the reused route loads a new ID', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Route reuse is certified once on desktop.');
    await preparePatientDetail(page);
    await page.goto('/doctor/patient/patient-amira');
    await expect(page.getByRole('heading', { name: 'Amira Ben Salah' })).toBeVisible();

    await page.evaluate(() => {
      history.pushState({}, '', '/doctor/patient/patient-leila');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.getByRole('heading', { name: 'Chargement du patient' })).toBeVisible();
    await expect(page.getByText('Amira Ben Salah')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Leila Mansouri' })).toBeVisible();
    await expect(page.getByText('Amira Ben Salah')).toHaveCount(0);
  });

  test('preserves 404, 403, 500 retry and empty-field states without exposing a record', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Data states are certified once on desktop.');
    await preparePatientDetail(page);

    await page.goto('/doctor/patient/not-found');
    await expect(page.getByRole('heading', { name: 'Patient introuvable' })).toBeVisible();
    await expect(page.locator('main[role="tabpanel"]')).toHaveCount(0);

    await page.goto('/doctor/patient/forbidden');
    await expect(page.getByRole('heading', { name: 'Accès non autorisé' })).toBeVisible();
    await expect(page.locator('main[role="tabpanel"]')).toHaveCount(0);

    await page.goto('/doctor/patient/retry');
    await expect(
      page.getByRole('heading', { name: 'Impossible de charger le patient' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.getByRole('heading', { name: 'Amira Ben Salah' })).toBeVisible();

    await page.goto('/doctor/patient/missing-fields');
    await expect(page.getByRole('heading', { name: 'Patient sans nom' })).toBeVisible();
    await expect(page.getByText('Date de naissance non renseignée', { exact: true })).toBeVisible();
    await expect(page.getByText('Non lié', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Saisie manuelle', { exact: true })).toBeVisible();
  });
});
