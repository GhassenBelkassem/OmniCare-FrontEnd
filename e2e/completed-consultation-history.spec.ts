import { expect, test, type Page, type Route } from '@playwright/test';

const consultationId = '7b54cf2f-3cad-4fe4-b2a6-8a5b9fa8d9a1';
const completedAt = '2026-10-27T10:00:00.000Z';

const completedConsultation = {
  consultationId,
  patient: { displayName: 'Nadia Ben Ali', relationship: null },
  sourceType: 'SCHEDULED_APPOINTMENT',
  sourceId: 'appointment-p5-13',
  status: 'COMPLETED',
  medicalAccessStatus: 'EXPIRED',
  startedAt: '2026-10-22T09:00:00.000Z',
  completedAt,
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function prepareCompletedHistory(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    sessionStorage.setItem(
      'omnicare.dashboard.session',
      JSON.stringify({
        accessToken: 'e2e-access-token',
        tokenType: 'Bearer',
        expiresAt: expiry,
        refreshToken: 'e2e-refresh-token',
        refreshExpiresAt: expiry,
        user: { id: 'e2e-doctor', role: 'DOCTOR', mustChangePassword: false },
      }),
    );
  });

  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
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
    if (pathname.endsWith('/doctor/consultations/active')) return json(route, 404, {});
    if (pathname.endsWith('/appointments/stats/today')) {
      return json(route, 200, { consultations: 0, upcoming: 0, finished: 0, urgentRequests: 0 });
    }
    if (pathname.endsWith('/appointments/availability/rules')) {
      return json(route, 200, [{
        dayOfWeek: 'TUESDAY', active: true, startTime: '08:00', endTime: '17:00',
        pauseStart: null, pauseEnd: null, slotDurationMinutes: 30,
      }]);
    }
    if (pathname.endsWith('/appointments')) return json(route, 200, []);
    if (pathname.endsWith('/doctor/scheduled-care/home-summary')) {
      return json(route, 200, {
        generatedAt: completedAt,
        pendingRequestCount: 0,
        nextPendingRequest: null,
        nextConfirmedAppointment: null,
      });
    }
    if (pathname === '/api/v1/doctor/consultations/completed') {
      return json(route, 200, [completedConsultation]);
    }
    if (pathname === `/api/v1/doctor/consultations/completed/${consultationId}`) {
      return json(route, 200, {
        consultation: completedConsultation,
        historicalMedicalAccessStatus: 'NOT_AUTHORIZED',
        artifactStatusAvailable: true,
        artifacts: [{
          artifactId: 'artifact-p5-13',
          artifactType: 'PRESCRIPTION',
          artifactVersion: 1,
          status: 'FINALIZED',
          renderStatus: 'READY',
          renderVersion: 1,
          createdAt: '2026-10-22T09:30:00.000Z',
          updatedAt: completedAt,
        }],
      });
    }
    return json(route, 200, {});
  });
}

test('doctor discovers a completed consultation from the dashboard and opens read-only detail', async ({ page }) => {
  await prepareCompletedHistory(page);
  await page.goto('/doctor/command');

  const completedMetric = page.getByRole('link', {
    name: 'Terminees : 0. Ouvrir l’historique',
  });
  await expect(completedMetric).toBeVisible();
  await completedMetric.click();

  await expect(page).toHaveURL(/\/doctor\/history$/);
  await expect(page.getByRole('heading', { name: 'Consultations terminées' })).toBeVisible();
  const consultationLink = page.getByRole('link', { name: /Nadia Ben Ali/ });
  await expect(consultationLink).toContainText('Terminée');
  await consultationLink.click();

  await expect(page).toHaveURL(new RegExp(`/doctor/history/${consultationId}$`));
  await expect(page.getByRole('heading', { name: 'Consultation terminée' })).toBeVisible();
  await expect(page.getByText('Expiré', { exact: true })).toBeVisible();
  await expect(page.getByText('Dossier médical historique non autorisé')).toBeVisible();
  await expect(page.getByText('Ordonnance', { exact: true })).toBeVisible();
  await expect(page.getByText('Prêt', { exact: true })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /enregistrer|finaliser|terminer/i })).toHaveCount(0);
  await expect(page.getByText(/storage|mrs patient|grant/i)).toHaveCount(0);
});
