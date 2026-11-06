import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const now = '2026-11-06T09:00:00.000Z';
const consultationId = '11111111-1111-4111-8111-111111111111';

const appointment = {
  id: 'appointment-legacy-1',
  doctorId: 'e2e-doctor',
  patientId: 'patient-1',
  patientName: 'Nadia Ben Ali',
  startTime: '2026-11-06T09:30:00.000Z',
  endTime: '2026-11-06T10:00:00.000Z',
  status: 'IN_PROGRESS',
  source: 'WEB',
  notes: 'Consultation de suivi',
  quotedPriceTnd: 80,
  startedAt: '2026-11-06T09:35:00.000Z',
  completedAt: null,
  createdAt: '2026-11-01T08:00:00.000Z',
};

const pendingRequestItem = {
  resourceType: 'BOOKING_REQUEST',
  requestId: 'request-1',
  appointmentId: null,
  sourceBookingRequestId: null,
  version: 3,
  status: 'PENDING_DOCTOR',
  doctor: { displayName: 'Dr Ben Salah', specialty: 'Médecine générale' },
  subject: { subjectType: 'SELF', displayName: 'Claire Bernard', relationship: 'Patiente' },
  cabinet: {
    name: 'Cabinet Les Berges',
    address: '1 rue du Lac',
    city: 'Tunis',
    governorate: 'Tunis',
    timezone: 'Africa/Tunis',
  },
  start: '2026-11-07T09:00:00.000Z',
  end: '2026-11-07T09:30:00.000Z',
  timezone: 'Africa/Tunis',
  responseDeadline: '2026-11-06T18:00:00.000Z',
  cancellation: null,
  intakeStatus: null,
  availableActions: ['ACCEPT_REQUEST', 'PROPOSE_NEW_TIME', 'DECLINE_REQUEST'],
  sortAt: '2026-11-07T09:00:00.000Z',
  updatedAt: now,
};

const nextAppointmentItem = {
  resourceType: 'APPOINTMENT',
  requestId: null,
  appointmentId: 'appointment-2',
  sourceBookingRequestId: 'request-2',
  version: 4,
  status: 'CONFIRMED',
  doctor: { displayName: 'Dr Ben Salah', specialty: 'Médecine générale' },
  subject: { subjectType: 'SELF', displayName: 'Marc Legrand', relationship: 'Patient' },
  cabinet: {
    name: 'Cabinet Les Berges',
    address: '1 rue du Lac',
    city: 'Tunis',
    governorate: 'Tunis',
    timezone: 'Africa/Tunis',
  },
  start: '2026-11-06T14:30:00.000Z',
  end: '2026-11-06T15:00:00.000Z',
  timezone: 'Africa/Tunis',
  responseDeadline: null,
  cancellation: null,
  intakeStatus: null,
  availableActions: ['CANCEL_APPOINTMENT'],
  sortAt: '2026-11-06T14:30:00.000Z',
  updatedAt: now,
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function prepareCommandCenter(
  page: Page,
  options: { readonly retryFailures?: boolean } = {},
): Promise<Set<string>> {
  const calls = new Set<string>();
  let statsAttempts = 0;
  let homeAttempts = 0;

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
        user: { id: 'e2e-doctor', role: 'DOCTOR', mustChangePassword: false },
      });
    }
    if (pathname.endsWith('/notifications/unread-count')) return json(route, 200, { unreadCount: 0 });
    if (pathname.endsWith('/doctor/consultations/active')) {
      return json(
        route,
        200,
        options.retryFailures
          ? null
          : {
              consultationId,
              sourceType: 'SCHEDULED_APPOINTMENT',
              sourceId: 'appointment-legacy-1',
              status: 'IN_PROGRESS',
              medicalAccessStatus: 'NONE',
              version: 2,
              startedAt: '2026-11-06T09:35:00.000Z',
            },
      );
    }
    if (pathname.endsWith('/me/urgent-cabinet/commitments')) return json(route, 200, []);
    if (pathname.endsWith('/appointments/stats/today')) {
      statsAttempts += 1;
      if (options.retryFailures && statsAttempts === 1) return json(route, 503, {});
      return json(route, 200, {
        consultations: 1,
        upcoming: 1,
        finished: 0,
        urgentRequests: 0,
      });
    }
    if (pathname.endsWith('/appointments/availability/rules')) {
      return json(route, 200, [
        {
          dayOfWeek: 'FRIDAY',
          active: true,
          startTime: '08:00',
          endTime: '17:00',
          pauseStart: null,
          pauseEnd: null,
          slotDurationMinutes: 30,
        },
      ]);
    }
    if (pathname.endsWith('/appointments')) return json(route, 200, [appointment]);
    if (pathname.endsWith('/doctor/scheduled-care/home-summary')) {
      homeAttempts += 1;
      if (options.retryFailures && homeAttempts === 1) return json(route, 503, {});
      return json(route, 200, {
        generatedAt: now,
        pendingRequestCount: 1,
        nextPendingRequest: pendingRequestItem,
        nextConfirmedAppointment: options.retryFailures ? null : nextAppointmentItem,
      });
    }
    return json(route, 200, {});
  });

  return calls;
}

test.describe('production Doctor Accueil', () => {
  test('renders API-backed presentation at the approved responsive sizes', async ({ page }, testInfo) => {
    const calls = await prepareCommandCenter(page);
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await page.goto('/doctor/command');
    await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();
    await expect(page.getByText('Nadia Ben Ali', { exact: true })).toBeVisible();
    await expect(page.getByText('Claire Bernard', { exact: true })).toBeVisible();
    await expect(page.getByText('Marc Legrand', { exact: true })).toBeVisible();
    await expect(page.getByText('Motif non renseigné', { exact: true })).toBeVisible();
    await expect(page.getByText('Salle non renseignée', { exact: true })).toBeVisible();
    await expect(page.getByText('Non disponibles dans la projection active autorisée.')).toBeVisible();

    expect(calls).toContain('GET /api/v1/appointments');
    expect(calls).toContain('GET /api/v1/appointments/stats/today');
    expect(calls).toContain('GET /api/v1/appointments/availability/rules');
    expect(calls).toContain('GET /api/v1/doctor/scheduled-care/home-summary');
    expect(calls).toContain('GET /api/v1/doctor/consultations/active');
    expect(calls).toContain('GET /api/v1/me/urgent-cabinet/commitments');

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    const accessibility = await new AxeBuilder({ page })
      .include('.demo-dashboard')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      browserErrors.filter((message) => !message.includes("WebSocket connection to 'ws://localhost:8080")),
    ).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`doctor-command-production-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('preserves detail, navigation, empty, error, and retry outcomes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Interaction paths are certified once on desktop.');
    await prepareCommandCenter(page, { retryFailures: true });
    await page.goto('/doctor/command');

    const dayRetry = page.locator('.today-panel').getByRole('button', { name: 'Réessayer' });
    const scheduledRetry = page.locator('.tasks-panel').getByRole('button', { name: 'Réessayer' });
    await expect(dayRetry).toBeVisible();
    await expect(scheduledRetry).toBeVisible();
    await dayRetry.click();
    await expect(page.getByText('Nadia Ben Ali', { exact: true })).toBeVisible();
    await scheduledRetry.click();
    await expect(page.getByText('Claire Bernard', { exact: true })).toBeVisible();
    await expect(page.getByText('Aucune consultation en cours', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: /Nadia Ben Ali/ }).click();
    await expect(page.getByText('Détails du rendez-vous', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fermer' }).click();

    await page.getByRole('link', { name: 'Gérer mes disponibilités' }).click();
    await expect(page).toHaveURL(/\/doctor\/settings\?tab=schedule$/);
  });
});
