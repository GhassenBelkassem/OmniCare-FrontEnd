import { type Page, type Route } from '@playwright/test';

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const doctorProfilePayload = {
  userId: 'e2e-doctor',
  firstName: 'Ben',
  lastName: 'Salah',
  displayName: 'Dr Ben Salah',
  photoUrl: null,
  professionalLicenseNumber: 'LIC-2020-001',
  specialty: 'Medecine generale',
  governorate: 'Tunis',
  affiliatedClinicId: 'clinic-9',
  affiliatedClinicName: null,
  alsoIndependent: true,
  verifiedAt: '2026-01-10T00:00:00.000Z',
  mfaMethod: 'none',
  consultationPriceTnd: 80,
  experienceYears: 12,
  practiceLatitude: 36.8065,
  practiceLongitude: 10.1815,
  practiceCity: 'Tunis',
  acceptingNewPatients: true,
  subSpecialties: [],
  languages: ['Francais'],
  areasOfCare: [],
  expertise: [],
  visitReasons: [],
  patientAgeGroups: ['Adultes'],
  consultationTypes: [],
  biography: 'Medecin generaliste a Tunis.',
  updatedAt: '2026-09-01T09:00:00.000Z',
  revision: 1,
};

export const doctorReadinessPayload = {
  publicDirectory: { discoverable: true, blockingReasons: [] },
  cabinet: {
    discoverable: true,
    capabilityEnabled: true,
    activeCabinetCount: 1,
    blockingReasons: [],
  },
  acceptingNewPatients: true,
  professionalVerification: {
    verified: true,
    verifiedAt: '2026-10-05T08:30:00.000Z',
  },
  evaluatedAt: '2026-10-05T09:00:00.000Z',
};

/** Browser-only isolation fixture: no real authentication or API data. */
export async function prepareSyntheticDoctor(
  page: Page,
  overrides: {
    profile?: typeof doctorProfilePayload;
    readiness?: typeof doctorReadinessPayload;
  } = {},
): Promise<{ patchBodies: Record<string, unknown>[]; profileGets: () => number }> {
  const current = structuredClone(overrides.profile ?? doctorProfilePayload);
  const readiness = structuredClone(overrides.readiness ?? doctorReadinessPayload);
  const patchBodies: Record<string, unknown>[] = [];
  let profileGetCount = 0;

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
    if (pathname.endsWith('/auth/refresh')) {
      return json(route, 200, {
        accessToken: 'e2e-access-token',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        refreshToken: 'e2e-refresh-token',
        refreshExpiresAt: new Date(Date.now() + 60 * 60 * 1000 * 24).toISOString(),
        user: { id: 'e2e-doctor', role: 'DOCTOR', mustChangePassword: false },
      });
    }
    if (pathname.endsWith('/urgent-requests/availability')) {
      return json(route, 200, {
        acceptsHomeVisits: false,
        acceptsCabinetVisits: false,
        availableForUrgent: false,
      });
    }
    if (pathname.endsWith('/notifications/unread-count')) {
      return json(route, 200, { unreadCount: 0 });
    }
    if (pathname.endsWith('/appointments/availability/rules')) {
      return json(route, 200, []);
    }
    if (pathname.endsWith('/appointments/availability/exceptions')) {
      return json(route, 200, []);
    }
    if (pathname.endsWith('/me/professional-readiness')) {
      return json(route, 200, readiness);
    }
    if (pathname.endsWith('/me/professional-profile')) {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        patchBodies.push(body);
        Object.assign(current, body);
        return json(route, 200, current);
      }
      profileGetCount += 1;
      return json(route, 200, current);
    }
    return json(route, 200, {});
  });

  return {
    patchBodies,
    profileGets: () => profileGetCount,
  };
}
