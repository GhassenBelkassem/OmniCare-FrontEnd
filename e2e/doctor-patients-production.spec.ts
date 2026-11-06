import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

interface PatientsFixtureOptions {
  readonly failFirstList?: boolean;
  readonly delayFirstList?: boolean;
}

const ahmed = {
  id: 'practice-patient-ahmed',
  doctorId: 'e2e-doctor',
  firstName: 'Ahmed',
  lastName: 'Ben Salah',
  dateOfBirth: '1990-04-12',
  sex: 'M',
  phone: '+216 71 234 567',
  email: null,
  address: 'Tunis',
  source: 'MANUAL',
  linkedOmniCareUserId: null,
  mrsPatientId: null,
  mrsProvisioned: false,
  possibleOmniCareMatch: false,
  createdAt: '2026-08-21T09:00:00.000Z',
  updatedAt: '2026-08-21T09:00:00.000Z',
};

const fatma = {
  ...ahmed,
  id: 'practice-patient-fatma',
  firstName: 'Fatma',
  lastName: 'Trabelsi',
  dateOfBirth: '1985-02-20',
  sex: 'F',
  phone: '+216 22 410 520',
  email: 'fatma.trabelsi@example.test',
  source: 'OMNICARE',
  linkedOmniCareUserId: 'omnicare-user-fatma',
};

const pageBody = (content: readonly unknown[], totalElements: number, page: number) => ({
  content,
  totalElements,
  totalPages: Math.ceil(totalElements / 20),
  size: 20,
  number: page,
  first: page === 0,
  last: page + 1 >= Math.ceil(totalElements / 20),
  empty: content.length === 0,
});

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function preparePatients(
  page: Page,
  options: PatientsFixtureOptions = {},
): Promise<{ readonly calls: string[]; readonly creates: unknown[] }> {
  const calls: string[] = [];
  const creates: unknown[] = [];
  let listAttempts = 0;

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
    calls.push(`${request.method()} ${pathname}${url.search}`);

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
    if (pathname.endsWith('/patients') && request.method() === 'POST') {
      const body = request.postDataJSON();
      creates.push(body);
      if (body.phone === '+216 99 000 000') {
        return json(route, 409, { existingPatientId: 'practice-patient-existing' });
      }
      return json(route, 201, {
        ...ahmed,
        ...body,
        id: 'practice-patient-created',
        possibleOmniCareMatch: body.phone === '+216 21 555 404',
      });
    }
    if (pathname.endsWith('/patients') && request.method() === 'GET') {
      listAttempts += 1;
      if (options.failFirstList && listAttempts === 1) return json(route, 503, {});
      if (options.delayFirstList && listAttempts === 1) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      const query = url.searchParams.get('query');
      const filter = url.searchParams.get('filter');
      const pageNumber = Number(url.searchParams.get('page') ?? '0');
      if (query === 'introuvable') return json(route, 200, pageBody([], 0, pageNumber));
      if (query) return json(route, 200, pageBody([fatma], 1, pageNumber));
      if (pageNumber === 1) {
        return json(
          route,
          200,
          pageBody([{ ...ahmed, id: 'practice-patient-page-2', lastName: 'Mansour' }], 42, 1),
        );
      }
      if (filter === 'LINKED') return json(route, 200, pageBody([fatma], 21, 0));
      if (filter === 'EXTERNAL') return json(route, 200, pageBody([ahmed], 21, 0));
      return json(route, 200, pageBody([ahmed, fatma], 42, 0));
    }
    return json(route, 200, {});
  });

  return { calls, creates };
}

test.describe('production Doctor Mes patients', () => {
  test('renders the approved administrative directory with authoritative DTO fields', async ({
    page,
  }, testInfo) => {
    const { calls } = await preparePatients(page);
    const browserErrors: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });

    await page.goto('/doctor/patients');
    await expect(page.getByRole('heading', { name: 'Mes patients' })).toBeVisible();
    await expect(page.getByText('42 patients', { exact: true })).toBeVisible();
    await expect(page.getByText('Ben Salah Ahmed', { exact: true })).toBeVisible();
    await expect(page.getByText('Trabelsi Fatma', { exact: true })).toBeVisible();
    await expect(page.getByText('Lié à OmniCare', { exact: true })).toBeVisible();
    await expect(page.getByText('Correspondance possible')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Plus de filtres' })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Patient', exact: true })).toHaveCount(0);
    await expect(page.getByText('WALK_IN')).toHaveCount(0);
    await expect(page.getByText(/assurance|consultation le|diagnostic/i)).toHaveCount(0);
    await expect(page.getByLabel('Dernière consultation non disponible')).toHaveCount(2);
    await expect(page.getByLabel('Aucun prochain rendez-vous disponible')).toHaveCount(2);
    expect(calls).toContain('GET /api/v1/patients?filter=ALL&page=0&size=20');

    const accessibility = await new AxeBuilder({ page })
      .include('.patient-directory')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    const overflowSources = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => {
          const style = getComputedStyle(element);
          return element.scrollWidth > element.clientWidth + 1 && style.overflowX === 'visible';
        })
        .slice(0, 12)
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
    );
    expect(overflowSources).toEqual([]);
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

    await page.screenshot({
      path: testInfo.outputPath(`doctor-patients-production-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('preserves server search, filter reset, pagination and real-id navigation', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'Interaction paths are certified once on desktop.',
    );
    const { calls } = await preparePatients(page);
    await page.goto('/doctor/patients');
    await expect(page.getByText('42 patients', { exact: true })).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Rechercher un patient' });
    await search.fill('Trabelsi');
    await expect(page.getByText('1 résultats', { exact: true })).toBeVisible();
    expect(calls.some((call) => call.includes('query=Trabelsi') && call.includes('page=0'))).toBe(
      true,
    );

    await search.clear();
    await expect(page.getByText('42 patients', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Liés à OmniCare' }).click();
    await expect(page.getByText('21 patients', { exact: true })).toBeVisible();
    expect(calls.some((call) => call.includes('filter=LINKED') && call.includes('page=0'))).toBe(
      true,
    );

    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(page.getByText('42 patients', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Page 2', exact: true }).click();
    await expect(page.getByText('Mansour Ahmed', { exact: true })).toBeVisible();
    expect(calls.some((call) => call.includes('filter=ALL') && call.includes('page=1'))).toBe(true);

    const patientLink = page.getByRole('link', { name: /Mansour Ahmed/ }).first();
    await expect(patientLink).toHaveAttribute('href', '/doctor/patient/practice-patient-page-2');
    await patientLink.click();
    await expect(page).toHaveURL(/\/doctor\/patient\/practice-patient-page-2$/);
  });

  test('preserves loading, empty, error and retry states', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Data states are certified once on desktop.');
    await preparePatients(page, { failFirstList: true });
    await page.goto('/doctor/patients');
    await expect(
      page.getByRole('heading', { name: 'Impossible de charger les patients' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.getByText('42 patients', { exact: true })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Rechercher un patient' }).fill('introuvable');
    await expect(page.getByRole('heading', { name: 'Aucun patient trouvé' })).toBeVisible();

    const loadingPage = await page.context().newPage();
    await preparePatients(loadingPage, { delayFirstList: true });
    await loadingPage.goto('/doctor/patients');
    await expect(
      loadingPage.getByRole('heading', { name: 'Chargement des patients…' }),
    ).toBeVisible();
    await expect(loadingPage.getByText('42 patients', { exact: true })).toBeVisible();
    await loadingPage.close();
  });

  test('preserves creation and duplicate-phone reconciliation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Creation paths are certified once on desktop.');
    const { creates } = await preparePatients(page);
    await page.goto('/doctor/patients');

    await page.getByRole('button', { name: 'Ajouter un patient' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('#add-patient-last-name').fill('Essai');
    await dialog.locator('#add-patient-first-name').fill('Nour');
    await dialog.locator('#add-patient-dob').fill('1994-05-18');
    await dialog.locator('#add-patient-sex').fill('F');
    await dialog.locator('#add-patient-phone').fill('+216 21 555 404');
    await dialog.locator('#add-patient-email').fill('nour.essai@example.test');
    await dialog.locator('#add-patient-address').fill('10 rue de Tunis');
    await dialog.getByRole('button', { name: 'Créer le patient' }).click();
    await expect(page.getByText(/Nour Essai a été ajouté/)).toBeVisible();
    expect(creates.at(-1)).toEqual({
      firstName: 'Nour',
      lastName: 'Essai',
      dateOfBirth: '1994-05-18',
      sex: 'F',
      phone: '+216 21 555 404',
      email: 'nour.essai@example.test',
      address: '10 rue de Tunis',
    });

    await page.getByRole('button', { name: 'Ajouter un patient' }).click();
    dialog = page.getByRole('dialog');
    await dialog.locator('#add-patient-last-name').fill('Doublon');
    await dialog.locator('#add-patient-first-name').fill('Patient');
    await dialog.locator('#add-patient-dob').fill('1990-01-01');
    await dialog.locator('#add-patient-sex').fill('M');
    await dialog.locator('#add-patient-phone').fill('+216 99 000 000');
    await dialog.getByRole('button', { name: 'Créer le patient' }).click();
    await expect(dialog.getByText('Numéro déjà utilisé')).toBeVisible();
    await dialog.getByRole('button', { name: 'Voir le dossier existant' }).click();
    await expect(page).toHaveURL(/\/doctor\/patient\/practice-patient-existing$/);
  });
});
