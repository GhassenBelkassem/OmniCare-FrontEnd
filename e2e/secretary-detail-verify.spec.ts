import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

type Member = Record<string, unknown>;

const NAMED_ACTIVE: Member = {
  membershipId: 'mem-active',
  secretaryUserId: 'user-active',
  firstName: 'Amira',
  lastName: 'Ben Salah',
  email: 'amira@cabinet.tn',
  status: 'ACTIVE',
  permissions: ['VIEW_AGENDA', 'CREATE_APPOINTMENT', 'VIEW_PATIENT_CONTACT'],
  invitedAt: '2026-08-01T09:00:00Z',
  activatedAt: '2026-08-02T09:00:00Z',
  suspendedAt: null,
  endedAt: null,
  version: 3,
  invitationExpiresAt: null,
};

const NAMELESS_INVITED: Member = {
  ...NAMED_ACTIVE,
  membershipId: 'mem-invited',
  secretaryUserId: null,
  firstName: null,
  lastName: null,
  email: 'invited@cabinet.tn',
  status: 'INVITED',
  permissions: ['RESCHEDULE_APPOINTMENT'],
  activatedAt: null,
  version: 0,
  invitationExpiresAt: '2026-10-20T09:00:00Z',
};

const ENDED: Member = {
  ...NAMED_ACTIVE,
  membershipId: 'mem-ended',
  firstName: 'Sami',
  lastName: 'Trabelsi',
  email: 'sami@cabinet.tn',
  status: 'ENDED',
  endedAt: '2026-09-01T09:00:00Z',
};

const members: Member[] = [NAMED_ACTIVE, NAMELESS_INVITED, ENDED];

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const patchBodies: Record<string, unknown>[] = [];
const inviteBodies: Record<string, unknown>[] = [];
let detailGets = 0;

async function prepare(page: Page): Promise<void> {
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
    const request = route.request();
    const { pathname } = new URL(request.url());

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
    if (pathname.endsWith('/notifications/unread-count')) return json(route, 200, { unreadCount: 0 });

    if (pathname === '/api/v1/me/secretaries') {
      return json(route, 200, members.map(({ firstName: _f, lastName: _l, ...rest }) => rest));
    }
    if (pathname.endsWith('/invitations') && request.method() === 'POST') {
      inviteBodies.push(request.postDataJSON() as Record<string, unknown>);
      return json(route, 201, {
        membershipId: 'mem-new',
        secretaryUserId: 'user-new',
        email: (request.postDataJSON() as { email: string }).email,
        status: 'INVITED',
        permissions: ['VIEW_AGENDA', 'CREATE_APPOINTMENT', 'VIEW_PATIENT_CONTACT'],
        invitationExpiresAt: '2026-10-20T09:00:00Z',
      });
    }

    const permissionPatch = /\/api\/v1\/me\/secretaries\/([^/]+)\/permissions$/.exec(pathname);
    if (permissionPatch) {
      const id = permissionPatch[1];
      patchBodies.push(request.postDataJSON() as Record<string, unknown>);
      const updated = members.find((m) => m['membershipId'] === id)!;
      updated['permissions'] = (request.postDataJSON() as { permissions: string[] }).permissions;
      updated['version'] = Number(updated['version']) + 1;
      return json(route, 200, updated);
    }

    const detail = /\/api\/v1\/me\/secretaries\/([^/]+)$/.exec(pathname);
    if (detail) {
      detailGets += 1;
      return json(route, 200, members.find((m) => m['membershipId'] === detail[1]));
    }

    const action = /\/api\/v1\/me\/secretaries\/[^/]+\/(suspension|end|invitation\/resend)$/.exec(
      pathname,
    );
    if (action) return json(route, 200, {});

    return json(route, 200, {});
  });
}

/**
 * The ng-zorro multiple-select keeps its options in a body-level overlay that this
 * viewport places outside the hit-test area, so the option is picked through the
 * control's own search-and-Enter path instead of a coordinate click. The tag count
 * asserted by the caller is what proves the selection took effect.
 */
async function chooseOption(page: Page, label: string): Promise<void> {
  const selector = page.locator('.ant-select-selector').first();
  await selector.scrollIntoViewIfNeeded();
  // Forced because the shell sidebar overlays the control on the narrow viewport; the
  // assertions on the resulting tags are what prove the interaction worked.
  await selector.click({ force: true });
  await page.keyboard.type(label);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
}

test.beforeEach(() => {
  patchBodies.length = 0;
  inviteBodies.length = 0;
  detailGets = 0;
  for (const member of members) {
    member['permissions'] = [...(NAMED_ACTIVE['permissions'] as string[])];
  }
});

test('the list links each delegation to its detail view', async ({ page }, testInfo: TestInfo) => {
  await prepare(page);
  await page.goto('/doctor/team');

  await expect(page.getByRole('link', { name: 'View details for amira@cabinet.tn' })).toHaveAttribute(
    'href',
    '/doctor/team/mem-active',
  );
  await expect(page.locator('.team-card')).toHaveCount(3);
  // Lifecycle buttons used to live on each row.
  await expect(page.getByRole('button', { name: 'End access' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('secretary-list.png'), fullPage: true });

  await page.getByRole('link', { name: 'View details for amira@cabinet.tn' }).click();
  await expect(page).toHaveURL(/\/doctor\/team\/mem-active$/);

  await expect(page.getByRole('heading', { name: 'Amira Ben Salah' })).toBeVisible();
  await expect(page.getByText('amira@cabinet.tn').first()).toBeVisible();
  for (const heading of ['Identity', 'Permissions', 'History', 'Access']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.locator('.team-detail__permission')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('secretary-detail.png'), fullPage: true });
});

test('clicking the visible "View details" label on a row navigates', async ({ page }) => {
  // Regression: the label was a sibling <p> of the anchor, so the card advertised a link the
  // doctor could not reach -- hovering showed the right URL, clicking did nothing (no
  // navigation, no request, no console error). Asserting the href passes in that broken state,
  // so this clicks the label itself, on every row.
  await prepare(page);
  await page.goto('/doctor/team');

  for (const [email, membershipId] of [
    ['amira@cabinet.tn', 'mem-active'],
    ['invited@cabinet.tn', 'mem-invited'],
    ['sami@cabinet.tn', 'mem-ended'],
  ] as const) {
    const label = page
      .locator('.team-card', { hasText: email })
      .locator('.team-card__cta');
    await expect(label, `no "View details" label on the ${email} card`).toHaveCount(1);
    await expect(label).toHaveText('View details and manage access');

    const requestsBefore = detailGets;
    // Forced for the same reason chooseOption() is: the shell sidebar overlays the page on
    // the 390px viewport. The assertions below are what prove the click reached the anchor.
    await label.click({ force: true });

    await expect(page).toHaveURL(new RegExp(`/doctor/team/${membershipId}$`));
    // The detail request really went out, so the click navigated rather than just moving the URL.
    expect(detailGets, `no detail request after clicking the ${email} label`).toBeGreaterThan(
      requestsBefore,
    );
    await expect(page.getByRole('link', { name: /Back to my team/ })).toBeVisible();

    await page.goto('/doctor/team');
  }
});

test('saving permissions sends the whole set and re-reads from the server', async ({ page }, testInfo: TestInfo) => {
  await prepare(page);
  await page.goto('/doctor/team/mem-active');

  const getsBefore = detailGets;
  await page.getByRole('button', { name: 'Manage permissions' }).click();

  // Seeded with the server's current set, not an empty control.
  await expect(page.locator('.ant-select-selection-item')).toHaveCount(3);

  await chooseOption(page, 'Cancel appointments');
  // The new tag is proof the option was picked up, not just that the click was sent.
  await expect(page.locator('.team-detail__permission-form .ant-select-selection-item')).toHaveCount(4);

  await page.getByRole('button', { name: 'Save permissions' }).click();

  expect(patchBodies).toHaveLength(1);
  expect(patchBodies[0]['permissions']).toEqual([
    'VIEW_AGENDA',
    'CREATE_APPOINTMENT',
    'VIEW_PATIENT_CONTACT',
    'CANCEL_APPOINTMENT',
  ]);
  // Re-read rather than trusting the request: detailGets rises after the PATCH.
  expect(detailGets).toBeGreaterThan(getsBefore);

  await expect(page.getByText('Permissions updated.')).toBeVisible();
  await expect(page.locator('.team-detail__permission')).toHaveCount(4);
  await expect(page.locator('.team-detail__permission', { hasText: 'Cancel appointments' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('secretary-permissions-saved.png'), fullPage: true });
});

test('an ended delegation cannot be edited and says why', async ({ page }) => {
  await prepare(page);
  await page.goto('/doctor/team/mem-ended');

  await expect(page.getByRole('heading', { name: 'Sami Trabelsi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage permissions' })).toHaveCount(0);
  await expect(page.getByText('no longer be changed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'End access' })).toHaveCount(0);
  await expect(page.getByText('No further action is available')).toBeVisible();
});

test('a delegation invited before names existed falls back to the email', async ({ page }, testInfo: TestInfo) => {
  await prepare(page);
  await page.goto('/doctor/team/mem-invited');

  await expect(page.getByRole('heading', { name: 'invited@cabinet.tn' })).toBeVisible();
  await expect(page.getByText('Not provided')).toHaveCount(2);
  await expect(page.getByText('Invitation expires')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend invitation' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('secretary-detail-nameless.png'), fullPage: true });
});

test('the invite form captures an optional name without inventing the other one', async ({ page }, testInfo: TestInfo) => {
  await prepare(page);
  await page.goto('/doctor/team');

  await page.getByRole('button', { name: 'Invite a secretary' }).first().click();
  await page.locator('#invite-email').fill('new.secretary@cabinet.tn');
  await page.locator('#invite-first-name').fill('Nour');

  await page.locator('.team-page__form nz-select').click();
  await chooseOption(page, 'View agenda');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Send invitation' }).click();

  await expect(page.getByText('An invitation was sent to')).toBeVisible();
  expect(inviteBodies).toHaveLength(1);
  expect(inviteBodies[0]).toEqual({
    email: 'new.secretary@cabinet.tn',
    permissions: ['VIEW_AGENDA'],
    firstName: 'Nour',
  });
  expect(inviteBodies[0]).not.toHaveProperty('lastName');
  await page.screenshot({ path: testInfo.outputPath('secretary-invite-named.png'), fullPage: true });
});