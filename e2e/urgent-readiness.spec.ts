import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { prepareSyntheticDoctor } from './doctor-profile-e2e-fixture';

const screenshotRoot = '/private/tmp/ang-p4-04-r1';

const exactConfiguration = (
  revision = 4,
  homeFee = '75.000',
  distance = '20.500000',
  cabinetFee: string | null = '60.000',
) =>
  `{"revision":${revision},"home":{"consultationFeeTnd":${homeFee},"feeConfigured":true,"maxTravelKm":${distance},"maxTravelDistanceConfigured":true},"cabinet":{"consultationFeeTnd":${cabinetFee ?? 'null'},"feeConfigured":${cabinetFee !== null}}}`;

const readiness = {
  revision: 4,
  professionalEligible: true,
  home: {
    capabilityEnabled: true,
    configurationReady: false,
    runtimeAvailabilityIntent: false,
    effectiveCurrentEligibility: false,
    blockingReasons: [
      'HOME_TRAVEL_DISTANCE_NOT_CONFIGURED',
      'REQUEST_SPECIFIC_ELIGIBILITY_NOT_EVALUATED',
    ],
  },
  cabinet: {
    capabilityEnabled: true,
    configurationReady: true,
    runtimeAvailabilityIntent: false,
    effectiveCurrentEligibility: false,
    blockingReasons: ['REQUEST_SPECIFIC_ELIGIBILITY_NOT_EVALUATED'],
  },
  completeLiveMatchingEligibilityEvaluated: false,
  evaluatedAt: '2026-10-15T10:00:00Z',
};

interface UrgentSettingsOptions {
  readonly activeCabinet?: boolean;
  readonly configuration?: string;
  readonly configurationAfterConflict?: string;
  readonly conflictOnSave?: boolean;
  readonly readinessUnavailableInitially?: boolean;
  readonly readinessUnavailableAfterFirst?: boolean;
}

async function prepareCurrentUrgentSettings(
  page: Page,
  options: UrgentSettingsOptions = {},
): Promise<void> {
  await prepareSyntheticDoctor(page);
  let configurationReads = 0;
  let readinessReads = 0;

  await page.route('**/api/v1/me/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname.endsWith('/me/care-capabilities/urgent-configuration/readiness')) {
      readinessReads += 1;
      if (
        options.readinessUnavailableInitially ||
        (options.readinessUnavailableAfterFirst && readinessReads > 1)
      ) {
        return route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({ code: 'URGENT_RUNTIME_UNAVAILABLE' }),
        });
      }
      return json(route, readiness);
    }

    if (pathname.endsWith('/me/care-capabilities/urgent-configuration')) {
      if (request.method() === 'PUT') {
        if (options.conflictOnSave) {
          return route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({ code: 'RESOURCE_STATE_CONFLICT' }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: options.configuration ?? exactConfiguration(),
        });
      }
      configurationReads += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body:
          configurationReads > 1 && options.configurationAfterConflict
            ? options.configurationAfterConflict
            : (options.configuration ?? exactConfiguration()),
      });
    }

    if (pathname.endsWith('/me/care-capabilities')) {
      return json(route, {
        revision: 4,
        capabilities: ['CABINET', 'HOME_VISIT', 'URGENT_HOME', 'URGENT_CABINET'],
      });
    }

    if (pathname.endsWith('/me/practice-locations')) {
      return json(
        route,
        options.activeCabinet === false
          ? []
          : [
              {
                id: 'cab-e2e-lac',
                type: 'CABINET',
                name: 'Cabinet Démo Lac',
                governorate: 'Tunis',
                city: 'Tunis',
                address: 'Adresse synthétique',
                latitude: 36.8065,
                longitude: 10.1815,
                publicPhone: null,
                wheelchairAccessible: true,
                patientInstructions: null,
                primary: true,
                active: true,
                revision: 1,
                createdAt: '2026-10-01T08:00:00Z',
                updatedAt: '2026-10-01T08:00:00Z',
                gallery: [],
              },
            ],
      );
    }

    if (pathname.endsWith('/me/equipment')) {
      const stethoscope = {
        code: 'STETHOSCOPE',
        displayName: 'Stéthoscope',
        portable: true,
        active: true,
      };
      return json(route, { catalog: [stethoscope], mobile: { revision: 2, equipment: [] } });
    }

    return route.fallback();
  });
}

async function openServices(page: Page, options: UrgentSettingsOptions = {}): Promise<void> {
  await prepareCurrentUrgentSettings(page, options);
  await page.goto('/doctor/settings?tab=services');
  await expect(page.getByRole('heading', { name: 'Services', level: 2 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Services' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
}

async function prepareSyntheticScheduledCare(page: Page): Promise<void> {
  await prepareSyntheticDoctor(page);
  await page.route('**/api/v1/doctor/scheduled-care*', (route) =>
    json(route, {
      generatedAt: '2026-10-15T10:00:00Z',
      from: '2026-10-14T00:00:00Z',
      to: '2026-12-15T00:00:00Z',
      items: [],
    }),
  );
}

test('keeps the compatibility route read-only and points to the single Services editor', async ({
  page,
}) => {
  await prepareCurrentUrgentSettings(page);
  await page.goto('/doctor/urgent-readiness');

  await expect(
    page.getByRole('heading', { name: 'Préparation aux urgences', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Une seule source de préparation' }),
  ).toBeVisible();
  await expect(page.locator('.urgent-readiness-route form')).toHaveCount(0);
  await expect(page.locator('app-urgent-care-configuration-settings')).toHaveCount(0);
  await expect(page.getByText(/ne présente plus de disponibilité/)).toBeVisible();

  await page.getByRole('button', { name: 'Ouvrir les paramètres Services' }).click();
  await expect(page).toHaveURL(/\/doctor\/settings\?tab=services$/);
  await expect(
    page.getByRole('heading', { name: 'Configuration permanente des urgences' }),
  ).toBeVisible();
});

test('keeps the shared Doctor shell and P3 Requests and Calendar layouts intact', async ({
  page,
}) => {
  await prepareSyntheticScheduledCare(page);
  await page.goto('/doctor/requests');
  await expect(page.getByRole('heading', { name: 'Demandes', level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((node) => node.clientWidth),
  );

  if (test.info().project.name === 'desktop') {
    await page.screenshot({ path: `${screenshotRoot}/doctor-p3-requests.png`, fullPage: true });
  }

  await page.goto('/doctor/calendar');
  await expect(page).toHaveURL(/\/doctor\/calendar$/);
  await expect(page.locator('oc-calendar-page')).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('html').evaluate((node) => node.clientWidth),
  );

  if (test.info().project.name === 'desktop') {
    await page.screenshot({ path: `${screenshotRoot}/doctor-p3-calendar.png`, fullPage: true });
  }
});

test('renders the three V1 capabilities, exact HOME/CABINET decimals and backend readiness', async ({
  page,
}) => {
  await openServices(page);

  await expect(page.getByRole('switch')).toHaveCount(3);
  for (const name of ['Consultation au cabinet', 'Urgence à domicile', 'Urgence au cabinet']) {
    await expect(page.getByRole('switch', { name })).toBeVisible();
  }
  await expect(page.getByRole('switch', { name: 'Visite à domicile' })).toHaveCount(0);
  await expect(page.getByLabel('Tarif de consultation à domicile')).toHaveValue('75.000');
  await expect(page.getByLabel('Distance maximale d’intervention')).toHaveValue('20.500000');
  await expect(page.getByLabel('Tarif de consultation urgente au cabinet')).toHaveValue('60.000');
  await expect(page.getByText('Distance HOME non configurée')).toBeVisible();
  await expect(page.getByText('Vérification complète non effectuée')).toHaveCount(2);
  await expect(page.getByText(/Ce statut ne signifie pas que vous êtes disponible/)).toBeVisible();
  await expect(page.getByText(/Révision 4 · Configuration enregistrée/)).toBeVisible();
});

test('preserves explicit zero, null and the active-Cabinet prerequisite', async ({ page }) => {
  await openServices(page, {
    activeCabinet: false,
    configuration:
      '{"revision":4,"home":{"consultationFeeTnd":0.000,"feeConfigured":true,"maxTravelKm":20.500000,"maxTravelDistanceConfigured":true},"cabinet":{"consultationFeeTnd":null,"feeConfigured":false}}',
  });

  await expect(page.getByLabel('Tarif de consultation à domicile')).toHaveValue('0.000');
  await expect(page.getByLabel('Distance maximale d’intervention')).toHaveValue('20.500000');
  await expect(page.getByLabel('Tarif de consultation urgente au cabinet')).toHaveValue('');
  await expect(
    page.getByText('Un cabinet actif est requis pour activer URGENT_CABINET.'),
  ).toBeVisible();
});

test('keeps the unsaved draft through shared-revision conflict reconciliation', async ({
  page,
}) => {
  await openServices(page, {
    conflictOnSave: true,
    configurationAfterConflict: exactConfiguration(7, '75.000', '30.000000', '65.000'),
  });

  const homeFee = page.getByLabel('Tarif de consultation à domicile');
  await homeFee.fill('90.000');
  await page.getByRole('button', { name: 'Enregistrer la configuration urgente' }).click();
  await expect(page.getByText(/modifiée ailleurs/)).toBeVisible();
  await expect(homeFee).toHaveValue('90.000');

  await page.getByRole('button', { name: 'Réconcilier avec le serveur' }).click();
  await expect(homeFee).toHaveValue('90.000');
  await expect(page.getByLabel('Distance maximale d’intervention')).toHaveValue('30.000000');
  await expect(page.getByLabel('Tarif de consultation urgente au cabinet')).toHaveValue('65.000');
  await expect(page.getByText('Modifications non enregistrées.')).toBeVisible();

  if (test.info().project.name === 'desktop') {
    await page.screenshot({
      path: `${screenshotRoot}/services-revision-conflict.png`,
      fullPage: true,
    });
  }
});

test('marks stale readiness after a failed refresh', async ({ page }) => {
  await openServices(page, { readinessUnavailableAfterFirst: true });
  await page.getByRole('button', { name: 'Actualiser', exact: true }).click();
  await expect(page.getByText('État non vérifié')).toBeVisible();
  await expect(page.getByText(/dernière réponse vérifiée reste affichée/)).toBeVisible();

  if (test.info().project.name === 'desktop') {
    await page.screenshot({
      path: `${screenshotRoot}/services-readiness-stale.png`,
      fullPage: true,
    });
  }
});

test('shows backend unavailable without synthetic readiness values', async ({ page }) => {
  await openServices(page, { readinessUnavailableInitially: true });
  await expect(page.getByText('Préparation impossible à vérifier')).toBeVisible();
  await expect(page.getByText(/Aucune valeur de remplacement/)).toBeVisible();

  if (test.info().project.name === 'desktop') {
    await page.screenshot({
      path: `${screenshotRoot}/services-backend-unavailable.png`,
      fullPage: true,
    });
  }
});

test('keeps selected tabs visible, keyboard reachable and content contained at required widths', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'One project certifies the full width matrix.');
  await openServices(page);

  for (const width of [1440, 1024, 768, 720, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/doctor/settings?tab=services');
    await expect(page.getByRole('heading', { name: 'Services', level: 2 })).toBeVisible();

    const layout = await page.evaluate(() => {
      const settings = document.querySelector<HTMLElement>('.settings-page');
      const strip = document.querySelector<HTMLElement>('.oc-tabs ul');
      const selected = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      const urgent = document.querySelector<HTMLElement>('.urgent-configuration');
      const fields = [...document.querySelectorAll<HTMLElement>('.urgent-configuration__input')];
      const doctorLayout = document.querySelector<HTMLElement>('.doctor-layout');
      const doctorShell = document.querySelector<HTMLElement>('.doctor-shell');
      const workspace = document.querySelector<HTMLElement>('.workspace');
      if (!settings || !strip || !selected || !urgent) throw new Error('Settings surface missing');
      const settingsBox = settings.getBoundingClientRect();
      const stripBox = strip.getBoundingClientRect();
      const selectedBox = selected.getBoundingClientRect();
      const urgentBox = urgent.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        doctorLayoutWidth: doctorLayout?.getBoundingClientRect().width,
        doctorLayoutColumns: doctorLayout ? getComputedStyle(doctorLayout).gridTemplateColumns : '',
        doctorShellWidth: doctorShell?.getBoundingClientRect().width,
        doctorShellCssWidth: doctorShell ? getComputedStyle(doctorShell).width : '',
        workspaceWidth: workspace?.getBoundingClientRect().width,
        workspaceCss: workspace
          ? {
              width: getComputedStyle(workspace).width,
              minWidth: getComputedStyle(workspace).minWidth,
              maxWidth: getComputedStyle(workspace).maxWidth,
              padding: getComputedStyle(workspace).padding,
              margin: getComputedStyle(workspace).margin,
              gridColumn: getComputedStyle(workspace).gridColumn,
            }
          : null,
        settingsLeft: settingsBox.left,
        settingsRight: settingsBox.right,
        selectedLeft: selectedBox.left,
        selectedRight: selectedBox.right,
        stripLeft: stripBox.left,
        stripRight: stripBox.right,
        urgentLeft: urgentBox.left,
        urgentRight: urgentBox.right,
        fieldsContained: fields.every((field) => {
          const box = field.getBoundingClientRect();
          return box.left >= urgentBox.left && box.right <= urgentBox.right;
        }),
      };
    });

    expect(
      layout.documentWidth,
      `${width}px page overflow: ${JSON.stringify(layout)}`,
    ).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.settingsLeft).toBeGreaterThanOrEqual(0);
    expect(layout.settingsRight).toBeLessThanOrEqual(width);
    expect(layout.urgentLeft).toBeGreaterThanOrEqual(layout.settingsLeft);
    expect(layout.urgentRight).toBeLessThanOrEqual(layout.settingsRight);
    expect(layout.selectedLeft).toBeGreaterThanOrEqual(layout.stripLeft);
    expect(layout.selectedRight).toBeLessThanOrEqual(layout.stripRight);
    expect(layout.fieldsContained).toBe(true);

    await page.screenshot({ path: `${screenshotRoot}/services-${width}.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/doctor/settings?tab=services');
  const servicesTab = page.getByRole('tab', { name: 'Services' });
  await servicesTab.focus();
  await expect(servicesTab).toBeFocused();
  await servicesTab.press('ArrowLeft');
  await expect(page).toHaveURL(/tab=schedule/);
  await expect(page.getByRole('tab', { name: 'Emploi du temps' })).toBeFocused();
  await page.getByRole('tab', { name: 'Emploi du temps' }).press('ArrowRight');
  await expect(page).toHaveURL(/tab=services/);
  await expect(page.getByRole('tab', { name: 'Services' })).toBeFocused();

  await page.getByLabel('Tarif de consultation à domicile').fill('-1.000');
  await page.getByLabel('Tarif de consultation à domicile').blur();
  await expect(page.getByText('Saisissez une valeur positive ou nulle.')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: `${screenshotRoot}/services-validation-readiness.png`,
    fullPage: true,
  });
});

test('passes serious and critical WCAG checks on the current Services surface', async ({
  page,
}) => {
  await openServices(page);
  const contrast = await page.evaluate(() => {
    const selectors = {
      activeTab: '.oc-tabs__item--active',
      configurationStatus: '.urgent-configuration__actions',
      readinessEyebrow: '.urgent-readiness__eyebrow',
      readinessMetadata: '.urgent-readiness__metadata',
      equipmentGuidance: '.equipment-settings__context',
      equipmentDescription: '.equipment-settings__description',
    } as const;
    const channel = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
      if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${color}`);
      return (
        0.2126 * channel(channels[0]!) +
        0.7152 * channel(channels[1]!) +
        0.0722 * channel(channels[2]!)
      );
    };
    const background = (element: HTMLElement) => {
      let current: HTMLElement | null = element;
      while (current) {
        const value = getComputedStyle(current).backgroundColor;
        if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
        current = current.parentElement;
      }
      return 'rgb(255, 255, 255)';
    };

    return Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing contrast target: ${selector}`);
        const foreground = getComputedStyle(element).color;
        const surface = background(element);
        const foregroundLuminance = luminance(foreground);
        const backgroundLuminance = luminance(surface);
        const ratio =
          (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
        return [name, Number(ratio.toFixed(2))];
      }),
    );
  });
  console.info(`ANG-P4-04-R1 contrast ${JSON.stringify(contrast)}`);
  for (const [name, ratio] of Object.entries(contrast)) {
    expect(ratio, `${name} contrast`).toBeGreaterThanOrEqual(4.5);
  }

  const results = await new AxeBuilder({ page })
    .include('.settings-page')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations
    .filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
    .flatMap((item) => item.nodes.map((node) => `${item.id}:${node.target.join(' ')}`));

  expect(violations).toEqual([]);
});

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
